/** 매스 스터디 (실제 배치도가 아닌 교육용 가상 매스) — 3D 장면과 배치도가 공유 */
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
