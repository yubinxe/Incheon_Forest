"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { KAKAO_JS_KEY, loadKakao, type KakaoNS } from "@/lib/kakao";

/** 카카오 장소 검색으로 실제 좌표를 받는다 — 좌표를 손으로 박지 않는다. */
const POIS: { q: string; label: string; cat: string; prefer?: string }[] = [
  { q: "청라호수공원", label: "청라호수공원", cat: "공원" },
  { q: "청라국제도시역", label: "청라국제도시역", cat: "공항철도", prefer: "SW8" },
  { q: "청라IC", label: "청라IC", cat: "공항고속도로" },
  { q: "청라 커낼웨이", label: "커낼웨이", cat: "수변상가" },
];
const CENTER = { lat: 37.536, lng: 126.645 }; // 청라국제도시 — 검색 기준점
/** 사업지는 교육용 가상 사업장. 호수공원 중심점에서 북측으로 약 600m 띄운 개념 위치. */
const SITE_OFFSET_LAT = 0.0055;

type Status = "loading" | "ready" | "error";

export function LocationMap({ diagram }: { diagram: ReactNode }) {
  const hasKey = KAKAO_JS_KEY.length > 0;
  const [view, setView] = useState<"map" | "diagram">(hasKey ? "map" : "diagram");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const fig = useRef<HTMLElement>(null);
  const mapRef = useRef<{ map: KakaoNS; bounds: KakaoNS } | null>(null);

  // 화면 가까이 왔을 때만 SDK를 받는다 — 첫 화면(3D) 부하와 분리.
  useEffect(() => {
    if (!hasKey || !fig.current) return;
    let dead = false;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        loadKakao()
          .then((kakao) => (dead ? null : draw(kakao)))
          .catch((e: Error) => {
            if (dead) return;
            console.warn("[지도]", e.message); // 도메인 등록 안내는 개발자 콘솔로만
            setError("지도를 불러오지 못해 개념도로 표시합니다.");
            setStatus("error");
            setView("diagram");
          });
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(fig.current);

    async function draw(kakao: KakaoNS) {
      if (!host.current) return;
      const map = new kakao.maps.Map(host.current, {
        center: new kakao.maps.LatLng(CENTER.lat, CENTER.lng),
        level: 6,
      });
      map.setZoomable(false); // 휠 스크롤이 페이지 스크롤을 가로채지 않게
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

      const places = new kakao.maps.services.Places();
      const near = { location: new kakao.maps.LatLng(CENTER.lat, CENTER.lng), radius: 8000 };
      const find = (p: (typeof POIS)[number]) =>
        new Promise<{ lat: number; lng: number } | null>((res) =>
          places.keywordSearch(
            p.q,
            (data: { x: string; y: string; category_group_code?: string }[], st: string) => {
              if (st !== kakao.maps.services.Status.OK || !data.length) return res(null);
              const hit = (p.prefer && data.find((d) => d.category_group_code === p.prefer)) || data[0];
              res({ lat: Number(hit.y), lng: Number(hit.x) });
            },
            near,
          ),
        );

      const found = await Promise.all(POIS.map(find));
      if (dead) return;
      const bounds = new kakao.maps.LatLngBounds();
      const add = (lat: number, lng: number, el: HTMLElement, z: number) => {
        const pos = new kakao.maps.LatLng(lat, lng);
        new kakao.maps.CustomOverlay({ map, position: pos, content: el, yAnchor: 1, zIndex: z });
        bounds.extend(pos);
      };

      POIS.forEach((p, i) => {
        const c = found[i];
        if (!c) return;
        const el = document.createElement("div");
        el.className = "km-pin";
        el.innerHTML = `<span class="km-cat"></span><b></b>`;
        (el.firstChild as HTMLElement).textContent = p.cat;
        (el.lastChild as HTMLElement).textContent = p.label;
        add(c.lat, c.lng, el, 2);
      });

      const park = found[0];
      if (park) {
        const el = document.createElement("div");
        el.className = "km-site";
        el.innerHTML = `<b>사업지</b><span>개념 위치</span>`;
        add(park.lat + SITE_OFFSET_LAT, park.lng, el, 3);
      }

      mapRef.current = { map, bounds };
      if (!bounds.isEmpty()) map.setBounds(bounds, 56, 56, 56, 56);
      setStatus("ready");
    }

    return () => {
      dead = true;
      io.disconnect();
    };
  }, [hasKey]);

  // 숨겨진 상태에서 만들어졌거나 탭 전환 후 — 크기를 다시 재고 범위를 맞춘다.
  useEffect(() => {
    const m = mapRef.current;
    if (view !== "map" || !m) return;
    m.map.relayout();
    if (!m.bounds.isEmpty()) m.map.setBounds(m.bounds, 56, 56, 56, 56);
  }, [view, status]);

  return (
    <figure ref={fig} className="loc-map" aria-label="입지">
      {hasKey && status !== "error" && (
        <div className="loc-tabs" role="tablist" aria-label="지도 보기 방식">
          <button role="tab" aria-selected={view === "map"} onClick={() => setView("map")}>
            지도
          </button>
          <button role="tab" aria-selected={view === "diagram"} onClick={() => setView("diagram")}>
            개념도
          </button>
        </div>
      )}

      {hasKey && (
        <div className="km-wrap" hidden={view !== "map"}>
          <div ref={host} className="km-host" />
          {status === "loading" && <p className="km-state">지도를 불러오는 중</p>}
        </div>
      )}
      <div hidden={view !== "diagram"}>{diagram}</div>

      <figcaption>
        {view === "map"
          ? "실제 지도 — 주변 시설은 카카오 장소 검색 좌표입니다. 사업지는 교육용 가상 사업장으로 호수공원 북측 개념 위치에 표시했습니다."
          : "개념도 — 축척과 위치는 실제와 다릅니다. 실제 배치·거리는 인허가 도서로 확인합니다."}
        {status === "error" && error && <span className="km-err">{error}</span>}
      </figcaption>
    </figure>
  );
}
