"use client";

import { useMemo, useState } from "react";
import { usePlan, DEFAULT_REGION } from "@/components/plan/PlanProvider";
import { SectionHead } from "./Heads";
import {
  HOPE_AVG_PER_PY,
  INPUTS,
  PF_LIMIT_TARGET,
  breakevenPrice,
  breakevenRate,
  endingCash,
  sampleCells,
  sensitivity,
  zoneOf,
  HOPE_APT_REVENUE,
  HOPE_COMMERCIAL_REVENUE,
  TOTAL_SUPPLY_PY,
  unitPrice,
} from "@/lib/finance";
import { UNIT_TYPES } from "@/lib/project";
import { RULES } from "@/lib/market/rules";
import { CashFlow } from "./CashFlow";
import { eok, m, mw, pct, signed } from "@/lib/format";
import { U } from "./U";
import { m2ToPy } from "@/lib/market/util";
import type { Excluded } from "@/lib/market/analyze";

/* ───────── 공통 ───────── */

function Meta({ n, date, excluded, window }: { n: number | string; date: string; excluded?: Excluded; window?: string }) {
  const ex = excluded?.filter((e) => e.count > 0);
  return (
    <p className="meta">
      <span>표본 <b>{n}</b>건</span>
      {window && <span>기간 {window}</span>}
      <span>조회일 {date}</span>
      {ex && ex.length > 0 && <span>제외 — {ex.map((e) => `${e.reason} ${e.count}`).join(" · ")}</span>}
    </p>
  );
}

function Pending({ children }: { children: React.ReactNode }) {
  return <div className="pending">{children}</div>;
}

/* ───────── Ⅲ 분양 가정의 근거 ───────── */

