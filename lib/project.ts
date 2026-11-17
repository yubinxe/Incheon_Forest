/**
 * 청라 레이크포레 — 원자료 (01 사업계획서 · 02 소요자금 · 03 분양계획 · 06 시공사 재무 · 07 도급계약서)
 * 100% 합성(교육용) 데이터. 금액 단위: 백만원, 평당가: 만원.
 */

export type UnitType = {
  type: string;
  exclusiveM2: number; // 전용면적 ㎡
  exclusivePy: number; // 전용면적 평
  supplyPy: number; // 공급면적 평 (전용 + 주거공용)
  units: number;
  hopePerPy: number; // 희망 평당가 (공급기준, 만원)
  hopePerExclusivePy: number; // 희망 평당가 (전용기준, 만원) — 03 제공값
};

export const UNIT_TYPES: UnitType[] = [
  { type: "59㎡A", exclusiveM2: 59.82, exclusivePy: 18.1, supplyPy: 25.4, units: 168, hopePerPy: 1830, hopePerExclusivePy: 2568 },
  { type: "74㎡", exclusiveM2: 74.55, exclusivePy: 22.55, supplyPy: 31.2, units: 152, hopePerPy: 1790, hopePerExclusivePy: 2477 },
  { type: "84㎡A", exclusiveM2: 84.91, exclusivePy: 25.69, supplyPy: 34.9, units: 196, hopePerPy: 1750, hopePerExclusivePy: 2377 },
  { type: "84㎡B", exclusiveM2: 84.96, exclusivePy: 25.7, supplyPy: 35.3, units: 96, hopePerPy: 1740, hopePerExclusivePy: 2390 },
];

export const COMMERCIAL = { supplyPy: 620.0, units: 18, hopePerPy: 1650 };

export const PROJECT = {
  name: "청라 레이크포레",
  fullName: "청라 레이크포레 공동주택 신축사업",
  developer: "(주)청라레이크포레개발",
  contractor: "(주)대주건설",
  location: "인천광역시 서해구 청라동 000-0번지 일원",
  locationNote: "2026-07-01 서구 → 서해구·검단구 개편 (옛 공고는 ‘인천광역시 서구’)",
  siteM2: 24800.0,
  sitePy: 7502.0,
  grossM2: 98500.0,
  grossPy: 29796.3,
  bcr: 19.4,
  far: 219.8,
  scale: "지하 2층 ~ 지상 29층 · 8개동",
  households: 612,
  approval: "2026-08-20",
  construction: "2027-03 ~ 2029-11 (33개월)",
  moveIn: "2029-11",
  pfMaturity: "2030-03",
  baseDate: "2026-09-30",
} as const;

export type CostItem = {
  group: string;
  name: string;
  amount: number | null; // 백만원; null = 02 공란
  basis: string;
  kind: "fixed" | "variable" | "offset";
};

