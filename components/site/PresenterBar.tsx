"use client";

import { useCallback, useEffect, useState } from "react";

const STEPS = [
  { key: "1", label: "79.9% 한계선", target: "#thresholds" },
  { key: "2", label: "계산기 시연", target: "#calculator" },
  { key: "3", label: "시공사 420억원", target: "#risk-contractor" },
  { key: "4", label: "검증·결론", target: "#verify" },
] as const;

type LenisLike = { scrollTo: (el: HTMLElement | number, o?: { offset?: number; duration?: number }) => void };

function go(sel: string) {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
  const gnb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gnb-h")) || 80;
  // 계산기 카드는 sticky — 카드가 헤더 바로 아래 고정되는 지점(섹션 상단 + 카드 상단 여백)으로 이동
  const card = sel === "#calculator" ? el.querySelector<HTMLElement>(".calc") : null;
  const y = card
    ? el.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(card).marginTop || "0") - (gnb + 12)
    : el.getBoundingClientRect().top + scrollY - (gnb + 16);
  if (lenis) lenis.scrollTo(y, { duration: 1.4 });
  else scrollTo({ top: y, behavior: "smooth" });
}

/**
 * 발표 4-Step 리모컨 — 숫자키 1~4로 해당 장면으로 이동, 발표 모드에서는 ←/→ 로 이전·다음.
 * 입력 필드에 포커스가 있으면 단축키를 무시한다.
 */
export default function PresenterBar() {
  const [on, setOn] = useState(false);
  const [cur, setCur] = useState(-1);

  const goStep = useCallback((i: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, i));
    setCur(k);
    go(STEPS[k].target);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = STEPS.findIndex((s) => s.key === e.key);
      if (idx >= 0) {
        e.preventDefault();
        setOn(true);
        goStep(idx);
      } else if (on && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        goStep(cur + (e.key === "ArrowRight" ? 1 : -1));
      } else if (on && e.key === "Escape") setOn(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [on, cur, goStep]);

  return (
    <nav className={`pbar${on ? " is-on" : ""}`} aria-label="발표 4단계 이동">
      <button type="button" className="pbar-toggle" aria-pressed={on} onClick={() => setOn((v) => !v)}>
        발표 모드
      </button>
      {on && (
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button type="button" aria-current={cur === i ? "step" : undefined} onClick={() => goStep(i)}>
                <kbd>{s.key}</kbd>
                {s.label}
              </button>
            </li>
          ))}
          <li className="pbar-hint">← → 이동 · Esc 닫기</li>
        </ol>
      )}
    </nav>
  );
}
