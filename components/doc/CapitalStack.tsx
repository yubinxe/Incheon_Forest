"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { usePlan } from "@/components/plan/PlanProvider";
import { waterfall, type Tier, type TierKey } from "@/lib/analysis";
import { eok, pct } from "@/lib/format";

/**
 * 상환 워터폴 타워 — 분양대금(수위)이 자금 집행 순서대로 층을 채운다.
 * 채워진 층 = 상환 완료, 비어 있는 유리층 = 미상환(손실). 맨 위 금색 = 시행사 이익.
 * 시나리오 바(분양가·분양률)와 실시간 연동.
 */

const COLOR: Record<TierKey, string> = {
  cost: "#a9a294",
  trA: "#13284b",
  trB: "#3a5a8c",
  retention: "#8a7350",
  devLoan: "#5d4a2c",
  profit: "#c9a45c",
};
const LOSS = "#a23a24";
const W = 2.2; // 타워 폭
const H = 6.4; // 최대 높이 (월드 단위)
const GAP = 0.035;

type View = { tiers: Tier[]; level: number; scale: number };

export function CapitalStack() {
  const { price, rate, commRate } = usePlan();
  const w = useMemo(() => waterfall({ aptPerPy: price, salesRate: rate, commercialRate: commRate ?? undefined }), [price, rate, commRate]);
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const target = useRef<View | null>(null);
  const [gl, setGl] = useState<"pending" | "ok" | "none">("pending");

  // 스케일은 시나리오와 무관하게 고정(희망가 완판 기준 ≒ 3,750억 → 높이 86%) — 움직임이 그대로 보이게
  const scale = useMemo(() => Math.max(436_000, w.level * 1.04, w.claims * 1.04), [w.level, w.claims]);
  target.current = { tiers: w.tiers, level: w.level, scale };

  useEffect(() => {
    const maybe = host.current;
    if (!maybe) return;
    const el: HTMLDivElement = maybe;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setGl("none");
      return;
    }
    setGl("ok");
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight("#fffaf0", "#b9b2a3", 1.6));
    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(4, 9, 6);
    scene.add(sun);
    const rim = new THREE.DirectionalLight("#d6c39b", 0.9);
    rim.position.set(-6, 3, -4);
    scene.add(rim);

    // 바닥 — 접지 그림자 대신 부드러운 원형 그라데이션
    const gc = document.createElement("canvas");
    gc.width = gc.height = 256;
    const g2 = gc.getContext("2d")!;
    const grd = g2.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, "rgba(14,26,46,0.22)");
    grd.addColorStop(1, "rgba(14,26,46,0)");
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 256, 256);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const root = new THREE.Group();
    scene.add(root);

    // 층 하나 = 채워진 부분(솔리드) + 빈 부분(유리) + 외곽선
    const box = new THREE.BoxGeometry(1, 1, 1);
    const edgeGeo = new THREE.EdgesGeometry(box);
    type Slab = { key: TierKey; solid: THREE.Mesh; ghost: THREE.Mesh; edge: THREE.LineSegments; edgeMat: THREE.LineBasicMaterial; ghostMat: THREE.MeshStandardMaterial };
    const slabs: Slab[] = (["cost", "trA", "trB", "retention", "devLoan", "profit"] as TierKey[]).map((key) => {
      const solid = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: COLOR[key], roughness: key === "profit" ? 0.35 : 0.62, metalness: key === "profit" ? 0.45 : 0.05 }));
      const ghostMat = new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.16, roughness: 0.1, depthWrite: false });
      const ghost = new THREE.Mesh(box, ghostMat);
      const edgeMat = new THREE.LineBasicMaterial({ color: "#0e1a2e", transparent: true, opacity: 0.35 });
      const edge = new THREE.LineSegments(edgeGeo, edgeMat);
      root.add(solid, ghost, edge);
      return { key, solid, ghost, edge, edgeMat, ghostMat };
    });

    // 수위면 — 분양대금이 어디까지 찼는가
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 1.5, W * 1.5),
      new THREE.MeshBasicMaterial({ color: "#c9a45c", transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    water.rotation.x = -Math.PI / 2;
    const waterEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(W * 1.5, W * 1.5)),
      new THREE.LineBasicMaterial({ color: "#9c7e48" }),
    );
    waterEdge.rotation.x = -Math.PI / 2;
    root.add(water, waterEdge);

    // 현재 표시값 — 목표값으로 부드럽게 수렴
    const cur = new Map<TierKey, { base: number; amount: number; filled: number }>();
    let curLevel = 0;
    let curScale = target.current?.scale ?? 436_000;

    let yaw = -0.62;
    let drag: { x: number; yaw: number } | null = null;
    let idleT = 0;
    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, yaw };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
      idleT = 0;
      kick();
    };
    const onUp = () => (drag = null);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);

    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      cam.aspect = r.width / Math.max(1, r.height);
      cam.updateProjectionMatrix();
      kick();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const v = new THREE.Vector3();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = false;
    let last = performance.now();
    let settled = false;

    function frame(now: number) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = target.current;
      if (!t) return;
      const k = reduce ? 1 : 1 - Math.exp(-dt * 7);
      curScale += (t.scale - curScale) * k;
      curLevel += (t.level - curLevel) * k;
      let moving = Math.abs(t.level - curLevel) > t.scale * 0.0005 || Math.abs(t.scale - curScale) > 10;
      const u = H / curScale;

      for (const tier of t.tiers) {
        const c = cur.get(tier.key) ?? { base: tier.base, amount: 0, filled: tier.filled };
        c.base += (tier.base - c.base) * k;
        c.amount += (tier.amount - c.amount) * k;
        c.filled += (tier.filled - c.filled) * k;
        if (Math.abs(tier.amount - c.amount) > t.scale * 0.0005 || Math.abs(tier.filled - c.filled) > 0.002) moving = true;
        cur.set(tier.key, c);

        const s = slabs.find((x) => x.key === tier.key)!;
        const h = Math.max(0, c.amount * u - GAP);
        const y0 = c.base * u + GAP / 2;
        const hs = h * c.filled;
        const hg = h - hs;
        const show = h > 0.004;
        s.solid.visible = show && hs > 0.002;
        s.solid.scale.set(W, Math.max(0.001, hs), W);
        s.solid.position.y = y0 + hs / 2;
        s.ghost.visible = show && hg > 0.002;
        s.ghost.scale.set(W, Math.max(0.001, hg), W);
        s.ghost.position.y = y0 + hs + hg / 2;
        const lossy = tier.key !== "profit" && c.filled < 0.999;
        s.ghostMat.color.set(lossy ? "#f3d9d2" : "#ffffff");
        s.ghostMat.opacity = lossy ? 0.34 : 0.16;
        s.edge.visible = show;
        s.edge.scale.set(W + 0.002, h + 0.002, W + 0.002);
        s.edge.position.y = y0 + h / 2;
        s.edgeMat.color.set(lossy ? LOSS : "#0e1a2e");
        s.edgeMat.opacity = lossy ? 0.85 : 0.3;
      }
      const wy = curLevel * u;
      water.position.y = waterEdge.position.y = wy + 0.002;

      // 카메라 — 천천히 흔들리는 3/4 뷰, 드래그로 회전
      if (!drag && !reduce) {
        idleT += dt;
        yaw += Math.sin(idleT * 0.35) * dt * 0.06;
      }
      const top = Math.max(curLevel, t.tiers[t.tiers.length - 1].base + t.tiers[t.tiers.length - 1].amount) * u;
      const cy = Math.max(2.4, top * 0.52);
      const dist = 15;
      cam.position.set(Math.sin(yaw) * dist, cy + 3.2, Math.cos(yaw) * dist);
      cam.lookAt(0, cy - 0.15, 0);
      renderer.render(scene, cam);

      // 라벨 — 각 층 오른쪽 모서리에 붙이고 겹침은 세로로 밀어낸다
      const box2 = el.getBoundingClientRect();
      const L = labels.current;
      if (L) {
        const items: { el: HTMLElement; y: number; ax: number; ay: number }[] = [];
        for (const tier of t.tiers) {
          const c = cur.get(tier.key)!;
          const node = L.querySelector<HTMLElement>(`[data-k="${tier.key}"]`);
          if (!node) continue;
          const h = c.amount * u;
          if (h < 0.004) {
            node.style.opacity = "0";
            continue;
          }
          // 카메라 기준 오른쪽 벡터 — 그 방향으로 가장 바깥 꼭짓점에 라벨을 붙인다
          const rx = Math.cos(yaw), rz = -Math.sin(yaw);
          const ex = (Math.sign(rx) * W) / 2, ez = (Math.sign(rz) * W) / 2;
          const ex2 = -ex, ez2 = -ez;
          // 오른쪽·앞쪽에 가장 가까운 꼭짓점
          const corners = [[ex, ez], [ex, ez2], [ex2, ez], [ex2, ez2]];
          let best = corners[0], bs = -Infinity;
          for (const [x, z] of corners) {
            const sc = x * rx + z * rz;
            if (sc > bs) { bs = sc; best = [x, z]; }
          }
          v.set(best[0], c.base * u + h / 2, best[1]).project(cam);
          const ax = (v.x * 0.5 + 0.5) * box2.width;
          const ay = (-v.y * 0.5 + 0.5) * box2.height;
          node.style.opacity = "1";
          items.push({ el: node, y: ay, ax, ay });
        }
        items.sort((a, b) => b.ay - a.ay); // 아래(화면 큰 y)부터
        const minGap = 34;
        for (let i = 1; i < items.length; i++) if (items[i - 1].y - items[i].y < minGap) items[i].y = items[i - 1].y - minGap;
        const lx = Math.min(box2.width - (box2.width < 500 ? 96 : 176), Math.max(...items.map((i) => i.ax)) + 34);
        for (const it of items) {
          it.el.style.transform = `translate(${lx}px, ${it.y}px) translateY(-50%)`;
          const line = it.el.querySelector<SVGLineElement>("line");
          const svg = it.el.querySelector<SVGSVGElement>("svg");
          if (line && svg) {
            const dx = lx - it.ax;
            const dy = it.ay - it.y;
            svg.style.left = `${-dx}px`;
            svg.setAttribute("width", String(dx));
            line.setAttribute("x1", "0");
            line.setAttribute("y1", String(dy));
            line.setAttribute("x2", String(dx - 4));
            line.setAttribute("y2", "0");
            svg.style.top = `${Math.min(0, dy)}px`;
            svg.setAttribute("height", String(Math.abs(dy) + 1));
            if (dy < 0) {
              line.setAttribute("y1", "0");
              line.setAttribute("y2", String(-dy));
            } else {
              line.setAttribute("y1", String(dy));
              line.setAttribute("y2", "0");
            }
          }
        }
      }

      settled = !moving;
      if (visible && (!settled || !reduce)) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (!raf && visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(el);
    (el as HTMLDivElement & { __kick?: () => void }).__kick = kick;
    resize();

    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // 시나리오가 바뀌면 렌더 루프를 깨운다
  useEffect(() => {
    (host.current as (HTMLDivElement & { __kick?: () => void }) | null)?.__kick?.();
  }, [w, scale]);

  const ordered = [...w.tiers].reverse();
  const reachedTier = w.tiers.find((t) => t.key === w.reached)!;
  const headline =
    w.cash >= 0
      ? { tone: "good", text: `수위가 시행사 이익까지 찼습니다 — 모든 채권자 전액 상환 후 ${eok(w.profit, 0)}원이 남습니다.` }
      : w.lenderLoss <= 0.5
        ? { tone: "warn", text: `대주단은 전액 상환, 수위가 ${reachedTier.label}에서 멈춥니다 — 후순위 ${eok(w.subLoss, 0)}원 미회수.` }
        : { tone: "bad", text: `수위가 ${reachedTier.label}에 머뭅니다 — 대주단 ${eok(w.lenderLoss, 0)}원 미상환, 후순위 전액 손실.` };

  return (
    <figure className="stack" aria-label="상환 워터폴">
      <figcaption className="stack-cap">
        <p className="stack-eyebrow">상환 워터폴 · 자금 집행 순서</p>
        <h3 className="stack-h">분양대금이 어디까지 차오르는가</h3>
        <p className={`stack-head v-${headline.tone}`}>{headline.text}</p>
      </figcaption>

      <div className="stack-grid">
        <div className="stack-3d">
          <div ref={host} className="stack-canvas" aria-hidden="true" />
          <div ref={labels} className="stack-labels" aria-hidden="true">
            {w.tiers.map((t) => (
              <div key={t.key} data-k={t.key} className={`sl${t.loss > 0.5 ? " is-loss" : ""}${t.key === "profit" ? " is-profit" : ""}`}>
                <svg className="sl-lead"><line /></svg>
                <b>{t.label}</b>
                <span>{eok(t.amount, 0)}</span>
              </div>
            ))}
          </div>
          <p className="stack-level">
            <i aria-hidden="true" />
            분양대금 수위 <b>{eok(w.level, 0)}원</b>
            <small>분양수입 + 출자·대여 + 예치금이자</small>
          </p>
          {gl === "ok" && <p className="stack-hint">끌어서 회전</p>}
        </div>

        <ol className="wl" aria-label="층별 상환 현황 (위가 가장 후순위)">
          {ordered.map((t) => {
            const done = t.key === "profit" ? t.amount > 0.5 : t.filled >= 0.9995;
            const none = t.key !== "profit" && t.filled <= 0.0005;
            return (
              <li key={t.key} className={`wl-${t.key}${t.loss > 0.5 ? " is-loss" : ""}${t.key === w.reached ? " is-reached" : ""}`}>
                <i className="wl-sw" style={{ background: COLOR[t.key] }} aria-hidden="true" />
                <div className="wl-name">
                  <b>{t.label}</b>
                  <span>{t.holder}</span>
                </div>
                <div className="wl-amt">{t.key === "profit" && t.amount <= 0.5 ? "—" : eok(t.amount, 0)}</div>
                <div className="wl-bar" aria-hidden="true">
                  <i style={{ width: `${(t.key === "profit" ? (t.amount > 0.5 ? 1 : 0) : t.filled) * 100}%` }} />
                </div>
                <div className="wl-st">
                  {t.key === "profit"
                    ? t.amount > 0.5
                      ? `잔여 · 매출 대비 ${pct(t.amount / Math.max(1, w.level))}`
                      : "이익 없음"
                    : done
                      ? "상환 완료"
                      : none
                        ? `미상환 −${eok(t.loss, 0)}`
                        : `${pct(t.filled, 0)} 상환 · −${eok(t.loss, 0)}`}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="stack-note">
        아래층부터 채워지고 손실은 위층(가장 후순위)부터 흡수합니다. 본PF 미상환분이 생기면 미분양담보대출(한도 400억)로 대환되며
        그 이자가 사업비에 더해집니다{w.unsoldDraw > 0 ? ` — 현재 대환 ${eok(w.unsoldDraw, 0)}원` : ""}. 층 높이는 금액에 비례합니다.
      </p>
    </figure>
  );
}
