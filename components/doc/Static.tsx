import {
  HOPE_APT_REVENUE,
  HOPE_AVG_PER_PY,
  HOPE_COMMERCIAL_REVENUE,
  INPUTS,
  TOTAL_SUPPLY_PY,
  breakevenPrice,
  breakevenRate,
  endingCash,
  fillBlanks,
  PF_LIMIT_TARGET,
} from "@/lib/finance";
import { CONTRACT, CONTRACTOR_FIN as F, LOANS, PROJECT, RATES, UNIT_TYPES, COMMERCIAL } from "@/lib/project";
import { eok, m, pct } from "@/lib/format";
import { SectionHead } from "./Heads";
export { SectionHead };

const kindLabel = { fixed: "고정", variable: "변동", offset: "상쇄" } as const;

/* ───────── Ⅰ 사업 개요 ───────── */

export function Overview() {
  const facts: [string, string][] = [
    ["사업위치", PROJECT.location],
    ["행정구역", PROJECT.locationNote],
    ["대지 · 연면적", `${m(PROJECT.siteM2, 1)}㎡ (${m(PROJECT.sitePy, 1)}평) · ${m(PROJECT.grossM2, 1)}㎡`],
    ["건폐율 · 용적률", `${PROJECT.bcr}% · ${PROJECT.far}%`],
    ["규모", `${PROJECT.scale} · ${PROJECT.households}세대 전 세대 일반분양`],
    ["부대시설", `근린생활시설 ${COMMERCIAL.units}호 · 공급 ${m(COMMERCIAL.supplyPy, 1)}평`],
    ["시행 · 시공", `${PROJECT.developer} · ${PROJECT.contractor} (시평 27위 가정)`],
    ["사업계획승인", PROJECT.approval],
    ["공사 · 입주", `${PROJECT.construction} · 입주 ${PROJECT.moveIn}`],
    ["본PF 만기", PROJECT.pfMaturity],
  ];
  const timeline: [string, string, string][] = [
    ["2026-09", "진행", "브릿지론 기표 · 토지 잔금"],
    ["2027-03", "예정", "본PF(Tr-A) 기표 · 브릿지론 상환 · 착공"],
    ["2027-04", "예정", "분양 개시 (612세대)"],
    ["2027-10 ~ 2028-12", "예정", "중도금 6회 (각 10%, 이자후불제)"],
    ["2029-11", "예정", "준공 · 입주 · 잔금"],
    ["2029-11 ~ 2030-03", "예정", "본PF 원리금 상환"],
    ["2030-03", "예정", "유보금 · 시행사 대여금 지급 (후순위)"],
  ];
  return (
    <section id="overview" className="doc-sec" data-shot="5">
      <SectionHead no="01" group="사업안내" title="사업개요" lede="기준일 2026-09-30. 사업장·법인·재무는 전부 교육용 합성 자료이며, 시장 자료만 공공데이터포털의 실제 공개자료입니다." />
      <div className="grid-2">
        <dl className="facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <h3 className="h3">일정</h3>
          <ol className="timeline">
            {timeline.map(([d, , t]) => (
              <li key={d}>
                <span className="t-date">{d}</span>
                <span className="t-text">{t}</span>
              </li>
            ))}
          </ol>
          <h3 className="h3">차입 구조</h3>
          <table className="tbl compact">
            <thead>
              <tr><th>구분</th><th className="num">한도</th><th className="num">금리</th><th>기간</th></tr>
            </thead>
            <tbody>
              {LOANS.map((l) => (
                <tr key={l.name}>
                  <td>{l.name}<span className="sub">{l.note}</span></td>
                  <td className="num">{m(l.limit)}</td>
                  <td className="num">{l.rate.toFixed(1)}%</td>
                  <td>{l.term}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">본PF 130,000백만원. 분양수입은 신탁계좌로 입금되어 필수경비 후 본PF 원리금에 우선 충당됩니다.</p>
        </div>
      </div>
      <h3 className="h3">분양 계획(안) — 희망 평당가</h3>
      <table className="tbl">
        <thead>
          <tr>
            <th>타입</th><th className="num">전용㎡</th><th className="num">공급평</th><th className="num">세대</th>
            <th className="num">희망 평당가(공급)</th><th className="num">희망 평당가(전용)</th><th className="num">세대당 분양가</th><th className="num">타입 합계</th>
          </tr>
        </thead>
        <tbody>
          {UNIT_TYPES.map((t) => (
            <tr key={t.type}>
              <td>{t.type}</td>
              <td className="num">{t.exclusiveM2.toFixed(2)}</td>
              <td className="num">{t.supplyPy.toFixed(1)}</td>
              <td className="num">{t.units}</td>
              <td className="num">{m(t.hopePerPy)}</td>
              <td className="num">{m(t.hopePerExclusivePy)}</td>
              <td className="num">{m((t.supplyPy * t.hopePerPy) / 100, 2)}</td>
              <td className="num">{m((t.supplyPy * t.hopePerPy * t.units) / 100, 2)}</td>
            </tr>
          ))}
          <tr className="sum">
            <td>아파트 계</td><td /><td className="num">{m(TOTAL_SUPPLY_PY, 1)}</td><td className="num">612</td>
            <td className="num">{m(HOPE_AVG_PER_PY, 1)}<span className="sub">가중평균</span></td><td /><td /><td className="num">{m(HOPE_APT_REVENUE, 2)}</td>
          </tr>
          <tr>
            <td>근린생활시설</td><td /><td className="num">{m(COMMERCIAL.supplyPy, 1)}</td><td className="num">{COMMERCIAL.units}호</td>
            <td className="num">{m(COMMERCIAL.hopePerPy)}</td><td /><td /><td className="num">{m(HOPE_COMMERCIAL_REVENUE, 2)}</td>
          </tr>
          <tr className="sum strong">
            <td colSpan={7}>총 분양수입 (희망가 · 100%)</td>
            <td className="num">{m(HOPE_APT_REVENUE + HOPE_COMMERCIAL_REVENUE, 2)}</td>
          </tr>
        </tbody>
      </table>
      <p className="note">단위: 금액 백만원, 평당가 만원. 세대당 분양가 = 공급면적 × 평당가 ÷ 100. 청약홈 분양가는 공급면적 기준, 실거래가는 전용면적 기준입니다.</p>
    </section>
  );
}

/* ───────── Ⅱ 입력값 산출 ───────── */

export function Inputs() {
  const b = fillBlanks();
  const formulas: Record<string, string> = {
    학교용지부담금: `${m(HOPE_APT_REVENUE, 2)} × 0.8%`,
    "분양대행수수료(아파트)": `3백만원 × 612세대`,
    사업예비비: `189,000 × 3%`,
    중도금이자후불제: `${m(HOPE_APT_REVENUE, 2)} × 60% × 5.2% × 18/12`,
  };
  const groups = [...new Set(INPUTS.items.map((i) => i.group))];
  const comm = HOPE_COMMERCIAL_REVENUE;
  const schoolWithComm = (HOPE_APT_REVENUE + comm) * RATES.schoolLevy;
  return (
    <section id="inputs" className="doc-sec" data-shot="5">
      <SectionHead
        no="04"
        group="사업수지"
        title="입력값 산출"
        lede="02 소요자금의 공란 4개를 산정근거의 요율로 채우고, 모든 항목을 고정비 · 변동비 · 상쇄 항목으로 나눕니다. 이 표가 틀리면 이후의 모든 숫자가 틀립니다."
      />

      <div className="blanks">
        {[
          ["학교용지부담금", b.schoolLevy, "변동", formulas["학교용지부담금"]],
          ["분양대행수수료(아파트)", b.agencyFeeApt, "변동", formulas["분양대행수수료(아파트)"]],
          ["사업예비비", b.reserve, "고정", formulas["사업예비비"]],
          ["중도금이자후불제", b.midPaymentInterest, "상쇄", formulas["중도금이자후불제"]],
        ].map(([name, v, k, f]) => (
          <div className="blank" key={name as string}>
            <span className="b-kind">{k as string}</span>
            <span className="b-name">{name as string}</span>
            <span className="b-val">{m(v as number, 2)}</span>
            <span className="b-f">{f as string}</span>
          </div>
        ))}
      </div>

      <div className="ledger">
        <div className="ledger-row strong">
          <span>고정비</span><span className="num">{m(INPUTS.fixed, 2)}</span>
          <span className="ex">소요자금 − 변동비 − 상쇄 항목. 금융비용 {m(INPUTS.financing)} · 사업예비비 {m(b.reserve)} · 시행사 대여금 상환 6,000 포함</span>
        </div>
        <div className="ledger-row">
          <span>변동비 <i>(100% 분양 시)</i></span><span className="num">{m(INPUTS.variable, 2)}</span>
          <span className="ex">학교용지부담금 0.8% × 아파트 분양수입 + 분양대행 300만원 × 분양세대 — 분양률에 비례</span>
        </div>
        <div className="ledger-row">
          <span>상쇄 항목</span><span className="num">{m(INPUTS.offset, 2)}</span>
          <span className="ex">중도금이자후불제 {m(b.midPaymentInterest, 2)} + 이자상환적립계정 1,872 — 01 Ⅲ-1: 시행사 선지급 후 입주 시 회수 · 만기 환입이라 유입과 지출에 같은 금액</span>
        </div>
        <div className="ledger-row strong">
          <span>총사업비</span><span className="num">{m(INPUTS.totalProjectCost, 2)}</span><span className="ex">고정비 + 변동비</span>
        </div>
        <div className="ledger-row strong">
          <span>총투자비</span><span className="num">{m(INPUTS.totalInvestment, 2)}</span><span className="ex">고정비 + 변동비 + 상쇄 항목 = 소요자금 전 항목 합계와 일치</span>
        </div>
        <div className="ledger-row">
          <span>기타유입</span><span className="num">{m(INPUTS.otherInflow)}</span><span className="ex">시행사 출자금·대여금 22,000 + 예치금 이자수입 1,450 (01 Ⅲ-2)</span>
        </div>
        <div className="ledger-row">
          <span>후순위</span><span className="num">{m(INPUTS.subordinated)}</span><span className="ex">07 제9조 공사비 유보금 42,000 + 시행사 대여금 6,000 — 본PF 원리금 전액 상환 이후 지급</span>
        </div>
      </div>

      <details className="fold">
        <summary>소요자금 전 항목 ({INPUTS.items.length}개) 펼치기</summary>
        <table className="tbl">
          <thead>
            <tr><th>항목</th><th className="num">금액</th><th>구분</th><th>산정근거</th></tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const rows = INPUTS.items.filter((i) => i.group === g);
              const sub = rows.reduce((s, r) => s + r.value, 0);
              return [
                <tr key={g} className="grp"><td colSpan={2}>{g}</td><td /><td className="num">{m(sub, 2)}</td></tr>,
                ...rows.map((r) => (
                  <tr key={r.name} className={r.computed ? "computed" : undefined}>
                    <td>{r.name}</td>
                    <td className="num">{m(r.value, r.computed ? 2 : 0)}</td>
                    <td><span className={`tag ${r.kind}`}>{kindLabel[r.kind]}</span></td>
                    <td>{r.computed ? formulas[r.name] : r.basis}</td>
                  </tr>
                )),
              ];
            })}
            <tr className="sum strong"><td>합계 (총투자비)</td><td className="num">{m(INPUTS.totalInvestment, 2)}</td><td /><td /></tr>
          </tbody>
        </table>
      </details>

      <div className="aside">
        <h4>해석상 판단 2건</h4>
        <p>
          <b>학교용지부담금의 부과 기준.</b> 02는 ‘총분양가 × 0.8%’로 적었으나, 「학교용지 확보 등에 관한 특례법」 제5조의2는 공동주택 분양가격의 1천분의 8로 정합니다.
          근린생활시설 분양가를 기준에서 뺐습니다. 포함할 경우 {m(schoolWithComm, 2)}(+{m(schoolWithComm - b.schoolLevy, 2)})이며, 기말현금이 그만큼 줄어듭니다.
        </p>
        <p>
          <b>중도금이자후불제의 기준.</b> 이자후불제는 아파트 수분양자의 중도금 대출에 적용되므로 아파트 분양가 기준으로 계산했습니다. 상쇄 항목이라 어느 쪽을 택해도 기말현금은 변하지 않고, 시행사가 입주 시까지 선부담하는 유동성만 달라집니다.
        </p>
        <p>
          <b>부가가치세.</b> 전 타입이 전용 85㎡ 이하(최대 84.96㎡)라 국민주택 공급분으로 부가세 면세 대상이며, 도급금액도 부가세 별도로 계약되어 본 수지는 부가세를 반영하지 않습니다. 근린생활시설 분양분의 부가세는 범위에서 제외했습니다.
        </p>
      </div>
    </section>
  );
}

