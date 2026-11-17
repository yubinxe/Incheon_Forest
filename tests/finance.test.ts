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
