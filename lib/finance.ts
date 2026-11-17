import {
  COMMERCIAL,
  COST_ITEMS,
  OTHER_INFLOW,
  RATES,
  SUBORDINATED,
  UNIT_TYPES,
  type CostItem,
} from "./project";

/** 금액 단위: 백만원 · 평당가: 만원/평(공급기준) */

const round2 = (n: number) => Math.round(n * 100) / 100;

export const TOTAL_SUPPLY_PY = UNIT_TYPES.reduce((s, t) => s + t.supplyPy * t.units, 0); // 19,238.8
export const TOTAL_UNITS = UNIT_TYPES.reduce((s, t) => s + t.units, 0); // 612

/** 세대당 분양가 = 공급면적 × 평당가 ÷ 100 (백만원) */
export const unitPrice = (supplyPy: number, perPy: number) => (supplyPy * perPy) / 100;

/** 희망 분양가 기준 아파트 분양수입 (백만원) */
export const HOPE_APT_REVENUE = UNIT_TYPES.reduce((s, t) => s + unitPrice(t.supplyPy, t.hopePerPy) * t.units, 0);
/** 공급면적 가중 평균 희망 평당가 (만원/평) */
export const HOPE_AVG_PER_PY = (HOPE_APT_REVENUE * 100) / TOTAL_SUPPLY_PY;
export const HOPE_COMMERCIAL_REVENUE = unitPrice(COMMERCIAL.supplyPy, COMMERCIAL.hopePerPy);

/** 아파트 평균 평당가 p 일 때 아파트 분양수입(100% 분양) — 타입별 희망가 비율 유지 */
export const aptRevenueAt = (avgPerPy: number) => (TOTAL_SUPPLY_PY * avgPerPy) / 100;

/** 02 공란 4개 산출 */
export function fillBlanks(aptRevenue = HOPE_APT_REVENUE) {
  const directCost = COST_ITEMS.find((c) => c.name === "직접공사비")!.amount!;
  return {
    schoolLevy: aptRevenue * RATES.schoolLevy,
    agencyFeeApt: RATES.agencyFeePerUnit * TOTAL_UNITS,
    reserve: directCost * RATES.reserveOfDirect,
    midPaymentInterest:
      aptRevenue * RATES.midPaymentShare * RATES.midPaymentRate * (RATES.midPaymentMonths / 12),
  };
}

export type CompletedItem = CostItem & { value: number; computed: boolean };

export function completedItems(aptRevenue = HOPE_APT_REVENUE): CompletedItem[] {
  const b = fillBlanks(aptRevenue);
  const map: Record<string, number> = {
    학교용지부담금: b.schoolLevy,
    "분양대행수수료(아파트)": b.agencyFeeApt,
    사업예비비: b.reserve,
    중도금이자후불제: b.midPaymentInterest,
  };
  return COST_ITEMS.map((c) => ({
    ...c,
    value: c.amount ?? map[c.name],
    computed: c.amount === null,
  }));
}

/** 앱 입력값 (100% 분양 · 희망가 기준) */
export function inputs() {
  const items = completedItems();
  const sum = (k: CostItem["kind"]) => items.filter((i) => i.kind === k).reduce((s, i) => s + i.value, 0);
  const fixed = sum("fixed");
  const variable = sum("variable");
  const offset = sum("offset");
  const financing = items
    .filter((i) => i.group.startsWith("IX."))
    .reduce((s, i) => s + i.value, 0);
  const otherInflow = OTHER_INFLOW.equity + OTHER_INFLOW.depositInterest;
  const subordinated = SUBORDINATED.retention + SUBORDINATED.developerLoan;
  return {
    items,
    fixed,
    fixedExFinancing: fixed - financing,
    financing,
    variable,
    offset,
    totalProjectCost: fixed + variable, // 총사업비 (상쇄 제외)
    totalInvestment: fixed + variable + offset, // 총투자비
    otherInflow,
    subordinated,
  };
}

export const INPUTS = inputs();

