"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/** 관성 스크롤 — 앵커 이동도 같은 곡선으로. 모션 축소 설정이면 끈다. */
export default function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (matchMedia("(pointer: coarse)").matches) return; // 터치 기기는 네이티브 스크롤
    const lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), wheelMultiplier: 0.9 });
    document.documentElement.style.scrollBehavior = "auto";
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const gnb = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gnb-h")) || 80;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href")!;
      const el = id === "#top" ? document.body : document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: id === "#top" ? 0 : -(gnb() + 16), duration: 1.6 });
      history.replaceState(null, "", id);
    };
    document.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);
  return null;
}
