import { NextResponse } from "next/server";
import { authenticateFoundingBetaAccess } from "@/lib/boardsignal/server/betaAccess";
import { getAdminAuth } from "@/utils/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
      ...(status === 429 ? { "Retry-After": "900" } : {}),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: unknown; accessCode?: unknown };
    if (typeof body.username !== "string" || typeof body.accessCode !== "string") {
      return response({ ok: false, code: "INVALID_INPUT", error: "Chess.com username and private access code are required." }, 400);
    }
    const { account, identity } = await authenticateFoundingBetaAccess(body.username, body.accessCode);
    const customToken = await getAdminAuth().createCustomToken(account.uid, {
      role: "player",
      accessTier: "founding_beta",
      chessPlayerId: String(identity.playerId),
      chessUsername: identity.canonicalUsername,
      boardsignalAuthProvider: "founding_beta_access",
    });
    return response({ ok: true, customToken });
  } catch (error) {
    const status = Number((error as { status?: number }).status ?? 500);
    const code = String((error as { code?: string }).code ?? "BETA_ACCESS_FAILED");
    return response({
      ok: false,
      code,
      error: error instanceof Error ? error.message : "Founding Access could not be completed.",
    }, status);
  }
}
