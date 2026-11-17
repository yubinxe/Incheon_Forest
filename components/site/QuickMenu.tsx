"use client";

import { useEffect, useState } from "react";

/** 우측 고정 퀵메뉴 — 실무자가 가장 자주 여는 곳으로 바로 이동 */
export default function QuickMenu() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(scrollY > innerHeight * 0.8);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);

  return (
    <aside className={`quick${show ? " is-on" : ""}`} aria-label="빠른 이동">
      <a href="#overview">
        <b>개요</b>
        <span>사업개요</span>
      </a>
      <a href="#calculator">
        <b>계산</b>
        <span>분양률 계산기</span>
      </a>
      <a href="#thresholds">
        <b>한계</b>
        <span>상환 한계</span>
      </a>
      <a href="#opinion">
        <b>의견</b>
        <span>검토의견</span>
      </a>
      <button type="button" onClick={() => print()}>
        <b>인쇄</b>
        <span>보고서 인쇄</span>
      </button>
      <a href="#top" className="q-top">
        <b>위로</b>
        <span>맨 위로</span>
      </a>
    </aside>
  );
}
