import type * as THREE from "three";

/**
 * 기기 사양별 품질 단계 — 어떤 기기에서도 끊김 없이 보이도록 시작 단계를 고르고,
 * 실행 중에는 프레임 시간을 보며 해상도와 효과를 단계적으로 조정한다.
 * 0 저사양(소프트웨어 렌더·저가 모바일) · 1 보급형(모바일·내장 그래픽) · 2 고사양 · 3 최고(외장 그래픽)
 */
export type Tier = 0 | 1 | 2 | 3;

export type Quality = {
  tier: Tier;
  maxDpr: number;
  minDpr: number;
  shadow: number; // 0 = 그림자 끔
  ao: boolean;
  bloom: boolean;
  msaa: number;
  waterRes: number; // 0 = 반사 수면 대신 단순 재질
  trees: number;
  cars: number;
  buildings: number;
  cloudShadow: boolean;
  gpu: string;
};

const PRESETS: Record<Tier, Omit<Quality, "tier" | "gpu">> = {
  0: { maxDpr: 1, minDpr: 0.6, shadow: 0, ao: false, bloom: false, msaa: 0, waterRes: 0, trees: 450, cars: 70, buildings: 220, cloudShadow: false },
  1: { maxDpr: 1.25, minDpr: 0.7, shadow: 1024, ao: false, bloom: true, msaa: 2, waterRes: 512, trees: 800, cars: 180, buildings: 300, cloudShadow: true },
  2: { maxDpr: 1.6, minDpr: 0.8, shadow: 2048, ao: true, bloom: true, msaa: 4, waterRes: 1024, trees: 1100, cars: 360, buildings: 380, cloudShadow: true },
  3: { maxDpr: 2, minDpr: 0.9, shadow: 4096, ao: true, bloom: true, msaa: 4, waterRes: 1024, trees: 1300, cars: 460, buildings: 380, cloudShadow: true },
};

function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    return "";
  }
}

export function detectQuality(renderer: THREE.WebGLRenderer): Quality {
  const gpu = gpuName(renderer.getContext());
  const g = gpu.toLowerCase();
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const touch = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(screen.width, screen.height) < 820;

  let tier: Tier = 2;
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(g)) tier = 0;
  else if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|apple m[1-9] (pro|max|ultra)|apple m[3-9]/.test(g)) tier = 3;
  else if (/apple m[1-9]|apple gpu/.test(g) && !touch) tier = 2;
  else if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|radeon graphics/.test(g)) tier = 1;
  else if (/mali|adreno|powervr|apple gpu|xclipse|immortalis/.test(g)) tier = 1;

  if (touch && small) tier = Math.min(tier, 1) as Tier;
  if (mem <= 4 || cores <= 4) tier = Math.min(tier, 1) as Tier;
  if (mem <= 2 || cores <= 2) tier = 0;

  const q = new URLSearchParams(location.search).get("q");
  const forced = { low: 0, medium: 1, high: 2, ultra: 3 }[q ?? ""] as Tier | undefined;
  if (forced !== undefined) tier = forced;

  return { tier, gpu, ...PRESETS[tier] };
}

/**
 * 동적 해상도 — 지수이동평균 프레임 시간이 목표보다 길면 해상도를 낮추고,
 * 최저 해상도에서도 느리면 효과를 하나씩 끈다. 여유가 생기면 천천히 되올린다.
 */
export class Governor {
  scale = 1;
  private ema = 16.7;
  private slow = 0;
  private fast = 0;
  private warm = 0;
  constructor(
    private q: Quality,
    private apply: (dpr: number) => void,
    private drop: () => boolean, // 끌 효과가 남았으면 하나 끄고 true
  ) {}
  sample(dtMs: number) {
    if (dtMs > 250) return; // 탭 전환 등 이상치
    this.warm++;
    if (this.warm < 45) return; // 셰이더 컴파일 직후 구간 제외
    this.ema += (dtMs - this.ema) * 0.08;
    if (this.ema > 25) {
      this.slow++;
      this.fast = 0;
    } else if (this.ema < 15.5) {
      this.fast++;
      this.slow = 0;
    } else {
      this.slow = Math.max(0, this.slow - 1);
      this.fast = Math.max(0, this.fast - 1);
    }
    const dpr = () => Math.min(this.q.maxDpr, devicePixelRatio || 1) * this.scale;
    if (this.slow > 40) {
      this.slow = 0;
      const minScale = this.q.minDpr / Math.max(0.01, Math.min(this.q.maxDpr, devicePixelRatio || 1));
      if (this.scale > minScale + 0.01) {
        this.scale = Math.max(minScale, this.scale * 0.85);
        this.apply(dpr());
      } else if (this.drop()) {
        this.ema = 20;
      }
    } else if (this.fast > 180 && this.scale < 1) {
      this.fast = 0;
      this.scale = Math.min(1, this.scale * 1.08);
      this.apply(dpr());
    }
  }
}
