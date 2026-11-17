"use client";

import { useEffect, useState } from "react";

/**
 * 영화식 오프닝 — 레터박스가 닫힌 채 타이틀이 떠오르고, 막이 열리며 장면으로 들어간다.
 * 클릭·스크롤·키 입력 시 즉시 건너뛴다. 세션당 1회.
 */
export default function Intro() {
  const [phase, setPhase] = useState<"on" | "open" | "done">("on");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("lf:intro") === "1";
    } catch {}
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      setPhase("done");
      document.documentElement.dataset.intro = "done";
      return;
    }
    document.documentElement.dataset.intro = "on";
    const open = () => {
      setPhase((p) => (p === "on" ? "open" : p));
      document.documentElement.dataset.intro = "open";
      try {
        sessionStorage.setItem("lf:intro", "1");
      } catch {}
    };
    const t1 = setTimeout(open, 2600);
    const skip = () => open();
    addEventListener("wheel", skip, { once: true, passive: true });
    addEventListener("touchstart", skip, { once: true, passive: true });
    addEventListener("keydown", skip, { once: true });
    return () => {
      clearTimeout(t1);
      removeEventListener("wheel", skip);
      removeEventListener("touchstart", skip);
      removeEventListener("keydown", skip);
    };
  }, []);

  useEffect(() => {
    if (phase !== "open") return;
    const t = setTimeout(() => {
      setPhase("done");
      document.documentElement.dataset.intro = "done";
    }, 1700);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;
  return (
    <div className={`intro is-${phase}`} onClick={() => {
        document.documentElement.dataset.intro = "open";
        setPhase("open");
      }} aria-hidden="true">
      <div className="intro-bar top" />
      <div className="intro-bar bottom" />
      <div className="intro-title">
        <p className="intro-k"><span>인천광역시 서해구 청라동</span></p>
        <p className="intro-n"><span>청라 레이크 포레</span></p>
        <p className="intro-l"><i /></p>
      </div>
    </div>
  );
}
