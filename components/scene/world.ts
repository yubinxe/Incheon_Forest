import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** 결정적 난수 — 새로고침해도 같은 단지가 보이도록 */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────── 매스 스터디 (실제 배치도가 아닌 교육용 가상 매스) ───────── */

import { TOWERS, FLOOR_H, PILOTI_H } from "./towers";
export { TOWERS, FLOOR_H, PILOTI_H };
export type { TowerSpec } from "./towers";

const WIN_W = 24;
const WIN_H = 26;
const TOP = 30; // 옥상 크라운 밴드(px)
const COLS_PER_UNIT = 4; // 4칸 = 한 세대 폭(약 9.6m)

type Facade = {
  day: THREE.CanvasTexture;
  rm: THREE.CanvasTexture; // G = roughness, B = metalness
  glow: THREE.CanvasTexture;
  seedTex: THREE.CanvasTexture; // R = 점등 임계값 — 셰이더가 uLit 와 비교
  canvas: HTMLCanvasElement;
  seeds: Float32Array;
  hues: Uint8Array;
  cols: number;
  floors: number;
};

/**
 * 국내 고급 주거 입면 — 석재 저층부 · 깊게 들어간 유리 · 세대 경계 벽체.
 * 발코니 슬래브 · 유리 난간 · 세대 경계 핀은 실제 형상으로 따로 세운다 (buildComplex).
 * 같은 배치로 거칠기·금속도 맵을 함께 그려 유리만 하늘과 도시를 반사하게 한다.
 */
