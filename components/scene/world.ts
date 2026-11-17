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

export type TowerSpec = { x: number; z: number; w: number; d: number; floors: number; rot: number };

export const FLOOR_H = 2.9;
export const PILOTI_H = 5.2;

export const TOWERS: TowerSpec[] = [
  // 호수 쪽(남측) 전열 — 조망 확보를 위해 낮게
  { x: -78, z: 34, w: 34, d: 13, floors: 23, rot: 0.06 },
  { x: -24, z: 44, w: 22, d: 22, floors: 25, rot: 0 },
  { x: 30, z: 40, w: 22, d: 22, floors: 27, rot: 0 },
  { x: 82, z: 30, w: 34, d: 13, floors: 21, rot: -0.06 },
  // 후열 — 29층
  { x: -96, z: -38, w: 34, d: 13, floors: 27, rot: 0.04 },
  { x: -36, z: -30, w: 34, d: 13, floors: 29, rot: 0 },
  { x: 26, z: -34, w: 34, d: 13, floors: 29, rot: 0 },
  { x: 88, z: -42, w: 34, d: 13, floors: 26, rot: -0.04 },
];

const WIN_W = 18;
const WIN_H = 20;

type Facade = {
  day: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  seeds: Float32Array;
  hues: Uint8Array;
  cols: number;
  floors: number;
};

function paintDay(cols: number, floors: number, seed: number) {
  const c = document.createElement("canvas");
  c.width = cols * WIN_W;
  c.height = floors * WIN_H + 12;
  const g = c.getContext("2d")!;
  const r = rng(seed);
  // 노출 콘크리트 + 석재 패널 톤
  g.fillStyle = "#e6e0d4";
  g.fillRect(0, 0, c.width, c.height);
  for (let f = 0; f < floors; f++) {
    const y = 12 + f * WIN_H;
    // 슬래브 밴드
    g.fillStyle = "#d4ccbd";
    g.fillRect(0, y, c.width, 3);
    for (let i = 0; i < cols; i++) {
      const x = i * WIN_W;
      const pier = i % 4 === 0;
      if (pier) continue; // 세대 경계 벽체
      const grad = g.createLinearGradient(x, y, x + WIN_W, y + WIN_H);
      const t = 0.25 + r() * 0.2;
      grad.addColorStop(0, `rgba(58,74,92,${0.92 - t * 0.2})`);
      grad.addColorStop(1, `rgba(${110 + t * 60},${126 + t * 60},${142 + t * 50},0.95)`);
      g.fillStyle = grad;
      g.fillRect(x + 2, y + 5, WIN_W - 4, WIN_H - 7);
      // 발코니 난간
      g.fillStyle = "rgba(235,231,222,0.55)";
      g.fillRect(x + 2, y + WIN_H - 6, WIN_W - 4, 1.5);
    }
  }
  // 상단 코니스
  g.fillStyle = "#cfc6b6";
  g.fillRect(0, 0, c.width, 12);
  // 하부 필로티
  g.fillStyle = "#3b3f44";
  g.fillRect(0, c.height - WIN_H, c.width, WIN_H);
  return c;
}

const WARM = ["#ffd9a6", "#ffcf8f", "#ffe4bd", "#ffc27a", "#f6e9d2", "#dfe8f5"];

function paintGlow(f: Facade, lit: number) {
  const g = f.canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, f.canvas.width, f.canvas.height);
  for (let fl = 0; fl < f.floors - 1; fl++) {
    const y = 12 + fl * WIN_H;
    for (let i = 0; i < f.cols; i++) {
      if (i % 4 === 0) continue;
      const k = fl * f.cols + i;
      if (f.seeds[k] >= lit) continue;
      g.fillStyle = WARM[f.hues[k] % WARM.length];
      g.globalAlpha = 0.75 + (f.seeds[k] * 7919 % 1) * 0.25;
      g.fillRect(i * WIN_W + 3, y + 6, WIN_W - 6, WIN_H - 9);
    }
  }
  g.globalAlpha = 1;
  f.glow.needsUpdate = true;
}

function makeFacade(width: number, floors: number, seed: number): Facade {
  const cols = Math.max(4, Math.round(width / 2.4));
  const dayCanvas = paintDay(cols, floors, seed);
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = dayCanvas.width;
  glowCanvas.height = dayCanvas.height;
  const r = rng(seed * 31 + 7);
  const n = cols * floors;
  const seeds = new Float32Array(n);
  const hues = new Uint8Array(n);
  // 세대 단위(4칸)로 같은 점등 — 한 세대가 통째로 켜진다
  for (let fl = 0; fl < floors; fl++) {
    for (let u = 0; u < Math.ceil(cols / 4); u++) {
      const s = r();
      const h = Math.floor(r() * 255);
      for (let j = 0; j < 4; j++) {
        const i = u * 4 + j;
        if (i >= cols) break;
        seeds[fl * cols + i] = Math.min(0.999, s + (r() - 0.5) * 0.04);
        hues[fl * cols + i] = h;
      }
    }
  }
  const day = new THREE.CanvasTexture(dayCanvas);
  day.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = 8;
  const glow = new THREE.CanvasTexture(glowCanvas);
  glow.colorSpace = THREE.SRGBColorSpace;
  const f: Facade = { day, glow, canvas: glowCanvas, seeds, hues, cols, floors };
  paintGlow(f, 0);
  return f;
}

