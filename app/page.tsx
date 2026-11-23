import Scene from "@/components/scene/Scene";
import FilmFx from "@/components/FilmFx";
import Header from "@/components/site/Header";
import QuickMenu from "@/components/site/QuickMenu";
import PresenterBar from "@/components/site/PresenterBar";
import Intro from "@/components/site/Intro";
import SmoothScroll from "@/components/site/SmoothScroll";
import { PlanProvider } from "@/components/plan/PlanProvider";
import { Inputs, Opinion, Overview } from "@/components/doc/Static";
import { Core } from "@/components/doc/Core";
import { Location, SitePlan } from "@/components/doc/Place";
import { Calculator, Market, Signals, Thresholds, Verify } from "@/components/doc/Live";
import {
  HOPE_APT_REVENUE,
  HOPE_AVG_PER_PY,
  HOPE_COMMERCIAL_REVENUE,
  INPUTS,
  PF_LIMIT_TARGET,
  breakevenRate,
  endingCash,
} from "@/lib/finance";
import { PROJECT } from "@/lib/project";
import { eok, m, pct } from "@/lib/format";

export default function Page() {
  const revenue = HOPE_APT_REVENUE + HOPE_COMMERCIAL_REVENUE;
  const cash = endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: 1 }).cash;
  const pfRate = breakevenRate(HOPE_AVG_PER_PY, PF_LIMIT_TARGET);

  const keyFigures: [string, string, string][] = [
    ["대지면적", m(PROJECT.siteM2), "㎡"],
    ["규모", "지하 2층 – 지상 29층", "8개동"],
    ["세대수", m(PROJECT.households), "세대"],
    ["총 분양수입", m(revenue / 100), "억원"],
    ["입주 예정", "2029.11", ""],
  ];

  return (
    <PlanProvider>
      <Intro />
      <SmoothScroll />
      <Scene />
      <FilmFx />
      <div className="scene-veil" aria-hidden="true" />
      <Header baseDate={PROJECT.baseDate} />
      <QuickMenu />
      <PresenterBar />
      <a id="skip-film" href="#overview" className="skip-film">3D 투어 건너뛰고 사업개요 보기 ↓</a>

      <main id="top">
        {/* ── 히어로 ── */}
        <section className="film film-cover" data-shot="0" data-see="1">
          <div className="cover-inner">
            <p className="cover-kicker">
              <span>사업계획서</span>
              <span>시행사 사업 PM 검토본</span>
              <span>기준일 {PROJECT.baseDate.replaceAll("-", ".")}</span>
            </p>
            <h1>
              호수공원 첫 열,
              <br />
              청라 레이크 포레
            </h1>
            <p className="cover-sub">인천광역시 서해구 청라동 · 청라호수공원 북측 · 공동주택 {PROJECT.households}세대</p>
            <div className="cover-cta">
              <a href="#core" className="btn btn-primary">핵심 분석 보기</a>
              <a href="#overview" className="btn btn-ghost">사업개요</a>
            </div>
          </div>
          <dl className="keybar">
            {keyFigures.map(([k, v, u]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  {v}
                  {u && <small>{u}</small>}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── 필름: 스크롤에 따라 카메라가 단지를 따라간다 ── */}
        <section className="film film-left" data-shot="1" data-see="1">
          <div className="film-card">
            <p className="film-kicker">대지 · 규모</p>
            <p className="film-big">24,800<small>㎡</small></p>
            <dl className="film-dl">
              <div><dt>연면적</dt><dd>98,500㎡</dd></div>
              <div><dt>건폐율 · 용적률</dt><dd>19.4% · 219.8%</dd></div>
              <div><dt>규모</dt><dd>지하 2층 – 지상 29층 · 8개동</dd></div>
            </dl>
            <p className="film-foot">화면의 배치는 연면적·층수에 맞춘 매스 스터디이며 실제 배치도가 아닙니다.</p>
          </div>
        </section>

        <section className="film film-right" data-shot="2" data-see="1">
          <div className="film-card">
            <p className="film-kicker">희망 분양가 · 분양률 100%</p>
            <p className="film-big">{eok(revenue, 0)}</p>
            <p className="film-text">
              총 분양수입입니다. 총투자비 <b>{eok(INPUTS.totalInvestment, 0)}</b>을 쓰고 남는 기말현금은 <b>{eok(cash, 0)}</b>, 분양수입의 {pct(cash / revenue)}입니다.
            </p>
          </div>
        </section>

        <section className="film film-left" data-shot="3" data-see="1">
          <div className="film-card">
            <p className="film-kicker">시공 · 도급</p>
            <p className="film-big">1,890<small>억원</small></p>
            <p className="film-text">
              이 중 <b>420억원은 유보금</b>입니다. 본PF를 모두 갚은 뒤에야 시공사가 받습니다. 시공사의 2025년 말 현금성자산은 480억원입니다.
            </p>
          </div>
        </section>

        <section className="film film-night" data-shot="4" data-see="1">
          <div className="film-card">
            <p className="film-kicker">상환 한계선</p>
            <p className="film-big">{pct(pfRate)}</p>
            <p className="film-text">
              창 하나를 한 세대로 봅니다. 본PF 1,300억원을 전액 갚으려면 희망가 기준으로 이만큼 불이 켜져야 합니다. 이보다 어두우면 대주단이 손실을 봅니다.
            </p>
          </div>
        </section>
        <div data-film-end aria-hidden="true" />

        {/* ── 문서 ── */}
        <div className="paper">
          <div className="paper-head">
            <p className="paper-kicker">살아있는 사업계획서</p>
            <p className="paper-title">숫자는 소요자금표에서, 가정은 공공데이터에서.</p>
            <p className="paper-sub">단위 — 금액 백만원 · 평당가 만원(공급면적 기준). 시장 자료는 서버가 하루 한 번 새로 받습니다.</p>
          </div>
          <Core />
          <Overview />
          <Location />
          <SitePlan />
          <Inputs />
          <Market />
        </div>

        <Calculator />

        <div className="paper">
          <Thresholds />
          <Signals />
          <Opinion />
          <Verify />
        </div>

        <footer className="end" data-shot="7" data-see="1">
          <div className="end-inner">
            <p className="end-mark">청라 레이크 포레</p>
            <dl className="end-info">
              <div><dt>사업명</dt><dd>{PROJECT.fullName}</dd></div>
              <div><dt>시행</dt><dd>{PROJECT.developer}</dd></div>
              <div><dt>시공</dt><dd>{PROJECT.contractor}</dd></div>
              <div><dt>기준일</dt><dd>{PROJECT.baseDate}</dd></div>
            </dl>
            <p>본 사업장·시행사·시공사·재무 자료는 교육 목적의 100% 합성 데이터입니다. 실재하는 사업장·법인과 무관하며 투자 판단의 근거로 사용할 수 없습니다.</p>
            <p>시장 자료 출처 — 공공데이터포털: 행정안전부 법정동코드 · 국토교통부 아파트 분양권전매/전월세 실거래가 · 한국부동산원 청약홈 분양정보 · 경쟁률.</p>
          </div>
        </footer>
      </main>
    </PlanProvider>
  );
}
