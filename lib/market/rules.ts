/**
 * 적용 분양가 · 적용 분양률 결정 규칙 — 공공데이터가 갱신되면 결과도 매일 바뀐다.
 * 각 계수는 '가정'이며 화면에 그대로 공개한다.
 */
export const RULES = {
  /** 청약홈 금액은 '분양최고금액' — 주택형 평균가로 환산하는 할인 (가정) */
  topToAverage: 0.03,
  /** 1·2순위 접수 충족률 → 계약률 환산 계수 (경쟁률 ≠ 계약률, 가정) */
  contractConversion: 0.85,
  /** 무순위·잔여세대 공고가 있으면 분양률 차감 (가정) */
  remainingPenalty: 0.05,
  /** 분양권이 청약홈 최고금액을 하회한 거래 비중이 이 값 이상이면 평당가 추가 차감 */
  belowTopShareTrigger: 0.3,
  belowTopPricePenalty: 0.02,
  rateFloor: 0.4,
  rateCap: 1,
} as const;

export type RuleInput = {
  hopeAvgPerPy: number;
  marketMedianPerPy: number | null;
  fillRatio: number | null;
  remainingNotices: number;
  premiumMatched: number;
  premiumBelowTop: number;
};

export type Applied = {
  price: number | null;
  rate: number | null;
  priceSteps: string[];
  rateSteps: string[];
};

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function applyRules(i: RuleInput): Applied {
  const priceSteps: string[] = [];
  const rateSteps: string[] = [];
  let price: number | null = null;
  let rate: number | null = null;

  if (i.marketMedianPerPy) {
    let p = i.marketMedianPerPy * (1 - RULES.topToAverage);
    priceSteps.push(`인근 공급평당 최고금액 중위 ${fmt(i.marketMedianPerPy)} × (1 − ${pct(RULES.topToAverage)}) = ${fmt(p)}`);
    const share = i.premiumMatched ? i.premiumBelowTop / i.premiumMatched : 0;
    if (i.premiumMatched >= 3 && share >= RULES.belowTopShareTrigger) {
      p *= 1 - RULES.belowTopPricePenalty;
      priceSteps.push(`분양권 최고가 하회 비중 ${pct(share)} ≥ ${pct(RULES.belowTopShareTrigger)} → −${pct(RULES.belowTopPricePenalty)} = ${fmt(p)}`);
    }
    if (p > i.hopeAvgPerPy) {
      priceSteps.push(`희망가 ${fmt(i.hopeAvgPerPy)} 상한 적용`);
      p = i.hopeAvgPerPy;
    }
    price = p;
  } else {
    priceSteps.push("비교 가능한 인근 신규 분양 표본 없음 — 적용 보류");
  }

  if (i.fillRatio !== null) {
    let r = i.fillRatio * RULES.contractConversion;
    rateSteps.push(`1·2순위 접수 충족률 ${pct(i.fillRatio)} × 계약 환산 ${RULES.contractConversion} = ${pct(r)}`);
    if (i.remainingNotices > 0) {
      r -= RULES.remainingPenalty;
      rateSteps.push(`무순위·잔여세대 공고 ${i.remainingNotices}건 → −${pct(RULES.remainingPenalty)}p = ${pct(r)}`);
    }
    r = Math.min(RULES.rateCap, Math.max(RULES.rateFloor, r));
    rate = r;
  } else {
    rateSteps.push("경쟁률 표본 없음 — 적용 보류");
  }
  return { price, rate, priceSteps, rateSteps };
}
