"use client";

import { useEffect, useState } from "react";

/** 우측 고정 퀵메뉴 — 장 번호 + 전체 이름을 항상 보이게, 지금 읽는 장은 표시 */
const ITEMS = [
  { href: "#core", no: "요약", label: "핵심 분석" },
  { href: "#calculator", no: "05-1", label: "분양률 계산" },
  { href: "#thresholds", no: "06", label: "상환 한계" },
  { href: "#opinion", no: "08", label: "리스크·의견" },
] as const;

export default function QuickMenu() {
  const [show, setShow] = useState(false);
  const [cur, setCur] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const els = ITEMS.map((it) => document.querySelector<HTMLElement>(it.href));
    const update = () => {
      raf = 0;
      setShow(scrollY > innerHeight * 0.8);
      const line = innerHeight * 0.4;
      let hit: string | null = null;
      els.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) hit = ITEMS[i].href;
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

  return (
    <aside className={`quick${show ? " is-on" : ""}`} aria-label="빠른 이동">
      <p className="q-head">바로가기</p>
      {ITEMS.map((it) => (
        <a key={it.href} href={it.href} aria-current={cur === it.href ? "location" : undefined}>
          <small>{it.no}</small>
          <b>{it.label}</b>
        </a>
      ))}
      <button type="button" className="q-util" onClick={() => print()}>
        <b>보고서 인쇄</b>
      </button>
      <a href="#top" className="q-top">
        <b>↑ 맨 위로</b>
      </a>
    </aside>
  );
}
