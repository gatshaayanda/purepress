import { NextResponse } from "next/server";
import { buildLiveDesk } from "@/lib/boardsignal/processor";
import type { DeskApiResponse } from "@/lib/boardsignal/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  try {
    const anchorStart = new URL(request.url).searchParams.get("anchorStart") ?? undefined;
    const desk = await buildLiveDesk(decodeURIComponent(username), { anchorStart });
    return NextResponse.json<DeskApiResponse>({ ok: true, desk }, {
      headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BoardSignal could not build this Review.";
    const errorCode = (error as { code?: string }).code;
    const status = (error as { status?: number }).status === 404 ? 404 : 422;
    return NextResponse.json<DeskApiResponse>({ ok: false, error: message, code: status === 404 ? "PLAYER_NOT_FOUND" : errorCode ?? "PROCESSING_FAILED" }, {
      status,
      headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
}

