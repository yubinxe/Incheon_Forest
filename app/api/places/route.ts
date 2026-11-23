import { NextResponse } from "next/server";
import { findPois, restKey } from "@/lib/places";

export const revalidate = 86400;

/** 주변 시설 좌표 — 서버에서 카카오 REST 키로 조회해 하루 캐시. 키·원문 오류는 내보내지 않는다. */
export async function GET() {
  if (!restKey()) return NextResponse.json({ status: "no_key", pois: [] });
  const pois = await findPois();
  return NextResponse.json({ status: pois.length ? "ok" : "empty", pois }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } });
}
