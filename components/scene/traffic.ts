import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./world";

/** 도로 정의 — 중심 (x, z), 길이 방향 폭 w(x축) · 깊이 d(z축). w > d 이면 동서 방향 도로 */
export type Road = [number, number, number, number];

type Car = { axis: 0 | 1; fixed: number; from: number; len: number; dir: 1 | -1; s0: number; v: number };

/**
 * 차량 흐름 — 우측통행 차로에 인스턴스 차량을 흘린다.
 * 차체 · 유리 · 전조등 · 후미등을 같은 인스턴스 행렬 버퍼로 공유해 한 번만 갱신한다.
 */
export function buildTraffic(roads: Road[], max: number) {
  const r = rng(3141);
  const cars: Car[] = [];
  for (const [x, z, w, d] of roads) {
    const along = w > d;
    const width = along ? d : w;
    const len = along ? w : d;
    const lanesPerDir = width >= 28 ? 3 : width >= 20 ? 2 : 1;
    for (const dir of [1, -1] as const) {
      for (let l = 0; l < lanesPerDir; l++) {
        // 우측통행: 진행 방향의 오른쪽 절반
        const off = (1.6 + l * 3.3) * (along ? dir : -dir);
        let s = r() * 60;
        while (s < len) {
          cars.push({
            axis: along ? 0 : 1,
            fixed: (along ? z : x) + off,
            from: (along ? x : z) - len / 2,
            len,
            dir,
            s0: s,
            v: 11 + r() * 6 - l * 1.2,
          });
          s += 28 + r() * 70;
        }
      }
    }
  }
  // 고르게 솎아 max 대로 제한
  while (cars.length > max) cars.splice(Math.floor(r() * cars.length), 1);
  const N = cars.length;

  const body = mergeGeometries([
    new THREE.BoxGeometry(4.6, 0.9, 1.84).translate(0, 0.72, 0),
    new THREE.BoxGeometry(4.3, 0.3, 1.7).translate(0, 0.35, 0),
  ])!;
  const cabin = new THREE.BoxGeometry(2.5, 0.62, 1.62).translate(-0.25, 1.48, 0);
  const head = mergeGeometries([
    new THREE.BoxGeometry(0.06, 0.16, 0.36).translate(2.31, 0.85, 0.6),
    new THREE.BoxGeometry(0.06, 0.16, 0.36).translate(2.31, 0.85, -0.6),
  ])!;
  const tail = mergeGeometries([
    new THREE.BoxGeometry(0.06, 0.14, 0.42).translate(-2.31, 0.9, 0.6),
    new THREE.BoxGeometry(0.06, 0.14, 0.42).translate(-2.31, 0.9, -0.6),
  ])!;

  const bodyMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.28, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: "#151b22", roughness: 0.06, metalness: 0.8 });
  const headMat = new THREE.MeshBasicMaterial({ color: "#fff4dc", transparent: true, opacity: 0, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: "#ff2a1a", transparent: true, opacity: 0, toneMapped: false });

  const bodies = new THREE.InstancedMesh(body, bodyMat, N);
  const glass = new THREE.InstancedMesh(cabin, glassMat, N);
  const heads = new THREE.InstancedMesh(head, headMat, N);
  const tails = new THREE.InstancedMesh(tail, tailMat, N);
  // 국내 차량 색 분포 — 흰색 · 회색 · 검정 · 은색 위주
  const palette = ["#f4f4f2", "#f4f4f2", "#f4f4f2", "#1b1d20", "#1b1d20", "#7d8187", "#a9adb2", "#a9adb2", "#2c3a52", "#6b1d1d"];
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) bodies.setColorAt(i, col.set(palette[Math.floor(r() * palette.length)]));
  for (const m of [glass, heads, tails]) m.instanceMatrix = bodies.instanceMatrix;
  for (const m of [bodies, glass, heads, tails]) {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  bodies.castShadow = true;

  const group = new THREE.Group();
  group.add(bodies, glass, heads, tails);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const qs = [
    new THREE.Quaternion().setFromAxisAngle(up, 0), // +x
    new THREE.Quaternion().setFromAxisAngle(up, Math.PI), // -x
    new THREE.Quaternion().setFromAxisAngle(up, -Math.PI / 2), // +z
    new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2), // -z
  ];
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  function update(t: number) {
    for (let i = 0; i < N; i++) {
      const c = cars[i];
      let s = (c.s0 + c.v * t) % c.len;
      if (c.dir < 0) s = c.len - s;
      const a = c.from + s;
      if (c.axis === 0) {
        p.set(a, 0.3, c.fixed);
        q.copy(qs[c.dir > 0 ? 0 : 1]);
      } else {
        p.set(c.fixed, 0.3, a);
        q.copy(qs[c.dir > 0 ? 2 : 3]);
      }
      m4.compose(p, q, one);
      bodies.setMatrixAt(i, m4);
    }
    bodies.instanceMatrix.needsUpdate = true;
  }

  function setNight(k: number) {
    headMat.opacity = k;
    tailMat.opacity = k;
    headMat.visible = tailMat.visible = k > 0.02;
  }

  update(0);
  return { group, update, setNight, count: N };
}
