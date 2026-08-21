import { NextResponse } from "next/server";
import { buildCurrentEpisodeSummary } from "@/lib/boardsignal/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  try {
    const anchorStart = new URL(request.url).searchParams.get("anchorStart") ?? undefined;
    const progress = await buildCurrentEpisodeSummary(decodeURIComponent(username), { anchorStart });
    return NextResponse.json({ ok: true, progress }, { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Current episode progress is unavailable." }, { status: 422, headers: { "Cache-Control": "no-store, private" } });
  }
}
