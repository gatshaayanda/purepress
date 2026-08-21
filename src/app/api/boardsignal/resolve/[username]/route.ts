import { NextResponse } from "next/server";
import { resolveChessComPlayer } from "@/lib/boardsignal/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  try {
    const player = await resolveChessComPlayer(decodeURIComponent(username));
    return NextResponse.json({ ok: true, player }, {
      headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chess.com player could not be confirmed.";
    const status = (error as { status?: number }).status === 404 ? 404 : 422;
    return NextResponse.json({ ok: false, error: message, code: status === 404 ? "PLAYER_NOT_FOUND" : "RESOLUTION_FAILED" }, {
      status,
      headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
}