export type Complex = {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  setLit: (lit: number) => void;
};

export function buildComplex(): Complex {
  const group = new THREE.Group();
  const facades: Facade[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  const roofMat = new THREE.MeshStandardMaterial({ color: "#bdb5a6", roughness: 0.9 });
  const crownMat = new THREE.MeshStandardMaterial({ color: "#d9d2c4", roughness: 0.75 });

  TOWERS.forEach((t, idx) => {
    const h = PILOTI_H + t.floors * FLOOR_H;
    const long = makeFacade(t.w, t.floors + 1, 101 + idx * 13);
    const short = makeFacade(t.d, t.floors + 1, 503 + idx * 17);
    facades.push(long, short);
    const mk = (f: Facade) => {
      const m = new THREE.MeshStandardMaterial({
        map: f.day,
        emissiveMap: f.glow,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0,
        roughness: 0.62,
        metalness: 0.05,
      });
      materials.push(m);
      return m;
    };
    const longMat = mk(long);
    const shortMat = mk(short);
    const geo = new THREE.BoxGeometry(t.w, h, t.d);
    const mesh = new THREE.Mesh(geo, [shortMat, shortMat, roofMat, roofMat, longMat, longMat]);
    mesh.position.set(t.x, h / 2, t.z);
    mesh.rotation.y = t.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 옥탑 · 코어 크라운
    const crown = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.42, 6.5, t.d * 0.6), crownMat);
    crown.position.set(t.x, h + 3.25, t.z);
    crown.rotation.y = t.rot;
    crown.castShadow = true;
    group.add(crown);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.6, 1.1, t.d + 0.6), crownMat);
    parapet.position.set(t.x, h + 0.55, t.z);
    parapet.rotation.y = t.rot;
    group.add(parapet);
  });

  // 대지 플레이트 (24,800㎡ ≈ 236 × 105 m)
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(236, 1.2, 128),
    new THREE.MeshStandardMaterial({ color: "#b8b2a4", roughness: 0.95 }),
  );
  plate.position.set(0, 0.6, 2);
  plate.receiveShadow = true;
  group.add(plate);
  const lawn = new THREE.Mesh(
    new THREE.BoxGeometry(150, 0.3, 26),
    new THREE.MeshStandardMaterial({ color: "#5d6b4f", roughness: 1 }),
  );
  lawn.position.set(0, 1.3, 4);
  lawn.receiveShadow = true;
  group.add(lawn);

  let lastLit = -1;
  return {
    group,
    materials,
    setLit(lit: number) {
      const q = Math.round(lit * 100) / 100;
      if (q === lastLit) return;
      lastLit = q;
      facades.forEach((f) => paintGlow(f, q));
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
      const n = new THREE.Vector3(-dx * 0.9, -dy * 0.9, 1).normalize();
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

function genericFacade(seed: number) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9c3b8";
  g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 8)
    for (let x = 0; x < 128; x += 8) {
      g.fillStyle = (x / 8) % 4 === 0 ? "#c4bdb1" : "#56626e";
      g.fillRect(x + 1, y + 2, 6, 5);
    }
  const glow = document.createElement("canvas");
  glow.width = 128;
  glow.height = 256;
  const gg = glow.getContext("2d")!;
  gg.fillStyle = "#000";
  gg.fillRect(0, 0, 128, 256);
  const r = rng(seed);
  for (let y = 0; y < 256; y += 8)
    for (let x = 0; x < 128; x += 8) {
      if ((x / 8) % 4 === 0 || r() > 0.2) continue;
      gg.fillStyle = WARM[Math.floor(r() * WARM.length)];
      gg.fillRect(x + 1, y + 2, 6, 5);
    }
  const day = new THREE.CanvasTexture(c);
  day.colorSpace = THREE.SRGBColorSpace;
  const em = new THREE.CanvasTexture(glow);
  em.colorSpace = THREE.SRGBColorSpace;
  return { day, em };
}

