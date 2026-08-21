import { NextResponse } from "next/server";
import { getAdminAuth } from "@/utils/firebaseAdmin";
import { consumeAuthCompletionTicket } from "@/lib/boardsignal/server/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticket?: string };
    if (!body.ticket) throw Object.assign(new Error("A sign-in completion ticket is required."), { status: 400 });
    const completion = await consumeAuthCompletionTicket(body.ticket);
    const customToken = await getAdminAuth().createCustomToken(completion.uid, {
      role: "player",
      accessTier: "founding_beta",
      chessPlayerId: String(completion.identity.playerId),
      chessUsername: completion.identity.canonicalUsername,
    });
    return NextResponse.json({ ok: true, customToken }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const status = Number((error as { status?: number }).status ?? 400);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Sign-in could not be completed." }, { status, headers: { "Cache-Control": "no-store, private" } });
  }
}
