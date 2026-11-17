import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { buildMarket } from "@/lib/market/service";
import { sanitizeRegion } from "@/lib/market/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // 빌드 시 API 호출 금지
export const maxDuration = 60;

class Uncacheable extends Error {
  constructor(public payload: unknown) {
    super("uncacheable");
  }
}

// 성공 응답만 하루 캐시 — 실패는 캐시하지 않고 다음 요청에서 재시도
const cached = unstable_cache(
  async (region: string) => {
    const r = await buildMarket(region);
    if (r.status !== "ok") throw new Uncacheable(r);
    return r;
  },
  ["market-v1"],
  { revalidate: 86400, tags: ["market"] },
);

export async function GET(req: NextRequest) {
  const region = sanitizeRegion(req.nextUrl.searchParams.get("region"));
  if (!region) {
    return NextResponse.json({ status: "bad_request", message: "지역명은 한글·숫자·공백 40자 이내" }, { status: 400 });
  }
  if (!process.env.DATA_GO_KR_SERVICE_KEY) {
    return NextResponse.json({ status: "no_key", region }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const data = await cached(region);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    const payload = e instanceof Uncacheable ? e.payload : { status: "error", region, message: "시장 데이터 조회 중 오류" };
    return NextResponse.json(payload, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
