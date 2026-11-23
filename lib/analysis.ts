/**
 * 핵심 3대 분석 — 사업성 검토 · 투자 분석 · 수익성 계산
 * 모든 값은 finance.ts 의 동일 계산 엔진(endingCash · cashflow · breakeven)에서 파생한다. 단위: 백만원.
 * 세전(법인세 미반영) 기준이며, 판정 기준은 본 보고서의 내부 가정이다.
 */
import {
  INPUTS,
  PF_LIMIT_TARGET,
  QUARTERS,
  breakevenPrice,
  breakevenRate,
  cashflow,
  endingCash,
  type Scenario,
} from "./finance";
import { LOANS, OTHER_INFLOW, SUBORDINATED } from "./project";

const sumGroup = (prefix: string) =>
  INPUTS.items.filter((i) => i.group.startsWith(prefix) && i.kind !== "offset").reduce((s, i) => s + i.value, 0);
const item = (name: string) => INPUTS.items.find((i) => i.name === name)!;

export const EQUITY_IN = OTHER_INFLOW.equity; // 시행사 출자금·대여금 투입 22,000
export const PF_TOTAL = LOANS.filter((l) => l.name.startsWith("Tr-")).reduce((s, l) => s + l.limit, 0); // 본PF 130,000

/** 수익성 — 매출에서 비용 그룹을 차례로 빼 시행사 순이익까지 */
export function profitability(s: Scenario) {
  const r = endingCash(s);
  const fullVar = INPUTS.variable; // 100% 분양 시 변동비
  const rateVar = r.variable; // 분양률 반영 변동비
  const school = item("학교용지부담금").value;
  const agency = item("분양대행수수료(아파트)").value;
  // 변동비는 각 그룹 안에서 분양률만큼 축소
  const varScale = fullVar ? rateVar / fullVar : 0;
  const steps = [
    { key: "land", label: "토지비", value: sumGroup("I.") },
    { key: "direct", label: "직접공사비", value: sumGroup("II.") },
    { key: "indirect", label: "간접공사비", value: sumGroup("III.") },
    { key: "tax", label: "제세·부담금", value: sumGroup("IV.") - school + school * varScale },
    { key: "sga", label: "판매·관리비", value: sumGroup("V.") - agency + agency * varScale },
    { key: "fin", label: "금융비용", value: sumGroup("IX.") + r.unsoldInterest },
  ];
  const cost = steps.reduce((a, b) => a + b.value, 0); // 시행사 대여금 상환(VII) 제외 — 비용이 아닌 원금 회수
  const interestIncome = OTHER_INFLOW.depositInterest;
  const profit = r.revenue + interestIncome - cost; // = 기말현금 − 출자·대여 투입 + 대여금 회수
  return {
    revenue: r.revenue,
    interestIncome,
    steps,
    cost,
    profit,
    margin: r.revenue ? profit / r.revenue : 0,
    endingCash: r.cash,
    unsoldDraw: r.unsoldDraw,
  };
}

/** 분기 단위 IRR (이분법) → 연환산 */
function irrQuarterly(flows: number[]) {
  const npv = (q: number) => flows.reduce((s, f, i) => s + f / Math.pow(1 + q, i), 0);
  let lo = -0.99, hi = 1;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return Math.pow(1 + (lo + hi) / 2, 4) - 1;
}

/** 투자 분석 — 시행사 자기자본 관점 + 차입 구조 */
export function investment(s: Scenario) {
  const p = profitability(s);
  const cf = cashflow(s);
  const n = QUARTERS.length;
  // 자기자본 현금흐름: 2026.Q2 투입 → 2030.Q1 대여금 회수 + 기말 잔여현금 (음수면 추가 투입 의무로 본다)
  const back = p.endingCash + SUBORDINATED.developerLoan;
  const flows = new Array(n).fill(0);
  flows[0] = -EQUITY_IN;
  flows[n - 1] = Math.max(back, -Infinity);
  const irr = back > 0 ? irrQuarterly(flows) : null;
  const years = (n - 1) / 4;
  return {
    equity: EQUITY_IN,
    back,
    profit: back - EQUITY_IN,
    roe: (back - EQUITY_IN) / EQUITY_IN,
    multiple: back / EQUITY_IN,
    irr,
    years,
    period: `${QUARTERS[0]} – ${QUARTERS[n - 1]}`,
    peak: -cf.peak.cum, // 차입 전 최대 자금 부족
    peakQ: cf.peak.q,
    pf: PF_TOTAL,
    pfHeadroom: PF_TOTAL - -cf.peak.cum,
    ltc: PF_TOTAL / p.cost, // 본PF 한도 / 총사업비
    equityRatio: EQUITY_IN / p.cost,
    gapQuarters: cf.gap.map((g) => g.q),
    rows: cf.rows,
  };
}

