import { NextResponse } from "next/server";
import { getFounderTraffic } from "@/lib/boardsignal/server/vercelTraffic";
import { trafficDateRange, type VercelTrafficRange } from "@/lib/boardsignal/vercelTrafficLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") === "30" ? 30 : 7) as VercelTrafficRange;
  try {
    const traffic = await getFounderTraffic(range, { refresh: url.searchParams.get("refresh") === "1" });
    return NextResponse.json({ ok: true, traffic }, { headers });
  } catch {
    const { since, until } = trafficDateRange(range);
    return NextResponse.json({ ok: true, traffic: { connection: "unavailable", message: "Traffic analytics temporarily unavailable.", range, since, until, partial: false } }, { headers });
  }
}
