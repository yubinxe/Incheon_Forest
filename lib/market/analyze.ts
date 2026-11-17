import { exclusiveFromHouseTy, m2ToPy, median, namesMatch, quantile, toNum } from "./util";

/* ───────── 공통 타입 ───────── */

export type Excluded = { reason: string; count: number }[];

export type PresaleDeal = {
  aptNm: string;
  exclusiveM2: number;
  amount: number; // 만원
  perExclusivePy: number; // 만원/전용평
  date: string;
  floor: string;
  premium: number | null; // 만원, 청약홈 최고금액 대비
};

export type SupplyType = {
  houseManageNo: string;
  houseNm: string;
  noticeDate: string;
  houseTy: string;
  exclusiveM2: number;
  supplyM2: number;
  households: number;
  topAmount: number; // 만원 (분양최고금액)
  perSupplyPy: number; // 만원/공급평
};

export type CompetitionType = {
  houseManageNo: string;
  houseNm: string;
  houseTy: string;
  supply: number;
  requests: number;
  unmet: boolean;
};

/* ───────── ① 분양권 전매 ───────── */

export function analyzePresale(
  rows: Record<string, string>[],
  dong: string,
  supplyTypes: SupplyType[],
) {
  const ex = { cancelled: 0, notPresale: 0, otherDong: 0, area: 0, invalid: 0 };
  const deals: PresaleDeal[] = [];
  for (const r of rows) {
    if ((r.umdNm ?? "").trim() !== dong) { ex.otherDong++; continue; }
    if ((r.cdealType ?? "").trim() === "O") { ex.cancelled++; continue; }
    // ownershipGbn: 분(분양권) / 입(입주권). 비어 있으면 분양권으로 본다(API 기본 대상)
    if (r.ownershipGbn && r.ownershipGbn.trim() !== "분") { ex.notPresale++; continue; }
    const area = toNum(r.excluUseAr);
    const amt = toNum(r.dealAmount);
    if (!Number.isFinite(area) || !Number.isFinite(amt) || amt <= 0) { ex.invalid++; continue; }
    if (area < 50 || area > 100) { ex.area++; continue; }
    const match = supplyTypes.find(
      (s) => namesMatch(r.aptNm ?? "", s.houseNm) && Math.abs(s.exclusiveM2 - area) < 0.6,
    );
    deals.push({
      aptNm: r.aptNm ?? "",
      exclusiveM2: area,
      amount: amt,
      perExclusivePy: amt / m2ToPy(area),
      date: `${r.dealYear}-${String(r.dealMonth).padStart(2, "0")}-${String(r.dealDay).padStart(2, "0")}`,
      floor: r.floor ?? "",
      premium: match ? amt - match.topAmount : null,
    });
  }
  deals.sort((a, b) => b.date.localeCompare(a.date));
  const per = deals.map((d) => d.perExclusivePy);
  const prem = deals.filter((d) => d.premium !== null).map((d) => d.premium!);
  return {
    n: deals.length,
    excluded: [
      { reason: `${dong} 외 법정동`, count: ex.otherDong },
      { reason: "해제 거래(cdealType=O)", count: ex.cancelled },
      { reason: "입주권(분양권 아님)", count: ex.notPresale },
      { reason: "전용 50㎡ 미만·100㎡ 초과", count: ex.area },
      { reason: "금액·면적 결측", count: ex.invalid },
    ] as Excluded,
    medianPerExclusivePy: median(per),
    p25: quantile(per, 0.25),
    p75: quantile(per, 0.75),
    premium: {
      matched: prem.length,
      median: median(prem),
      belowTop: prem.filter((p) => p < 0).length,
    },
    recent: deals.slice(0, 10),
  };
}

/* ───────── ② 전월세 ───────── */

export function analyzeRent(rows: Record<string, string>[], dong: string) {
  const ex = { otherDong: 0, monthly: 0, area: 0, invalid: 0 };
  const deposits84: number[] = [];
  const deposits59: number[] = [];
  let n = 0;
  for (const r of rows) {
    if ((r.umdNm ?? "").trim() !== dong) { ex.otherDong++; continue; }
    const monthly = toNum(r.monthlyRent);
    if (Number.isFinite(monthly) && monthly > 0) { ex.monthly++; continue; }
    const dep = toNum(r.deposit);
    const area = toNum(r.excluUseAr);
    if (!Number.isFinite(dep) || !Number.isFinite(area) || dep <= 0) { ex.invalid++; continue; }
    if (area >= 80 && area <= 86) { deposits84.push(dep); n++; }
    else if (area >= 55 && area <= 61) { deposits59.push(dep); n++; }
    else ex.area++;
  }
  return {
    n,
    n84: deposits84.length,
    n59: deposits59.length,
    excluded: [
      { reason: `${dong} 외 법정동`, count: ex.otherDong },
      { reason: "월세(월차임 > 0)", count: ex.monthly },
      { reason: "전용 55~61·80~86㎡ 외", count: ex.area },
      { reason: "보증금·면적 결측", count: ex.invalid },
    ] as Excluded,
    median84: median(deposits84), // 만원
    median59: median(deposits59),
  };
}

/* ───────── ③ 청약홈 분양정보 ───────── */

export type NoticeRow = Record<string, unknown>;

