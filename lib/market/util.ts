export const PY_PER_M2 = 1 / 3.305785; // 1평 = 3.305785㎡

export const m2ToPy = (m2: number) => m2 * PY_PER_M2;

export const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export function quantile(values: number[], q: number): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
export const median = (v: number[]) => quantile(v, 0.5);

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

/** data.go.kr RTMS XML → item 객체 배열 (의존성 없는 최소 파서) */
export function parseXmlItems(xml: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const obj: Record<string, string> = {};
    const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f: RegExpExecArray | null;
    while ((f = fieldRe.exec(m[1]))) {
      obj[f[1]] = f[2].replace(/&(amp|lt|gt|quot|apos);/g, (e) => ENTITIES[e]).trim();
    }
    out.push(obj);
  }
  return out;
}

export function parseXmlHeader(xml: string) {
  const code = /<resultCode>([^<]*)<\/resultCode>/.exec(xml)?.[1]?.trim() ?? "";
  const msg = /<resultMsg>([^<]*)<\/resultMsg>/.exec(xml)?.[1]?.trim() ?? "";
  const total = toNum(/<totalCount>([^<]*)<\/totalCount>/.exec(xml)?.[1]);
  // 게이트웨이 오류(인증키 등)는 <returnAuthMsg> 로 내려온다
  const auth = /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/.exec(xml)?.[1]?.trim();
  return { code, msg: auth ?? msg, total: Number.isFinite(total) ? total : 0 };
}

/** KST 기준 YYYYMM 목록 (이번 달 포함, 과거로 n개월) */
export function recentMonths(n: number, now = new Date()): string[] {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  let y = kst.getUTCFullYear();
  let mo = kst.getUTCMonth() + 1;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${y}${String(mo).padStart(2, "0")}`);
    mo -= 1;
    if (mo === 0) {
      mo = 12;
      y -= 1;
    }
  }
  return out;
}

export function kstDate(now = new Date()): string {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  return k.toISOString().slice(0, 10);
}

export function kstDateTime(now = new Date()): string {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${k.toISOString().slice(0, 16).replace("T", " ")} KST`;
}

export function daysAgo(days: number, now = new Date()): string {
  return kstDate(new Date(now.getTime() - days * 86400 * 1000));
}

/** 단지명 정규화 — 분양권 aptNm ↔ 청약홈 HOUSE_NM 매칭용 */
export function normalizeName(s: string): string {
  return s
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .toLowerCase()
    .replace(/아파트|공동주택|신축공사|주상복합/g, "")
    .replace(/[^가-힣a-z0-9]/g, "");
}

export function namesMatch(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (x.length < 3 || y.length < 3) return false;
  return x.includes(y) || y.includes(x);
}

/** 청약홈 HOUSE_TY "084.9800A" → 84.98 */
export const exclusiveFromHouseTy = (ty: string) => toNum(String(ty).replace(/[^0-9.]/g, ""));

/** 지역명 입력 정제 — 한글·숫자·공백만, 40자 이하 */
export function sanitizeRegion(input: string | null): string | null {
  if (!input) return null;
  const s = input.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!s || s.length > 40) return null;
  if (!/^[가-힣0-9 ]+$/.test(s)) return null;
  return s;
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