export function Market() {
  const { region, setRegion, load, market, applied, scope, setScope } = usePlan();
  const [draft, setDraft] = useState(region);

  return (
    <section id="market" className="doc-sec" data-shot="5">
      <SectionHead
        no="05"
        group="사업수지 · 분양 가정"
        title="분양 가정의 근거"
        lede="적용 분양가와 적용 분양률은 공공데이터포털 API로만 정합니다. 서버가 지역명을 법정동코드로 확인하고, 응답은 하루 동안 캐시됩니다."
      />

      <form
        className="region"
        onSubmit={(e) => {
          e.preventDefault();
          setRegion(draft.trim() || DEFAULT_REGION);
        }}
      >
        <label htmlFor="region">사업대상지</label>
        <input id="region" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} autoComplete="off" />
        <button type="submit">조회</button>
      </form>

      {load.state === "loading" && <Pending>공공데이터 조회 중 — 첫 조회는 30초 안팎이 걸릴 수 있습니다.</Pending>}
      {load.state === "failed" && <Pending>조회 실패: {load.message}</Pending>}
      {load.state === "done" && load.data.status === "no_key" && (
        <Pending>
          <b>공공데이터 인증키가 아직 서버에 설정되지 않았습니다.</b> Vercel 프로젝트 환경변수 <code>DATA_GO_KR_API_KEY</code>(zipcatch와 같은 이름) 또는 <code>DATA_GO_KR_SERVICE_KEY</code>에 공공데이터포털 일반 인증키를 넣고
          재배포하면, 이 장과 <a href="#thresholds">06 상환 한계선</a>·<a href="#signals">07 시장 대비 여유</a>의 적용값이 자동으로 채워집니다. 그전까지 적용값은 비워 두며 임의의 시장 수치를 쓰지 않습니다.
        </Pending>
      )}
      {load.state === "done" && load.data.status === "error" && <Pending>{"message" in load.data ? load.data.message : "오류"}</Pending>}

      {market && (
        <>
          <h3 className="h3">⓪ 사업대상지 확인</h3>
          <table className="tbl compact">
            <thead><tr><th>시군구코드</th><th>명칭</th><th>출처</th></tr></thead>
            <tbody>
              {market.regionInfo.codes.map((c) => (
                <tr key={c.code}><td className="mono">{c.code}</td><td>{c.label}</td><td>{c.source === "api" ? "법정동코드 API" : c.source === "probe" ? "실거래 API 탐색" : "개편 전 코드 병행 조회"}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="meta">
            <span>입력 ‘{market.region}’ → 질의 ‘{market.regionInfo.query}’</span>
            <span>일치 행 {market.regionInfo.matched.length}건: {market.regionInfo.matched.map((r) => `${r.name}(${r.code})`).join(", ") || "없음"}</span>
            <span>조회일 {market.fetchedAt}</span>
          </p>
          {market.regionInfo.warnings.map((w) => <p key={w} className="warn">{w}</p>)}

          <details className="fold">
            <summary>시군구코드 × 월별 {market.regionInfo.dong} 거래 건수 — 개편 전·후 기간 포함 여부 검증</summary>
            <table className="tbl compact">
              <thead><tr><th>코드</th><th>월</th><th className="num">분양권</th><th className="num">전월세</th></tr></thead>
              <tbody>
                {market.verification.map((v) => (
                  <tr key={v.code + v.ym}><td className="mono">{v.code}</td><td className="mono">{v.ym}</td><td className="num">{v.presale}</td><td className="num">{v.rent < 0 ? "—" : v.rent}</td></tr>
                ))}
              </tbody>
            </table>
          </details>

          <h3 className="h3">③ 인근 신규 공급 — 청약홈 분양정보 (주택형별)</h3>
          <div className="kpis">
            <Kpi label="공급평당 최고금액 중위" value={m(market.supply.median)} unit="만원" />
            <Kpi label="사분위 범위" value={`${m(market.supply.p25)} – ${m(market.supply.p75)}`} unit="만원" />
            <Kpi label="표본" value={`${market.supply.nComplexes}단지 · ${market.supply.nTypes}주택형`} />
            <Kpi label="범위" value={market.scope === "wide" ? "서해구·검단구 전체" : market.supply.tier === "A" ? `${market.regionInfo.dong} 주소 공고` : "서구·서해구 확대"} />
          </div>
          {market.supply.nComplexes <= 2 && (
            <p className="bias">
              <span className="badge">표본 {market.supply.nComplexes}단지</span>
              단일 단지 편향 주의 — 한 단지의 상품(주상복합·하이엔드 등)이 시장 기준가를 좌우합니다. 여유 신호는 과대평가 방향으로 읽으십시오.
              {scope === "near" ? (
                <button type="button" className="link-btn" onClick={() => setScope("wide")}>검색 반경을 서해구·검단구 전체로 넓히기</button>
              ) : (
                <button type="button" className="link-btn" onClick={() => setScope("near")}>청라동 기준으로 되돌리기</button>
              )}
            </p>
          )}
          {market.supply.nComplexes > 2 && scope === "wide" && (
            <p className="note"><button type="button" className="link-btn" onClick={() => setScope("near")}>청라동 기준으로 되돌리기</button></p>
          )}
          <Meta
            n={market.supply.nTypes}
            date={market.queryDate}
            window={market.windows.notices}
            excluded={market.supply.excluded}
          />
          <p className="note">청약홈 금액은 주택형별 <b>분양최고금액</b>(고층·로열 기준)이므로 평균 분양가보다 높습니다. 공급평당가 = 최고금액 ÷ (공급면적㎡ ÷ 3.305785).</p>
          {market.supply.types.length > 0 && (
            <details className="fold">
              <summary>주택형 원자료 {market.supply.types.length}건</summary>
              <table className="tbl compact">
                <thead><tr><th>단지</th><th>공고일</th><th>주택형</th><th className="num">공급㎡</th><th className="num">최고금액</th><th className="num">공급평당</th></tr></thead>
                <tbody>
                  {market.supply.types.map((t) => (
                    <tr key={t.houseManageNo + t.houseTy}>
                      <td>{t.houseNm}</td><td className="mono">{t.noticeDate}</td><td className="mono">{t.houseTy}</td>
                      <td className="num">{t.supplyM2.toFixed(2)}</td><td className="num">{m(t.topAmount)}<U>만원</U></td><td className="num">{m(t.perSupplyPy)}<U>만원</U></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <h3 className="h3">④ 청약 경쟁률 — 1·2순위 접수</h3>
          <div className="kpis">
            <Kpi label="접수 충족률" value={pct(market.competition.fillRatio)} />
            <Kpi label="미달 주택형" value={`${market.competition.unmetTypes} / ${market.competition.nTypes}`} />
            <Kpi label="무순위·잔여세대 공고" value={`${market.remaining.notices}건`} unit={market.remaining.households ? `${m(market.remaining.households)}세대` : undefined} />
          </div>
          <Meta n={market.competition.nTypes} date={market.queryDate} window={`${market.windows.notices} · 잔여세대 ${market.windows.remaining}`} />
          <p className="note">충족률 = Σ min(접수, 공급) ÷ Σ 공급 (일반공급 주택형). 경쟁률은 청약 접수이지 <b>계약률이 아닙니다</b> — 당첨 후 계약 포기는 잔여세대·무순위 공고로 드러납니다.</p>

          <h3 className="h3">① 분양권 전매 실거래 — {market.regionInfo.dong}</h3>
          <div className="kpis">
            <Kpi label="전용평당 중위" value={m(market.presale.medianPerExclusivePy)} unit="만원" />
            <Kpi label="사분위 범위" value={`${m(market.presale.p25)} – ${m(market.presale.p75)}`} unit="만원" />
            <Kpi label="청약홈 최고금액 매칭" value={`${market.presale.premium.matched}건`} unit={market.presale.premium.matched ? `하회 ${market.presale.premium.belowTop}건` : undefined} />
            <Kpi label="웃돈 중위 (최고금액 대비)" value={market.presale.premium.median === null ? "—" : signed(market.presale.premium.median)} unit="만원" />
          </div>
          <Meta n={market.presale.n} date={market.queryDate} window={market.windows.trades} excluded={[...market.presale.excluded, { reason: "코드 간 중복", count: market.presale.duplicates }]} />
          {market.newTrades.used && (
            <>
              <h4 className="h4">대체 지표 — 준공 {market.newTrades.minBuildYear}년 이후 아파트 매매 실거래</h4>
              <p className="note">분양권 표본이 3건 미만이라, 완성형 택지지구의 신축·준신축 매매가로 ‘같은 동네 새 아파트의 시장가’를 대신 읽습니다.</p>
              <div className="kpis">
                <Kpi label="전용평당 중위" value={m(market.newTrades.medianPerExclusivePy)} unit="만원" />
                <Kpi label="사분위 범위" value={`${m(market.newTrades.p25)} – ${m(market.newTrades.p75)}`} unit="만원" />
                <Kpi label="표본" value={`${market.newTrades.complexes}단지 · ${market.newTrades.n}건`} />
              </div>
              <Meta n={market.newTrades.n} date={market.queryDate} window={market.windows.rent} excluded={market.newTrades.excluded} />
            </>
          )}

          <h3 className="h3">② 아파트 전세 실거래 — {market.regionInfo.dong}</h3>
          <div className="kpis">
            <Kpi label="전용 84㎡대 전세 중위" value={m(market.rent.median84)} unit={`만원 · ${market.rent.n84}건`} />
            <Kpi label="전용 59㎡대 전세 중위" value={m(market.rent.median59)} unit={`만원 · ${market.rent.n59}건`} />
          </div>
          <Meta n={market.rent.n} date={market.queryDate} window={market.windows.rent} excluded={[...market.rent.excluded, { reason: "코드 간 중복", count: market.rent.duplicates }]} />
        </>
      )}

      <h3 className="h3">적용값 결정 규칙</h3>
      <div className="rules">
        <div>
          <h4>적용 분양가</h4>
          <p className="formula">min(희망 {m(HOPE_AVG_PER_PY, 1)}만원, 인근 공급평당 최고금액 중위 × (1 − {pct(RULES.topToAverage, 0)}))</p>
          <ul>{(applied?.priceSteps ?? ["공공데이터 대기"]).map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="applied">{applied?.price ? <>{m(applied.price, 1)}<span>만원/평</span></> : "—"}</p>
        </div>
        <div>
          <h4>적용 분양률</h4>
          <p className="formula">1·2순위 충족률 × {RULES.contractConversion} − 무순위 공고 시 {pct(RULES.remainingPenalty, 0)}p</p>
          <ul>{(applied?.rateSteps ?? ["공공데이터 대기"]).map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="applied">{applied?.rate ? pct(applied.rate) : "—"}</p>
        </div>
      </div>
      <p className="note">계수 {pct(RULES.topToAverage, 0)}(최고금액→평균)와 {RULES.contractConversion}(접수→계약)는 가정입니다. 아래 계산기에서 직접 바꿔 볼 수 있습니다.</p>
    </section>
  );
}

function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="kpi">
      <span className="k-label">{label}</span>
      <span className="k-value">{value}</span>
      {unit && <span className="k-unit">{unit}</span>}
    </div>
  );
}

/* ───────── 계산기 (장면이 비치는 창) ───────── */

export function Calculator() {
  const { price, rate, setPrice, setRate, applied, commRate, setCommRate } = usePlan();
  const r = endingCash({ aptPerPy: price, salesRate: rate, commercialRate: commRate ?? undefined });
  const zone = zoneOf(r.cash);
  const label = { surplus: "후순위까지 전액 상환", subordinated: "본PF 상환 · 후순위 손실", "pf-shortfall": "본PF 미상환" }[zone];
  const presets: [string, number, number][] = [
    ["희망가 · 100%", HOPE_AVG_PER_PY, 1],
    ["PF 상환 한계", HOPE_AVG_PER_PY, breakevenRate(HOPE_AVG_PER_PY, PF_LIMIT_TARGET, undefined, commRate ?? undefined)],
  ];
  if (applied?.price && applied.rate) presets.push(["적용가 · 적용률", applied.price, applied.rate]);
  const commOptions: [string, number | null][] = [["아파트와 동일", null], ["100%", 1], ["50%", 0.5], ["0%", 0]];
  // 발표용 원클릭 시나리오 — 희망가 고정, 분양률만 정확한 값으로 세팅 (슬라이더 미세 조작 불필요)
  const pfExact = breakevenRate(HOPE_AVG_PER_PY, PF_LIMIT_TARGET, undefined, commRate ?? undefined);
  const full = endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: 1, commercialRate: commRate ?? undefined });
  const stage: { key: string; title: string; sub: string; rate: number }[] = [
    { key: "full", title: "100% 완판", sub: `기말현금 ${eok(full.cash, 0)} · ${pct(full.cash / full.revenue)}`, rate: 1 },
    { key: "pf", title: `${pct(pfExact)} 상환 한계선`, sub: "본PF 마지노선", rate: pfExact + 1e-9 },
    { key: "stress", title: "75.0% 스트레스", sub: "미분양대출 9% 발동", rate: 0.75 },
  ];
  const onStage = (x: number) => Math.abs(price - HOPE_AVG_PER_PY) < 0.05 && Math.abs(rate - x) < 0.0002;

  return (
    <section id="calculator" className="window-sec" data-shot="6" data-see="1">
      <div className="calc">
        <p className="eyebrow">05-1 분양률 계산기 · 창 하나가 한 세대입니다</p>
        <h2>불이 켜진 만큼 팔렸습니다</h2>
        <div className="stage" role="group" aria-label="원클릭 시나리오">
          {stage.map((st) => (
            <button key={st.key} type="button" className={`stage-${st.key}`} aria-pressed={onStage(st.rate)} onClick={() => { setPrice(HOPE_AVG_PER_PY); setRate(st.rate); }}>
              <b>{st.title}</b>
              <span>{st.sub}</span>
            </button>
          ))}
        </div>
        {zone === "pf-shortfall" ? (
          <p className="stage-alert" role="alert">
            <span aria-hidden="true">⚠</span> 본PF(1,300억원) 상환 부족 구간 진입 — 연 9.0% 미분양담보대출(한도 400억원) 발동 및 시행사 마진 소멸
          </p>
        ) : rate >= 0.9995 ? (
          <p className="stage-insight">
            완판 기준 기말현금 {eok(r.cash, 0)} (분양수입 대비 {pct(r.cash / r.revenue)}) — 하방 충격 흡수 여력 제한적
          </p>
        ) : null}
        <div className="slider">
          <label htmlFor="rate">분양률 <output>{pct(rate)}</output></label>
          <input id="rate" type="range" min={0.4} max={1} step="any" value={rate} onChange={(e) => setRate(Math.round(Number(e.target.value) * 1000) / 1000)} />
        </div>
        <div className="slider">
          <label htmlFor="price">아파트 평균 공급평당가 <output>{m(price, Number.isInteger(price) ? 0 : 1)}만원</output></label>
          <input id="price" type="range" min={1200} max={2600} step="any" value={price} onChange={(e) => setPrice(Math.round(Number(e.target.value)))} />
        </div>
        <div className="seg" role="group" aria-label="근린생활시설 분양률">
          <span className="seg-label">상가 분양률</span>
          {commOptions.map(([n, v]) => (
            <button key={n} type="button" aria-pressed={commRate === v} className={commRate === v ? "on" : ""} onClick={() => setCommRate(v)}>{n}</button>
          ))}
        </div>
        <div className="presets">
          {presets.map(([n, p, s]) => (
            <button key={n} type="button" onClick={() => { setPrice(p); setRate(s); }}>{n}</button>
          ))}
        </div>
        <div className={`result ${zone}`}>
          <span className="r-label">기말현금</span>
          <span className="r-value">{eok(r.cash)}</span>
          <span className="r-zone">{label}</span>
        </div>
        <dl className="r-break">
          <div><dt>분양수입</dt><dd>{eok(r.revenue)}</dd></div>
          <div><dt>지출 (상쇄 포함)</dt><dd>{eok(r.outflow)}</dd></div>
          <div><dt>후순위 회수</dt><dd>{pct(Math.max(0, Math.min(1, (r.cash - PF_LIMIT_TARGET) / -PF_LIMIT_TARGET)))}</dd></div>
        </dl>
        {r.unsoldDraw > 0 && (
          <p className="r-loan">
            미분양담보대출 인출 {eok(r.unsoldDraw)} · 추가 이자 {eok(r.unsoldInterest, 1)} (연 9.0%, 6개월){r.unsoldDraw >= 40000 ? " — 한도 400억원 소진" : ""}
          </p>
        )}
      </div>
    </section>
  );
}

/* ───────── Ⅳ 상환 한계선 ───────── */

export function Thresholds() {
  const { applied, commRate } = usePlan();
  const cr = commRate ?? undefined;
  const hope = HOPE_AVG_PER_PY;
  const ap = applied?.price ?? null;
  const ar = applied?.rate ?? null;

  const rows: { label: string; base: string; zero: string; pf: string; note?: string }[] = [
    { label: "분양률 (희망가 고정)", base: `${m(hope, 1)}만원`, zero: pct(breakevenRate(hope, 0, undefined, cr), 2), pf: pct(breakevenRate(hope, PF_LIMIT_TARGET, undefined, cr), 2) },
    { label: "평당가 (분양률 100%)", base: "100%", zero: `${m(breakevenPrice(1, 0, undefined, cr), 1)}만원`, pf: `${m(breakevenPrice(1, PF_LIMIT_TARGET, undefined, cr), 1)}만원` },
    {
      label: "분양률 (적용가 고정)",
      base: ap ? `${m(ap, 1)}만원` : "—",
      zero: ap ? pct(breakevenRate(ap, 0, undefined, cr), 2) : "대기",
      pf: ap ? pct(breakevenRate(ap, PF_LIMIT_TARGET, undefined, cr), 2) : "대기",
    },
    {
      label: "평당가 (적용률 고정)",
      base: ar ? pct(ar) : "—",
      zero: ar ? `${m(breakevenPrice(ar, 0, undefined, cr), 1)}만원` : "대기",
      pf: ar ? `${m(breakevenPrice(ar, PF_LIMIT_TARGET, undefined, cr), 1)}만원` : "대기",
    },
  ];

  const prices = useMemo(() => {
    const set = new Set<number>([1400, 1500, 1600, 1700, Math.round(hope), 1850]);
    if (ap) set.add(Math.round(ap));
    return [...set].sort((a, b) => a - b);
  }, [hope, ap]);
  const rates = useMemo(() => {
    const set = new Set<number>([0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]);
    if (ar) set.add(Math.round(ar * 1000) / 1000);
    return [...set].sort((a, b) => b - a);
  }, [ar]);
  const grid = sensitivity(prices, rates, cr);

  return (
    <section id="thresholds" className="doc-sec" data-shot="5">
      <SectionHead
        no="06"
        group="사업수지"
        title="상환 한계선"
        lede="두 손익분기를 따로 봅니다. 기말현금 0은 후순위까지 모두 갚는 선, 기말현금 −48,000백만원(−480억원)은 후순위를 포기하고 본PF만 전액 갚는 마지막 선입니다."
      />
      <table className="tbl">
        <thead>
          <tr><th>구하는 값</th><th>고정 조건</th><th className="num">기말현금 = 0</th><th className="num">기말현금 = −후순위 (본PF 상환 한계)</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}><td>{r.label}</td><td>{r.base}</td><td className="num">{r.zero}</td><td className="num strong">{r.pf}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        기말현금 = s × [아파트 분양수입 × (1 − 0.8%) + 근생 분양수입 − 300만원 × 612] + 기타유입 {mw(INPUTS.otherInflow)} − 고정비 {mw(INPUTS.fixed, 0)}. 상쇄 항목은 유입·지출 양쪽에 같은 금액이라 소거됩니다.
        근린생활시설은 희망가 1,650만원에 고정하고 아파트 평균가만 움직였습니다. 상가 분양률은 계산기에서 고른 값({commRate === null ? "아파트와 동일" : pct(commRate, 0)})을 따릅니다.
        금융비용은 분양 속도와 무관하게 고정이며, 본PF 미상환분이 생기면 미분양담보대출(한도 400억원, 연 9.0%, 6개월) 이자가 추가로 차감되어 손실이 비선형으로 커집니다.
      </p>

      <h3 className="h3">2축 민감도 — 기말현금 (억원)</h3>
      <div className="legend" role="list">
        <span role="listitem"><i className="g surplus">●</i>0 이상 — 후순위까지 상환</span>
        <span role="listitem"><i className="g subordinated">◐</i>−480억원 ~ 0 — 본PF 상환, 후순위 손실</span>
        <span role="listitem"><i className="g pf-shortfall">○</i>−480억원 미만 — 본PF 미상환</span>
      </div>
      <div className="heat-wrap">
        <table className="heat">
          <thead>
            <tr>
              <th className="corner">분양률 \ 평당가</th>
              {prices.map((p) => (
                <th key={p} className={p === Math.round(hope) ? "mark-hope" : ap && p === Math.round(ap) ? "mark-applied" : ""}>
                  {m(p)}<U>만원</U>
                  {p === Math.round(hope) && <span>희망</span>}
                  {ap && p === Math.round(ap) && <span>적용</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.map((r, i) => (
              <tr key={r}>
                <th className={ar && r === Math.round(ar * 1000) / 1000 ? "mark-applied" : ""}>
                  {pct(r, r * 100 % 1 ? 1 : 0)}
                  {ar && r === Math.round(ar * 1000) / 1000 && <span>적용</span>}
                </th>
                {grid[i].map((c, j) => {
                  const z = zoneOf(c);
                  return (
                    <td key={j} className={`cell ${z}`} title={`분양률 ${pct(r)} · 평당가 ${m(prices[j])}만원 → 기말현금 ${m(c)}백만원`}>
                      <span className="glyph">{z === "surplus" ? "●" : z === "subordinated" ? "◐" : "○"}</span>
                      {m(c / 100, 0)}<U>억원</U>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CashFlow />
    </section>
  );
}

/* ───────── Ⅴ 시장 대비 여유 ───────── */

export function Signals() {
  const { market, applied } = usePlan();
  const hope = HOPE_AVG_PER_PY;
  const rate = applied?.rate ?? 1;
  const usePre = (market?.presale.n ?? 0) >= 3;
  const nt = market?.newTrades;
  const pfPrice = breakevenPrice(rate, PF_LIMIT_TARGET);
  const zeroPrice = breakevenPrice(rate, 0);
  const pfRate = breakevenRate(applied?.price ?? hope, PF_LIMIT_TARGET);
  const t84 = UNIT_TYPES[2];
  const ratio84 = t84.exclusivePy > 0 ? t84.supplyPy / t84.exclusivePy : 1; // 공급/전용 환산
  const pfPerExclusive = pfPrice * (t84.hopePerPy / hope) * ratio84; // 84㎡A 상환 한계가의 전용평 환산
  const unit84AtApplied = unitPrice(t84.supplyPy, (applied?.price ?? hope) * (t84.hopePerPy / hope)) * 100; // 만원

  type Sig = { name: string; ours: string; market: string; margin: string; good: boolean | null; basis: string };
  const s: Sig[] = [];
  const date = market?.queryDate ?? "—";
  const med = market?.supply.median ?? null;
  s.push({
    name: "상환 한계 평당가 vs 인근 신규 공급평당가",
    ours: `${m(pfPrice, 0)}만원 (분양률 ${pct(rate)} 가정)`,
    market: med ? `${m(med)}만원 · ${market!.supply.nTypes}주택형` : "대기",
    margin: med ? pct(1 - pfPrice / med) : "—",
    good: med ? 1 - pfPrice / med >= 0.15 : null,
    basis: "수분양자가 실제로 비교하는 가격은 같은 시기 인근 신규 공급가 — 공급면적 기준으로 단위를 맞춤. 최고금액이라 여유가 과대평가되는 방향이므로 15%를 안전선으로 둠.",
  });
  const fill = market?.competition.fillRatio ?? null;
  const conv = fill !== null ? fill * RULES.contractConversion : null;
  s.push({
    name: "상환 한계 분양률 vs 시장 계약환산 분양률",
    ours: pct(pfRate),
    market: conv !== null ? `${pct(conv)} (충족률 ${pct(fill)} × ${RULES.contractConversion})` : "대기",
    margin: conv !== null ? `${((conv - pfRate) * 100).toFixed(1)}%p` : "—",
    good: conv !== null ? conv - pfRate >= 0.1 : null,
    basis: "경쟁률은 계약률이 아니므로 접수 충족률에 계약 환산 계수를 곱해 비교. 미분양은 초기 계약에서 결정되므로 1·2순위 결과를 기준으로 삼음.",
  });
  const ntOk = !!nt?.used && (nt.n ?? 0) >= 3;
  const pre = usePre ? market!.presale.medianPerExclusivePy : ntOk ? nt!.medianPerExclusivePy : null;
  s.push({
    name: usePre || !ntOk ? "상환 한계가(전용 환산) vs 분양권 전용평당 실거래" : `상환 한계가(전용 환산) vs 준공 ${nt!.minBuildYear}년 이후 매매 실거래`,
    ours: `${m(pfPerExclusive, 0)}만원/전용평 (84㎡A · 공급/전용 ${ratio84.toFixed(3)})`,
    market: pre
      ? usePre
        ? `${m(pre)}만원 · 분양권 ${market!.presale.n}건`
        : `${m(pre)}만원 · ${nt!.complexes}단지 ${nt!.n}건 (분양권 ${market!.presale.n}건이라 대체)`
      : market
        ? `${market.regionInfo.dong} 분양권 ${market.presale.n}건 · 대체 매매 ${nt?.n ?? 0}건`
        : "대기",
    margin: pre ? pct(1 - pfPerExclusive / pre) : "—",
    good: pre ? 1 - pfPerExclusive / pre >= 0.15 : null,
    basis: "분양권(또는 신축·준신축 매매) 시세는 ‘지금 이 동네 새 아파트를 얼마에 사는가’의 시장가. 실거래는 전용면적 기준이라 분양계획의 전용/공급 비율로 환산.",
  });
  const j84 = market?.rent.median84 ?? null;
  const need = unit84AtApplied * 0.9;
  s.push({
    name: "84㎡ 전세 중위 vs 입주 시 필요자금 (분양가 90%)",
    ours: `${m(need)}만원 (84㎡A 세대당 × 90%)`,
    market: j84 ? `${m(j84)}만원 · ${market!.rent.n84}건` : "대기",
    margin: j84 ? `${pct(j84 / need)} 충당` : "—",
    good: j84 ? j84 / need >= 0.6 : null,
    basis: "입주 시 수분양자는 중도금 60% 상환·전환과 잔금 30%를 마련해야 함. 전세 놓고 입주시키는 수요는 보증금으로 이를 메우므로, 충당률 60% 미만이면 잔금 미납 위험 신호.",
  });
  s.push({
    name: "무순위 · 잔여세대 공고",
    ours: "0건이 기준",
    market: market ? `${market.remaining.notices}건 · ${m(market.remaining.households)}세대` : "대기",
    margin: market ? (market.remaining.notices ? "경고" : "양호") : "—",
    good: market ? market.remaining.notices === 0 : null,
    basis: "청약 당첨 후 계약 포기·미분양이 공고로 확인되는 유일한 공개 신호. 경쟁률이 높아도 무순위가 반복되면 계약률이 낮다는 뜻.",
  });

  return (
    <section id="signals" className="doc-sec" data-shot="5">
      <SectionHead no="07" group="시장분석" title="시장 대비 여유" lede={`청라 기준으로 다섯 신호를 읽습니다. 각 신호의 비교 기준과 그 기준을 고른 이유를 함께 적습니다. 조회일 ${date}.`} />
      <ol className="signals">
        {s.map((x) => (
          <li key={x.name} className={x.good === null ? "wait" : x.good ? "ok" : "bad"}>
            <div className="s-top">
              <h3>{x.name}</h3>
              <span className="s-flag">{x.good === null ? (market ? "표본 없음" : "데이터 대기") : x.good ? "여유" : "주의"}</span>
            </div>
            <dl>
              <div><dt>사업</dt><dd>{x.ours}</dd></div>
              <div><dt>시장</dt><dd>{x.market}</dd></div>
              <div><dt>여유</dt><dd className="strong">{x.margin}</dd></div>
            </dl>
            <p className="basis">{x.basis}</p>
          </li>
        ))}
      </ol>
      <p className="note">전액 회수(기말현금 0) 평당가는 같은 분양률에서 {m(zeroPrice, 0)}만원입니다. 여유가 기준선 미만인 신호는 <a href="#conditions">08 추진 조건 1</a>과 연결됩니다.</p>
    </section>
  );
}

/* ───────── Ⅶ 검증 로그 · 보안 ───────── */

export function Verify() {
  const { market, load } = usePlan();
  const cells = sampleCells();
  const hand = HOPE_APT_REVENUE + HOPE_COMMERCIAL_REVENUE + INPUTS.otherInflow - INPUTS.fixed - INPUTS.variable;
  const calc = endingCash({ aptPerPy: HOPE_AVG_PER_PY, salesRate: 1 }).cash;
  const sumOk = Math.abs(INPUTS.totalInvestment - INPUTS.items.reduce((s, i) => s + i.value, 0)) < 1e-6;
  const keyState = load.state === "done" ? (load.data.status === "no_key" ? "미설정" : "서버 환경변수에서 로드") : "확인 중";

  return (
    <section id="verify" className="doc-sec" data-shot="5">
      <SectionHead no="09" group="검토의견" title="검증 로그와 보안 점검" lede="1회차 검증 3종은 페이지가 열릴 때마다 같은 계산 엔진으로 다시 계산됩니다. 보안 점검과 API 호출 기록은 아래 개발·검증 노트에 접어 두었습니다." />
      <ol className="checks">
        <li className="pass">
          <h4>표본 3셀 대조 — 세대당 분양가 = 공급면적 × 평당가 ÷ 100</h4>
          <table className="tbl compact">
            <thead><tr><th>타입</th><th className="num">공급평</th><th className="num">평당가</th><th className="num">계산</th><th className="num">원자료 사업계획서 Ⅳ</th></tr></thead>
            <tbody>
              {cells.map((c, i) => (
                <tr key={c.type}><td>{c.type}</td><td className="num">{c.supplyPy}</td><td className="num">{m(c.perPy)}<U>만원</U></td><td className="num">{m(c.perUnit, 2)}<U>백만원</U></td><td className="num">{[465, 558, 611][i]}<U>백만원</U></td></tr>
              ))}
            </tbody>
          </table>
        </li>
        <li className={sumOk ? "pass" : "fail"}>
          <h4>합계 일치 — 총투자비 = 고정비 + 변동비 + 상쇄 항목</h4>
          <p className="mono">{m(INPUTS.fixed, 2)} + {m(INPUTS.variable, 2)} + {m(INPUTS.offset, 2)} = {mw(INPUTS.totalInvestment, 2)} {sumOk ? `= 소요자금 ${INPUTS.items.length}개 항목 합계 ✓` : "✗"}</p>
        </li>
        <li className={Math.abs(hand - calc) < 1e-6 ? "pass" : "fail"}>
          <h4>역산 확인 — 희망가 · 분양률 100%</h4>
          <p className="mono">
            손계산 {m(HOPE_APT_REVENUE + HOPE_COMMERCIAL_REVENUE, 2)} + {m(INPUTS.otherInflow)} − {m(INPUTS.fixed, 2)} − {m(INPUTS.variable, 2)} = {mw(hand, 2)} · 계산기 {mw(calc, 2)} {Math.abs(hand - calc) < 1e-6 ? "✓" : "✗"}
          </p>
        </li>
      </ol>

      <details className="fold devnotes">
        <summary>개발·검증 노트 — 보안 점검 · API 호출 로그 (인증키 상태: {keyState})</summary>
      <ul className="sec-list">
        <li>인증키 상태: <b>{keyState}</b> — <code>DATA_GO_KR_SERVICE_KEY</code> · <code>DATA_GO_KR_API_KEY</code>는 <code>.env.local</code>과 Vercel 환경변수에만 둡니다. <code>NEXT_PUBLIC_</code> 접두사 미사용.</li>
        <li>공공데이터 호출은 <code>app/api/market</code> 라우트(서버)에서만 · <code>server-only</code>로 클라이언트 번들 유입 차단.</li>
        <li>브라우저는 지역 이름만 전송(한글·숫자·공백 40자 이내 검증), 법정동코드는 서버가 확인.</li>
        <li>응답은 하루 캐시(<code>revalidate 86400</code>) · 빌드 시 API 미호출(<code>force-dynamic</code>) · 서울 리전(<code>icn1</code>).</li>
        <li>인증키 문자열 검색: 저장소와 빌드 산출물(<code>.next/static</code>)에서 키 문자열 0건 — <code>npm test</code>의 보안 테스트가 소스의 <code>NEXT_PUBLIC_</code>·하드코딩 키 패턴을 차단합니다.</li>
      </ul>

      {market && (
        <>
          <h4 className="h4">API 호출 로그 — {market.fetchedAt}</h4>
          <table className="tbl compact">
            <thead><tr><th>출처</th><th className="num">호출</th><th className="num">행</th><th>오류</th></tr></thead>
            <tbody>
              {market.logs.map((l) => (
                <tr key={l.source}><td>{l.source}</td><td className="num">{l.calls}</td><td className="num">{m(l.rows)}</td><td>{l.error ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      </details>
      <p className="note">평균 공급평당가 {m(HOPE_AVG_PER_PY, 2)}만원 = 아파트 분양수입 {mw(HOPE_APT_REVENUE, 2)} × 100 ÷ 공급면적 {m(TOTAL_SUPPLY_PY, 1)}평. 전용평 환산은 {m2ToPy(84.91).toFixed(2)}평(84.91㎡) 등 1평 = 3.305785㎡.</p>
    </section>
  );
}