export function buildContext() {
  const group = new THREE.Group();
  const r = rng(2026);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshStandardMaterial({ color: "#b3ab9c", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 호수공원 녹지 (호수 둘레)
  const park = new THREE.Mesh(
    new THREE.ShapeGeometry(
      (() => {
        const s = new THREE.Shape();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const x = Math.cos(a) * 640;
          const y = Math.sin(a) * 250;
          if (i === 0) s.moveTo(x, y);
          else s.lineTo(x, y);
        }
        return s;
      })(),
    ),
    new THREE.MeshStandardMaterial({ color: "#737a5c", roughness: 1 }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(LAKE_CENTER.x, 0.15, LAKE_CENTER.z);
  park.receiveShadow = true;
  group.add(park);

  // 도로
  const roadMat = new THREE.MeshStandardMaterial({ color: "#77746d", roughness: 0.95 });
  const roads: [number, number, number, number][] = [
    [0, -110, 2400, 22],
    [0, 92, 2400, 16],
    [-150, 0, 18, 1600],
    [150, 0, 18, 1600],
    [520, 0, 26, 2400],
    [-640, 0, 26, 2400],
  ];
  for (const [x, z, w, d] of roads) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.2, z);
    m.receiveShadow = true;
    group.add(m);
  }

  // 주변 고층 주거 클러스터 (청라국제도시 맥락) — 호수 영역·사업지 제외
  const { day, em } = genericFacade(77);
  const ctxMat = new THREE.MeshStandardMaterial({
    map: day,
    emissiveMap: em,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0,
    roughness: 0.8,
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const COUNT = 220;
  const inst = new THREE.InstancedMesh(box, ctxMat, COUNT);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let placed = 0;
  let guard = 0;
  while (placed < COUNT && guard++ < 6000) {
    const x = (r() - 0.5) * 2600;
    const z = (r() - 0.5) * 2200 - 200;
    const inSite = Math.hypot(x, z * 1.3) < 340;
    const lx = (x - LAKE_CENTER.x) / 690;
    const lz = (z - LAKE_CENTER.z) / 290;
    const inLake = lx * lx + lz * lz < 1;
    if (inSite || inLake) continue;
    const near = Math.hypot(x, z) < 700;
    const h = near ? 32 + r() * 38 : 28 + r() * 70;
    const w = 14 + r() * 22;
    const d = 12 + r() * 10;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(r() * 2) * 0.08 - 0.08);
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d));
    inst.setMatrixAt(placed++, m4);
  }
  inst.count = placed;
  inst.castShadow = true;
  inst.receiveShadow = true;
  group.add(inst);

  // 수목
  // 수관 — 세 덩이를 겹쳐 구(球)가 아닌 나무 윤곽으로
  const lobes = [
    new THREE.IcosahedronGeometry(0.85, 2).translate(0, 0.1, 0),
    new THREE.IcosahedronGeometry(0.62, 2).translate(0.5, -0.12, 0.18),
    new THREE.IcosahedronGeometry(0.58, 2).translate(-0.42, -0.05, -0.3),
    new THREE.CylinderGeometry(0.07, 0.1, 1.2, 5).translate(0, -1.05, 0),
  ];
  const crown = mergeGeometries(lobes.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  const treeMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, envMapIntensity: 0.35 });
  const TREES = 700;
  const trees = new THREE.InstancedMesh(crown, treeMat, TREES);
  const col = new THREE.Color();
  for (let i = 0; i < TREES; i++) {
    let x: number, z: number;
    if (i < 420) {
      // 호숫가 산책로
      const a = r() * Math.PI * 2;
      const rr = 1.04 + r() * 0.18;
      x = LAKE_CENTER.x + Math.cos(a) * 520 * rr;
      z = LAKE_CENTER.z + Math.sin(a) * 165 * rr;
    } else if (i < 560) {
      // 단지 내 조경
      x = (r() - 0.5) * 220;
      z = (r() - 0.5) * 120;
      if (TOWERS.some((t) => Math.abs(x - t.x) < t.w / 2 + 4 && Math.abs(z - t.z) < t.d / 2 + 4)) {
        x = (r() - 0.5) * 140;
        z = 4 + (r() - 0.5) * 20;
      }
    } else {
      x = (r() - 0.5) * 1400;
      z = 100 + r() * 30;
    }
    const s = 2.4 + r() * 2;
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    m4.compose(new THREE.Vector3(x, s * 1.6 + 1.2, z), yaw, new THREE.Vector3(s, s * 1.15, s));
    trees.setMatrixAt(i, m4);
    col.setHSL(0.19 + r() * 0.08, 0.2 + r() * 0.12, 0.13 + r() * 0.07);
    trees.setColorAt(i, col);
  }
  trees.castShadow = true;
  group.add(trees);

  // 가로등 (야간 점등)
  const LAMPS = 260;
  const lampMat = new THREE.MeshBasicMaterial({ color: "#ffc98a", transparent: true, opacity: 0 });
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), lampMat, LAMPS);
  for (let i = 0; i < LAMPS; i++) {
    let x: number, z: number;
    if (i < 140) {
      const a = (i / 140) * Math.PI * 2;
      x = LAKE_CENTER.x + Math.cos(a) * 520 * 1.03;
      z = LAKE_CENTER.z + Math.sin(a) * 165 * 1.03;
    } else {
      const k = i - 140;
      x = -1200 + (k % 60) * 40;
      z = k < 60 ? -110 : 92;
    }
    m4.compose(new THREE.Vector3(x, 6, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    lamps.setMatrixAt(i, m4);
  }
  group.add(lamps);

  return { group, ctxMat, lampMat };
}
