"use client";

import { useMemo, useState } from "react";
import { usePlan } from "@/components/plan/PlanProvider";
import { cashflow } from "@/lib/finance";
import { eok, m, pct } from "@/lib/format";

const W = 960;
const H = 340;
const PAD = { l: 64, r: 20, t: 24, b: 40 };

/** 분기별 차입 전 누적현금 — 최저점이 차입으로 메워야 할 최대 자금 부족(Peak Funding) */
export function CashFlow() {
  const { price, rate, commRate } = usePlan();
  const cf = useMemo(() => cashflow({ aptPerPy: price, salesRate: rate, commercialRate: commRate ?? undefined }), [price, rate, commRate]);
  const [hover, setHover] = useState<number | null>(null);

  const rows = cf.rows;
  const lo = Math.min(...rows.map((r) => Math.min(r.cum, -r.capacity, r.net)));
  const hi = Math.max(0, ...rows.map((r) => Math.max(r.cum, r.net)));
  const span = hi - lo || 1;
  const yMin = lo - span * 0.06;
  const yMax = hi + span * 0.06;
  const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * (i + 0.5)) / rows.length;
  const y = (v: number) => PAD.t + ((yMax - v) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const bw = ((W - PAD.l - PAD.r) / rows.length) * 0.46;

  const ticks = useMemo(() => {
    const step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    const nice = [1, 2, 5, 10].map((k) => k * step).find((s) => span / s <= 6) ?? step * 10;
    const out: number[] = [];
    for (let v = Math.ceil(yMin / nice) * nice; v <= yMax; v += nice) out.push(v);
    return out;
  }, [span, yMin, yMax]);

  const line = rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r.cum).toFixed(1)}`).join(" ");
  const cap = rows
    .map((r, i) => {
      const x0 = PAD.l + ((W - PAD.l - PAD.r) * i) / rows.length;
      const x1 = PAD.l + ((W - PAD.l - PAD.r) * (i + 1)) / rows.length;
      return `${i ? "L" : "M"}${x0.toFixed(1)},${y(-r.capacity).toFixed(1)} L${x1.toFixed(1)},${y(-r.capacity).toFixed(1)}`;
    })
    .join(" ");
  const pi = rows.indexOf(cf.peak);
  const h = hover !== null ? rows[hover] : null;

  return (
    <div className="cf">
      <h3 className="h3">분기 현금흐름 — 차입 전 누적 (계산기 시나리오 연동)</h3>
      <div className="cf-kpis">
        <div><span>최대 자금 부족 (Peak Funding)</span><b>{eok(-cf.peak.cum)}</b><small>{cf.peak.q}</small></div>
        <div><span>같은 분기 차입 가용 한도</span><b>{eok(cf.peak.capacity)}</b><small>{cf.peak.capacity >= 130000 ? "본PF Tr-A + Tr-B" : cf.peak.capacity >= 105000 ? "본PF Tr-A" : "브릿지론"}</small></div>
        <div><span>한도 초과 분기</span><b>{cf.gap.length ? `${cf.gap.length}개` : "없음"}</b><small>{cf.gap.length ? cf.gap.map((g) => g.q).join(" · ") : "차입 한도 내 조달 가능"}</small></div>
        <div><span>최종 누적 = 기말현금</span><b>{eok(cf.ending)}</b><small>06 표와 일치</small></div>
      </div>
      <div className="cf-legend" role="list">
        <span role="listitem"><i className="lg-line" />차입 전 누적현금</span>
        <span role="listitem"><i className="lg-bar" />분기 순현금</span>
        <span role="listitem"><i className="lg-cap" />차입 가용 한도(음수 축)</span>
      </div>
      <div className="cf-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`분기 누적현금 — 최저 ${cf.peak.q} ${m(cf.peak.cum)}백만원`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? "cf-zero" : "cf-grid"} />
              <text x={PAD.l - 10} y={y(t) + 4} className="cf-axis" textAnchor="end">{m(t / 100)}</text>
            </g>
          ))}
          <text x={PAD.l - 10} y={PAD.t - 8} className="cf-axis" textAnchor="end">억원</text>
          {rows.map((r, i) => (
            <rect key={r.q} x={x(i) - bw / 2} width={bw} y={Math.min(y(r.net), y(0))} height={Math.max(1, Math.abs(y(r.net) - y(0)))} rx={2} className={r.net >= 0 ? "cf-bar up" : "cf-bar"} />
          ))}
          <path d={cap} className="cf-cap" />
          <path d={line} className="cf-line" />
          {rows.map((r, i) => (
            <circle key={r.q} cx={x(i)} cy={y(r.cum)} r={i === pi || i === hover ? 5 : 3} className={i === pi ? "cf-dot peak" : "cf-dot"} />
          ))}
          <text x={x(pi)} y={y(cf.peak.cum) + 22} textAnchor="middle" className="cf-peak">최대 부족 {eok(-cf.peak.cum, 0)}</text>
          {rows.map((r, i) => (
            <text key={r.q} x={x(i)} y={H - 14} textAnchor="middle" className="cf-axis">{i % 2 === 0 || rows.length < 10 ? r.q.replace("20", "’").replace(".Q", " Q") : ""}</text>
          ))}
          {rows.map((r, i) => (
            <rect key={`h-${r.q}`} x={x(i) - (W - PAD.l - PAD.r) / rows.length / 2} width={(W - PAD.l - PAD.r) / rows.length} y={PAD.t} height={H - PAD.t - PAD.b} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${r.q} 누적 ${m(r.cum)}백만원`} />
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="cf-cross" />}
        </svg>
        {h && (
          <div className="cf-tip" style={{ left: `${(x(hover!) / W) * 100}%` }}>
            <b>{h.q}</b>
            <span>유입 {m(h.inflow)}</span>
            <span>유출 {m(h.outflow)}</span>
            <span>순현금 {m(h.net)}</span>
            <span>누적 {m(h.cum)}</span>
            <span>차입 한도 {m(h.capacity)}</span>
          </div>
        )}
      </div>
      <p className="note">
        가정 — 사업계획서 일정 기준: 토지비 2026.Q2 10%·Q3 90%, 기성 1,470억은 2027.Q1~2029.Q4 S커브, 유보금 420억·시행사 대여금은 2030.Q1(후순위),
        분양대금은 계약금 10%(2027.Q2)·중도금 6회 60%(2027.Q4~2028.Q4)·잔금 30%(2029.Q4), 중도금 이자는 시행사가 선지급 후 입주 시 회수.
        차입 원금은 제외했으므로 누적선의 최저점이 차입으로 메워야 할 최대 부족액입니다. 분양률은 계약 시점에 확정된다고 보았습니다(단순화).
      </p>
      <details className="fold">
        <summary>분기별 표 보기 ({rows.length}개 분기)</summary>
        <table className="tbl compact">
          <thead><tr><th>분기</th><th className="num">유입</th><th className="num">유출</th><th className="num">순현금</th><th className="num">누적</th><th className="num">차입 한도</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.q} className={r.cum < -r.capacity ? "computed" : undefined}>
                <td className="mono">{r.q}</td><td className="num">{m(r.inflow)}</td><td className="num">{m(r.outflow)}</td><td className="num">{m(r.net)}</td><td className="num">{m(r.cum)}</td><td className="num">{m(r.capacity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">한도 초과 분기(음영)는 차입만으로 부족해 시행사 추가 출자나 공사비 지급 유예가 필요한 구간입니다. 최대 부족액 대비 본PF 한도 여유 {pct(1 - -cf.peak.cum / 130000)}.</p>
      </details>
    </div>
  );
}
