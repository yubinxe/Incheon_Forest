/**
 * 공공데이터포털 인증키 — 서버 전용.
 * zipcatch와 같은 변수명(DATA_GO_KR_API_KEY · 옛 PUBLIC_DATA_API_KEY)도 받아 같은 키를 그대로 옮겨 쓸 수 있다.
 */
export const KEY_ENV_NAMES = ["DATA_GO_KR_SERVICE_KEY", "DATA_GO_KR_API_KEY", "PUBLIC_DATA_API_KEY"] as const;

export function rawDataPortalKey(): string | null {
  for (const n of KEY_ENV_NAMES) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return null;
}
