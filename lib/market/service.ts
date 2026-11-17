import "server-only";
import {
  analyzeCompetition,
  analyzePresale,
  analyzeRent,
  classifyNotices,
  summarizeCompetition,
  summarizeSupply,
  toSupplyTypes,
  type CompetitionType,
  type NoticeRow,
  type SupplyType,
} from "./analyze";
import { daysAgo, kstDate, kstDateTime, mapLimit, parseXmlHeader, parseXmlItems, recentMonths } from "./util";

const DAY = 86400;

/** 인천 서구는 2026-07-01 서해구·검단구로 개편 — 개편 전 기간은 옛 시군구코드로도 조회한다 */
const LEGACY_SGG: { when: RegExp; code: string; label: string }[] = [
  { when: /인천광역시\s*(서구|서해구|검단구)/, code: "28260", label: "인천광역시 서구 (개편 전 코드)" },
];

function serviceKey(): string | null {
  const k = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!k) return null;
  return k.includes("%") ? k : encodeURIComponent(k);
}

class SourceError extends Error {
  constructor(public source: string, message: string) {
    super(message);
  }
}

async function getText(url: string, source: string): Promise<string> {
  const res = await fetch(url, {
    next: { revalidate: DAY },
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json, application/xml;q=0.9" },
  });
  const body = await res.text();
  if (!res.ok) throw new SourceError(source, `HTTP ${res.status}`);
  return body;
}

/* ───────── ⓪ 법정동코드 ───────── */

type RegionRow = { region_cd: string; locatadd_nm: string; locallow_nm: string; umd_cd: string; ri_cd: string };

async function fetchRegion(key: string, q: string): Promise<RegionRow[]> {
  const url =
    `https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList?serviceKey=${key}` +
    `&type=json&pageNo=1&numOfRows=200&locatadd_nm=${encodeURIComponent(q)}`;
  const text = await getText(url, "법정동코드");
  if (text.trim().startsWith("<")) {
    const h = parseXmlHeader(text);
    throw new SourceError("법정동코드", h.msg || "XML 오류 응답");
  }
  const json = JSON.parse(text);
  const block = json?.StanReginCd;
  if (!Array.isArray(block)) {
    const msg = json?.RESULT?.resultMsg;
    if (msg && /없습니다/.test(msg)) return [];
    throw new SourceError("법정동코드", msg ?? "응답 형식 오류");
  }
  const rows = block.find((b: Record<string, unknown>) => Array.isArray(b.row))?.row ?? [];
  return rows as RegionRow[];
}

export async function resolveRegion(key: string, input: string) {
  const dong = input.split(" ").reverse().find((t) => /동$/.test(t)) ?? input.split(" ").pop()!;
  let rows = await fetchRegion(key, input);
  let query = input;
  if (!rows.length && dong !== input) {
    rows = await fetchRegion(key, dong);
    query = dong;
  }
  const matched = rows.filter(
    (r) => (r.locallow_nm ?? "").trim() === dong && r.ri_cd === "00" && r.umd_cd !== "000",
  );
  const codes = new Map<string, { code: string; label: string; source: "api" | "legacy" }>();
  for (const r of matched) {
    const sgg = r.region_cd.slice(0, 5);
    const label = r.locatadd_nm.split(" ").slice(0, 2).join(" ");
    if (!codes.has(sgg)) codes.set(sgg, { code: sgg, label, source: "api" });
  }
  const names = matched.map((r) => r.locatadd_nm).join(" | ") + " " + input;
  for (const l of LEGACY_SGG) {
    if (l.when.test(names) && !codes.has(l.code)) codes.set(l.code, { code: l.code, label: l.label, source: "legacy" });
  }
  const warnings: string[] = [];
  if (!matched.length) warnings.push(`법정동코드 API에서 ‘${dong}’ 읍면동 행을 찾지 못함`);
  if (matched.length && matched.every((r) => r.region_cd.startsWith("28260")))
    warnings.push("API가 개편 전 코드(28260)만 반환 — 2026-07 이후 신규 코드 거래가 누락될 수 있음");
  const sggKeywords = new Set<string>();
  for (const r of matched) sggKeywords.add(r.locatadd_nm.split(" ")[1] ?? "");
  if ([...codes.values()].some((c) => c.source === "legacy")) sggKeywords.add("서구");
  sggKeywords.delete("");
  return {
    query,
    dong,
    matched: matched.map((r) => ({ code: r.region_cd, name: r.locatadd_nm })),
    codes: [...codes.values()],
    sggKeywords: [...sggKeywords],
    warnings,
  };
}

/* ───────── ①② 국토교통부 실거래가 ───────── */

