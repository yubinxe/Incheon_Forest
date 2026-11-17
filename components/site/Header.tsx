"use client";

import { useEffect, useState } from "react";
import { NAV, OWNER } from "./nav";

/**
 * 분양 홈페이지형 GNB.
 * 히어로 위에서는 투명, 스크롤하면 흰 바탕으로 전환. 현재 섹션의 대메뉴를 표시한다.
 */
export default function Header({ baseDate }: { baseDate: string }) {
  const [mode, setMode] = useState<"clear" | "dark" | "light">("clear");
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const ids = Object.keys(OWNER);
    const update = () => {
      raf = 0;
      const y = scrollY;
      const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gnb-h")) || 84;
      const overPaper = Array.from(document.querySelectorAll(".paper")).some((p) => {
        const r = p.getBoundingClientRect();
        return r.top <= h && r.bottom > h;
      });
      setMode(overPaper ? "light" : y > innerHeight * 0.5 ? "dark" : "clear");
      const max = document.documentElement.scrollHeight - innerHeight;
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
      let cur = "";
      let best = -Infinity;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= h + 60 && top > best) {
          best = top;
          cur = OWNER[id];
        }
      }
      setActive(cur);
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

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`gnb${mode === "light" ? " is-solid" : mode === "dark" ? " is-dark" : ""}${open ? " is-open" : ""}`}>
      <div className="gnb-bar">
        <a href="#top" className="brand" aria-label="청라 레이크 포레 처음으로">
          <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
            <rect x="14" y="12" width="10" height="34" />
            <rect x="27" y="18" width="10" height="28" />
            <rect x="40" y="8" width="10" height="38" />
            <rect x="10" y="49" width="44" height="2.5" className="bm-water" />
            <rect x="16" y="54" width="32" height="2" className="bm-water" />
          </svg>
          <span className="brand-name">청라 레이크 포레</span>
        </a>

        <nav className="gnb-menu" aria-label="주 메뉴">
          <ul>
            {NAV.map((n) => (
              <li key={n.label} className={active === n.label ? "is-active" : undefined}>
                <a href={n.href}>{n.label}</a>
                {n.children && (
                  <ul className="gnb-sub">
                    {n.children.map((c) => (
                      <li key={c.href}>
                        <a href={c.href}>{c.label}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="gnb-util">
          <span className="gnb-date">기준일 {baseDate}</span>
          <button type="button" className="gnb-print" onClick={() => print()}>
            보고서 인쇄
          </button>
          <button
            type="button"
            className="gnb-burger"
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <i />
            <i />
            <i />
          </button>
        </div>
      </div>
      <div className="gnb-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />

      {/* 모바일 전체 메뉴 */}
      <div className="gnb-sheet" hidden={!open}>
        <ul>
          {NAV.map((n) => (
            <li key={n.label}>
              <a href={n.href} onClick={() => setOpen(false)} className="sheet-top">
                {n.label}
              </a>
              {n.children && (
                <ul>
                  {n.children.map((c) => (
                    <li key={c.href}>
                      <a href={c.href} onClick={() => setOpen(false)}>
                        {c.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <p className="sheet-foot">기준일 {baseDate} · 교육용 합성 자료</p>
      </div>
    </header>
  );
}
