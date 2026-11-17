"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MarketResult } from "@/lib/market/service";
import { applyRules, type Applied } from "@/lib/market/rules";
import { HOPE_AVG_PER_PY } from "@/lib/finance";
import { setLiveLit } from "@/components/scene/Scene";

export const DEFAULT_REGION = "인천광역시 서해구 청라동";

type Load =
  | { state: "loading" }
  | { state: "done"; data: MarketResult | { status: "no_key"; region: string; fetchedAt?: string } }
  | { state: "failed"; message: string };

type Ctx = {
  region: string;
  setRegion: (r: string) => void;
  load: Load;
  market: Extract<MarketResult, { status: "ok" }> | null;
  applied: Applied | null;
  price: number;
  rate: number;
  setPrice: (v: number) => void;
  setRate: (v: number) => void;
};

const PlanCtx = createContext<Ctx | null>(null);

export function usePlan() {
  const c = useContext(PlanCtx);
  if (!c) throw new Error("PlanProvider 누락");
  return c;
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState(DEFAULT_REGION);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [price, setPrice] = useState(Math.round(HOPE_AVG_PER_PY));
  const [rate, setRate] = useState(1);

  const fetchMarket = useCallback(async (r: string) => {
    setLoad({ state: "loading" });
    try {
      const res = await fetch(`/api/market?region=${encodeURIComponent(r)}`);
      const json = await res.json();
      if (!res.ok && json?.status !== "no_key") throw new Error(json?.message ?? `HTTP ${res.status}`);
      setLoad({ state: "done", data: json });
    } catch (e) {
      setLoad({ state: "failed", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    fetchMarket(region);
  }, [region, fetchMarket]);

  useEffect(() => setLiveLit(rate), [rate]);

  const market = load.state === "done" && load.data.status === "ok" ? (load.data as Extract<MarketResult, { status: "ok" }>) : null;

  const applied = useMemo(() => {
    if (!market) return null;
    return applyRules({
      hopeAvgPerPy: HOPE_AVG_PER_PY,
      marketMedianPerPy: market.supply.median,
      fillRatio: market.competition.fillRatio,
      remainingNotices: market.remaining.notices,
      premiumMatched: market.presale.premium.matched,
      premiumBelowTop: market.presale.premium.belowTop,
    });
  }, [market]);

  const value = useMemo<Ctx>(
    () => ({ region, setRegion: setRegionState, load, market, applied, price, rate, setPrice, setRate }),
    [region, load, market, applied, price, rate],
  );
  return <PlanCtx.Provider value={value}>{children}</PlanCtx.Provider>;
}
