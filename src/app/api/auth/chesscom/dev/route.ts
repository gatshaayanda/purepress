import { NextResponse } from "next/server";
import { getAdminAuth } from "@/utils/firebaseAdmin";
import { ensureStablePlayerAccount } from "@/lib/boardsignal/server/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV === "production" || process.env.BOARDSIGNAL_DEV_AUTH_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "Controlled development identity is disabled." }, { status: 404 });
  }
  const playerId = Number(process.env.BOARDSIGNAL_DEV_CHESS_PLAYER_ID);
  const canonicalUsername = process.env.BOARDSIGNAL_DEV_CHESS_USERNAME?.trim() ?? "";
  if (!Number.isSafeInteger(playerId) || playerId <= 0 || !canonicalUsername) {
    return NextResponse.json({ ok: false, error: "Development identity environment values are incomplete." }, { status: 503 });
  }
  const account = await ensureStablePlayerAccount({ playerId, canonicalUsername });
  const customToken = await getAdminAuth().createCustomToken(account.uid, {
    role: "player",
    accessTier: "founding_beta",
    chessPlayerId: String(playerId),
    chessUsername: canonicalUsername,
    boardsignalDevelopmentIdentity: true,
  });
  return NextResponse.json({ ok: true, customToken, developmentIdentity: true }, { headers: { "Cache-Control": "no-store, private" } });
}
