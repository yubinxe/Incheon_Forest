"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LAKE_CENTER, buildComplex, buildContext, lakeShape, waterNormals } from "./world";

/** 장면 키프레임 — 섹션의 data-shot 값이 이 배열의 인덱스 */
type Shot = {
  pos: [number, number, number];
  look: [number, number, number];
  sun: number; // 태양 고도(°)
  night: number; // 0 낮 ~ 1 밤
  lit: number | "live"; // 창 점등률 (= 분양률)
  fov: number;
};

export const SHOTS: Shot[] = [
  { pos: [-300, 95, 600], look: [-170, 75, 0], sun: 3.2, night: 0, lit: 0, fov: 36 }, // 0 표지 — 노을 항공
  { pos: [40, 560, 140], look: [0, 0, 0], sun: 52, night: 0, lit: 0, fov: 38 }, // 1 대지 — 수직 조감
  { pos: [-170, 7, 470], look: [0, 46, 0], sun: 3.5, night: 0.05, lit: 0, fov: 36 }, // 2 호수 수면
  { pos: [150, 70, 150], look: [10, 52, 20], sun: 0.5, night: 0.35, lit: 0.35, fov: 40 }, // 3 입면
  { pos: [-300, 120, 420], look: [0, 42, 0], sun: -7, night: 1, lit: 0.799, fov: 36 }, // 4 밤 — 상환한계 점등
  { pos: [-380, 230, 560], look: [0, 30, 40], sun: -9, night: 1, lit: "live", fov: 34 }, // 5 문서
  { pos: [-40, 34, 330], look: [0, 50, 0], sun: -10, night: 1, lit: "live", fov: 38 }, // 6 계산기
  { pos: [620, 420, -380], look: [0, 0, 60], sun: -12, night: 1, lit: "live", fov: 34 }, // 7 맺음
];

const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function setLiveLit(rate: number) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("lf:lit", { detail: rate }));
}