/* ───────── Ⅵ 의견 ───────── */

export function Opinion() {
  const hope = HOPE_AVG_PER_PY;
  const cashHope = endingCash({ aptPerPy: hope, salesRate: 1 }).cash;
  const rev = HOPE_APT_REVENUE + HOPE_COMMERCIAL_REVENUE;
  const be0p = breakevenPrice(1, 0);
  const bePfp = breakevenPrice(1, PF_LIMIT_TARGET);
  const be0r = breakevenRate(hope, 0);
  const bePfr = breakevenRate(hope, PF_LIMIT_TARGET);
  const c70 = endingCash({ aptPerPy: hope, salesRate: 0.7 }).cash;
  const pfShort70 = -(c70 - PF_LIMIT_TARGET);
  const unsoldValue = 0.3 * rev;
  const monthlyInterest = (105000 * 0.065 + 25000 * 0.085) / 12;
  const dailyPenalty = CONTRACT.amount * CONTRACT.delayPenaltyPerDay;
  const capDays = Math.ceil((CONTRACT.amount * CONTRACT.delayPenaltyCap) / dailyPenalty);
  const last = 2;

  return (
    <section id="opinion" className="doc-sec" data-shot="5">
      <SectionHead no="08" group="검토의견" title="리스크와 의견" lede="리스크마다 근거 숫자 · 현실화 조건 · 완화 방안을 붙였습니다. 확약이 있다는 것과 이행할 능력이 있다는 것은 다른 문제입니다." />

      <ol className="risks">
        <li>
          <h3>분양가 하방 — 이익 완충이 얇다</h3>
          <dl>
            <dt>근거</dt>
            <dd>
              희망가({m(hope, 1)}만원/평)로 100% 분양해도 기말현금은 {eok(cashHope)}, 분양수입의 {pct(cashHope / rev)}입니다.
              전액 회수 평당가는 {m(be0p, 1)}만원(희망 대비 {pct(be0p / hope - 1)}), 본PF 상환 한계 평당가는 {m(bePfp, 1)}만원({pct(bePfp / hope - 1)})입니다.
            </dd>
            <dt>현실화 조건</dt>
            <dd>Ⅲ장의 인근 신규 공급평당가가 {m(be0p, 0)}만원 아래에서 형성되거나, 분양 촉진을 위한 할인이 {pct(1 - be0p / hope)}를 넘을 때 후순위(유보금·대여금)부터 손실이 납니다.</dd>
            <dt>완화</dt>
            <dd>분양가 확정 전 Ⅲ·Ⅴ장 신호로 재검증 · 할인분양 범위와 결정 권한을 대주단과 사전 합의 · 근린생활시설 별도 매각으로 고정 유입 확보.</dd>
          </dl>
        </li>
        <li>
          <h3>분양률 — 미분양담보대출은 손실을 흡수하지 않는다</h3>
          <dl>
            <dt>근거</dt>
            <dd>
              희망가 기준 본PF 상환 한계 분양률 {pct(bePfr)}, 전액 회수 분양률 {pct(be0r)}. 분양률 70%면 후순위 480억 전액 손실에 더해 본PF {eok(pfShort70)}가 미상환으로 남습니다.
              미분양담보대출 한도 400억은 이를 메울 수 있지만 연 9.0%·2030-09 만기의 <em>차입</em>이며, 상환재원은 결국 잔여 약 {Math.round(612 * 0.3)}세대 매각대금(희망가 {eok(unsoldValue)})입니다.
            </dd>
            <dt>현실화 조건</dt>
            <dd>인근 1·2순위 미달 주택형과 무순위 공고가 이어지고, 입주 시점 전세가가 잔금·중도금 상환액(분양가의 90%)에 크게 못 미칠 때.</dd>
            <dt>완화</dt>
            <dd>중도금 집단대출·잔금대출 협약 선확보 · 초기 6개월 계약률 트리거(미달 시 할인·임대전환 결정) · 미분양담보대출 실행조건(LTV·담보평가)을 지금 확정.</dd>
          </dl>
        </li>
        <li>
          <h3>시공사 신용 · 공사비 — 확약의 분모가 너무 크다</h3>
          <dl>
            <dt>근거</dt>
            <dd>
              (주)대주건설 {F.years[last]}년 영업손실 {m(F.operatingIncome[last])} · 순손실 {m(F.netIncome[last])}, 부채비율 {F.debtRatio[0]}% → {F.debtRatio[last]}%,
              순차입금 {m(F.netDebt[last])} 대비 현금성자산 {m(F.cash[last])}. PF 지급보증 {m(F.pfGuarantee)}(자기자본의 {F.pfGuaranteeToEquity}%), 책임준공 확약 {F.completionGuaranteeSites}개 현장, 회사채 {F.rating}.
              본 현장의 후순위 유보금 42,000은 시공사 현금성자산의 {pct(42000 / F.cash[last])}에 해당합니다.
            </dd>
            <dt>현실화 조건</dt>
            <dd>BBB− 이하 하향, 타 현장 PF 보증 현실화로 유동성이 막히면 기성 지연 → 공정 중단. 07 제3조로 착공 90일 이후 건설공사비지수 3% 이상 변동 시 공사비 증액 협의가 열려, 사업예비비 5,670(3%)을 초과하는 증액은 고정비를 직접 올립니다.</dd>
            <dt>완화</dt>
            <dd>신탁사 책임준공형 관리형토지신탁 또는 신용등급 A− 이상 연대 책임준공 · 등급 하향을 대체시공사 선정 트리거로 명문화 · 물가변동 조정 상한을 사업예비비 범위로 합의.</dd>
          </dl>
        </li>
      </ol>

      <div className="opinion-block">
        <h3 className="h3">시공사 책임준공의 실효성</h3>
        <div className="grid-2">
          <table className="tbl compact">
            <thead>
              <tr><th>06 재무</th>{F.years.map((y) => <th key={y} className="num">{y}</th>)}</tr>
            </thead>
            <tbody>
              {([
                ["매출액", F.revenue],
                ["영업이익", F.operatingIncome],
                ["당기순이익", F.netIncome],
                ["자본총계", F.equity],
                ["순차입금", F.netDebt],
                ["현금성자산", F.cash],
              ] as [string, number[]][]).map(([k, v]) => (
                <tr key={k}><td>{k}</td>{v.map((x, i) => <td key={i} className={`num ${x < 0 ? "neg" : ""}`}>{m(x)}</td>)}</tr>
              ))}
              {([
                ["부채비율", F.debtRatio],
                ["차입금의존도", F.debtDependency],
                ["영업이익률", F.opMargin],
              ] as [string, number[]][]).map(([k, v]) => (
                <tr key={k}><td>{k}</td>{v.map((x, i) => <td key={i} className={`num ${x < 0 ? "neg" : ""}`}>{x.toFixed(1)}%</td>)}</tr>
              ))}
            </tbody>
          </table>
          <ol className="verdict">
            <li><b>손해배상형 확약에 그친다.</b> 제12조②는 기한 도과 후 6개월 유예, 미이행 시 손해배상입니다. 대주단 대출의 조건부 채무인수로 전환되는 장치가 없어, 시공사가 지급불능이면 배상청구권은 무담보 채권에 불과합니다.</li>
            <li><b>지체상금은 이자를 덮지만 상한이 있다.</b> 일 {m(dailyPenalty, 1)}(도급액 0.05%)로 본PF 월 이자 약 {m(monthlyInterest, 0)}를 넘어서나, 상한 10%({m(CONTRACT.amount * CONTRACT.delayPenaltyCap)})에 {capDays}일이면 도달합니다.</li>
            <li><b>도산 시 해지권만 있다.</b> 제12조③은 회생·워크아웃 시 해지와 대체시공을 허용할 뿐, 대체시공 비용 증가분은 시행사 부담입니다.</li>
            <li><b>미분양 매입확약이 없다.</b> 제18조로 분양 리스크는 전부 시행사와 대주단에 남습니다.</li>
            <li><b>유보금은 양날이다.</b> 42,000 후순위 유보는 시공사를 준공에 묶어 두지만, 제9조④의 ‘부족분 별도 협의’는 분양 부진 시 분쟁과 공정 지연의 동기가 됩니다.</li>
          </ol>
        </div>
        <p className="conclusion">
          결론 — 책임준공 확약은 존재하나 이행능력은 3년 연속 약화되었습니다. 23개 현장이 자기자본 {m(F.equity[last])}의 같은 재무를 공유하므로, 본 확약을 독립적 신용보강으로 평가하지 않습니다.
        </p>
      </div>

      <div className="opinion-block">
        <h3 className="h3">추진 조건</h3>
        <ol className="conditions">
          <li><b>분양 가정의 시장 여유.</b> 적용 분양가 기준 본PF 상환 한계 평당가가 Ⅲ장 인근 공급평당가보다 15% 이상 낮고, 상환 한계 분양률이 시장 계약환산 분양률보다 10%p 이상 낮을 것.</li>
          <li><b>책임준공 보강.</b> 신탁사 책임준공형 관리형토지신탁 또는 A− 이상 연대 책임준공, 그리고 시공사 등급 BBB− 하향 시 대체시공사 선정 트리거.</li>
          <li><b>공사비 상한.</b> 07 제3조 물가변동 조정 누계를 사업예비비 5,670 범위로 제한.</li>
          <li><b>분양 트리거.</b> 분양 개시 후 6개월 계약률이 상환 한계 분양률에 미달하면 할인 · 임대전환을 결정하는 절차와 할인 하한(상환 한계 평당가)을 대주단과 사전 합의.</li>
          <li><b>유동성 장치.</b> 미분양담보대출 실행조건 확정, 이자상환적립계정 3개월분 유지, 중도금 집단대출 협약 선확보.</li>
        </ol>
      </div>
    </section>
  );
}
