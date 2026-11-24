"use client";

import { useEffect, useState } from "react";

type Item = { href?: string; label: string; sub: string; icon: React.ReactNode; onClick?: () => void; tone?: "gold" };

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  core: (
    <svg viewBox="0 0 24 24" {...S}><rect x="3.5" y="3.5" width="7" height="7" /><rect x="13.5" y="3.5" width="7" height="4.5" /><rect x="13.5" y="11" width="7" height="9.5" /><rect x="3.5" y="13.5" width="7" height="7" /></svg>
  ),
  calc: (
    <svg viewBox="0 0 24 24" {...S}><rect x="5" y="3" width="14" height="18" rx="1.5" /><rect x="7.5" y="5.5" width="9" height="3.5" /><path d="M8 12.5h.01M12 12.5h.01M16 12.5h.01M8 16h.01M12 16h.01M16 16h.01" strokeWidth="2.4" /></svg>
  ),
  line: (
    <svg viewBox="0 0 24 24" {...S}><path d="M3.5 20.5h17" /><path d="M4 9h16" strokeDasharray="2 2.2" /><path d="M5 17l4-5 3.5 2.5L19 6" /></svg>
  ),
  risk: (
    <svg viewBox="0 0 24 24" {...S}><path d="M12 3.5l8.5 15h-17z" /><path d="M12 9.5v4.5M12 16.6h.01" strokeWidth="2" /></svg>
  ),
  print: (
    <svg viewBox="0 0 24 24" {...S}><path d="M7 8V3.5h10V8" /><rect x="3.5" y="8" width="17" height="8.5" rx="1.2" /><path d="M7 14h10v6.5H7z" /></svg>
  ),
  top: (
    <svg viewBox="0 0 24 24" {...S}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
  ),
};

const TRACK = ["#core", "#calculator", "#thresholds", "#risk-contractor"];

/** 우측 고정 바로가기 — 아이콘 + 항상 보이는 한글 라벨 (분양 홈페이지형) */
export default function QuickMenu() {
  const [show, setShow] = useState(false);
  const [cur, setCur] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const els = TRACK.map((h) => document.querySelector<HTMLElement>(h));
    const update = () => {
      raf = 0;
      setShow(scrollY > innerHeight * 0.6);
      const line = innerHeight * 0.4;
      let hit: string | null = null;
      els.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) hit = TRACK[i];
      });
      setCur(hit);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => {
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const items: Item[] = [
    { href: "#core", label: "핵심 분석", sub: "3대 분석", icon: I.core },
    { href: "#calculator", label: "계산기", sub: "분양률 시연", icon: I.calc },
    { href: "#thresholds", label: "상환 한계", sub: "79.9% 기준선", icon: I.line },
    { href: "#risk-contractor", label: "리스크", sub: "시공사 420억", icon: I.risk },
    { label: "인쇄", sub: "A4 보고서", icon: I.print, onClick: () => print() },
  ];

  return (
    <aside className={`quick${show ? " is-on" : ""}`} aria-label="빠른 이동">
      <p className="q-head">바로가기</p>
      {items.map((it) =>
        it.href ? (
          <a key={it.label} href={it.href} className="q-item" aria-current={cur === it.href ? "location" : undefined}>
            <span className="q-ico" aria-hidden="true">{it.icon}</span>
            <b>{it.label}</b>
            <small>{it.sub}</small>
          </a>
        ) : (
          <button key={it.label} type="button" className="q-item" onClick={it.onClick}>
            <span className="q-ico" aria-hidden="true">{it.icon}</span>
            <b>{it.label}</b>
            <small>{it.sub}</small>
          </button>
        ),
      )}
      <a href="#top" className="q-item q-top">
        <span className="q-ico" aria-hidden="true">{I.top}</span>
        <b>맨 위로</b>
      </a>
    </aside>
  );
}