export type Grade = "양호" | "보통" | "취약" | "부적합";

/** 사업성 검토 — 손익분기 여유와 이익률로 판정 (내부 기준) */
export function feasibility(s: Scenario) {
  const p = profitability(s);
  const zeroRate = breakevenRate(s.aptPerPy, 0, undefined, s.commercialRate);
  const pfRate = breakevenRate(s.aptPerPy, PF_LIMIT_TARGET, undefined, s.commercialRate);
  const zeroPrice = breakevenPrice(s.salesRate, 0, undefined, s.commercialRate ?? s.salesRate);
  const pfPrice = breakevenPrice(s.salesRate, PF_LIMIT_TARGET, undefined, s.commercialRate ?? s.salesRate);
  const rateCushion = s.salesRate - zeroRate; // 분양률 여유(%p)
  const priceCushion = 1 - zeroPrice / s.aptPerPy; // 분양가 하락 허용폭
  const pfPriceCushion = 1 - pfPrice / s.aptPerPy;
  const checks: { name: string; value: string; grade: Grade; note: string }[] = [];
  const g = (v: number, good: number, ok: number): Grade => (v >= good ? "양호" : v >= ok ? "보통" : v >= 0 ? "취약" : "부적합");
  checks.push({ name: "매출 대비 순이익률", value: pctS(p.margin), grade: g(p.margin, 0.08, 0.03), note: "8% 이상 양호 · 3% 미만 취약" });
  checks.push({ name: "분양가 하락 허용폭", value: pctS(priceCushion), grade: g(priceCushion, 0.1, 0.05), note: "기말현금 0까지 · 10% 이상 양호" });
  checks.push({ name: "본PF 상환 한계 여유", value: pctS(pfPriceCushion), grade: g(pfPriceCushion, 0.2, 0.1), note: "대주단 손실 직전까지 · 20% 이상 양호" });
  checks.push({ name: "손익분기 분양률 여유", value: `${(rateCushion * 100).toFixed(1)}%p`, grade: g(rateCushion, 0.1, 0.05), note: "현재 분양률 − 손익분기 분양률" });
  const score = checks.reduce((s, c) => s + ({ 양호: 3, 보통: 2, 취약: 1, 부적합: 0 } as const)[c.grade], 0);
  const verdict =
    checks.some((c) => c.grade === "부적합") ? "재검토" : score >= 10 ? "추진 적정" : score >= 7 ? "조건부 추진" : "보완 후 재심";
  return { checks, verdict, zeroRate, pfRate, zeroPrice, pfPrice, rateCushion, priceCushion, pfPriceCushion, profit: p };
}

/** 민감도 — 변수별 ± 충격이 시행사 순이익에 주는 영향 (토네이도) */
export function tornado(s: Scenario) {
  const base = profitability(s).profit;
  const at = (x: Scenario) => profitability(x).profit;
  const direct = sumGroup("II.");
  const finCost = sumGroup("IX.");
  const rows = [
    { label: "분양가 ±5%", lo: at({ ...s, aptPerPy: s.aptPerPy * 0.95 }), hi: at({ ...s, aptPerPy: s.aptPerPy * 1.05 }) },
    { label: "분양률 ±5%p", lo: at({ ...s, salesRate: Math.max(0, s.salesRate - 0.05) }), hi: at({ ...s, salesRate: Math.min(1, s.salesRate + 0.05) }) },
    { label: "직접공사비 ±5%", lo: base - direct * 0.05, hi: base + direct * 0.05 },
    { label: "금융비용 ±10%", lo: base - finCost * 0.1, hi: base + finCost * 0.1 },
    {
      label: "상가 분양률 ±20%p",
      lo: at({ ...s, commercialRate: Math.max(0, (s.commercialRate ?? s.salesRate) - 0.2) }),
      hi: at({ ...s, commercialRate: Math.min(1, (s.commercialRate ?? s.salesRate) + 0.2) }),
    },
  ].map((r) => ({ ...r, lo: r.lo - base, hi: r.hi - base }));
  rows.sort((a, b) => Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo));
  return { base, rows };
}

const pctS = (v: number) => `${(v * 100).toFixed(1)}%`;
