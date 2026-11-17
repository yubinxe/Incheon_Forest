import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const SKIP = new Set(["node_modules", ".next", ".git", "tests"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    if (SKIP.has(f)) return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|js|mjs|json|md|css)$/.test(f) ? [p] : [];
  });
}

describe("보안 점검", () => {
  const all = files(ROOT);
  it("NEXT_PUBLIC_ 환경변수 미사용", () => {
    const use = /process\.env\.NEXT_PUBLIC_|^\s*NEXT_PUBLIC_[A-Z0-9_]*\s*=/m;
    const hits = [...all, join(ROOT, ".env.example")].filter((f) => existsSync(f) && use.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
  it("인증키 하드코딩 패턴 0건 (serviceKey=리터럴, 64자 hex/base64형 키)", () => {
    const re = /serviceKey=[A-Za-z0-9%+/]{20,}|[A-Za-z0-9%]{64,}={0,2}/;
    const hits = all.filter((f) => !f.endsWith("package-lock.json") && re.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
  it("공공데이터 호출 모듈은 server-only", () => {
    expect(readFileSync(join(ROOT, "lib/market/service.ts"), "utf8")).toMatch(/^import "server-only";/);
  });
  it("클라이언트 컴포넌트가 service 런타임 코드를 import 하지 않음", () => {
    const clients = all.filter((f) => /\.tsx$/.test(f) && readFileSync(f, "utf8").startsWith('"use client"'));
    for (const f of clients) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/import\s+\{[^}]*\}\s+from\s+"@\/lib\/market\/service"/);
    }
  });
  it("빌드 산출물에 실제 키 문자열 0건 (키가 설정된 환경에서만)", () => {
    const key = process.env.DATA_GO_KR_SERVICE_KEY || process.env.DATA_GO_KR_API_KEY || process.env.PUBLIC_DATA_API_KEY;
    const out = join(ROOT, ".next/static");
    if (!key || !existsSync(out)) return;
    const hits = files(out).filter((f) => readFileSync(f, "utf8").includes(key));
    expect(hits).toEqual([]);
  });
  it("vercel.json 서울 리전", () => {
    expect(JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")).regions).toEqual(["icn1"]);
  });
});

describe("인증키 변수명 호환", () => {
  it("SERVICE_KEY → API_KEY → PUBLIC_DATA_API_KEY 순으로 인식", async () => {
    const { rawDataPortalKey } = await import("@/lib/market/key");
    const saved = { ...process.env };
    delete process.env.DATA_GO_KR_SERVICE_KEY;
    delete process.env.DATA_GO_KR_API_KEY;
    process.env.PUBLIC_DATA_API_KEY = "legacy";
    expect(rawDataPortalKey()).toBe("legacy");
    process.env.DATA_GO_KR_API_KEY = " zipcatch ";
    expect(rawDataPortalKey()).toBe("zipcatch");
    process.env.DATA_GO_KR_SERVICE_KEY = "primary";
    expect(rawDataPortalKey()).toBe("primary");
    process.env = saved;
  });
});