function paintFacade(cols: number, floors: number, seed: number) {
  const c = document.createElement("canvas");
  c.width = cols * WIN_W;
  c.height = floors * WIN_H + TOP;
  const rmC = document.createElement("canvas");
  rmC.width = c.width;
  rmC.height = c.height;
  const g = c.getContext("2d")!;
  const m = rmC.getContext("2d")!;
  const r = rng(seed);
  const W = c.width;
  const rmFill = (rough: number, metal: number, x: number, y: number, w: number, h: number) => {
    m.fillStyle = `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;
    m.fillRect(x, y, w, h);
  };
  // 바탕 — 웜화이트 도장 + 빗물 얼룩
  g.fillStyle = "#e9e4da";
  g.fillRect(0, 0, W, c.height);
  rmFill(0.88, 0, 0, 0, W, c.height);
  for (let i = 0; i < 380; i++) {
    g.fillStyle = `rgba(110,98,82,${r() * 0.04})`;
    const x = r() * W;
    g.fillRect(x, r() * c.height, 1 + r() * 3, 20 + r() * 120);
  }
  const stoneFrom = floors - 3;
  for (let f = 0; f < floors - 1; f++) {
    const y = TOP + f * WIN_H;
    const stone = f >= stoneFrom;
    if (stone) {
      g.fillStyle = "#8c8478";
      g.fillRect(0, y, W, WIN_H);
      rmFill(0.62, 0, 0, y, W, WIN_H);
      g.fillStyle = "rgba(255,255,255,0.07)";
      for (let x = 0; x < W; x += 12) g.fillRect(x, y, 1, WIN_H);
    }
    for (let i = 0; i < cols; i++) {
      const x = i * WIN_W;
      if (i % COLS_PER_UNIT === 0) continue; // 세대 경계 벽 — 바탕 유지
      // 유리 — 어두운 실내 + 프레넬 반사는 셰이더가 처리
      const t = r();
      const glassY = y + 2;
      const glassH = WIN_H - 4;
      g.fillStyle = `rgb(${34 + t * 16},${44 + t * 16},${54 + t * 18})`;
      g.fillRect(x + 1.5, glassY, WIN_W - 3, glassH);
      rmFill(0.04 + r() * 0.08, 0.35, x + 1.5, glassY, WIN_W - 3, glassH);
      // 커튼 · 블라인드 — 반사가 약해지고 밝은 천이 비친다
      if (r() < 0.28) {
        const ch = glassH * (0.35 + r() * 0.6);
        g.fillStyle = `rgb(${190 + r() * 40},${180 + r() * 34},${160 + r() * 30})`;
        g.fillRect(x + 2, glassY + 1, WIN_W - 4, ch);
        rmFill(0.45, 0.05, x + 2, glassY + 1, WIN_W - 4, ch);
      }
      // 창틀 · 멀리언
      g.fillStyle = "#3a3f46";
      g.fillRect(x + WIN_W / 2 - 0.6, glassY, 1.2, glassH);
      g.fillRect(x + 1.5, glassY, WIN_W - 3, 1);
      rmFill(0.4, 0.8, x + WIN_W / 2 - 0.6, glassY, 1.2, glassH);
    }
  }
  // 옥상 밴드
  g.fillStyle = "#d6cfc1";
  g.fillRect(0, 0, W, TOP);
  // 필로티 — 어두운 개방부 + 석재 기둥
  g.fillStyle = "#24272b";
  g.fillRect(0, c.height - WIN_H, W, WIN_H);
  rmFill(0.9, 0, 0, c.height - WIN_H, W, WIN_H);
  g.fillStyle = "#8c8478";
  for (let i = 0; i < cols; i += COLS_PER_UNIT) g.fillRect(i * WIN_W, c.height - WIN_H, WIN_W * 0.6, WIN_H);
  return { c, rmC };
}

const WARM = ["#ffd9a6", "#ffcf8f", "#ffe4bd", "#ffc27a", "#f6e9d2", "#dfe8f5"];

/**
 * 점등 맵 — 모든 창의 색을 한 번만 그리고, 창마다 점등 임계값을 별도 텍스처에 기록한다.
 * 분양률이 바뀌어도 텍스처를 다시 그리거나 업로드하지 않고 셰이더 유니폼 하나만 바꾼다 (스크롤 끊김 방지).
 */
function paintGlow(f: Facade, seedCanvas: HTMLCanvasElement) {
  const g = f.canvas.getContext("2d")!;
  const sg = seedCanvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, f.canvas.width, f.canvas.height);
  sg.fillStyle = "#fff";
  sg.fillRect(0, 0, seedCanvas.width, seedCanvas.height);
  // 필로티 로비 조명 — 임계값 0(항상 켜짐, 밤에만 보임)
  g.fillStyle = "#c79a5c";
  g.fillRect(0, f.canvas.height - WIN_H + 6, f.canvas.width, WIN_H - 8);
  sg.fillStyle = "#000";
  sg.fillRect(0, f.canvas.height - WIN_H + 6, f.canvas.width, WIN_H - 8);
  for (let fl = 0; fl < f.floors - 1; fl++) {
    const y = TOP + fl * WIN_H;
    for (let i = 0; i < f.cols; i++) {
      if (i % COLS_PER_UNIT === 0) continue;
      const k = fl * f.cols + i;
      g.fillStyle = WARM[f.hues[k] % WARM.length];
      g.globalAlpha = 0.7 + ((f.seeds[k] * 7919) % 1) * 0.3;
      g.fillRect(i * WIN_W + 2, y + 3, WIN_W - 4, WIN_H - 6);
      const v = Math.max(2, Math.min(253, Math.round(f.seeds[k] * 255)));
      sg.fillStyle = `rgb(${v},${v},${v})`;
      sg.fillRect(i * WIN_W, y, WIN_W, WIN_H);
    }
  }
  g.globalAlpha = 1;
}

/** 공유 점등 유니폼 — 모든 입면 재질이 같은 값을 읽는다 */
export const LIT = { value: 0 };

function addLitThreshold(mat: THREE.MeshStandardMaterial, seedTex: THREE.Texture) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLit = LIT;
    shader.uniforms.uSeedMap = { value: seedTex };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uLit;\nuniform sampler2D uSeedMap;")
      .replace(
        "#include <emissivemap_fragment>",
        `#ifdef USE_EMISSIVEMAP
          vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
          float seedV = texture2D( uSeedMap, vEmissiveMapUv ).r;
          totalEmissiveRadiance *= emissiveColor.rgb * step( seedV, uLit + 0.002 );
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => "lit-threshold";
}

function makeFacade(width: number, floors: number, seed: number): Facade {
  const cols = Math.max(4, Math.round(width / 2.4));
  const { c: dayCanvas, rmC } = paintFacade(cols, floors, seed);
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = dayCanvas.width;
  glowCanvas.height = dayCanvas.height;
  const r = rng(seed * 31 + 7);
  const n = cols * floors;
  const seeds = new Float32Array(n);
  const hues = new Uint8Array(n);
  // 세대 단위로 같은 점등 — 한 세대가 통째로 켜진다
  for (let fl = 0; fl < floors; fl++) {
    for (let u = 0; u < Math.ceil(cols / COLS_PER_UNIT); u++) {
      const s = r();
      const h = Math.floor(r() * 255);
      for (let j = 0; j < COLS_PER_UNIT; j++) {
        const i = u * COLS_PER_UNIT + j;
        if (i >= cols) break;
        seeds[fl * cols + i] = Math.min(0.999, s + (r() - 0.5) * 0.04);
        hues[fl * cols + i] = h;
      }
    }
  }
  const day = new THREE.CanvasTexture(dayCanvas);
  day.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = 8;
  const rm = new THREE.CanvasTexture(rmC);
  rm.anisotropy = 8;
  const glow = new THREE.CanvasTexture(glowCanvas);
  glow.colorSpace = THREE.SRGBColorSpace;
  const seedCanvas = document.createElement("canvas");
  seedCanvas.width = dayCanvas.width;
  seedCanvas.height = dayCanvas.height;
  const seedTex = new THREE.CanvasTexture(seedCanvas);
  seedTex.magFilter = seedTex.minFilter = THREE.NearestFilter;
  seedTex.generateMipmaps = false;
  const f: Facade = { day, rm, glow, seedTex, canvas: glowCanvas, seeds, hues, cols, floors };
  paintGlow(f, seedCanvas);
  return f;
}

export type Complex = {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  glassMats: THREE.MeshStandardMaterial[];
  setLit: (lit: number) => void;
};

const louverCache = new Map<number, THREE.MeshStandardMaterial>();
function louverMat(width: number) {
  const key = Math.round(width);
  const hit = louverCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 64);
  const n = Math.max(8, Math.round(width * 1.4));
  const step = 256 / n;
  for (let i = 0; i < n; i++) {
    const x = i * step;
    const grad = g.createLinearGradient(x, 0, x + step * 0.5, 0);
    grad.addColorStop(0, "#6e5636");
    grad.addColorStop(0.5, "#b08d5a");
    grad.addColorStop(1, "#6e5636");
    g.fillStyle = grad;
    g.fillRect(x, 0, step * 0.5, 64);
  }
  g.fillStyle = "#8a6e45";
  g.fillRect(0, 0, 256, 5);
  g.fillRect(0, 59, 256, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
  louverCache.set(key, m);
  return m;
}

export function buildComplex(): Complex {
  const group = new THREE.Group();
  const facades: Facade[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  const roofMat = new THREE.MeshStandardMaterial({ color: "#a9a397", roughness: 0.9 });
  const bronze = new THREE.MeshStandardMaterial({ color: "#8a6e45", roughness: 0.38, metalness: 0.75 });
  const glassCore = new THREE.MeshStandardMaterial({ color: "#7b7f84", roughness: 0.45, metalness: 0.4 });
  const slabMat = new THREE.MeshStandardMaterial({ color: "#ece7dc", roughness: 0.78 });
  const finMat = new THREE.MeshStandardMaterial({ color: "#e4ded2", roughness: 0.82 });
  const railMat = new THREE.MeshStandardMaterial({
    color: "#a7bcc6",
    roughness: 0.04,
    metalness: 0.55,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  // 실구조 인스턴스 개수 산정
  let nSlab = 0;
  let nFin = 0;
  for (const t of TOWERS) {
    nSlab += t.floors * 2;
    nFin += (Math.floor(Math.round(t.w / 2.4) / COLS_PER_UNIT) + 1) * 2;
  }
  const slabGeo = new THREE.BoxGeometry(1, 1, 1);
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, nSlab);
  const rails = new THREE.InstancedMesh(slabGeo, railMat, nSlab);
  const fins = new THREE.InstancedMesh(slabGeo, finMat, nFin);
  slabs.castShadow = slabs.receiveShadow = true;
  fins.castShadow = fins.receiveShadow = true;
  let iS = 0;
  let iF = 0;
  const local = new THREE.Object3D();
  const towerM = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const put = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    local.position.set(x, y, z);
    local.scale.set(sx, sy, sz);
    local.updateMatrix();
    out.multiplyMatrices(towerM, local.matrix);
    mesh.setMatrixAt(i, out);
  };

  TOWERS.forEach((t, idx) => {
    const h = PILOTI_H + t.floors * FLOOR_H;
    const long = makeFacade(t.w, t.floors + 1, 101 + idx * 13);
    const short = makeFacade(t.d, t.floors + 1, 503 + idx * 17);
    facades.push(long, short);
    const mk = (f: Facade) => {
      const m = new THREE.MeshStandardMaterial({
        map: f.day,
        roughnessMap: f.rm,
        metalnessMap: f.rm,
        roughness: 1,
        metalness: 1,
        emissiveMap: f.glow,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0,
      });
      addLitThreshold(m, f.seedTex);
      materials.push(m);
      return m;
    };
    const longMat = mk(long);
    const shortMat = mk(short);
    const tower = new THREE.Group();
    tower.position.set(t.x, 0, t.z);
    tower.rotation.y = t.rot;
    tower.updateMatrix();
    towerM.copy(tower.matrix);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(t.w, h, t.d), [shortMat, shortMat, roofMat, roofMat, longMat, longMat]);
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tower.add(mesh);

    // 발코니 슬래브 · 유리 난간 — 남·북 장변, 매 층
    const depth = 1.6;
    const bw = t.w - 1.2;
    for (const side of [1, -1]) {
      for (let f = 1; f <= t.floors; f++) {
        const y = PILOTI_H + f * FLOOR_H - 0.12;
        put(slabs, iS, 0, y, side * (t.d / 2 + depth / 2), bw, 0.24, depth);
        put(rails, iS, 0, y + 0.6, side * (t.d / 2 + depth - 0.05), bw, 1.0, 0.06);
        iS++;
      }
      // 세대 경계 핀 — 필로티 위 전 층
      const cols = Math.round(t.w / 2.4);
      const units = Math.floor(cols / COLS_PER_UNIT);
      for (let u = 0; u <= units; u++) {
        const x = -t.w / 2 + Math.min(t.w, u * COLS_PER_UNIT * (t.w / cols)) + (u === 0 ? 0.25 : u === units ? -0.25 : 0);
        const fh = t.floors * FLOOR_H;
        put(fins, iF, x, PILOTI_H + fh / 2, side * (t.d / 2 + depth / 2), 0.32, fh, depth);
        iF++;
      }
    }

    // 루버 크라운 — 브론즈 수직 루버
    const fw = t.w + 1.0;
    const fd = t.d + 1.0 + depth * 2;
    const fh = 8;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), [
      louverMat(fd), louverMat(fd), roofMat, roofMat, louverMat(fw), louverMat(fw),
    ]);
    crown.geometry.groups.splice(2, 2); // 상·하면 제거 (열린 크라운)
    crown.position.y = h + fh / 2 + 0.4;
    crown.castShadow = true;
    tower.add(crown);
    // 크라운 상부 프레임 — 테두리만 (지붕 설비가 위에서 보이도록)
    for (const [w2, d2, x2, z2] of [
      [fw + 0.4, 0.7, 0, fd / 2],
      [fw + 0.4, 0.7, 0, -fd / 2],
      [0.7, fd + 0.4, fw / 2, 0],
      [0.7, fd + 0.4, -fw / 2, 0],
    ] as const) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w2, 0.7, d2), bronze);
      beam.position.set(x2, h + fh + 0.6, z2);
      tower.add(beam);
    }
    // 옥상 — 코어(승강기 기계실) · 실외기 · 옥상 녹화
    const core = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.3, 6, t.d * 0.5), roofMat);
    core.position.y = h + 3;
    core.castShadow = true;
    tower.add(core);
    const roofGreen = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.28, 0.4, t.d * 0.7), new THREE.MeshStandardMaterial({ color: "#56683f", roughness: 1 }));
    roofGreen.position.set(t.w * 0.3, h + 0.2, 0);
    tower.add(roofGreen);
    for (let k = 0; k < 4; k++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.4), glassCore);
      ac.position.set(-t.w * 0.32 + (k % 2) * 3, h + 0.8, (k < 2 ? -1 : 1) * t.d * 0.22);
      tower.add(ac);
    }
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.5, 1.2, t.d + 0.5), roofMat);
    parapet.position.y = h + 0.6;
    tower.add(parapet);
    group.add(tower);
  });
  slabs.count = iS;
  rails.count = iS;
  fins.count = iF;
  group.add(slabs, fins, rails);

  // 대지 — 보도 포장 + 중앙 잔디 + 수경
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(236, 1.2, 128),
    new THREE.MeshStandardMaterial({ color: "#c4bba9", roughness: 0.9 }),
  );
  plate.position.set(0, 0.6, 2);
  plate.receiveShadow = true;
  group.add(plate);
  const lawn = new THREE.Mesh(
    new THREE.BoxGeometry(150, 0.3, 26),
    new THREE.MeshStandardMaterial({ color: "#5a6f43", roughness: 1 }),
  );
  lawn.position.set(0, 1.3, 4);
  lawn.receiveShadow = true;
  group.add(lawn);
  const pond = new THREE.Mesh(
    new THREE.BoxGeometry(46, 0.2, 9),
    new THREE.MeshStandardMaterial({ color: "#1b2c38", roughness: 0.04, metalness: 0.9 }),
  );
  pond.position.set(0, 1.5, 4);
  group.add(pond);

  return {
    group,
    materials,
    glassMats: [...materials, glassCore, railMat],
    setLit(lit: number) {
      LIT.value = lit;
    },
  };
}