export const PF_LIMIT_TARGET = -(SUBORDINATED.retention + SUBORDINATED.developerLoan); // −48,000

export type Scenario = {
  aptPerPy: number; // 아파트 평균 공급평당가 (만원)
  salesRate: number; // 0~1
  commercialPerPy?: number; // 근린생활시설 평당가 (기본: 희망 1,650)
  commercialRate?: number; // 근린생활시설 분양률 (기본: 아파트 분양률과 동일)
};

/** 미분양담보대출 — 본PF 미상환분을 대환, 2030-03 ~ 2030-09 (6개월) 연 9.0% */
export const UNSOLD_LOAN = { limit: 40000, rate: 0.09, months: 6 } as const;

/** 기말현금 (백만원). 변동비·상쇄항목은 분양률에 비례, 고정비·금융비용은 고정 */
export function endingCash(s: Scenario) {
  const comm = unitPrice(COMMERCIAL.supplyPy, s.commercialPerPy ?? COMMERCIAL.hopePerPy);
  const aptFull = aptRevenueAt(s.aptPerPy);
  const commRate = s.commercialRate ?? s.salesRate;
  const revenue = s.salesRate * aptFull + commRate * comm;
  const variable = s.salesRate * (aptFull * RATES.schoolLevy + RATES.agencyFeePerUnit * TOTAL_UNITS);
  const midInterest =
    s.salesRate * aptFull * RATES.midPaymentShare * RATES.midPaymentRate * (RATES.midPaymentMonths / 12);
  const reserveAccount = INPUTS.items.find((i) => i.name === "이자상환적립계정 적립")!.value;
  const offset = midInterest + reserveAccount;
  const inflow = revenue + INPUTS.otherInflow + offset;
  const outflow0 = INPUTS.fixed + variable + offset;
  const base = inflow - outflow0;
  // 본PF 미상환분이 생기면 미분양담보대출로 대환 — 한도 내 인출액에 6개월 이자가 추가로 붙는다
  const unsoldDraw = Math.min(UNSOLD_LOAN.limit, Math.max(0, PF_LIMIT_TARGET - base));
  const unsoldInterest = (unsoldDraw * UNSOLD_LOAN.rate * UNSOLD_LOAN.months) / 12;
  const outflow = outflow0 + unsoldInterest;
  return { revenue, variable, offset, inflow, outflow, unsoldDraw, unsoldInterest, cash: inflow - outflow };
}

/** 목표 기말현금 target 을 만드는 분양률 (평당가 고정) */
export function breakevenRate(aptPerPy: number, target = 0, commercialPerPy = COMMERCIAL.hopePerPy, commercialRate?: number) {
  const comm = unitPrice(COMMERCIAL.supplyPy, commercialPerPy);
  const aptFull = aptRevenueAt(aptPerPy);
  if (commercialRate === undefined) {
    const netPerRate = aptFull * (1 - RATES.schoolLevy) + comm - RATES.agencyFeePerUnit * TOTAL_UNITS;
    return (INPUTS.fixed - INPUTS.otherInflow + target) / netPerRate;
  }
  const netPerRate = aptFull * (1 - RATES.schoolLevy) - RATES.agencyFeePerUnit * TOTAL_UNITS;
  return (INPUTS.fixed - INPUTS.otherInflow - commercialRate * comm + target) / netPerRate;
}

/** 목표 기말현금 target 을 만드는 아파트 평균 공급평당가 (분양률 고정) */
export function breakevenPrice(salesRate: number, target = 0, commercialPerPy = COMMERCIAL.hopePerPy, commercialRate = salesRate) {
  const comm = unitPrice(COMMERCIAL.supplyPy, commercialPerPy);
  const need = (INPUTS.fixed - INPUTS.otherInflow + target - commercialRate * comm) / salesRate;
  const aptFull = (need + RATES.agencyFeePerUnit * TOTAL_UNITS) / (1 - RATES.schoolLevy);
  return (aptFull * 100) / TOTAL_SUPPLY_PY;
}


