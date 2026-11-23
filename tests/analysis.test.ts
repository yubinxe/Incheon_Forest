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

describe("상환 워터폴", () => {
  it("이익 층 = 기말현금 (흑자), 손실 합 = −기말현금 (적자)", async () => {
    const { waterfall } = await import("@/lib/analysis");
    const w = waterfall(hope);
    expect(w.profit).toBeCloseTo(endingCash(hope).cash, 6);
    expect(w.lenderLoss + w.subLoss).toBe(0);
    const low = { aptPerPy: HOPE_AVG_PER_PY, salesRate: 0.7 };
    const wl = waterfall(low);
    expect(wl.lenderLoss + wl.subLoss).toBeCloseTo(-endingCash(low).cash, 6);
  });
  it("손익분기(93.8%)에서 대여금까지 정확히 채우고, 상환 한계(79.9%)에서 Tr-B 꼭대기", async () => {
    const { waterfall } = await import("@/lib/analysis");
    const { breakevenRate, PF_LIMIT_TARGET } = await import("@/lib/finance");
    const z = waterfall({ aptPerPy: HOPE_AVG_PER_PY, salesRate: breakevenRate(HOPE_AVG_PER_PY, 0) });
    expect(z.subLoss).toBeCloseTo(0, 4);
    const p = waterfall({ aptPerPy: HOPE_AVG_PER_PY, salesRate: breakevenRate(HOPE_AVG_PER_PY, PF_LIMIT_TARGET) });
    expect(p.lenderLoss).toBeCloseTo(0, 4);
    expect(p.subLoss).toBeCloseTo(48000, 4);
  });
});