/* ───────── 호수 · 지면 · 도시 맥락 ───────── */

export function lakeShape() {
  const s = new THREE.Shape();
  const r = rng(42);
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + Math.sin(a * 3 + 0.6) * 0.07 + Math.sin(a * 5 + 1.7) * 0.04 + (r() - 0.5) * 0.015;
    const x = Math.cos(a) * 520 * wob;
    const y = Math.sin(a) * 165 * wob;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}
export const LAKE_CENTER = new THREE.Vector3(-60, 0, 330);

/** 타일링 가능한 물결 노멀맵을 캔버스로 생성 (외부 이미지 없이) */
export function waterNormals(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const r = rng(9);
  const waves = Array.from({ length: 14 }, () => ({
    fx: Math.floor(r() * 9) - 4,
    fy: Math.floor(r() * 9) - 4,
    ph: r() * Math.PI * 2,
    a: 0.4 + r(),
  })).filter((w) => w.fx || w.fy);
  const h = (x: number, y: number) =>
    waves.reduce((s, w) => s + w.a * Math.sin(((w.fx * x + w.fy * y) / size) * Math.PI * 2 + w.ph), 0);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const n = new THREE.Vector3(-dx * 0.38, -dy * 0.38, 1).normalize();
      const k = (y * size + x) * 4;
      img.data[k] = (n.x * 0.5 + 0.5) * 255;
      img.data[k + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[k + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * 주변 고층 주거 입면 — 텍스처 1장이 16열(38.4m) × 64층(185.6m)을 덮고,
 * 셰이더가 인스턴스 크기에 맞춰 반복시켜 어느 동이든 층고 2.9m · 창폭 2.4m가 유지된다.
 */
const CTX_TILE = new THREE.Vector2(38.4, 185.6);
/** 입면 변형 — 바탕색 · 유리 색 · 측면 띠(단지별 아이덴티티 컬러) */
const CTX_VARIANTS = [
  { wall: "#eeebe4", glass: [64, 78, 92], band: "#faf8f3", stripe: null as string | null },
  { wall: "#e6e3dc", glass: [58, 74, 84], band: "#f4f2ee", stripe: "#7c8a99" },
  { wall: "#f0ece2", glass: [70, 80, 90], band: "#fbf9f4", stripe: "#a58a62" },
];
function genericFacade(seed: number, variant = 0) {
  const V = CTX_VARIANTS[variant % CTX_VARIANTS.length];
  const W = 128, H = 512;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };
  const c = mk(), rmC = mk(), glow = mk();
  const g = c.getContext("2d")!, m = rmC.getContext("2d")!, gg = glow.getContext("2d")!;
  const r = rng(seed);
  g.fillStyle = V.wall;
  g.fillRect(0, 0, W, H);
  m.fillStyle = "rgb(0,225,0)";
  m.fillRect(0, 0, W, H);
  gg.fillStyle = "#000";
  gg.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 8) {
    for (let x = 0; x < W; x += 8) {
      if ((x / 8) % 4 === 0) continue;
      const t = r() * 22;
      g.fillStyle = `rgb(${V.glass[0] + t},${V.glass[1] + t},${V.glass[2] + t})`;
      g.fillRect(x + 0.5, y + 1, 7, 5.5);
      m.fillStyle = `rgb(0,${Math.round(12 + r() * 30)},${110})`;
      m.fillRect(x + 0.5, y + 1, 7, 5.5);
      if (r() < 0.25) {
        g.fillStyle = `rgb(${196 + r() * 30},${188 + r() * 26},${170 + r() * 24})`;
        g.fillRect(x + 1, y + 1.2, 6, 2 + r() * 3);
      }
      if (r() < 0.36) {
        gg.fillStyle = WARM[Math.floor(r() * WARM.length)];
        gg.fillRect(x + 0.5, y + 1, 7, 5.5);
      }
    }
    // 발코니 슬래브 밴드 — 밝은 수평선과 그 아래 그림자
    g.fillStyle = V.band;
    g.fillRect(0, y + 6.5, W, 1.5);
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.fillRect(0, y, W, 1);
  }
  if (V.stripe) {
    // 측면 수직 띠 — 한 타일(16열) 마다 1열
    g.fillStyle = V.stripe;
    g.fillRect(0, 0, 8, H);
    m.fillStyle = "rgb(0,150,40)";
    m.fillRect(0, 0, 8, H);
  }
  const tex = (cv: HTMLCanvasElement, color: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  return { day: tex(c, true), rm: tex(rmC, false), em: tex(glow, true) };
}

/** 인스턴스 크기에 따라 입면 UV를 반복 — 모든 맵 UV에 같은 값을 쓴다 */
function tileByInstanceScale(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTile = { value: CTX_TILE };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec2 uTile;")
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec2 tuv = abs(normal.y) > 0.5 ? vec2(0.01, 0.01)
            : uv * (abs(normal.x) > 0.5 ? vec2(sc.z, sc.y) : vec2(sc.x, sc.y)) / uTile
              + vec2(fract(instanceMatrix[3].x * 0.013), 0.0);
          #ifdef USE_MAP
            vMapUv = tuv;
          #endif
          #ifdef USE_EMISSIVEMAP
            vEmissiveMapUv = tuv;
          #endif
          #ifdef USE_ROUGHNESSMAP
            vRoughnessMapUv = tuv;
          #endif
          #ifdef USE_METALNESSMAP
            vMetalnessMapUv = tuv;
          #endif
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => "ctx-tile";
}

/** 차선 표시가 있는 아스팔트 */
function roadTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#4b4c4e";
  g.fillRect(0, 0, 128, 256);
  const r = rng(5);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},255,${r() * 0.04})`;
    g.fillRect(r() * 128, r() * 256, 2, 2);
  }
  g.fillStyle = "#d9d4c6";
  g.fillRect(4, 0, 3, 256);
  g.fillRect(121, 0, 3, 256);
  g.fillStyle = "#d6b25a";
  g.fillRect(61, 0, 2.5, 256);
  g.fillRect(65, 0, 2.5, 256);
  g.fillStyle = "#e8e4da";
  for (let y = 0; y < 256; y += 64) {
    g.fillRect(32, y, 2.5, 30);
    g.fillRect(94, y, 2.5, 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** 저채도 지면 노이즈 */
function groundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8d8b82";
  g.fillRect(0, 0, 512, 512);
  const r = rng(11);
  // 단지 조경 — 멀리서 수관이 모여 보이는 작은 점 군집
  for (let i = 0; i < 60; i++) {
    const cx = r() * 512, cy = r() * 512, spread = 10 + r() * 26;
    const n = 30 + Math.floor(r() * 60);
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
      const v = r() * 18;
      g.fillStyle = `rgba(${70 + v},${82 + v},${58 + v * 0.5},0.32)`;
      g.beginPath();
      g.arc((cx + Math.cos(a) * d + 512) % 512, (cy + Math.sin(a) * d + 512) % 512, 1.2 + r() * 2.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // 포장 · 주차 · 보행로 결
  for (let i = 0; i < 2600; i++) {
    const v = 110 + r() * 70;
    g.fillStyle = `rgba(${v},${v - 4},${v - 14},0.07)`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 14, 1 + r() * 14);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(140, 140);
  t.anisotropy = 8;
  return t;
}

export const COAST_X = -1500;

/** 도로망 [중심 x, 중심 z, 동서 길이, 남북 길이] — 차량 흐름과 공유 */
export const ROADS: [number, number, number, number][] = [
  [0, -110, 3600, 26],
  [0, 92, 3600, 20],
  [-150, -300, 20, 1400],
  [150, -300, 20, 1400],
  [520, -200, 30, 3000],
  [-760, -200, 30, 3000],
  [0, -620, 3600, 30],
  [600, -1500, 4400, 40], // 광역 간선(고속화도로)
  [1250, -200, 26, 3000],
];
const onRoad = (x: number, z: number, pad: number) =>
  ROADS.some(([rx, rz, w, d]) => Math.abs(x - rx) < w / 2 + pad && Math.abs(z - rz) < d / 2 + pad);

export function buildContext(opt: { buildings: number; trees: number } = { buildings: 380, trees: 1100 }) {
  const group = new THREE.Group();
  const r = rng(2026);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = COAST_X + 20000;
  ground.receiveShadow = true;
  group.add(ground);

  // 서해 — 하늘을 비추는 넓은 수면 + 원경 섬(영종) 실루엣
  const seaMat = new THREE.MeshStandardMaterial({ color: "#2a3f4f", roughness: 0.16, metalness: 0.92, envMapIntensity: 1.1 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 40000), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(COAST_X - 7000 + 40, 0.25, 0);
  group.add(sea);
  // 해안 제방
  const dike = new THREE.Mesh(new THREE.BoxGeometry(24, 3, 9000), new THREE.MeshStandardMaterial({ color: "#8d877a", roughness: 0.95 }));
  dike.position.set(COAST_X + 8, 1.5, 0);
  dike.receiveShadow = true;
  group.add(dike);

  const hillMat = new THREE.MeshStandardMaterial({ color: "#4d5546", roughness: 1, flatShading: true });
  const islands: [number, number, number, number, number][] = [
    // x, z, 반경x, 반경z, 높이
    [-4200, -200, 900, 2200, 110],
    [-4700, 1800, 600, 900, 160],
    [-3900, -2400, 500, 700, 80],
  ];
  for (const [x, z, rx, rz, hh] of islands) {
    const geo = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setY(i, y * (0.75 + 0.5 * Math.abs(Math.sin(pos.getX(i) * 7 + pos.getZ(i) * 5))));
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, hillMat);
    m.scale.set(rx, hh, rz);
    m.position.set(x, 0, z);
    group.add(m);
  }

  // 해상교량 — 원경, 야간 점등
  const deckMat = new THREE.MeshStandardMaterial({ color: "#c9c4b8", roughness: 0.7 });
  const deckEnd = -4300;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(COAST_X + 60 - deckEnd, 3, 26), deckMat);
  deck.position.set((COAST_X + 60 + deckEnd) / 2, 18, 1100);
  group.add(deck);
  for (let i = 0; i < 26; i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 18, 10), deckMat);
    pier.position.set(COAST_X - 60 - i * 104, 9, 1100);
    group.add(pier);
  }
  const pylonMat = new THREE.MeshStandardMaterial({ color: "#e3ded2", roughness: 0.5 });
  for (const px of [COAST_X - 900, COAST_X - 1500]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(8, 150, 8), pylonMat);
    pylon.position.set(px, 75, 1100);
    group.add(pylon);
  }

  // 호수공원 녹지
  const park = new THREE.Mesh(
    new THREE.ShapeGeometry(
      (() => {
        const sh = new THREE.Shape();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const x = Math.cos(a) * 640;
          const y = Math.sin(a) * 250;
          if (i === 0) sh.moveTo(x, y);
          else sh.lineTo(x, y);
        }
        return sh;
      })(),
    ),
    new THREE.MeshStandardMaterial({ color: "#64744c", roughness: 1 }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(LAKE_CENTER.x, 0.15, LAKE_CENTER.z);
  park.receiveShadow = true;
  group.add(park);
  // 호숫가 산책로
  const path = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.045, 96),
    new THREE.MeshStandardMaterial({ color: "#d3c7ae", roughness: 0.95 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.scale.set(560, 182, 1);
  path.position.set(LAKE_CENTER.x, 0.3, LAKE_CENTER.z);
  group.add(path);

  // 커낼웨이 — 호수에서 동쪽으로 이어지는 수로
  const canalMat = new THREE.MeshStandardMaterial({ color: "#23394a", roughness: 0.12, metalness: 0.9 });
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(1500, 34), canalMat);
  canal.rotation.x = -Math.PI / 2;
  canal.rotation.z = 0.22;
  canal.position.set(1120, 0.32, 150);
  group.add(canal);

  // 도로 — 차선 표시
  const roadTex = roadTexture();
  const walkMat = new THREE.MeshStandardMaterial({ color: "#bdb6a6", roughness: 0.95 });
  for (const [x, z, w, d] of ROADS) {
    const along = w > d;
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.rotation = along ? Math.PI / 2 : 0;
    tex.center.set(0.5, 0.5);
    tex.repeat.set(1, Math.max(w, d) / 40);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.2, z);
    m.receiveShadow = true;
    group.add(m);
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(along ? w : d === 0 ? 0 : w + 12, along ? d + 12 : d), walkMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(x, 0.18, z);
    sw.receiveShadow = true;
    group.add(sw);
  }

  // 경인아라뱃길 — 청라 북측을 동서로 지나는 운하
  const araMat = new THREE.MeshStandardMaterial({ color: "#26394a", roughness: 0.1, metalness: 0.9 });
  const ara = new THREE.Mesh(new THREE.PlaneGeometry(6000, 90), araMat);
  ara.rotation.x = -Math.PI / 2;
  ara.position.set(COAST_X + 3000, 0.3, -2150);
  group.add(ara);
  const bankMat = new THREE.MeshStandardMaterial({ color: "#5d6c48", roughness: 1 });
  for (const dz of [-70, 70]) {
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(6000, 50), bankMat);
    bank.rotation.x = -Math.PI / 2;
    bank.position.set(COAST_X + 3000, 0.22, -2150 + dz);
    group.add(bank);
  }

  // 주변 고층 주거 (청라국제도시 맥락) — 호수변은 고층 링, 바깥은 중고층 · 도로·호수·사업지·바다 제외
  const ctxMats = CTX_VARIANTS.map((_, vi) => {
    const { day, rm, em } = genericFacade(77 + vi * 19, vi);
    const mat = new THREE.MeshStandardMaterial({
      map: day,
      roughnessMap: rm,
      metalnessMap: rm,
      roughness: 1,
      metalness: 1,
      emissiveMap: em,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0,
    });
    tileByInstanceScale(mat);
    return mat;
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const COUNT = opt.buildings;
  const insts = ctxMats.map((mat) => new THREE.InstancedMesh(box, mat, COUNT));
  const nV = [0, 0, 0];
  const crownMat = new THREE.MeshStandardMaterial({ color: "#d4cdbf", roughness: 0.55, metalness: 0.3 });
  const crowns = new THREE.InstancedMesh(box, crownMat, COUNT);
  const podMat = new THREE.MeshStandardMaterial({ color: "#8f8a80", roughness: 0.7, metalness: 0.15 });
  const pods = new THREE.InstancedMesh(box, podMat, 140);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tones = ["#ffffff", "#f6f1e8", "#ece8e1", "#e3e7ea", "#f1e9da", "#dedad2", "#e9e2d6"];
  const col = new THREE.Color();
  let placed = 0;
  let nPod = 0;
  let guard = 0;
  const PX = new Float32Array(COUNT);
  const PZ = new Float32Array(COUNT);
  while (placed < COUNT && guard++ < 14000) {
    const x = (r() - 0.5) * 3800 + 350;
    const z = (r() - 0.5) * 3000 - 450;
    if (x < COAST_X + 140 || z < -1980) continue;
    const inSite = Math.hypot(x, z * 1.3) < 330;
    const lx = (x - LAKE_CENTER.x) / 700;
    const lz = (z - LAKE_CENTER.z) / 300;
    const le = lx * lx + lz * lz;
    if (inSite || le < 1) continue;
    if (Math.abs(z - (150 + (x - 1120) * -0.22)) < 44 && x > 380) continue; // 수로
    if (onRoad(x, z, 26)) continue;
    // 호수변 첫 열은 고층(35~55층), 동북측 업무지구 초고층, 외곽은 중고층
    const lakefront = le < 1.9;
    const cbd = Math.hypot(x - 900, z + 700) < 420;
    const h = lakefront ? 105 + r() * 60 : cbd ? 125 + r() * 75 : 60 + r() * 60;
    const slab = r() < 0.55;
    const w = slab ? 42 + r() * 18 : 24 + r() * 6;
    const d = slab ? 14 + r() * 3 : 24 + r() * 6;
    // 겹침 방지 — 이미 놓인 동과 최소 간격
    let clash = false;
    for (let k = 0; k < placed && !clash; k++) if (Math.abs(PX[k] - x) < 50 && Math.abs(PZ[k] - z) < 38) clash = true;
    if (clash) continue;
    PX[placed] = x;
    PZ[placed] = z;
    q.setFromAxisAngle(up, (Math.round(r() * 2) - 1) * 0.05 + (r() < 0.12 ? Math.PI / 2 : 0));
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d));
    const vi = placed % insts.length;
    insts[vi].setMatrixAt(nV[vi], m4);
    insts[vi].setColorAt(nV[vi], col.set(tones[Math.floor(r() * tones.length)]));
    nV[vi]++;
    m4.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(w * 0.42, 6 + r() * 5, d * 0.6));
    crowns.setMatrixAt(placed, m4);
    if (cbd && nPod < 140) {
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w + 18, 9 + r() * 6, d + 22));
      pods.setMatrixAt(nPod++, m4);
    }
    placed++;
  }
  pods.count = nPod;
  pods.castShadow = pods.receiveShadow = true;
  group.add(pods);
  insts.forEach((m, vi) => {
    m.count = nV[vi];
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  });
  crowns.count = placed;
  group.add(crowns);

  // 수목 — 세 덩이를 겹쳐 나무 윤곽으로
  const jitter = (g: THREE.BufferGeometry, seed: number, amt: number) => {
    const jr = rng(seed);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const seen = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      let k = seen.get(key);
      if (k === undefined) {
        k = 1 + (jr() - 0.5) * amt;
        seen.set(key, k);
      }
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  };
  const lobes = [
    jitter(new THREE.IcosahedronGeometry(0.85, 2), 1, 0.3).translate(0, 0.12, 0),
    jitter(new THREE.IcosahedronGeometry(0.62, 1), 2, 0.3).translate(0.52, -0.1, 0.2),
    jitter(new THREE.IcosahedronGeometry(0.58, 1), 3, 0.3).translate(-0.44, -0.04, -0.3),
    jitter(new THREE.IcosahedronGeometry(0.5, 1), 4, 0.28).translate(0.05, 0.62, 0.1),
    new THREE.CylinderGeometry(0.07, 0.11, 1.3, 6).translate(0, -1.08, 0),
  ];
  const crown = mergeGeometries(lobes.map((gm) => (gm.index ? gm.toNonIndexed() : gm)))!;
  const treeMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, envMapIntensity: 0.35, flatShading: false });
  const TREES = opt.trees;
  const nComplex = 170;
  const nLake = Math.round((TREES - nComplex) * 0.42);
  const nYard = Math.round((TREES - nComplex) * 0.33);
  const trees = new THREE.InstancedMesh(crown, treeMat, TREES);
  for (let i = 0; i < TREES; i++) {
    let x: number, z: number;
    if (i < nLake) {
      const a = r() * Math.PI * 2;
      const rr = 1.04 + r() * 0.2;
      x = LAKE_CENTER.x + Math.cos(a) * 520 * rr;
      z = LAKE_CENTER.z + Math.sin(a) * 165 * rr;
    } else if (i < nLake + nComplex) {
      x = (r() - 0.5) * 220;
      z = (r() - 0.5) * 120;
      if (TOWERS.some((t) => Math.abs(x - t.x) < t.w / 2 + 4 && Math.abs(z - t.z) < t.d / 2 + 4)) {
        x = (r() - 0.5) * 140;
        z = 4 + (r() - 0.5) * 20;
      }
    } else if (i < nLake + nComplex + nYard && placed > 0) {
      // 주변 단지 조경 — 동 사이 녹지
      const b = Math.floor(r() * placed);
      const a = r() * Math.PI * 2;
      const rr = 30 + r() * 16;
      x = PX[b] + Math.cos(a) * rr;
      z = PZ[b] + Math.sin(a) * rr * 0.8;
    } else {
      // 가로수
      const k = i - (nLake + nComplex + nYard);
      const row = [-128, -94, 74, 108][k % 4];
      x = -1300 + (k / 4) * 28 + (r() - 0.5) * 4;
      z = row + (r() - 0.5) * 2;
    }
    const s = 2.4 + r() * 2;
    const yaw = new THREE.Quaternion().setFromAxisAngle(up, r() * Math.PI * 2);
    m4.compose(new THREE.Vector3(x, s * 1.6 + 1.2, z), yaw, new THREE.Vector3(s, s * 1.15, s));
    trees.setMatrixAt(i, m4);
    col.setHSL(0.17 + r() * 0.1, 0.24 + r() * 0.18, 0.13 + r() * 0.09);
    trees.setColorAt(i, col);
  }
  trees.castShadow = true;
  group.add(trees);

  // 가로등 · 교량 조명 (야간 점등)
  const LAMPS = 420;
  const lampMat = new THREE.MeshBasicMaterial({ color: "#ffc98a", transparent: true, opacity: 0 });
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), lampMat, LAMPS);
  for (let i = 0; i < LAMPS; i++) {
    let x: number, z: number, y = 6;
    if (i < 150) {
      const a = (i / 150) * Math.PI * 2;
      x = LAKE_CENTER.x + Math.cos(a) * 520 * 1.03;
      z = LAKE_CENTER.z + Math.sin(a) * 165 * 1.03;
    } else if (i < 330) {
      const k = i - 150;
      x = -1400 + (k % 60) * 48;
      z = [-124, 104, -636][Math.floor(k / 60)];
    } else {
      const k = i - 330;
      x = COAST_X - 40 - k * 34;
      z = 1100 + (k % 2 ? 12 : -12);
      y = 22;
    }
    m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1.2, 1.2, 1.2));
    lamps.setMatrixAt(i, m4);
  }
  group.add(lamps);

  return { group, ctxMats, lampMat, treeMat };
}
