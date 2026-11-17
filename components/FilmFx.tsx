"use client";

import { useEffect } from "react";

/** 화면 중앙선에 걸린 필름 챕터만 카드를 드러낸다 */
export default function FilmFx() {
  useEffect(() => {
    const films = Array.from(document.querySelectorAll<HTMLElement>(".film"));
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = innerHeight * 0.55;
      for (const f of films) {
        const r = f.getBoundingClientRect();
        const on = r.top <= mid && r.bottom > mid;
        if (on) f.setAttribute("data-active", "");
        else f.removeAttribute("data-active");
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