export default function Scene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      host.dataset.fallback = "1";
      return;
    }
    const mobile = matchMedia("(max-width: 760px)").matches;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.55;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#b9b2a6", 900, 4200);
    const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 1, 20000);

    /* 하늘 · 빛 */
    const sky = new Sky();
    sky.scale.setScalar(12000);
    const su = sky.material.uniforms;
    su.turbidity.value = 8;
    su.rayleigh.value = 2.2;
    su.mieCoefficient.value = 0.004;
    su.mieDirectionalG.value = 0.86;
    scene.add(sky);

    const sun = new THREE.DirectionalLight("#fff1dc", 3);
    sun.castShadow = !mobile;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 10; sc.far = 2200;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
    scene.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight("#d9dde4", "#6a5f4e", 0.9);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight("#8ea4cc", 0);
    moon.position.set(400, 600, -300);
    scene.add(moon);

    /* 환경맵 — 하늘을 PMREM으로 구워 유리·물 반사에 사용 (변화가 클 때만 갱신) */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const skyScene = new THREE.Scene();
    const skyForEnv = new Sky();
    skyForEnv.scale.setScalar(12000);
    skyScene.add(skyForEnv);
    let envRT: THREE.WebGLRenderTarget | null = null;
    let lastEnvSun = 999;
    const sunVec = new THREE.Vector3();
    const updateEnv = (elev: number) => {
      if (Math.abs(elev - lastEnvSun) < 1.5) return;
      lastEnvSun = elev;
      const u = skyForEnv.material.uniforms;
      for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"] as const) u[k].value = su[k].value;
      u.sunPosition.value.copy(sunVec);
      envRT?.dispose();
      envRT = pmrem.fromScene(skyScene as unknown as THREE.Scene);
      scene.environment = envRT.texture;
    };

    /* 지형 · 단지 */
    const ctx = buildContext();
    scene.add(ctx.group);
    const complex = buildComplex();
    scene.add(complex.group);

    const water = new Water(new THREE.ShapeGeometry(lakeShape(), 48), {
      textureWidth: mobile ? 512 : 1024,
      textureHeight: mobile ? 512 : 1024,
      waterNormals: waterNormals(),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xfff1dc,
      waterColor: 0x0e1e2c,
      distortionScale: 1.1,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(LAKE_CENTER.x, 0.4, LAKE_CENTER.z);
    (water.material as THREE.ShaderMaterial).uniforms.size.value = 2.4;
    scene.add(water);

    /* 후처리 — 야간 창·가로등 번짐 */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0, 0.55, 0.82);
    if (!mobile) composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /* 스크롤 → 샷 */
    let liveLit = 0.8;
    const onLit = (e: Event) => (liveLit = (e as CustomEvent<number>).detail);
    window.addEventListener("lf:lit", onLit);

    let sections: HTMLElement[] = [];
    let seeThrough: HTMLElement[] = [];
    const collect = () => {
      sections = Array.from(document.querySelectorAll<HTMLElement>("[data-shot]"));
      seeThrough = sections.filter((s) => s.dataset.see === "1");
    };
    collect();
    const mo = new MutationObserver(collect);
    mo.observe(document.body, { childList: true, subtree: true });

    const shotAt = () => {
      const mid = innerHeight * 0.5;
      let a = 0;
      let b = 0;
      let t = 0;
      for (let i = 0; i < sections.length; i++) {
        const top = sections[i].getBoundingClientRect().top;
        if (top <= mid) {
          a = Number(sections[i].dataset.shot);
          const next = sections[i + 1];
          if (next) {
            const nt = next.getBoundingClientRect().top;
            b = Number(next.dataset.shot);
            t = Math.min(1, Math.max(0, (mid - top) / Math.max(1, nt - top)));
          } else {
            b = a;
          }
        }
      }
      return { a, b, t };
    };

    const cur = {
      pos: new THREE.Vector3(...SHOTS[0].pos),
      look: new THREE.Vector3(...SHOTS[0].look),
      sun: SHOTS[0].sun,
      night: 0,
      lit: 0,
      fov: SHOTS[0].fov,
    };
    const tgtPos = new THREE.Vector3();
    const tgtLook = new THREE.Vector3();
    const fogDay = new THREE.Color("#c4b9a8");
    const fogDusk = new THREE.Color("#c29a78");
    const fogNight = new THREE.Color("#0b1220");
    const fogCol = new THREE.Color();

    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;
    const onVis = () => (visible = document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      // 불투명 문서가 화면을 모두 덮으면 렌더 생략 (카메라 상태는 계속 갱신)
      const covered =
        seeThrough.length > 0 &&
        !seeThrough.some((s) => {
          const r = s.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight;
        });
      const { a, b, t } = shotAt();
      const A = SHOTS[a] ?? SHOTS[0];
      const B = SHOTS[b] ?? A;
      const k = ease(t);
      tgtPos.set(lerp(A.pos[0], B.pos[0], k), lerp(A.pos[1], B.pos[1], k), lerp(A.pos[2], B.pos[2], k));
      tgtLook.set(lerp(A.look[0], B.look[0], k), lerp(A.look[1], B.look[1], k), lerp(A.look[2], B.look[2], k));
      const litA = A.lit === "live" ? liveLit : A.lit;
      const litB = B.lit === "live" ? liveLit : B.lit;

      const dt = Math.min(0.05, clock.getDelta());
      const damp = reduce ? 1 : 1 - Math.exp(-dt * 3.2);
      const elapsed = clock.elapsedTime;
      // 미세한 호흡 — 정지 화면처럼 보이지 않도록
      const drift = reduce ? 0 : 1;
      tgtPos.x += Math.sin(elapsed * 0.07) * 14 * drift;
      tgtPos.y += Math.sin(elapsed * 0.11) * 3 * drift;
      cur.pos.lerp(tgtPos, damp);
      cur.look.lerp(tgtLook, damp);
      cur.sun = lerp(cur.sun, lerp(A.sun, B.sun, k), damp);
      cur.night = lerp(cur.night, lerp(A.night, B.night, k), damp);
      cur.lit = lerp(cur.lit, lerp(litA, litB, k), Math.min(1, damp * 1.6));
      cur.fov = lerp(cur.fov, lerp(A.fov, B.fov, k), damp);

      if (covered && !reduce) return;

      camera.position.copy(cur.pos);
      camera.lookAt(cur.look);
      if (Math.abs(camera.fov - cur.fov) > 0.01) {
        camera.fov = cur.fov;
        camera.updateProjectionMatrix();
      }

      // 태양
      const el = THREE.MathUtils.degToRad(cur.sun);
      const az = THREE.MathUtils.degToRad(-62);
      sunVec.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
      su.sunPosition.value.copy(sunVec);
      sun.position.copy(sunVec).multiplyScalar(900);
      const dayK = THREE.MathUtils.clamp(cur.sun / 12, 0, 1);
      const above = THREE.MathUtils.clamp((cur.sun + 2) / 4, 0, 1);
      sun.intensity = 4.2 * above * (0.55 + 0.45 * dayK);
      sun.color.setHSL(0.075, 0.75 * (1 - dayK) + 0.12, 0.6 + 0.28 * dayK);
      hemi.intensity = 0.12 + 0.5 * above + 0.25 * dayK;
      moon.intensity = 0.45 * cur.night;
      (water.material as THREE.ShaderMaterial).uniforms.sunDirection.value.copy(sunVec).normalize();
      (water.material as THREE.ShaderMaterial).uniforms.time.value = elapsed * 0.35;
      updateEnv(cur.sun);
      scene.environmentIntensity = 0.25 + 0.75 * above;

      fogCol.copy(fogDay).lerp(fogDusk, 1 - dayK).lerp(fogNight, cur.night);
      (scene.fog as THREE.Fog).color.copy(fogCol);
      renderer.toneMappingExposure = lerp(0.55, 0.9, cur.night);

      // 창 점등 (= 분양률)
      complex.setLit(cur.lit);
      const glow = 1.35 * THREE.MathUtils.smoothstep(cur.night, 0.15, 0.85);
      for (const m of complex.materials) m.emissiveIntensity = glow;
      ctx.ctxMat.emissiveIntensity = glow * 0.32;
      ctx.lampMat.opacity = THREE.MathUtils.smoothstep(cur.night, 0.4, 1);
      bloom.strength = 0.6 * THREE.MathUtils.smoothstep(cur.night, 0.3, 1);

      composer.render();
    };
    frame();
    requestAnimationFrame(() => host.classList.add("is-ready"));

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
    };
    addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
      window.removeEventListener("lf:lit", onLit);
      document.removeEventListener("visibilitychange", onVis);
      mo.disconnect();
      envRT?.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="scene" aria-hidden="true" />;
}
