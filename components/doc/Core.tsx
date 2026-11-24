"use client";

import { useId, useMemo, useState } from "react";
import { usePlan } from "@/components/plan/PlanProvider";
import { HOPE_AVG_PER_PY, PF_LIMIT_TARGET, breakevenRate } from "@/lib/finance";
import { feasibility, investment, profitability, tornado, type Grade } from "@/lib/analysis";
import { eok, m, pct, signed } from "@/lib/format";
import { CapitalStack } from "./CapitalStack";

type Tab = "feas" | "inv" | "prof";
const GRADE_ICON: Record<Grade, string> = { 양호: "●", 보통: "◐", 취약: "○", 부적합: "✕" };

/**
 * 핵심 분석 — 과제의 세 질문(사업성 · 투자 · 수익성)에 한 화면으로 답한다.
 * 시나리오 바의 분양가·분양률은 계산기 · 3D 점등과 같은 상태를 공유한다.
 */
export function Core() {
  const { price, rate, setPrice, setRate, applied, commRate } = usePlan();
  const [tab, setTab] = useState<Tab>("feas");
  const s = useMemo(() => ({ aptPerPy: price, salesRate: rate, commercialRate: commRate ?? undefined }), [price, rate, commRate]);
  const f = useMemo(() => feasibility(s), [s]);
  const v = useMemo(() => investment(s), [s]);
  const p = f.profit;
  const id = useId();

  const presets: [string, number, number][] = [
    ["희망가 · 100%", HOPE_AVG_PER_PY, 1],
    ["손익분기", HOPE_AVG_PER_PY, Math.ceil(breakevenRate(HOPE_AVG_PER_PY, 0) * 1000) / 1000],
    ["본PF 상환 한계", HOPE_AVG_PER_PY, Math.ceil(breakevenRate(HOPE_AVG_PER_PY, PF_LIMIT_TARGET) * 1000) / 1000],
  ];
  if (applied?.price && applied.rate) presets.push(["공공데이터 적용값", applied.price, applied.rate]);
  const isPreset = (pp: number, rr: number) => Math.abs(pp - price) < 0.05 && Math.abs(rr - rate) < 0.0005;

  const tabs: { key: Tab; no: string; title: string; q: string; value: string; sub: string }[] = [
    { key: "feas", no: "01", title: "사업성 검토", q: "추진할 만한 사업인가", value: f.verdict, sub: `손익분기 분양률 ${pct(f.zeroRate)}` },
    { key: "inv", no: "02", title: "투자 분석", q: "투입 자본은 얼마로 돌아오나", value: v.irr === null ? "회수 불가" : `IRR ${pct(v.irr)}`, sub: `수익배수 ${v.multiple.toFixed(2)}배` },
    { key: "prof", no: "03", title: "수익성 계산", q: "최종적으로 얼마가 남나", value: `${eok(p.profit, 0)}`, sub: `매출 대비 ${pct(p.margin)}` },
  ];

  return (
    <section id="core" className="doc-sec core" data-shot="5" aria-labelledby={`${id}-h`}>
      <header className="sec-head">
        <p className="sec-kicker">
          <span className="sec-no">00</span>
          <span className="sec-group">핵심 분석</span>
        </p>
        <h2 id={`${id}-h`}>세 가지 질문에 한 화면으로 답합니다</h2>
        <p className="lede">
          분양가와 분양률을 움직이면 사업성 판정 · 투자 수익률 · 순이익이 함께 다시 계산됩니다. 같은 값이 아래 계산기와 3D 단지의 점등에도 반영됩니다.
        </p>
      </header>

      {/* 시나리오 바 */}
      <div className="scn" role="group" aria-label="시나리오">
        <div className="scn-row">
          <label className="scn-field">
            <span className="scn-k">아파트 평균 공급평당가</span>
            <span className="scn-v">{m(price)}<small>만원</small></span>
            <input type="range" min={1200} max={2600} step={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} aria-label="아파트 평균 공급평당가 (만원)" />
            <span className="scn-scale"><span>1,200만원</span><span>희망 {m(HOPE_AVG_PER_PY)}만원</span><span>2,600만원</span></span>
          </label>
          <label className="scn-field">
            <span className="scn-k">분양률</span>
            <span className="scn-v">{(rate * 100).toFixed(1)}<small>%</small></span>
            <input type="range" min={0.4} max={1} step={0.001} value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="분양률" />
            <span className="scn-scale"><span>40%</span><span>손익분기 {pct(f.zeroRate)}</span><span>100%</span></span>
          </label>
        </div>
        <div className="scn-presets">
          <span className="scn-k">빠른 시나리오</span>
          {presets.map(([n, pp, rr]) => (
            <button key={n} type="button" aria-pressed={isPreset(pp, rr)} onClick={() => { setPrice(pp); setRate(rr); }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <CapitalStack />

      {/* 탭 — 각 탭이 자기 결론을 미리 보여준다 */}
      <div className="core-tabs" role="tablist" aria-label="핵심 분석">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`${id}-t-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`${id}-p-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={`core-tab${tab === t.key ? " is-on" : ""}`}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => {
              const order: Tab[] = ["feas", "inv", "prof"];
              const i = order.indexOf(tab);
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = order[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3];
                setTab(next);
                document.getElementById(`${id}-t-${next}`)?.focus();
              }
            }}
          >
            <span className="ct-no">{t.no}</span>
            <span className="ct-title">{t.title}</span>
            <span className="ct-q">{t.q}</span>
            <span className={`ct-value${t.key === "feas" ? ` v-${verdictTone(f.verdict)}` : t.key === "prof" && p.profit < 0 ? " v-bad" : ""}`}>{t.value}</span>
            <span className="ct-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      <div className="core-panel" role="tabpanel" id={`${id}-p-${tab}`} aria-labelledby={`${id}-t-${tab}`}>
        {tab === "feas" && <Feasibility f={f} rate={rate} />}
        {tab === "inv" && <Investment v={v} />}
        {tab === "prof" && <Profitability s={s} />}
      </div>

      <p className="note">
        세전 기준(법인세 미반영). 순이익 = 기말현금 − 시행사 투입 220억원 + 대여금 회수 60억원. 판정 기준은 본 보고서의 내부 가정이며 금융기관·감정평가 기준이 아닙니다. 금액 단위 억원(표의 원자료는 백만원).
      </p>
    </section>
  );
}

const verdictTone = (v: string) => (v === "추진 적정" ? "good" : v === "조건부 추진" ? "warn" : "bad");

/* ───────── 01 사업성 검토 ───────── */

function Feasibility({ f, rate }: { f: ReturnType<typeof feasibility>; rate: number }) {
  const lo = 0.6;
  const x = (r: number) => `${(Math.min(1, Math.max(0, (r - lo) / (1 - lo))) * 100).toFixed(2)}%`;
  const why =
    f.verdict === "재검토"
      ? "현재 시나리오에서는 본PF 원리금을 모두 갚지 못합니다. 분양가 · 분양률 가정 자체를 다시 세워야 합니다."
      : f.verdict === "조건부 추진"
        ? "대주단 상환에는 여유가 있지만 시행사 이익 완충이 얇습니다. 분양가 확정 전 시장 신호 재검증과 할인분양 한도 합의를 조건으로 붙입니다."
        : f.verdict === "추진 적정"
          ? "손익분기와 상환 한계 모두 넉넉한 여유가 있습니다."
          : "일부 지표가 취약합니다. 원가 절감이나 분양가 재설정 후 다시 검토합니다.";
  return (
    <div className="feas">
      <div className="feas-verdict">
        <p className="fv-k">종합 판정</p>
        <p className={`fv-v v-${verdictTone(f.verdict)}`}>{f.verdict}</p>
        <p className="fv-why">{why}</p>
      </div>
      <div className="feas-body">
        <h3 className="h3">분양률 기준선</h3>
        <div className="gauge" role="img" aria-label={`현재 분양률 ${pct(rate)}, 손익분기 ${pct(f.zeroRate)}, 본PF 상환 한계 ${pct(f.pfRate)}`}>
          <div className="g-track">
            <i className="g-zone bad" style={{ left: 0, width: x(f.pfRate) }} />
            <i className="g-zone warn" style={{ left: x(f.pfRate), width: `calc(${x(f.zeroRate)} - ${x(f.pfRate)})` }} />
            <i className="g-zone good" style={{ left: x(f.zeroRate), right: 0 }} />
            <span className="g-mark" style={{ left: x(f.pfRate) }}><em>본PF 상환 한계</em><b>{pct(f.pfRate)}</b></span>
            <span className="g-mark" style={{ left: x(f.zeroRate) }}><em>손익분기</em><b>{pct(f.zeroRate)}</b></span>
            <span className={`g-now${rate > 0.92 ? " edge-r" : rate < 0.68 ? " edge-l" : ""}`} style={{ left: x(rate) }}><b>현재 {pct(rate)}</b></span>
          </div>
          <div className="g-legend">
            <span><i className="bad" />대주단 손실</span>
            <span><i className="warn" />후순위(유보금·대여금) 손실</span>
            <span><i className="good" />전액 상환 · 시행사 이익</span>
          </div>
        </div>
        <h3 className="h3">판정 근거</h3>
        <ul className="checks4">
          {f.checks.map((c) => (
            <li key={c.name} className={`g-${c.grade}`}>
              <span className="c4-badge"><span aria-hidden="true">{GRADE_ICON[c.grade]}</span>{c.grade}</span>
              <span className="c4-name">{c.name}</span>
              <span className="c4-val">{c.value}</span>
              <span className="c4-note">{c.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────── 02 투자 분석 ───────── */

function Investment({ v }: { v: ReturnType<typeof investment> }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = v.rows;
  const W = 760, H = 260, P = { l: 58, r: 12, t: 22, b: 30 };
  const lo = Math.min(...rows.map((r) => r.cum), -v.pf * 1.02);
  const hi = Math.max(0, ...rows.map((r) => r.cum));
  const xs = (i: number) => P.l + ((W - P.l - P.r) * i) / (rows.length - 1);
  const ys = (val: number) => P.t + ((hi - val) / (hi - lo || 1)) * (H - P.t - P.b);
  const path = rows.map((r, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(r.cum).toFixed(1)}`).join(" ");
  const area = `${path} L${xs(rows.length - 1)},${ys(0)} L${xs(0)},${ys(0)} Z`;
  const pi = rows.findIndex((r) => r.q === v.peakQ);
  const hv = hover ?? pi;

  return (
    <div className="inv">
      <dl className="tiles">
        <div><dt>시행사 투입</dt><dd>{eok(v.equity, 0)}</dd><p>출자금 · 대여금 (2026.Q2)</p></div>
        <div><dt>회수액</dt><dd>{eok(v.back, 0)}</dd><p>기말현금 + 대여금 회수</p></div>
        <div className="em"><dt>연환산 IRR</dt><dd>{v.irr === null ? "—" : pct(v.irr)}</dd><p>{v.period} · {v.years.toFixed(2)}년</p></div>
        <div><dt>수익배수</dt><dd>{v.multiple.toFixed(2)}<small>배</small></dd><p>순이익 {eok(v.profit, 0)} · ROE {pct(v.roe)}</p></div>
      </dl>

      <div className="inv-grid">
        <figure className="cf-mini">
          <figcaption>
            <b>차입 전 누적현금</b> — 최저점이 차입으로 메워야 할 최대 자금 부족(Peak Funding)
          </figcaption>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`최대 자금 부족 ${eok(v.peak, 0)} (${v.peakQ}), 본PF 한도 ${eok(v.pf, 0)}`} onMouseLeave={() => setHover(null)}>
            {[-1500, -1000, -500, 500].filter((t) => t * 100 > lo && t * 100 < hi).map((t) => (
              <g key={t}>
                <line x1={P.l} x2={W - P.r} y1={ys(t * 100)} y2={ys(t * 100)} className="grid" />
                <text x={P.l - 8} y={ys(t * 100) + 4} textAnchor="end" className="tick">{m(t)}</text>
              </g>
            ))}
            <text x={P.l - 8} y={P.t - 4} textAnchor="end" className="tick">억원</text>
            <line x1={P.l} x2={W - P.r} y1={ys(0)} y2={ys(0)} className="ax0" />
            <line x1={P.l} x2={W - P.r} y1={ys(-v.pf)} y2={ys(-v.pf)} className="pfline" />
            <text x={W - P.r} y={ys(-v.pf) - 6} textAnchor="end" className="lbl">본PF 한도 −{eok(v.pf, 0)}</text>
            <text x={P.l - 8} y={ys(0) + 4} textAnchor="end" className="tick">0</text>
            <path d={area} className="cf-area" />
            <path d={path} className="cf-line" />
            {rows.map((r, i) => (
              <rect key={r.q} x={xs(i) - (W - P.l - P.r) / rows.length / 2} y={P.t} width={(W - P.l - P.r) / rows.length} height={H - P.t - P.b} fill="transparent" onMouseEnter={() => setHover(i)} />
            ))}
            <line x1={xs(hv)} x2={xs(hv)} y1={P.t} y2={H - P.b} className="xh" />
            <circle cx={xs(hv)} cy={ys(rows[hv].cum)} r={5} className="dot" />
            {[0, 4, 8, 12, rows.length - 1].map((i) => (
              <text key={i} x={xs(i)} y={H - 8} textAnchor="middle" className="tick">{rows[i].q.replace(".", " ")}</text>
            ))}
          </svg>
          <p className="cf-read" aria-live="polite">
            <b>{rows[hv].q}</b> 누적 {eok(rows[hv].cum, 0)} · 분기 순유입 {signed(rows[hv].net / 100, 0)}억원
            {hv === pi && <em> · 최대 자금 부족 시점</em>}
          </p>
        </figure>

        <div className="inv-side">
          <h3 className="h3">자금 구조</h3>
          <dl className="kv">
            <div><dt>최대 자금 부족</dt><dd>{eok(v.peak, 0)} <small>{v.peakQ}</small></dd></div>
            <div><dt>본PF 한도</dt><dd>{eok(v.pf, 0)}</dd></div>
            <div><dt>한도 여유</dt><dd className={v.pfHeadroom < 0 ? "neg" : ""}>{eok(v.pfHeadroom, 0)}</dd></div>
            <div><dt>본PF / 총사업비</dt><dd>{pct(v.ltc)}</dd></div>
            <div><dt>자기자본 / 총사업비</dt><dd>{pct(v.equityRatio)}</dd></div>
          </dl>
          {v.gapQuarters.length > 0 ? (
            <p className="warn">차입 한도를 넘는 분기: {v.gapQuarters.join(", ")} — 추가 자금 조달이 필요합니다.</p>
          ) : (
            <p className="note">모든 분기에서 누적 자금 부족이 차입 가용 한도 안에 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── 03 수익성 계산 ───────── */

function Profitability({ s }: { s: Parameters<typeof profitability>[0] }) {
  const p = useMemo(() => profitability(s), [s]);
  const t = useMemo(() => tornado(s), [s]);
  const [hover, setHover] = useState<string | null>(null);
  const [table, setTable] = useState(false);

  // 폭포 차트: 매출 + 이자수입 → 비용 6단계 → 순이익
  const bars: { key: string; label: string; from: number; to: number; kind: "in" | "out" | "total" }[] = [];
  let acc = 0;
  bars.push({ key: "rev", label: "분양수입", from: 0, to: p.revenue, kind: "in" });
  acc = p.revenue;
  bars.push({ key: "int", label: "이자수입", from: acc, to: acc + p.interestIncome, kind: "in" });
  acc += p.interestIncome;
  for (const st of p.steps) {
    bars.push({ key: st.key, label: st.label, from: acc, to: acc - st.value, kind: "out" });
    acc -= st.value;
  }
  bars.push({ key: "profit", label: "순이익", from: 0, to: acc, kind: "total" });

  const W = 1160, H = 340, P = { l: 20, r: 20, t: 28, b: 46 };
  const max = Math.max(...bars.map((b) => Math.max(b.from, b.to)));
  const min = Math.min(0, ...bars.map((b) => Math.min(b.from, b.to)));
  const y = (val: number) => P.t + ((max - val) / (max - min || 1)) * (H - P.t - P.b);
  const step = (W - P.l - P.r) / bars.length;
  const bw = Math.min(56, step * 0.62);
  const hb = bars.find((b) => b.key === hover);

  const tw = 1160, rowH = 44, tP = { l: 200, r: 20 }, gutter = 64;
  const tMax = Math.max(1, ...t.rows.flatMap((r) => [Math.abs(r.lo), Math.abs(r.hi)]));
  const tx = (val: number) => tP.l + gutter + ((val + tMax) / (2 * tMax)) * (tw - tP.l - tP.r - gutter * 2);

  return (
    <div className="prof">
      <dl className="tiles">
        <div><dt>분양수입</dt><dd>{eok(p.revenue, 0)}</dd><p>아파트 + 근린생활시설</p></div>
        <div><dt>총사업비</dt><dd>{eok(p.cost, 0)}</dd><p>대여금 상환 · 상쇄 항목 제외</p></div>
        <div className={`em${p.profit < 0 ? " neg" : ""}`}><dt>시행사 순이익(세전)</dt><dd>{eok(p.profit, 0)}</dd><p>매출 대비 {pct(p.margin)}</p></div>
        <div><dt>기말현금</dt><dd>{eok(p.endingCash, 0)}</dd><p>사업 종료 시 신탁 잔액</p></div>
      </dl>

      <figure className="wf">
        <figcaption>
          <b>매출에서 순이익까지</b>
          <button type="button" className="linkbtn" onClick={() => setTable((v) => !v)} aria-pressed={table}>{table ? "차트로 보기" : "표로 보기"}</button>
        </figcaption>
        {table ? (
          <table className="tbl compact">
            <thead><tr><th>항목</th><th className="num">금액(억원)</th><th className="num">매출 대비</th></tr></thead>
            <tbody>
              {bars.map((b) => (
                <tr key={b.key} className={b.kind === "total" ? "sum strong" : undefined}>
                  <td>{b.label}</td>
                  <td className="num">{b.kind === "out" ? "−" : ""}{m(Math.abs(b.to - b.from) / 100, 1)}억원</td>
                  <td className="num">{pct(Math.abs(b.to - b.from) / p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`분양수입 ${eok(p.revenue, 0)}에서 비용을 빼면 순이익 ${eok(p.profit, 0)}`} onMouseLeave={() => setHover(null)}>
              <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} className="ax0" />
              {bars.map((b, i) => {
                const cx = P.l + step * (i + 0.5);
                const top = y(Math.max(b.from, b.to));
                const h = Math.max(1.5, Math.abs(y(b.from) - y(b.to)));
                const next = bars[i + 1];
                const cls = b.kind === "total" ? (b.to >= 0 ? "wf-total" : "wf-neg") : b.kind === "in" ? "wf-in" : "wf-out";
                return (
                  <g key={b.key} onMouseEnter={() => setHover(b.key)}>
                    <rect x={cx - step / 2} y={P.t} width={step} height={H - P.t - P.b} fill="transparent" />
                    <rect x={cx - bw / 2} y={top} width={bw} height={h} rx={2} className={`${cls}${hover && hover !== b.key ? " dim" : ""}`} />
                    {next && next.kind !== "total" && <line x1={cx + bw / 2} x2={cx + step - bw / 2} y1={y(b.to)} y2={y(b.to)} className="wf-link" />}
                    {(b.kind !== "out" || Math.abs(b.to - b.from) > max * 0.04) && (
                      <text x={cx} y={top - 7} textAnchor="middle" className="wf-val">
                        {b.kind === "out" ? "−" : ""}{m(Math.abs(b.to - b.from) / 100, 0)}억원
                      </text>
                    )}
                    <text x={cx} y={H - P.b + 20} textAnchor="middle" className={`tick${b.kind === "total" ? " strong" : ""}`}>{b.label}</text>
                  </g>
                );
              })}
            </svg>
            <p className="cf-read" aria-live="polite">
              {hb ? (
                <><b>{hb.label}</b> {hb.kind === "out" ? "−" : ""}{m(Math.abs(hb.to - hb.from) / 100, 1)}억원 · 매출 대비 {pct(Math.abs(hb.to - hb.from) / p.revenue)}</>
              ) : (
                <>막대에 마우스를 올리면 항목별 금액과 매출 대비 비중이 보입니다. 단위 억원.</>
              )}
            </p>
          </>
        )}
      </figure>

      <figure className="tor">
        <figcaption>
          <b>무엇이 순이익을 가장 크게 흔드나</b> — 변수 하나만 움직였을 때 순이익 변화(억원)
        </figcaption>
        <svg viewBox={`0 0 ${tw} ${t.rows.length * rowH + 30}`} role="img" aria-label="순이익 민감도">
          <line x1={tx(0)} x2={tx(0)} y1={4} y2={t.rows.length * rowH + 6} className="ax0" />
          {t.rows.map((r, i) => {
            const yy = 8 + i * rowH;
            const a = Math.min(r.lo, r.hi), bb = Math.max(r.lo, r.hi);
            return (
              <g key={r.label}>
                <text x={tP.l - 14} y={yy + 20} textAnchor="end" className="tor-k">{r.label}</text>
                {a < 0 && <rect x={tx(a)} y={yy + 4} width={tx(0) - tx(a) - 1} height={22} rx={2} className="tor-dn" />}
                {bb > 0 && <rect x={tx(0) + 1} y={yy + 4} width={tx(bb) - tx(0) - 1} height={22} rx={2} className="tor-up" />}
                {a < 0 && <text x={tx(a) - 6} y={yy + 19} textAnchor="end" className="tor-v">{signed(a / 100, 0)}억원</text>}
                {bb > 0 && <text x={tx(bb) + 6} y={yy + 19} className="tor-v">{signed(bb / 100, 0)}억원</text>}
              </g>
            );
          })}
          <text x={tx(0)} y={t.rows.length * rowH + 24} textAnchor="middle" className="tick">현재 순이익 {m(t.base / 100, 0)}억원 기준</text>
        </svg>
        <p className="g-legend">
          <span><i className="bad" />불리한 방향</span>
          <span><i className="good" />유리한 방향</span>
          <span>분양률이 이미 100%이면 상승 여지가 없어 한쪽만 표시됩니다.</span>
        </p>
      </figure>
    </div>
  );
}