/** 두 손익분기 묶음 */
export function thresholds(aptPerPy: number, salesRate = 1) {
  return {
    zero: { rate: breakevenRate(aptPerPy, 0), price: breakevenPrice(salesRate, 0) },
    pf: { rate: breakevenRate(aptPerPy, PF_LIMIT_TARGET), price: breakevenPrice(salesRate, PF_LIMIT_TARGET) },
  };
}

export function sensitivity(prices: number[], rates: number[], commercialRate?: number) {
  return rates.map((r) => prices.map((p) => endingCash({ aptPerPy: p, salesRate: r, commercialRate }).cash));
}

/** 표본 3셀 대조: 세대당 분양가 */
export function sampleCells() {
  return UNIT_TYPES.slice(0, 3).map((t) => ({
    type: t.type,
    supplyPy: t.supplyPy,
    perPy: t.hopePerPy,
    perUnit: round2(unitPrice(t.supplyPy, t.hopePerPy)),
  }));
}

export type CashZone = "surplus" | "subordinated" | "pf-shortfall";
export const zoneOf = (cash: number): CashZone =>
  cash >= 0 ? "surplus" : cash >= PF_LIMIT_TARGET ? "subordinated" : "pf-shortfall";

/* ───────── 분기 현금흐름 (차입 전 누적) ───────── */

export const QUARTERS = (() => {
  const q: string[] = [];
  for (let y = 2026, k = 2; y < 2030 || (y === 2030 && k <= 1); ) {
    q.push(`${y}.Q${k}`);
    k++;
    if (k > 4) { k = 1; y++; }
  }
  return q; // 2026.Q2 ~ 2030.Q1 (16개 분기)
})();

const qi = (label: string) => QUARTERS.indexOf(label);
const spread = (arr: number[], amount: number, from: string, to: string, weights?: number[]) => {
  const a = qi(from), b = qi(to);
  const n = b - a + 1;
  const w = weights ?? Array.from({ length: n }, () => 1);
  const sum = w.reduce((x, y) => x + y, 0);
  for (let i = 0; i < n; i++) arr[a + i] += (amount * w[i]) / sum;
};

/** 공사 S커브 가중 (12개 분기, 2027.Q1 ~ 2029.Q4) */
const S_CURVE = [3, 5, 7, 9, 10, 11, 11, 11, 10, 9, 8, 6];

/**
 * 분기별 유입·유출 — 01 사업계획서 일정 기반의 단순화 가정.
 * 차입금 원금은 제외(누적선의 최저점 = 차입으로 메워야 할 최대 자금 부족),
 * 마지막 분기 누적값 = 기말현금과 일치하도록 모든 항목을 배분한다.
 */
