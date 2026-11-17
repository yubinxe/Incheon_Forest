import { describe, expect, it } from "vitest";
import {
  HOPE_APT_REVENUE, HOPE_AVG_PER_PY, HOPE_COMMERCIAL_REVENUE, INPUTS, TOTAL_SUPPLY_PY,
  breakevenPrice, breakevenRate, endingCash, fillBlanks, PF_LIMIT_TARGET, sampleCells, unitPrice,
} from "@/lib/finance";
import { COST_ITEMS } from "@/lib/project";

describe("① 입력값 산출", () => {
  it("공급면적 합계 = 03 합계 19,238.8평", () => expect(TOTAL_SUPPLY_PY).toBeCloseTo(19238.8, 6));
  it("공란 4개", () => {
    const b = fillBlanks();
    expect(HOPE_APT_REVENUE).toBeCloseTo(341650.84, 2);
    expect(b.schoolLevy).toBeCloseTo(2733.20672, 4);
    expect(b.agencyFeeApt).toBe(1836);
    expect(b.reserve).toBe(5670);
    expect(b.midPaymentInterest).toBeCloseTo(15989.259312, 4);
  });
  it("분류 합계", () => {
    expect(INPUTS.fixed).toBeCloseTo(349094, 6);
    expect(INPUTS.financing).toBe(30259);
    expect(INPUTS.variable).toBeCloseTo(4569.20672, 4);
    expect(INPUTS.offset).toBeCloseTo(17861.259312, 4);
    expect(INPUTS.otherInflow).toBe(23450);
    expect(INPUTS.subordinated).toBe(48000);
  });
  it("합계 일치 — 총투자비 = 고정 + 변동 + 상쇄 = 항목 합", () => {
    const itemSum = INPUTS.items.reduce((s, i) => s + i.value, 0);
    expect(INPUTS.totalInvestment).toBeCloseTo(itemSum, 6);
    expect(INPUTS.totalInvestment).toBeCloseTo(371524.465, 2);
    expect(COST_ITEMS.filter((c) => c.amount === null)).toHaveLength(4);
  });
});

describe("검증 3종", () => {
  it("표본 3셀 — 세대당 분양가", () => {
    expect(sampleCells().map((c) => c.perUnit)).toEqual([464.82, 558.48, 610.75]);
    expect(unitPrice(35.3, 1740)).toBeCloseTo(614.22, 6);
  });
  it("역산 — 희망가·100% 기말현금 손계산 일치", () => {
    const hand = HOPE_APT_REVENUE + HOPE_COMMERCIAL_REVENUE + 23450 - 349094 - 4569.20672;
    const r = endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: 1 });
    expect(r.cash).toBeCloseTo(hand, 6);
    expect(r.cash).toBeCloseTo(21667.63328, 4);
  });
});

describe("③ 두 손익분기", () => {
  it("희망가 기준 분양률", () => {
    const z = breakevenRate(HOPE_AVG_PER_PY, 0);
    const pf = breakevenRate(HOPE_AVG_PER_PY, PF_LIMIT_TARGET);
    expect(endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: z }).cash).toBeCloseTo(0, 6);
    expect(endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: pf }).cash).toBeCloseTo(-48000, 6);
    expect(z).toBeCloseTo(0.93761, 4);
    expect(pf).toBeCloseTo(0.79941, 4);
  });
  it("100% 분양 기준 평당가", () => {
    const z = breakevenPrice(1, 0);
    const pf = breakevenPrice(1, PF_LIMIT_TARGET);
    expect(endingCash({ aptPerPy: z, salesRate: 1 }).cash).toBeCloseTo(0, 6);
    expect(endingCash({ aptPerPy: pf, salesRate: 1 }).cash).toBeCloseTo(-48000, 6);
    expect(z).toBeCloseTo(1662.31, 1);
    expect(pf).toBeCloseTo(1410.8, 1);
  });
});

import { cashflow, UNSOLD_LOAN } from "@/lib/finance";

describe("현금흐름 · 미분양담보대출 · 상가 분양률", () => {
  it("분기 누적 마지막 값 = 기말현금", () => {
    for (const s of [
      { aptPerPy: HOPE_AVG_PER_PY, salesRate: 1 },
      { aptPerPy: 1600, salesRate: 0.7 },
      { aptPerPy: 1900, salesRate: 0.85, commercialRate: 0 },
    ]) {
      expect(cashflow(s).ending).toBeCloseTo(endingCash(s).cash, 6);
    }
  });
  it("본PF 상환 한계 위에서는 미분양담보대출 이자 0, 아래에서는 6개월 9% 이자", () => {
    expect(endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: 0.85 }).unsoldInterest).toBe(0);
    const r = endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: 0.7 });
    expect(r.unsoldDraw).toBeCloseTo(34525.86, 1);
    expect(r.unsoldInterest).toBeCloseTo((r.unsoldDraw * UNSOLD_LOAN.rate) / 2, 6);
    expect(endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: 0.4 }).unsoldDraw).toBe(40000);
  });
  it("상가 분양률 분리 — 손익분기 역산 일치", () => {
    const rate = breakevenRate(HOPE_AVG_PER_PY, PF_LIMIT_TARGET, 1650, 0);
    expect(endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: rate, commercialRate: 0 }).cash).toBeCloseTo(PF_LIMIT_TARGET, 6);
    const price = breakevenPrice(0.8, 0, 1650, 0.5);
    expect(endingCash({ aptPerPy: price, salesRate: 0.8, commercialRate: 0.5 }).cash).toBeCloseTo(0, 6);
  });
});