export function classifyNotices(rows: NoticeRow[], dongKeyword: string, sggKeywords: string[]) {
  const ex = { publicOrRental: 0, outside: 0 };
  const tierA: NoticeRow[] = [];
  const tierB: NoticeRow[] = [];
  for (const r of rows) {
    const addr = String(r.HSSPLY_ADRES ?? "");
    const name = String(r.HOUSE_NM ?? "");
    const dtl = String(r.HOUSE_DTL_SECD_NM ?? r.HOUSE_DTL_SECD ?? "");
    const secd = String(r.HOUSE_SECD ?? "");
    const rent = String(r.RENT_SECD ?? "0");
    if (dtl.includes("국민") || dtl === "03" || secd === "10" || (rent !== "0" && rent !== "")) {
      ex.publicOrRental++;
      continue;
    }
    if (addr.includes(dongKeyword) || name.includes(dongKeyword.replace(/동$/, ""))) tierA.push(r);
    else if (sggKeywords.some((k) => addr.includes(k))) tierB.push(r);
    else ex.outside++;
  }
  return { tierA, tierB, excluded: ex };
}

export function toSupplyTypes(notice: NoticeRow, models: NoticeRow[]) {
  const ex = { area: 0, missing: 0 };
  const out: SupplyType[] = [];
  for (const m of models) {
    const houseTy = String(m.HOUSE_TY ?? "");
    const exclusive = exclusiveFromHouseTy(houseTy);
    const supplyM2 = toNum(m.SUPLY_AR);
    const top = toNum(m.LTTOT_TOP_AMOUNT);
    if (!Number.isFinite(supplyM2) || !Number.isFinite(top) || top <= 0 || supplyM2 <= 0) { ex.missing++; continue; }
    if (!Number.isFinite(exclusive) || exclusive < 50 || exclusive > 100) { ex.area++; continue; }
    out.push({
      houseManageNo: String(notice.HOUSE_MANAGE_NO ?? ""),
      houseNm: String(notice.HOUSE_NM ?? ""),
      noticeDate: String(notice.RCRIT_PBLANC_DE ?? ""),
      houseTy,
      exclusiveM2: exclusive,
      supplyM2,
      households: toNum(m.SUPLY_HSHLDCO) || 0,
      topAmount: top,
      perSupplyPy: top / m2ToPy(supplyM2),
    });
  }
  return { types: out, excluded: ex };
}

export function summarizeSupply(types: SupplyType[]) {
  const per = types.map((t) => t.perSupplyPy);
  return {
    nTypes: types.length,
    nComplexes: new Set(types.map((t) => t.houseManageNo)).size,
    median: median(per),
    p25: quantile(per, 0.25),
    p75: quantile(per, 0.75),
  };
}

/* ───────── ④ 경쟁률 ───────── */

export function analyzeCompetition(rows: NoticeRow[], houseNm: string): CompetitionType[] {
  const byTy = new Map<string, { supply: number; req: number; manage: string }>();
  for (const r of rows) {
    const rank = String(r.SUBSCRPT_RANK_CODE ?? "");
    if (rank && rank !== "1" && rank !== "2") continue;
    const ty = String(r.HOUSE_TY ?? "");
    const cur = byTy.get(ty) ?? { supply: 0, req: 0, manage: String(r.HOUSE_MANAGE_NO ?? "") };
    const s = toNum(r.SUPLY_HSHLDCO);
    if (Number.isFinite(s)) cur.supply = Math.max(cur.supply, s);
    const q = toNum(r.REQ_CNT);
    if (Number.isFinite(q)) cur.req += q;
    byTy.set(ty, cur);
  }
  return [...byTy.entries()]
    .filter(([, v]) => v.supply > 0)
    .map(([ty, v]) => ({
      houseManageNo: v.manage,
      houseNm,
      houseTy: ty,
      supply: v.supply,
      requests: v.req,
      unmet: v.req < v.supply,
    }));
}

export function summarizeCompetition(types: CompetitionType[]) {
  const supply = types.reduce((s, t) => s + t.supply, 0);
  const filled = types.reduce((s, t) => s + Math.min(t.requests, t.supply), 0);
  return {
    nTypes: types.length,
    unmetTypes: types.filter((t) => t.unmet).length,
    supply,
    fillRatio: supply > 0 ? filled / supply : null,
  };
}

/* ───────── ① 대체: 준공 10년 이내 아파트 매매 (분양권 표본 부족 시) ───────── */

export function analyzeNewTrades(rows: Record<string, string>[], dong: string, maxAge = 10, now = new Date()) {
  const ex = { otherDong: 0, cancelled: 0, old: 0, area: 0, invalid: 0 };
  const per: number[] = [];
  const minYear = now.getFullYear() - maxAge;
  const complexes = new Set<string>();
  for (const r of rows) {
    if ((r.umdNm ?? "").trim() !== dong) { ex.otherDong++; continue; }
    if ((r.cdealType ?? "").trim() === "O") { ex.cancelled++; continue; }
    const by = toNum(r.buildYear);
    if (!Number.isFinite(by) || by < minYear) { ex.old++; continue; }
    const area = toNum(r.excluUseAr);
    const amt = toNum(r.dealAmount);
    if (!Number.isFinite(area) || !Number.isFinite(amt) || amt <= 0) { ex.invalid++; continue; }
    if (area < 50 || area > 100) { ex.area++; continue; }
    per.push(amt / m2ToPy(area));
    complexes.add(r.aptNm ?? "");
  }
  return {
    n: per.length,
    complexes: complexes.size,
    minBuildYear: minYear,
    medianPerExclusivePy: median(per),
    p25: quantile(per, 0.25),
    p75: quantile(per, 0.75),
    excluded: [
      { reason: `${dong} 외 법정동`, count: ex.otherDong },
      { reason: "해제 거래", count: ex.cancelled },
      { reason: `${minYear}년 이전 준공`, count: ex.old },
      { reason: "전용 50㎡ 미만·100㎡ 초과", count: ex.area },
      { reason: "금액·면적 결측", count: ex.invalid },
    ] as Excluded,
  };
}
