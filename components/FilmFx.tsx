"use client";

import { useEffect } from "react";

/**
 * 필름 연출 제어
 * - 화면 중앙선에 걸린 필름 챕터만 카드를 드러낸다
 * - 필름 챕터(표지 제외) 구간에서는 레터박스를 내린다
 * - 문서 섹션 제목은 화면에 들어올 때 떠오른다
 */
export default function FilmFx() {
  useEffect(() => {
    const films = Array.from(document.querySelectorAll<HTMLElement>(".film"));
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = innerHeight * 0.55;
      let cine = false;
      for (const f of films) {
        const r = f.getBoundingClientRect();
        const on = r.top <= mid && r.bottom > mid;
        if (on) f.setAttribute("data-active", "");
        else f.removeAttribute("data-active");
        if (on && !f.classList.contains("film-cover")) cine = true;
      }
      if (cine) root.dataset.cine = "1";
      else delete root.dataset.cine;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);

    let io: IntersectionObserver | null = null;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      root.classList.add("js-reveal");
      io = new IntersectionObserver(
        (es) => {
          for (const e of es) if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io?.unobserve(e.target);
          }
        },
        { rootMargin: "0px 0px -12% 0px" },
      );
      document.querySelectorAll(".sec-head").forEach((el) => io!.observe(el));
    }
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      root.classList.remove("js-reveal");
    };
  }, []);
  return (
    <>
      <div className="letterbox top" aria-hidden="true" />
      <div className="letterbox bottom" aria-hidden="true" />
    </>
  );
}
