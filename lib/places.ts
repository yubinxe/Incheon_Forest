import "server-only";

/**
 * 주변 시설 좌표 — 카카오 로컬 키워드 검색 (zipcatch lib/consumer/geocode.ts 방식 차용).
 * REST 키는 서버에만 둔다. 브라우저로 내보내면 누구나 우리 할당량으로 조회할 수 있다.
 */
export const POI_QUERIES = [
  { key: "park", q: "청라호수공원", prefer: "AT4" },
  { key: "station", q: "청라국제도시역", prefer: "SW8" },
  { key: "ic", q: "청라IC" },
  { key: "canal", q: "청라커낼웨이" },
] as const;

/** 시설명 검색에 끼어드는 건물(오피스텔·아파트 등)은 버린다 — '커낼웨이' 가 단지명에 들어간 경우 */
const NOT_FACILITY = /오피스텔|아파트|빌딩|타워|주차|상가동|더휴|푸르지오|자이|힐스테이트|레지던스/;

export type Poi = { key: (typeof POI_QUERIES)[number]["key"]; lat: number; lng: number; name: string };

const ENDPOINT = "https://dapi.kakao.com/v2/local/search/keyword.json";
const CENTER = { x: 126.645, y: 37.536 }; // 청라국제도시

export const restKey = () => (process.env.KAKAO_REST_API_KEY ?? "").trim();

export async function findPois(): Promise<Poi[]> {
  const key = restKey();
  if (!key) return [];
  const hits = await Promise.all(
    POI_QUERIES.map(async (p) => {
      try {
        const url = `${ENDPOINT}?query=${encodeURIComponent(p.q)}&x=${CENTER.x}&y=${CENTER.y}&radius=8000&sort=accuracy`;
        const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, next: { revalidate: 86400 } });
        if (!res.ok) return null;
        const json = (await res.json()) as { documents?: { x: string; y: string; place_name: string; category_group_code?: string }[] };
        const docs = (json.documents ?? []).filter((d) => !NOT_FACILITY.test(d.place_name));
        const doc = ("prefer" in p && docs.find((d) => d.category_group_code === p.prefer)) || docs[0];
        return doc ? { key: p.key, lat: Number(doc.y), lng: Number(doc.x), name: doc.place_name } : null;
      } catch {
        return null;
      }
    }),
  );
  return hits.filter((h): h is Poi => h !== null && Number.isFinite(h.lat) && Number.isFinite(h.lng));
}
