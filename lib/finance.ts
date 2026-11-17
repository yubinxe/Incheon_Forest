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

export type Scenario = {
  aptPerPy: number; // 아파트 평균 공급평당가 (만원)
  salesRate: number; // 0~1
  commercialPerPy?: number; // 근린생활시설 평당가 (기본: 희망 1,650)
};

/** 기말현금 (백만원). 변동비·상쇄항목은 분양률에 비례, 고정비·금융비용은 고정 */
export function endingCash(s: Scenario) {
  const comm = unitPrice(COMMERCIAL.supplyPy, s.commercialPerPy ?? COMMERCIAL.hopePerPy);
  const aptFull = aptRevenueAt(s.aptPerPy);
  const revenue = s.salesRate * (aptFull + comm);
  const variable = s.salesRate * (aptFull * RATES.schoolLevy + RATES.agencyFeePerUnit * TOTAL_UNITS);
  const midInterest =
    s.salesRate * aptFull * RATES.midPaymentShare * RATES.midPaymentRate * (RATES.midPaymentMonths / 12);
  const reserveAccount = INPUTS.items.find((i) => i.name === "이자상환적립계정 적립")!.value;
  const offset = midInterest + reserveAccount;
  const inflow = revenue + INPUTS.otherInflow + offset;
  const outflow = INPUTS.fixed + variable + offset;
  return { revenue, variable, offset, inflow, outflow, cash: inflow - outflow };
}

/** 목표 기말현금 target 을 만드는 분양률 (평당가 고정) */
export function breakevenRate(aptPerPy: number, target = 0, commercialPerPy = COMMERCIAL.hopePerPy) {
  const comm = unitPrice(COMMERCIAL.supplyPy, commercialPerPy);
  const aptFull = aptRevenueAt(aptPerPy);
  const netPerRate = aptFull * (1 - RATES.schoolLevy) + comm - RATES.agencyFeePerUnit * TOTAL_UNITS;
  return (INPUTS.fixed - INPUTS.otherInflow + target) / netPerRate;
}

/** 목표 기말현금 target 을 만드는 아파트 평균 공급평당가 (분양률 고정) */
export function breakevenPrice(salesRate: number, target = 0, commercialPerPy = COMMERCIAL.hopePerPy) {
  const comm = unitPrice(COMMERCIAL.supplyPy, commercialPerPy);
  const need = (INPUTS.fixed - INPUTS.otherInflow + target) / salesRate;
  const aptFull = (need - comm + RATES.agencyFeePerUnit * TOTAL_UNITS) / (1 - RATES.schoolLevy);
  return (aptFull * 100) / TOTAL_SUPPLY_PY;
}

export const PF_LIMIT_TARGET = -(SUBORDINATED.retention + SUBORDINATED.developerLoan); // −48,000

/** 두 손익분기 묶음 */
export function thresholds(aptPerPy: number, salesRate = 1) {
  return {
    zero: { rate: breakevenRate(aptPerPy, 0), price: breakevenPrice(salesRate, 0) },
    pf: { rate: breakevenRate(aptPerPy, PF_LIMIT_TARGET), price: breakevenPrice(salesRate, PF_LIMIT_TARGET) },
  };
}

export function sensitivity(prices: number[], rates: number[]) {
  return rates.map((r) => prices.map((p) => endingCash({ aptPerPy: p, salesRate: r }).cash));
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
