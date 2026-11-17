import { describe, expect, it } from "vitest";
import { analyzeCompetition, analyzePresale, analyzeRent, classifyNotices, summarizeCompetition, toSupplyTypes } from "@/lib/market/analyze";
import { applyRules } from "@/lib/market/rules";
import { exclusiveFromHouseTy, m2ToPy, median, parseXmlHeader, parseXmlItems, recentMonths, sanitizeRegion } from "@/lib/market/util";

const XML = `<?xml version="1.0"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptNm>청라 호수뷰 &amp; 파크</aptNm><dealAmount>  65,000</dealAmount><excluUseAr>84.97</excluUseAr><umdNm>청라동</umdNm><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>3</dealDay><ownershipGbn>분</ownershipGbn><cdealType></cdealType><floor>12</floor></item>
<item><aptNm>청라 호수뷰 파크</aptNm><dealAmount>60,000</dealAmount><excluUseAr>84.97</excluUseAr><umdNm>청라동</umdNm><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>1</dealDay><ownershipGbn>분</ownershipGbn><cdealType>O</cdealType><floor>3</floor></item>
<item><aptNm>가정 OO</aptNm><dealAmount>50,000</dealAmount><excluUseAr>59.9</excluUseAr><umdNm>가정동</umdNm><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>1</dealDay></item>
</items><totalCount>3</totalCount></body></response>`;

describe("유틸", () => {
  it("XML 파싱 · 엔티티 · 헤더", () => {
    const items = parseXmlItems(XML);
    expect(items).toHaveLength(3);
    expect(items[0].aptNm).toBe("청라 호수뷰 & 파크");
    expect(parseXmlHeader(XML)).toMatchObject({ code: "000", total: 3 });
  });
  it("평 환산 · 중위수 · 주택형", () => {
    expect(m2ToPy(84.91)).toBeCloseTo(25.685, 2);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
    expect(exclusiveFromHouseTy("084.9800A")).toBeCloseTo(84.98);
  });
  it("최근 월 — KST · 연도 넘김", () => {
    expect(recentMonths(3, new Date("2026-01-15T00:00:00Z"))).toEqual(["202601", "202512", "202511"]);
  });
  it("지역명 입력 검증", () => {
    expect(sanitizeRegion(" 인천광역시  서해구 청라동 ")).toBe("인천광역시 서해구 청라동");
    expect(sanitizeRegion("<script>")).toBeNull();
    expect(sanitizeRegion("a".repeat(41))).toBeNull();
    expect(sanitizeRegion(null)).toBeNull();
  });
});

describe("분석", () => {
  const notice = { HOUSE_MANAGE_NO: "1", HOUSE_NM: "청라 호수뷰 파크", RCRIT_PBLANC_DE: "2026-03-02", HSSPLY_ADRES: "인천광역시 서구 청라동 1" };
  const types = toSupplyTypes(notice, [
    { HOUSE_TY: "084.9700A", SUPLY_AR: "112.4", LTTOT_TOP_AMOUNT: "62000", SUPLY_HSHLDCO: "100" },
    { HOUSE_TY: "039.0000", SUPLY_AR: "55", LTTOT_TOP_AMOUNT: "30000" },
    { HOUSE_TY: "059.9000", SUPLY_AR: "", LTTOT_TOP_AMOUNT: "40000" },
  ]);
  it("주택형 — 면적 제외 · 결측 제외 · 공급평당", () => {
    expect(types.types).toHaveLength(1);
    expect(types.excluded).toEqual({ area: 1, missing: 1 });
    expect(types.types[0].perSupplyPy).toBeCloseTo(62000 / (112.4 / 3.305785), 6);
  });
  it("분양권 — 해제·타동 제외, 청약홈 최고가 매칭", () => {
    const r = analyzePresale(parseXmlItems(XML), "청라동", types.types);
    expect(r.n).toBe(1);
    expect(r.excluded.find((e) => e.reason.startsWith("해제"))!.count).toBe(1);
    expect(r.premium.matched).toBe(1);
    expect(r.premium.median).toBe(3000);
  });
  it("전세 — 월세 제외", () => {
    const r = analyzeRent(
      [
        { umdNm: "청라동", deposit: "45,000", monthlyRent: "0", excluUseAr: "84.9" },
        { umdNm: "청라동", deposit: "10,000", monthlyRent: "120", excluUseAr: "84.9" },
        { umdNm: "청라동", deposit: "31,000", monthlyRent: "0", excluUseAr: "59.8" },
      ],
      "청라동",
    );
    expect(r.median84).toBe(45000);
    expect(r.median59).toBe(31000);
    expect(r.excluded.find((e) => e.reason.startsWith("월세"))!.count).toBe(1);
  });
  it("공고 분류 — 청라동 우선, 국민주택 제외", () => {
    const c = classifyNotices(
      [notice, { HSSPLY_ADRES: "인천광역시 서구 가정동", HOUSE_NM: "x" }, { HSSPLY_ADRES: "인천광역시 서구 청라동", HOUSE_DTL_SECD_NM: "국민" }],
      "청라동",
      ["서해구", "서구"],
    );
    expect(c.tierA).toHaveLength(1);
    expect(c.tierB).toHaveLength(1);
    expect(c.excluded.publicOrRental).toBe(1);
  });
  it("경쟁률 — 순위 합산 · 미달 판정 · 충족률", () => {
    const t = analyzeCompetition(
      [
        { HOUSE_TY: "084A", SUPLY_HSHLDCO: "100", REQ_CNT: "60", SUBSCRPT_RANK_CODE: "1" },
        { HOUSE_TY: "084A", SUPLY_HSHLDCO: "100", REQ_CNT: "20", SUBSCRPT_RANK_CODE: "2" },
        { HOUSE_TY: "059A", SUPLY_HSHLDCO: "50", REQ_CNT: "500", SUBSCRPT_RANK_CODE: "1" },
      ],
      "x",
    );
    const s = summarizeCompetition(t);
    expect(s.unmetTypes).toBe(1);
    expect(s.fillRatio).toBeCloseTo((80 + 50) / 150, 6);
  });
});

describe("적용 규칙", () => {
  it("희망가 상한 · 계약 환산 · 무순위 차감", () => {
    const a = applyRules({ hopeAvgPerPy: 1775.88, marketMedianPerPy: 2000, fillRatio: 1, remainingNotices: 1, premiumMatched: 0, premiumBelowTop: 0 });
    expect(a.price).toBeCloseTo(1775.88, 2);
    expect(a.rate).toBeCloseTo(0.8, 6);
  });
  it("시장가 하회 · 데이터 없음", () => {
    const a = applyRules({ hopeAvgPerPy: 1775.88, marketMedianPerPy: 1700, fillRatio: null, remainingNotices: 0, premiumMatched: 4, premiumBelowTop: 2 });
    expect(a.price).toBeCloseTo(1700 * 0.97 * 0.98, 6);
    expect(a.rate).toBeNull();
  });
});