/** 02_소요자금.csv 원문 그대로 (공란 4개는 null) */
export const COST_ITEMS: CostItem[] = [
  { group: "I. 토지비", name: "토지매입비", amount: 86000, basis: "토지매매계약서", kind: "fixed" },
  { group: "I. 토지비", name: "토지취득세", amount: 4140, basis: "취득세율 4.6%", kind: "fixed" },
  { group: "I. 토지비", name: "토지용역비", amount: 1850, basis: "사업팀 산정", kind: "fixed" },
  { group: "I. 토지비", name: "감정평가수수료", amount: 96, basis: "사업팀 산정", kind: "fixed" },
  { group: "II. 직접공사비", name: "직접공사비", amount: 189000, basis: "도급계약서 (유보금 42,000 포함)", kind: "fixed" },
  { group: "III. 간접공사비", name: "설계비", amount: 2980, basis: "사업팀 산정", kind: "fixed" },
  { group: "III. 간접공사비", name: "감리비", amount: 3420, basis: "사업팀 산정", kind: "fixed" },
  { group: "III. 간접공사비", name: "예술장식품설치비", amount: 311, basis: "사업팀 산정", kind: "fixed" },
  { group: "III. 간접공사비", name: "철거공사비", amount: 1240, basis: "사업팀 산정", kind: "fixed" },
  { group: "III. 간접공사비", name: "인입공사비", amount: 386, basis: "사업팀 산정", kind: "fixed" },
  { group: "III. 간접공사비", name: "기타공사비", amount: 402, basis: "사업팀 산정", kind: "fixed" },
  { group: "IV. 제세공과 및 부담금", name: "보존등기비", amount: 2640, basis: "사업팀 산정", kind: "fixed" },
  { group: "IV. 제세공과 및 부담금", name: "보유세", amount: 1180, basis: "사업팀 산정", kind: "fixed" },
  { group: "IV. 제세공과 및 부담금", name: "상수도원인자부담금", amount: 214, basis: "사업팀 산정", kind: "fixed" },
  { group: "IV. 제세공과 및 부담금", name: "하수도원인자부담금", amount: 586, basis: "사업팀 산정", kind: "fixed" },
  { group: "IV. 제세공과 및 부담금", name: "광역교통시설부담금", amount: 1490, basis: "사업팀 산정", kind: "fixed" },
  { group: "IV. 제세공과 및 부담금", name: "학교용지부담금", amount: null, basis: "공동주택 분양가 × 0.8%", kind: "variable" },
  { group: "V. 판매비와 관리비", name: "M/H 건립비", amount: 1820, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "M/H 임차비", amount: 1150, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "M/H 운영비", amount: 760, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "분양용역비", amount: 140, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "분양보증수수료", amount: 1240, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "중도금보증료", amount: 690, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "분양광고비", amount: 1580, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "분양대행수수료(아파트)", amount: null, basis: "300만원/세대", kind: "variable" },
  { group: "V. 판매비와 관리비", name: "분양대행수수료(근린상가)", amount: 420, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "입주관리비", amount: 520, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "용역수수료", amount: 380, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "세무법률수수료", amount: 310, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "자금신탁수수료", amount: 1140, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "시행사 운영비", amount: 1080, basis: "사업팀 산정", kind: "fixed" },
  { group: "V. 판매비와 관리비", name: "사업예비비", amount: null, basis: "직접공사비 × 3%", kind: "fixed" },
  { group: "VI. 중도금이자후불제", name: "중도금이자후불제", amount: null, basis: "중도금 60% × 연 5.2% × 18개월", kind: "offset" },
  { group: "VII. 시행사 대여금 상환", name: "시행사 대여금 상환", amount: 6000, basis: "선투입분 회수 · 본PF 후순위", kind: "fixed" },
  { group: "VIII. 이자상환적립계정 적립", name: "이자상환적립계정 적립", amount: 1872, basis: "차입금 3개월분 이자 · 만기 환입", kind: "offset" },
  { group: "IX. 이자비용 및 금융수수료", name: "이자비용 - 브릿지론", amount: 3895, basis: "금융조건(안)", kind: "fixed" },
  { group: "IX. 이자비용 및 금융수수료", name: "금융수수료 - 브릿지론", amount: 1230, basis: "금융조건(안)", kind: "fixed" },
  { group: "IX. 이자비용 및 금융수수료", name: "이자비용 - Tr-A 차입금", amount: 18018, basis: "금융조건(안)", kind: "fixed" },
  { group: "IX. 이자비용 및 금융수수료", name: "이자비용 - Tr-B 차입금", amount: 4441, basis: "금융조건(안)", kind: "fixed" },
  { group: "IX. 이자비용 및 금융수수료", name: "금융수수료 - Tr-A 차입금", amount: 1575, basis: "금융조건(안)", kind: "fixed" },
  { group: "IX. 이자비용 및 금융수수료", name: "금융수수료 - Tr-B 차입금", amount: 500, basis: "금융조건(안)", kind: "fixed" },
  { group: "IX. 이자비용 및 금융수수료", name: "금융수수료 - 미분양담보대출", amount: 600, basis: "금융조건(안)", kind: "fixed" },
];

export const RATES = {
  schoolLevy: 0.008, // 학교용지법 제5조의2 — 공동주택 분양가격의 1천분의 8
  agencyFeePerUnit: 3, // 백만원/세대 (300만원)
  reserveOfDirect: 0.03,
  midPaymentShare: 0.6,
  midPaymentRate: 0.052,
  midPaymentMonths: 18,
} as const;

export const OTHER_INFLOW = {
  equity: 22000, // 시행사 출자금 및 대여금 (01 Ⅲ-2)
  depositInterest: 1450, // 예치금 이자수입 (01 Ⅲ-2)
};

export const SUBORDINATED = {
  retention: 42000, // 07 제9조 공사비 유보금
  developerLoan: 6000, // 시행사 대여금
};

export const LOANS = [
  { name: "브릿지론", limit: 82000, rate: 9.5, term: "2026-09 ~ 2027-03", note: "토지비 · 본PF로 상환" },
  { name: "Tr-A 차입금", limit: 105000, rate: 6.5, term: "2027-03 ~ 2030-03", note: "선순위" },
  { name: "Tr-B 차입금", limit: 25000, rate: 8.5, term: "2027-06 ~ 2030-03", note: "중순위 한도대출" },
  { name: "미분양담보대출", limit: 40000, rate: 9.0, term: "~ 2030-09", note: "한도약정 · 미상환잔액 발생 시" },
];

/** 06 시공사 재무현황 (DART 발췌 형식, 합성) */
export const CONTRACTOR_FIN = {
  years: [2023, 2024, 2025],
  revenue: [842000, 915000, 876000],
  operatingIncome: [31200, 20500, -18000],
  netIncome: [24100, 12800, -29400],
  assets: [1284000, 1361000, 1402000],
  liabilities: [837000, 927000, 1021000],
  equity: [447000, 434000, 381000],
  totalDebt: [386000, 452000, 531000],
  cash: [92000, 71000, 48000],
  netDebt: [294000, 381000, 483000],
  debtRatio: [187.2, 213.6, 268.0],
  debtDependency: [30.1, 33.2, 37.9],
  opMargin: [3.7, 2.2, -2.1],
  pfGuarantee: 420000,
  completionGuaranteeSites: 23,
  pfGuaranteeToEquity: 110.2,
  rank: "27위 (2026)",
  rating: "BBB0 (2026.06, 하향 검토)",
};

export const CONTRACT = {
  amount: 189000,
  progressPaid: 147000,
  retention: 42000,
  period: "2027-03-01 ~ 2029-11-30 (33개월)",
  delayPenaltyPerDay: 0.0005, // 도급금액의 1,000분의 0.5
  delayPenaltyCap: 0.1,
};
