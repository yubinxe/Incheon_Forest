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

type Facade = {
  day: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  seeds: Float32Array;
  hues: Uint8Array;
  cols: number;
  floors: number;
};

/** 국내 고급 주거 입면 — 석재 저층부 · 유리 난간 발코니 · 세대 경계 벽체 · 브론즈 크라운 */
function paintDay(cols: number, floors: number, seed: number) {
  const c = document.createElement("canvas");
  c.width = cols * WIN_W;
  c.height = floors * WIN_H + TOP;
  const g = c.getContext("2d")!;
  const r = rng(seed);
  const W = c.width;
  // 바탕 — 웜화이트 도장 + 미세한 얼룩
  g.fillStyle = "#ebe6dc";
  g.fillRect(0, 0, W, c.height);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(120,108,90,${r() * 0.035})`;
    g.fillRect(r() * W, r() * c.height, 2 + r() * 30, 2 + r() * 50);
  }
  const stoneFrom = floors - 3; // 저층 2개 층 석재
  for (let f = 0; f < floors - 1; f++) {
    const y = TOP + f * WIN_H;
    const stone = f >= stoneFrom;
    if (stone) {
      g.fillStyle = "#8f877b";
      g.fillRect(0, y, W, WIN_H);
      g.fillStyle = "rgba(255,255,255,0.08)";
      for (let x = 0; x < W; x += 12) g.fillRect(x, y, 1, WIN_H);
    }
    // 슬래브 엣지
    g.fillStyle = stone ? "#7b7468" : "#d9d2c4";
    g.fillRect(0, y + WIN_H - 3, W, 3);
    for (let i = 0; i < cols; i++) {
      const x = i * WIN_W;
      if (i % 4 === 0) {
        // 세대 경계 벽체 — 살짝 돌출된 음영
        g.fillStyle = stone ? "#857d71" : "#e2dcd0";
        g.fillRect(x, y, WIN_W, WIN_H - 3);
        g.fillStyle = "rgba(0,0,0,0.06)";
        g.fillRect(x + WIN_W - 2, y, 2, WIN_H - 3);
        continue;
      }
      // 유리 — 하늘 반사 그라데이션
      const t = r();
      const grad = g.createLinearGradient(x, y, x, y + WIN_H);
      grad.addColorStop(0, `rgb(${70 + t * 30},${88 + t * 30},${108 + t * 30})`);
      grad.addColorStop(0.55, `rgb(${118 + t * 40},${138 + t * 36},${156 + t * 30})`);
      grad.addColorStop(1, `rgb(${60 + t * 20},${74 + t * 20},${90 + t * 20})`);
      g.fillStyle = grad;
      g.fillRect(x + 1.5, y + 3, WIN_W - 3, WIN_H - 7);
      // 커튼 · 블라인드 (일부 세대)
      if (r() < 0.22) {
        g.fillStyle = `rgba(${200 + r() * 40},${190 + r() * 30},${170 + r() * 30},0.55)`;
        g.fillRect(x + 2, y + 4, WIN_W - 4, (WIN_H - 9) * (0.3 + r() * 0.5));
      }
      // 멀리언
      g.fillStyle = "rgba(40,44,50,0.55)";
      g.fillRect(x + WIN_W / 2 - 0.5, y + 3, 1, WIN_H - 7);
      // 유리 난간
      g.fillStyle = "rgba(205,222,228,0.42)";
      g.fillRect(x + 1, y + WIN_H - 11, WIN_W - 2, 7);
      g.fillStyle = "rgba(245,245,240,0.85)";
      g.fillRect(x + 1, y + WIN_H - 11, WIN_W - 2, 1.2);
    }
  }
  // 측면 수직 액센트 (네이비 핀)
  g.fillStyle = "#1d2c44";
  g.fillRect(W - WIN_W * 0.5, TOP, WIN_W * 0.18, (floors - 3) * WIN_H);
  // 옥상 크라운 — 브론즈 프레임
  g.fillStyle = "#d8d1c3";
  g.fillRect(0, 0, W, TOP);
  g.fillStyle = "#8a6e45";
  g.fillRect(0, TOP - 6, W, 4);
  g.fillRect(0, 4, W, 3);
  for (let x = 0; x < W; x += WIN_W * 2) g.fillRect(x, 4, 3, TOP - 6);
  // 필로티
  g.fillStyle = "#2f3237";
  g.fillRect(0, c.height - WIN_H, W, WIN_H);
  g.fillStyle = "#c9a874";
  g.fillRect(0, c.height - WIN_H, W, 2);
  return c;
}

const WARM = ["#ffd9a6", "#ffcf8f", "#ffe4bd", "#ffc27a", "#f6e9d2", "#dfe8f5"];

function paintGlow(f: Facade, lit: number) {
  const g = f.canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, f.canvas.width, f.canvas.height);
  // 크라운 경관조명 — 항상 켜짐(밤에만 보임)
  g.fillStyle = "#e9c48a";
  g.fillRect(0, TOP - 6, f.canvas.width, 4);
  for (let fl = 0; fl < f.floors - 1; fl++) {
    const y = TOP + fl * WIN_H;
    for (let i = 0; i < f.cols; i++) {
      if (i % 4 === 0) continue;
      const k = fl * f.cols + i;
      if (f.seeds[k] >= lit) continue;
      g.fillStyle = WARM[f.hues[k] % WARM.length];
      g.globalAlpha = 0.72 + ((f.seeds[k] * 7919) % 1) * 0.28;
      g.fillRect(i * WIN_W + 2, y + 4, WIN_W - 4, WIN_H - 9);
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
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
  louverCache.set(key, m);
  return m;
}

export function buildComplex(): Complex {
  const group = new THREE.Group();
  const facades: Facade[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  const roofMat = new THREE.MeshStandardMaterial({ color: "#a9a397", roughness: 0.9 });
  const bronze = new THREE.MeshStandardMaterial({ color: "#8a6e45", roughness: 0.38, metalness: 0.75 });
  const glassCore = new THREE.MeshStandardMaterial({ color: "#3e4a58", roughness: 0.12, metalness: 0.6 });

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
        roughness: 0.5,
        metalness: 0.08,
      });
      materials.push(m);
      return m;
    };
    const longMat = mk(long);
    const shortMat = mk(short);
    const tower = new THREE.Group();
    tower.position.set(t.x, 0, t.z);
    tower.rotation.y = t.rot;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(t.w, h, t.d), [shortMat, shortMat, roofMat, roofMat, longMat, longMat]);
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tower.add(mesh);

    // 옥상 — 유리 코어 + 브론즈 크라운 프레임
    const core = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.36, 7, t.d * 0.55), glassCore);
    core.position.y = h + 3.5;
    tower.add(core);
    // 루버 크라운 — 브론즈 수직 루버를 컷아웃으로
    const fw = t.w + 1.0;
    const fd = t.d + 1.0;
    const fh = 8;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd, 1, 1, 1), [
      louverMat(fd), louverMat(fd), roofMat, roofMat, louverMat(fw), louverMat(fw),
    ]);
    crown.geometry.groups.splice(2, 2); // 상·하면 제거 (열린 크라운)
    crown.position.y = h + fh / 2 + 0.4;
    crown.castShadow = true;
    tower.add(crown);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.4, 0.7, fd + 0.4), bronze);
    cap.position.y = h + fh + 0.6;
    tower.add(cap);
    const capHole = new THREE.Mesh(new THREE.BoxGeometry(fw - 1.2, 0.8, fd - 1.2), glassCore);
    capHole.position.y = h + fh + 0.62;
    tower.add(capHole);
    // 파라펫
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.5, 1.2, t.d + 0.5), roofMat);
    parapet.position.y = h + 0.6;
    tower.add(parapet);
    group.add(tower);
  });

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
    new THREE.MeshStandardMaterial({ color: "#5f7448", roughness: 1 }),
  );
  lawn.position.set(0, 1.3, 4);
  lawn.receiveShadow = true;
  group.add(lawn);
  const pond = new THREE.Mesh(
    new THREE.BoxGeometry(46, 0.2, 9),
    new THREE.MeshStandardMaterial({ color: "#1f3442", roughness: 0.08, metalness: 0.9 }),
  );
  pond.position.set(0, 1.5, 4);
  group.add(pond);

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

/** 주변 고층 주거 — 흰 바탕 텍스처에 인스턴스 색으로 톤을 달리한다 */
function genericFacade(seed: number) {
  const W = 128, H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const r = rng(seed);
  g.fillStyle = "#f2f0ea";
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 8) {
    g.fillStyle = "#dcd8cf";
    g.fillRect(0, y + 7, W, 1);
    for (let x = 0; x < W; x += 8) {
      if ((x / 8) % 4 === 0) continue;
      const t = r() * 30;
      g.fillStyle = `rgb(${78 + t},${92 + t},${108 + t})`;
      g.fillRect(x + 1, y + 1.5, 6, 4.5);
      g.fillStyle = "rgba(220,230,235,0.5)";
      g.fillRect(x + 1, y + 5, 6, 1);
    }
  }
  const glow = document.createElement("canvas");
  glow.width = W;
  glow.height = H;
  const gg = glow.getContext("2d")!;
  gg.fillStyle = "#000";
  gg.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 8)
    for (let x = 0; x < W; x += 8) {
      if ((x / 8) % 4 === 0 || r() > 0.34) continue;
      gg.fillStyle = WARM[Math.floor(r() * WARM.length)];
      gg.fillRect(x + 1, y + 1.5, 6, 4.5);
    }
  const day = new THREE.CanvasTexture(c);
  day.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = 4;
  const em = new THREE.CanvasTexture(glow);
  em.colorSpace = THREE.SRGBColorSpace;
  return { day, em };
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
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#a8a293";
  g.fillRect(0, 0, 256, 256);
  const r = rng(11);
  for (let i = 0; i < 1400; i++) {
    const v = 120 + r() * 80;
    g.fillStyle = `rgba(${v},${v - 6},${v - 18},0.08)`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 10, 1 + r() * 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  return t;
}

export const COAST_X = -1500;

export function buildContext() {
  const group = new THREE.Group();
  const r = rng(2026);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = COAST_X + 4500;
  ground.receiveShadow = true;
  group.add(ground);

  // 서해 — 하늘을 비추는 넓은 수면 + 원경 섬(영종) 실루엣
  const seaMat = new THREE.MeshStandardMaterial({ color: "#2a3f4f", roughness: 0.16, metalness: 0.92, envMapIntensity: 1.1 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 16000), seaMat);
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
  const roads: [number, number, number, number][] = [
    [0, -110, 3000, 26],
    [0, 92, 3000, 20],
    [-150, -300, 20, 1400],
    [150, -300, 20, 1400],
    [520, 0, 30, 2600],
    [-760, 0, 30, 2600],
    [0, -620, 3000, 30],
  ];
  for (const [x, z, w, d] of roads) {
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

  // 주변 고층 주거 클러스터 (청라국제도시 맥락) — 호수·사업지·바다 제외
  const { day, em } = genericFacade(77);
  const ctxMat = new THREE.MeshStandardMaterial({
    map: day,
    emissiveMap: em,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0,
    roughness: 0.62,
    metalness: 0.05,
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const COUNT = 320;
  const inst = new THREE.InstancedMesh(box, ctxMat, COUNT);
  const crownMat = new THREE.MeshStandardMaterial({ color: "#d9d3c6", roughness: 0.6, metalness: 0.2 });
  const crowns = new THREE.InstancedMesh(box, crownMat, COUNT);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tones = ["#ffffff", "#f3ece0", "#e9e4dc", "#dfe3e6", "#efe6d6", "#d9d5cc"];
  const col = new THREE.Color();
  let placed = 0;
  let guard = 0;
  while (placed < COUNT && guard++ < 9000) {
    const x = (r() - 0.5) * 3600 + 300;
    const z = (r() - 0.5) * 2800 - 300;
    if (x < COAST_X + 120) continue;
    const inSite = Math.hypot(x, z * 1.3) < 330;
    const lx = (x - LAKE_CENTER.x) / 700;
    const lz = (z - LAKE_CENTER.z) / 300;
    if (inSite || lx * lx + lz * lz < 1) continue;
    if (Math.abs(z - (150 + (x - 1120) * -0.22)) < 40 && x > 380) continue; // 수로
    const d0 = Math.hypot(x, z);
    // 동북측 상업지 — 초고층
    const cbd = Math.hypot(x - 900, z + 700) < 420;
    const h = cbd ? 120 + r() * 70 : d0 < 800 ? 70 + r() * 45 : 55 + r() * 70;
    const slab = r() < 0.6;
    const w = slab ? 40 + r() * 20 : 22 + r() * 8;
    const d = slab ? 13 + r() * 3 : 22 + r() * 8;
    q.setFromAxisAngle(up, (Math.round(r() * 2) - 1) * 0.06 + (r() < 0.15 ? Math.PI / 2 : 0));
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d));
    inst.setMatrixAt(placed, m4);
    inst.setColorAt(placed, col.set(tones[Math.floor(r() * tones.length)]));
    m4.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(w * 0.45, 5 + r() * 4, d * 0.6));
    crowns.setMatrixAt(placed, m4);
    placed++;
  }
  inst.count = placed;
  crowns.count = placed;
  inst.castShadow = true;
  inst.receiveShadow = true;
  group.add(inst, crowns);

  // 수목 — 세 덩이를 겹쳐 나무 윤곽으로
  const lobes = [
    new THREE.IcosahedronGeometry(0.85, 2).translate(0, 0.1, 0),
    new THREE.IcosahedronGeometry(0.62, 2).translate(0.5, -0.12, 0.18),
    new THREE.IcosahedronGeometry(0.58, 2).translate(-0.42, -0.05, -0.3),
    new THREE.CylinderGeometry(0.07, 0.1, 1.2, 5).translate(0, -1.05, 0),
  ];
  const crown = mergeGeometries(lobes.map((gm) => (gm.index ? gm.toNonIndexed() : gm)))!;
  const treeMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, envMapIntensity: 0.35 });
  const TREES = 1100;
  const trees = new THREE.InstancedMesh(crown, treeMat, TREES);
  for (let i = 0; i < TREES; i++) {
    let x: number, z: number;
    if (i < 560) {
      const a = r() * Math.PI * 2;
      const rr = 1.04 + r() * 0.2;
      x = LAKE_CENTER.x + Math.cos(a) * 520 * rr;
      z = LAKE_CENTER.z + Math.sin(a) * 165 * rr;
    } else if (i < 720) {
      x = (r() - 0.5) * 220;
      z = (r() - 0.5) * 120;
      if (TOWERS.some((t) => Math.abs(x - t.x) < t.w / 2 + 4 && Math.abs(z - t.z) < t.d / 2 + 4)) {
        x = (r() - 0.5) * 140;
        z = 4 + (r() - 0.5) * 20;
      }
    } else {
      // 가로수
      const k = i - 720;
      const row = [-128, -94, 74, 108][k % 4];
      x = -1300 + (k / 4) * 28 + (r() - 0.5) * 4;
      z = row + (r() - 0.5) * 2;
    }
    const s = 2.4 + r() * 2;
    const yaw = new THREE.Quaternion().setFromAxisAngle(up, r() * Math.PI * 2);
    m4.compose(new THREE.Vector3(x, s * 1.6 + 1.2, z), yaw, new THREE.Vector3(s, s * 1.15, s));
    trees.setMatrixAt(i, m4);
    col.setHSL(0.2 + r() * 0.07, 0.22 + r() * 0.14, 0.15 + r() * 0.08);
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

  return { group, ctxMat, lampMat };
}
