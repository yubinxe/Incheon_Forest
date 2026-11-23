import { describe, expect, it } from "vitest";
import { HOPE_AVG_PER_PY, endingCash } from "@/lib/finance";
import { feasibility, investment, profitability, tornado } from "@/lib/analysis";

const hope = { aptPerPy: HOPE_AVG_PER_PY, salesRate: 1 };

describe("핵심 3대 분석", () => {
  it("순이익 = 기말현금 − 출자·대여 투입 + 대여금 회수", () => {
    for (const s of [hope, { aptPerPy: 1600, salesRate: 0.85 }, { aptPerPy: 1400, salesRate: 0.7 }]) {
      const p = profitability(s);
      expect(p.profit).toBeCloseTo(endingCash(s).cash - 22000 + 6000, 6);
      expect(p.revenue + p.interestIncome - p.steps.reduce((a, b) => a + b.value, 0)).toBeCloseTo(p.profit, 6);
    }
  });
  it("자기자본 회수 = 기말현금 + 대여금, IRR은 수익배수와 기간에 정합", () => {
    const v = investment(hope);
    expect(v.back).toBeCloseTo(endingCash(hope).cash + 6000, 6);
    expect(Math.pow(1 + v.irr!, v.years)).toBeCloseTo(v.multiple, 4);
  });
  it("희망가 100%는 손익분기 위, 분양률 70%는 재검토", () => {
    expect(feasibility(hope).rateCushion).toBeGreaterThan(0);
    expect(feasibility({ aptPerPy: HOPE_AVG_PER_PY, salesRate: 0.7 }).verdict).toBe("재검토");
  });
  it("토네이도는 영향 큰 순서", () => {
    const t = tornado(hope);
    const w = t.rows.map((r) => Math.abs(r.hi - r.lo));
    expect([...w].sort((a, b) => b - a)).toEqual(w);
  });
});