async function fetchRtms(key: string, svc: "SilvTrade" | "AptRent", code: string, ym: string) {
  const op = svc === "SilvTrade" ? "RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade" : "RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
  const source = svc === "SilvTrade" ? "분양권전매" : "전월세";
  const items: Record<string, string>[] = [];
  let page = 1;
  for (;;) {
    const url = `https://apis.data.go.kr/1613000/${op}?serviceKey=${key}&LAWD_CD=${code}&DEAL_YMD=${ym}&pageNo=${page}&numOfRows=1000`;
    const xml = await getText(url, source);
    const h = parseXmlHeader(xml);
    if (h.code && !/^0+$/.test(h.code)) throw new SourceError(source, `${h.code} ${h.msg}`);
    if (!h.code && !xml.includes("<items")) throw new SourceError(source, h.msg || "응답 형식 오류");
    items.push(...parseXmlItems(xml));
    if (items.length >= h.total || page >= 10) break;
    page++;
  }
  return items;
}

/* ───────── ③④ 청약홈 (odcloud) ───────── */

async function odcloud(key: string, path: string, params: Record<string, string>, perPage = 500) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const source = path.includes("Cmpet") ? "청약홈 경쟁률" : "청약홈 분양정보";
  const url = `https://api.odcloud.kr/api/${path}?page=1&perPage=${perPage}&serviceKey=${key}${qs ? "&" + qs : ""}`;
  const text = await getText(url, source);
  const json = JSON.parse(text);
  if (!Array.isArray(json?.data)) throw new SourceError(source, json?.msg ?? "응답 형식 오류");
  return json.data as NoticeRow[];
}

async function noticesSince(key: string, path: string, since: string, area?: string) {
  const cond: Record<string, string> = { "cond[RCRIT_PBLANC_DE::GTE]": since };
  if (area) cond["cond[SUBSCRPT_AREA_CODE_NM::EQ]"] = area;
  try {
    return await odcloud(key, path, cond, 1000);
  } catch {
    // 일부 엔드포인트는 날짜 조건을 지원하지 않는다 → 조건 없이 받아 로컬 필터
    const rows = await odcloud(key, path, area ? { "cond[SUBSCRPT_AREA_CODE_NM::EQ]": area } : {}, 1000);
    return rows.filter((r) => String(r.RCRIT_PBLANC_DE ?? "") >= since);
  }
}

/* ───────── 종합 ───────── */

export type SourceLog = { source: string; calls: number; rows: number; error?: string };

