const _nf = (d: number) => new Intl.NumberFormat("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
/** 하이픈 대신 타이포그래픽 마이너스(U+2212) */
const nf = (d: number) => ({ format: (v: number) => _nf(d).format(v).replace(/^-/, "\u2212") });

/** 백만원 */
export const m = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : nf(d).format(v));
/** 억원 (백만원 입력) — 단위까지 붙여 돌려준다: "217억원" */
export const eok = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${nf(d).format(v / 100)}억원`);
/** 백만원 원자료 — 단위 포함 */
export const mw = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${nf(d).format(v)}백만원`);
export const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${nf(d).format(v * 100)}%`);
export const py = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${nf(d).format(v)}만원`);
export const signed = (v: number, d = 0) => `${v >= 0 ? "+" : "−"}${nf(d).format(Math.abs(v))}`;
