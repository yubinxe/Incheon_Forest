"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { buildTraffic } from "./traffic";
import { addWind, buildCloudShadows, buildClouds } from "./atmosphere";
import { LAKE_CENTER, ROADS, buildComplex, buildContext, lakeShape, waterNormals } from "./world";

/** 필름 그레이드 — 비네트 · 미세 색수차 · 그레인 · 틸/앰버 톤 (sRGB 출력 후 적용) */
const CineShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.045 },
    uVig: { value: 0.42 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVig; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    void main(){
      vec2 c = vUv - 0.5;
      float d = length(c);
      vec2 off = c * 0.0035 * d;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(1.06, 1.0, 0.92), smoothstep(0.45, 1.0, lum));
      col += vec3(-0.012, 0.004, 0.02) * (1.0 - smoothstep(0.0, 0.45, lum));
      col = mix(col, smoothstep(0.0, 1.0, col), 0.22);
      col *= mix(1.0, 1.0 - uVig, smoothstep(0.28, 0.82, d));
      float n = hash(vUv * uRes + fract(uTime) * 91.7) - 0.5;
      col += n * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

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
  { pos: [260, 30, 430], look: [-100, 56, 70], sun: 8.5, night: 0, lit: 0.06, fov: 38 }, // 0 표지 — 서해 낙조 역광
  { pos: [40, 560, 140], look: [0, 0, 0], sun: 52, night: 0, lit: 0, fov: 38 }, // 1 대지 — 수직 조감
  { pos: [-170, 7, 470], look: [0, 46, 0], sun: 6, night: 0.02, lit: 0, fov: 36 }, // 2 호수 수면
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
    scene.fog = new THREE.Fog("#b9b2a6", 1500, 11000);
    const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 2, 24000);

    /* 하늘 · 빛 */
    const sky = new Sky();
    sky.scale.setScalar(12000);
    const su = sky.material.uniforms;
    su.turbidity.value = 4.5;
    su.rayleigh.value = 2.8;
    su.mieCoefficient.value = 0.005;
    su.mieDirectionalG.value = 0.84;
    scene.add(sky);

    const sun = new THREE.DirectionalLight("#fff1dc", 3);
    sun.castShadow = !mobile;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -340; sc.right = 340; sc.top = 340; sc.bottom = -340; sc.near = 10; sc.far = 2400;
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

    /* 유리 반사 — 실제 도시 HDRI(CC0)를 유리 재질에만 입혀 하늘과 건물이 비치게 한다 */
    let glassEnvRT: THREE.WebGLRenderTarget | null = null;
    let disposed = false;
    import("@pmndrs/assets/hdri/city.exr")
      .then((mod) => new EXRLoader().loadAsync(mod.default))
      .then((tex) => {
        if (disposed) return tex.dispose();
        tex.mapping = THREE.EquirectangularReflectionMapping;
        glassEnvRT = pmrem.fromEquirectangular(tex);
        tex.dispose();
        for (const m of complex.glassMats) {
          m.envMap = glassEnvRT.texture;
          m.needsUpdate = true;
        }
        ctx.ctxMat.envMap = glassEnvRT.texture;
        ctx.ctxMat.needsUpdate = true;
      })
      .catch(() => {});

    /* 시간 축 — 구름 · 구름 그림자 · 차량 · 바람 */
    const clouds = buildClouds();
    scene.add(clouds.mesh);
    const cloudShadow = buildCloudShadows();
    scene.add(cloudShadow.mesh);
    const traffic = buildTraffic(ROADS, mobile ? 160 : 420);
    scene.add(traffic.group);
    const windTime = { value: 0 };
    addWind(ctx.treeMat, windTime);

    const water = new Water(new THREE.ShapeGeometry(lakeShape(), 48), {
      textureWidth: mobile ? 512 : 1024,
      textureHeight: mobile ? 512 : 1024,
      waterNormals: waterNormals(),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xfff1dc,
      waterColor: 0x0e1e2c,
      distortionScale: 0.32,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(LAKE_CENTER.x, 0.4, LAKE_CENTER.z);
    (water.material as THREE.ShaderMaterial).uniforms.size.value = 1.4;
    scene.add(water);

    /* 후처리 — 야간 창·가로등 번짐 */
    // MSAA 렌더 타깃 — 후처리를 거쳐도 가장자리 계단 현상이 없도록
    const msaa = new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), {
      type: THREE.HalfFloatType,
      samples: mobile ? 2 : 4,
    });
    const composer = new EffectComposer(renderer, msaa);
    composer.addPass(new RenderPass(scene, camera));
    // 앰비언트 오클루전 — 발코니 아래 · 동 사이 · 수관 밑의 접촉 음영
    const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    gtao.updateGtaoMaterial({ radius: 7, distanceExponent: 1.6, thickness: 6, scale: 1.25, samples: 12, distanceFallOff: 1 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.85;
    if (!mobile) composer.addPass(gtao);
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0, 0.55, 0.82);
    if (!mobile) composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const cine = new ShaderPass(CineShader);
    cine.uniforms.uRes.value.set(innerWidth, innerHeight);
    if (mobile) cine.uniforms.uGrain.value = 0.03;
    composer.addPass(cine);

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

    // 오프닝: 서해 상공 원경에서 출발해 단지로 활공
    const cur = {
      pos: reduce ? new THREE.Vector3(...SHOTS[0].pos) : new THREE.Vector3(-2600, 760, 2600),
      look: reduce ? new THREE.Vector3(...SHOTS[0].look) : new THREE.Vector3(-600, 60, 200),
      sun: SHOTS[0].sun,
      night: 0,
      lit: 0,
      fov: SHOTS[0].fov,
    };
    const tgtPos = new THREE.Vector3();
    const tgtLook = new THREE.Vector3();
    const fogDay = new THREE.Color("#b7c0ca");
    const fogDusk = new THREE.Color("#c9a585");
    const fogNight = new THREE.Color("#0b1220");
    const fogCol = new THREE.Color();

    const clock = new THREE.Clock();
    let flyStart = 0;
    let degraded = false;
    let adaptiveChecks = 0;
    const frameMs: number[] = [];
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
      const elapsed = clock.elapsedTime;
      const introOn = document.documentElement.dataset.intro === "on";
      if (introOn) flyStart = elapsed;
      const fly = THREE.MathUtils.smoothstep(elapsed - flyStart, 0, 6);
      const damp = reduce ? 1 : introOn ? 0 : 1 - Math.exp(-dt * (0.35 + 2.85 * fly));
      // 미세한 호흡 — 정지 화면처럼 보이지 않도록
      const drift = reduce ? 0 : 1;
      const coverW = a === 0 ? 1 - k : b === 0 ? k : 0;
      tgtPos.x += Math.sin(elapsed * 0.07) * (14 + 46 * coverW) * drift;
      tgtPos.z += Math.cos(elapsed * 0.05) * 30 * coverW * drift;
      tgtPos.y += Math.sin(elapsed * 0.11) * 3 * drift;
      cur.pos.lerp(tgtPos, damp);
      cur.look.lerp(tgtLook, damp);
      cur.sun = lerp(cur.sun, lerp(A.sun, B.sun, k), damp);
      cur.night = lerp(cur.night, lerp(A.night, B.night, k), damp);
      cur.lit = lerp(cur.lit, lerp(litA, litB, k), Math.min(1, damp * 1.6));
      cur.fov = lerp(cur.fov, lerp(A.fov, B.fov, k), damp);

      if (covered && !reduce) return;

      // 4D — 시간에 따라 흐르는 것들
      const flow = reduce ? 0 : elapsed;
      clouds.uniforms.uTime.value = flow;
      cloudShadow.uniforms.uTime.value = flow;
      windTime.value = flow;
      traffic.update(flow);

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
      renderer.toneMappingExposure = lerp(0.74, 0.95, cur.night);

      // 창 점등 (= 분양률)
      complex.setLit(cur.lit);
      const glow = 1.35 * THREE.MathUtils.smoothstep(cur.night, 0.15, 0.85);
      for (const m of complex.materials) m.emissiveIntensity = glow;
      ctx.ctxMat.emissiveIntensity = glow * 0.32;
      ctx.lampMat.opacity = THREE.MathUtils.smoothstep(cur.night, 0.4, 1);
      bloom.strength = 0.18 * (1 - dayK) + 0.62 * THREE.MathUtils.smoothstep(cur.night, 0.3, 1);
      cine.uniforms.uTime.value = elapsed;
      clouds.uniforms.uSunDir.value.copy(sunVec);
      clouds.uniforms.uSunCol.value.copy(sun.color);
      clouds.uniforms.uSky.value.copy(fogCol);
      clouds.uniforms.uNight.value = cur.night;
      cloudShadow.uniforms.uSunDir.value.copy(sunVec);
      cloudShadow.uniforms.uStrength.value = 0.34 * above * (1 - cur.night);
      cloudShadow.mesh.visible = above > 0.05;
      traffic.setNight(THREE.MathUtils.smoothstep(cur.night, 0.2, 0.8) + (1 - dayK) * 0.35);
      for (const m of complex.glassMats) m.envMapIntensity = 0.15 + 0.85 * above * (0.6 + 0.4 * dayK);
      ctx.ctxMat.envMapIntensity = 0.15 + 0.85 * above;

      // 적응형 품질 — 느린 기기에서는 AO · 블룸을 끄고 해상도를 낮춘다
      if (!degraded && elapsed > 3) {
        frameMs.push(dt * 1000);
        if (frameMs.length > 90) {
          const sorted = [...frameMs].sort((x, y) => x - y);
          if (sorted[45] > 34) {
            degraded = true;
            gtao.enabled = false;
            bloom.enabled = false;
            renderer.setPixelRatio(1);
            composer.setPixelRatio?.(1);
            onResize();
          }
          frameMs.length = 0;
          adaptiveChecks++;
          if (adaptiveChecks > 3) degraded = true; // 충분히 확인함
        }
      }
      cine.uniforms.uVig.value = 0.36 + 0.14 * cur.night;

      composer.render();
    };
    frame();
    requestAnimationFrame(() => host.classList.add("is-ready"));

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
      gtao.setSize(innerWidth, innerHeight);
      cine.uniforms.uRes.value.set(innerWidth, innerHeight);
    };
    addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
      window.removeEventListener("lf:lit", onLit);
      document.removeEventListener("visibilitychange", onVis);
      mo.disconnect();
      disposed = true;
      envRT?.dispose();
      glassEnvRT?.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="scene" aria-hidden="true" />;
}