export async function buildMarket(region: string) {
  const key = serviceKey();
  const fetchedAt = kstDateTime();
  if (!key) return { status: "no_key" as const, fetchedAt, region };

  const logs: Record<string, SourceLog> = {};
  const log = (source: string, rows: number, error?: string) => {
    const l = (logs[source] ??= { source, calls: 0, rows: 0 });
    l.calls++;
    l.rows += rows;
    if (error && !l.error) l.error = error;
  };
  const safe = async <T>(source: string, fn: () => Promise<T[]>): Promise<T[]> => {
    try {
      const r = await fn();
      log(source, r.length);
      return r;
    } catch (e) {
      log(source, 0, e instanceof Error ? e.message : String(e));
      return [];
    }
  };

  let reg: Awaited<ReturnType<typeof resolveRegion>>;
  try {
    reg = await resolveRegion(key, region);
    log("법정동코드", reg.matched.length);
  } catch (e) {
    return { status: "error" as const, fetchedAt, region, message: `법정동코드 확인 실패: ${(e as Error).message}` };
  }
  if (!reg.codes.length) {
    return { status: "error" as const, fetchedAt, region, message: `‘${region}’에 해당하는 시군구코드를 찾지 못했습니다.`, regionInfo: reg };
  }

  const months12 = recentMonths(12);
  const months6 = months12.slice(0, 6);

  // 청약홈 먼저 — 분양권 웃돈 매칭에 필요
  const since24 = daysAgo(730);
  const since12 = daysAgo(365);
  const notices = await safe("청약홈 분양정보", () =>
    noticesSince(key, "ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail", since24, "인천"),
  );
  const cls = classifyNotices(notices, reg.dong, reg.sggKeywords);

  const loadTypes = async (rows: NoticeRow[]) => {
    const perNotice = await mapLimit(rows, 5, async (n) => {
      const models = await safe("청약홈 주택형별", () =>
        odcloud(key, "ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl", { "cond[HOUSE_MANAGE_NO::EQ]": String(n.HOUSE_MANAGE_NO) }),
      );
      const cmpet = await safe("청약홈 경쟁률", () =>
        odcloud(key, "ApplyhomeInfoCmpetRtSvc/v1/getAPTLttotPblancCmpet", { "cond[HOUSE_MANAGE_NO::EQ]": String(n.HOUSE_MANAGE_NO) }),
      );
      return { st: toSupplyTypes(n, models), comp: analyzeCompetition(cmpet, String(n.HOUSE_NM ?? "")) };
    });
    return {
      types: perNotice.flatMap((p) => p.st.types),
      comp: perNotice.flatMap((p) => p.comp),
      exArea: perNotice.reduce((s, p) => s + p.st.excluded.area, 0),
      exMissing: perNotice.reduce((s, p) => s + p.st.excluded.missing, 0),
    };
  };

  const a = await loadTypes(cls.tierA);
  let tier: "A" | "B" = "A";
  let types: SupplyType[] = a.types;
  let comp: CompetitionType[] = a.comp;
  let exArea = a.exArea;
  let exMissing = a.exMissing;
  if (a.types.length < 3) {
    const b = await loadTypes(cls.tierB);
    tier = "B";
    types = [...a.types, ...b.types];
    comp = [...a.comp, ...b.comp];
    exArea += b.exArea;
    exMissing += b.exMissing;
  }

  const remndr = await safe("청약홈 잔여세대", () =>
    noticesSince(key, "ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancDetail", since12),
  );
  const remCls = classifyNotices(
    remndr.filter((r) => String(r.HSSPLY_ADRES ?? "").includes("인천")),
    reg.dong,
    reg.sggKeywords,
  );
  const remList = tier === "A" ? remCls.tierA : [...remCls.tierA, ...remCls.tierB];

  // 실거래 — 시군구코드 × 월 (개편 전·후 코드 모두)
  const verification: { code: string; ym: string; presale: number; rent: number }[] = [];
  const jobs = reg.codes.flatMap((c) => months12.map((ym) => ({ code: c.code, ym })));
  const presaleRows: Record<string, string>[] = [];
  const rentRows: Record<string, string>[] = [];
  await mapLimit(jobs, 6, async ({ code, ym }) => {
    const p = await safe("분양권전매", () => fetchRtms(key, "SilvTrade", code, ym));
    const r = months6.includes(ym) ? await safe("전월세", () => fetchRtms(key, "AptRent", code, ym)) : [];
    presaleRows.push(...p);
    rentRows.push(...r);
    verification.push({
      code,
      ym,
      presale: p.filter((x) => x.umdNm?.trim() === reg.dong).length,
      rent: months6.includes(ym) ? r.filter((x) => x.umdNm?.trim() === reg.dong).length : -1,
    });
  });
  const dedupe = (rows: Record<string, string>[]) => {
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = [r.aptNm, r.dealYear, r.dealMonth, r.dealDay, r.excluUseAr, r.dealAmount ?? r.deposit, r.monthlyRent, r.floor].join("|");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const presaleDeduped = dedupe(presaleRows);
  const rentDeduped = dedupe(rentRows);

  verification.sort((x, y) => (x.code + y.ym).localeCompare(y.code + x.ym) || y.ym.localeCompare(x.ym));

  return {
    status: "ok" as const,
    fetchedAt,
    queryDate: kstDate(),
    region,
    regionInfo: reg,
    windows: { trades: `${months12[months12.length - 1]} ~ ${months12[0]}`, rent: `${months6[months6.length - 1]} ~ ${months6[0]}`, notices: `${since24} 이후 공고`, remaining: `${since12} 이후 공고` },
    verification,
    presale: { ...analyzePresale(presaleDeduped, reg.dong, types), raw: presaleRows.length, duplicates: presaleRows.length - presaleDeduped.length },
    rent: { ...analyzeRent(rentDeduped, reg.dong), raw: rentRows.length, duplicates: rentRows.length - rentDeduped.length },
    supply: {
      tier,
      tierACount: cls.tierA.length,
      tierBCount: cls.tierB.length,
      noticesRaw: notices.length,
      excluded: [
        { reason: "국민주택·신혼희망타운·임대", count: cls.excluded.publicOrRental },
        { reason: "청라동·서구/서해구 외 주소", count: cls.excluded.outside },
        { reason: "전용 50㎡ 미만·100㎡ 초과 주택형", count: exArea },
        { reason: "공급면적·최고금액 결측", count: exMissing },
      ],
      ...summarizeSupply(types),
      types: types.sort((x, y) => y.noticeDate.localeCompare(x.noticeDate)).slice(0, 40),
    },
    competition: { ...summarizeCompetition(comp), types: comp.slice(0, 40) },
    remaining: {
      notices: remList.length,
      households: remList.reduce((s, r) => s + (Number(r.TOT_SUPLY_HSHLDCO) || 0), 0),
      list: remList.slice(0, 10).map((r) => ({
        name: String(r.HOUSE_NM ?? ""),
        date: String(r.RCRIT_PBLANC_DE ?? ""),
        households: Number(r.TOT_SUPLY_HSHLDCO) || 0,
      })),
    },
    logs: Object.values(logs),
  };
}

export type MarketResult = Awaited<ReturnType<typeof buildMarket>>;
