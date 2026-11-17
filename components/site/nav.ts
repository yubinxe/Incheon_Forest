/** 상단 GNB · 퀵메뉴 · 스크롤 스파이가 함께 쓰는 목차 */
export type NavItem = { label: string; href: string; children?: { label: string; href: string }[] };

export const NAV: NavItem[] = [
  { label: "사업개요", href: "#overview" },
  { label: "입지환경", href: "#location" },
  { label: "단지안내", href: "#siteplan" },
  {
    label: "사업수지",
    href: "#inputs",
    children: [
      { label: "04 입력값 산출", href: "#inputs" },
      { label: "05 분양 가정의 근거", href: "#market" },
      { label: "05-1 분양률 계산기", href: "#calculator" },
      { label: "06 상환 한계선", href: "#thresholds" },
    ],
  },
  {
    label: "시장분석",
    href: "#signals",
    children: [{ label: "07 시장 대비 여유", href: "#signals" }],
  },
  {
    label: "검토의견",
    href: "#opinion",
    children: [
      { label: "08 리스크와 의견", href: "#opinion" },
      { label: "09 검증 로그", href: "#verify" },
    ],
  },
];

/** 섹션 id → 소속 대메뉴 */
export const OWNER: Record<string, string> = Object.fromEntries(
  NAV.flatMap((n) => [[n.href.slice(1), n.label], ...(n.children ?? []).map((c) => [c.href.slice(1), n.label])]),
);
