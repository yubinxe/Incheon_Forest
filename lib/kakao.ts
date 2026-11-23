/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 카카오 지도 JavaScript SDK 로더 — zipcatch `components/consumer/kakao-sdk.ts` 차용.
 *
 * JS 키는 브라우저에 노출되도록 설계된 키다. 보호 수단은 키 비밀이 아니라
 * 카카오 개발자 콘솔 › 플랫폼 › Web › 사이트 도메인 등록이다.
 * 공공데이터 인증키(서버 전용)와 성격이 다르므로 이 키 하나만 NEXT_PUBLIC_ 으로 둔다.
 */
export type KakaoNS = any;

export const KAKAO_JS_KEY = (process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY ?? "").trim();
const SCRIPT_ID = "kakao-maps-sdk";
const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`;

type W = { kakao?: KakaoNS; __kakaoMapPromise?: Promise<KakaoNS> };

export function loadKakao(): Promise<KakaoNS> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저 전용"));
  const w = window as unknown as W;
  if (w.kakao?.maps?.Map && w.kakao.maps.services) return Promise.resolve(w.kakao);
  if (w.__kakaoMapPromise) return w.__kakaoMapPromise;

  const hint = `카카오 개발자 콘솔 › 앱 설정 › 플랫폼 › Web › 사이트 도메인에 「${window.location.origin}」 등록이 필요합니다.`;

  w.__kakaoMapPromise = new Promise<KakaoNS>((resolve, reject) => {
    if (!KAKAO_JS_KEY) {
      reject(new Error("지도 키가 설정되지 않았습니다."));
      return;
    }
    const timer = window.setTimeout(() => reject(new Error("지도를 불러오는 데 시간이 너무 오래 걸립니다.")), 15000);
    const start = () => {
      const k = (window as unknown as W).kakao;
      if (!k?.maps) {
        window.clearTimeout(timer);
        reject(new Error(`지도를 불러오지 못했습니다. ${hint}`));
        return;
      }
      k.maps.load(() => {
        window.clearTimeout(timer);
        resolve(k);
      });
    };
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", start);
      return;
    }
    const el = document.createElement("script");
    el.id = SCRIPT_ID;
    el.async = true;
    el.src = SDK_URL;
    el.onload = start;
    el.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`지도를 불러오지 못했습니다. ${hint}`));
    };
    document.head.appendChild(el);
  }).catch((err) => {
    // 실패한 약속을 남기면 다시 들어와도 지도가 영영 안 뜬다.
    delete (window as unknown as W).__kakaoMapPromise;
    throw err;
  });

  return w.__kakaoMapPromise;
}
