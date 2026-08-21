import { NextResponse } from "next/server";
import { accountForToken, requirePlayerToken } from "@/lib/boardsignal/server/persistence";
import {
  acceptFriendRequest,
  blockPlayer,
  cancelFriendRequest,
  declineFriendRequest,
  headToHead,
  searchSocialPlayers,
  sendFriendRequest,
  setRivalPin,
  socialOverview,
  suggestedSocialPlayers,
  unfriend,
} from "@/lib/boardsignal/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) { return NextResponse.json(body, { status }); }

export async function GET(request: Request) {
  try {
    const token = await requirePlayerToken(request);
    const account = await accountForToken(token);
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "overview";
    if (view === "overview") return json({ ok: true, overview: await socialOverview(account) });
    if (view === "search") return json({ ok: true, players: await searchSocialPlayers(account, url.searchParams.get("q")) });
    if (view === "suggested") return json({ ok: true, players: await suggestedSocialPlayers(account) });
    if (view === "compare") return json({ ok: true, comparison: await headToHead(account, url.searchParams.get("playerId")) });
    return json({ ok: false, error: "Unknown social view." }, 400);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "BoardSignal social request failed." }, Number((error as { status?: number }).status ?? 500));
  }
}

export async function POST(request: Request) {
  try {
    const token = await requirePlayerToken(request);
    const account = await accountForToken(token);
    const body = await request.json() as { action?: string; playerId?: unknown; pinned?: boolean };
    switch (body.action) {
      case "send": return json({ ok: true, result: await sendFriendRequest(account, body.playerId) });
      case "accept": return json({ ok: true, result: await acceptFriendRequest(account, body.playerId) });
      case "decline": return json({ ok: true, result: await declineFriendRequest(account, body.playerId) });
      case "cancel": return json({ ok: true, result: await cancelFriendRequest(account, body.playerId) });
      case "unfriend": return json({ ok: true, result: await unfriend(account, body.playerId) });
      case "block": return json({ ok: true, result: await blockPlayer(account, body.playerId) });
      case "pin": return json({ ok: true, result: await setRivalPin(account, body.playerId, body.pinned === true) });
      default: return json({ ok: false, error: "Unknown social action." }, 400);
    }
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "BoardSignal social update failed." }, Number((error as { status?: number }).status ?? 500));
  }
}