export function cashflow(s: Scenario) {
  const n = QUARTERS.length;
  const inflow = new Array(n).fill(0);
  const outflow = new Array(n).fill(0);
  const items = INPUTS.items;
  const v = (name: string) => items.find((i) => i.name === name)!.value;
  const r = endingCash(s);
  const commRate = s.commercialRate ?? s.salesRate;
  const aptFull = aptRevenueAt(s.aptPerPy);
  const comm = unitPrice(COMMERCIAL.supplyPy, s.commercialPerPy ?? COMMERCIAL.hopePerPy);
  const sales = s.salesRate * aptFull + commRate * comm;

  // 유입 — 계약금 10% (2027.Q2) · 중도금 60% 6회 · 잔금 30% (2029.Q4)
  inflow[qi("2027.Q2")] += sales * 0.1;
  for (const q of ["2027.Q4", "2028.Q1", "2028.Q2", "2028.Q3", "2028.Q4", "2028.Q4"]) inflow[qi(q)] += sales * 0.1;
  inflow[qi("2029.Q4")] += sales * 0.3;
  inflow[qi("2026.Q2")] += INPUTS.otherInflow - 1450; // 시행사 출자·대여 22,000
  spread(inflow, 1450, "2027.Q1", "2030.Q1"); // 예치금 이자
  // 상쇄 항목: 중도금 이자 선지급 → 입주 시 회수, 이자적립 → 만기 환입
  spread(outflow, r.offset - v("이자상환적립계정 적립"), "2028.Q1", "2029.Q3");
  inflow[qi("2029.Q4")] += r.offset - v("이자상환적립계정 적립");
  outflow[qi("2027.Q1")] += v("이자상환적립계정 적립");
  inflow[qi("2030.Q1")] += v("이자상환적립계정 적립");

  // 유출
  const land = items.filter((i) => i.group.startsWith("I.")).reduce((x, i) => x + i.value, 0);
  outflow[qi("2026.Q2")] += land * 0.1;
  outflow[qi("2026.Q3")] += land * 0.9;
  spread(outflow, 189000 - 42000, "2027.Q1", "2029.Q4", S_CURVE); // 기성
  outflow[qi("2030.Q1")] += 42000; // 유보금 (후순위)
  const indirect = items.filter((i) => i.group.startsWith("III.")).reduce((x, i) => x + i.value, 0);
  spread(outflow, indirect, "2027.Q1", "2029.Q4", S_CURVE);
  spread(outflow, v("사업예비비"), "2027.Q1", "2029.Q4", S_CURVE);
  outflow[qi("2027.Q1")] += v("광역교통시설부담금") + v("상수도원인자부담금") + v("하수도원인자부담금");
  spread(outflow, v("보유세"), "2026.Q4", "2029.Q4");
  outflow[qi("2029.Q4")] += v("보존등기비");
  outflow[qi("2027.Q2")] += r.variable; // 학교용지부담금·분양대행 (분양 시점)
  const mh = v("M/H 건립비") + v("M/H 임차비") + v("M/H 운영비") + v("분양광고비") + v("분양용역비");
  spread(outflow, mh, "2027.Q1", "2027.Q3");
  outflow[qi("2027.Q2")] += v("분양보증수수료") + v("분양대행수수료(근린상가)");
  outflow[qi("2027.Q4")] += v("중도금보증료");
  outflow[qi("2029.Q4")] += v("입주관리비");
  spread(outflow, v("용역수수료") + v("세무법률수수료") + v("자금신탁수수료") + v("시행사 운영비"), "2026.Q3", "2030.Q1");
  outflow[qi("2030.Q1")] += v("시행사 대여금 상환");
  // 금융비용
  spread(outflow, v("이자비용 - 브릿지론"), "2026.Q3", "2027.Q1");
  outflow[qi("2026.Q3")] += v("금융수수료 - 브릿지론");
  spread(outflow, v("이자비용 - Tr-A 차입금"), "2027.Q1", "2030.Q1");
  spread(outflow, v("이자비용 - Tr-B 차입금"), "2027.Q2", "2030.Q1");
  outflow[qi("2027.Q1")] += v("금융수수료 - Tr-A 차입금");
  outflow[qi("2027.Q2")] += v("금융수수료 - Tr-B 차입금");
  outflow[qi("2029.Q4")] += v("금융수수료 - 미분양담보대출");
  outflow[qi("2030.Q1")] += r.unsoldInterest;

  // 차입 가용 한도 — 브릿지 82,000 → 본PF Tr-A 105,000 + Tr-B 25,000
  const capacity = QUARTERS.map((q) => (qi(q) < qi("2026.Q3") ? 0 : qi(q) < qi("2027.Q1") ? 82000 : qi(q) < qi("2027.Q2") ? 105000 : 130000));

  let cum = 0;
  const rows = QUARTERS.map((q, i) => {
    cum += inflow[i] - outflow[i];
    return { q, inflow: inflow[i], outflow: outflow[i], net: inflow[i] - outflow[i], cum, capacity: capacity[i] };
  });
  const peak = rows.reduce((a, b) => (b.cum < a.cum ? b : a), rows[0]);
  const gap = rows.filter((x) => x.cum < -x.capacity);
  return { rows, peak, gap, ending: cum };
}
