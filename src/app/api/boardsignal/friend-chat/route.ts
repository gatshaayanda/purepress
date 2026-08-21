import { NextResponse } from "next/server";
import { requirePlayerToken } from "@/lib/boardsignal/server/persistence";
import { friendConversation, sendFriendMessage } from "@/lib/boardsignal/server/friendChat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function GET(request: Request) {
  try {
    const token = await requirePlayerToken(request);
    const playerId = new URL(request.url).searchParams.get("playerId");
    return response({ ok: true, conversation: await friendConversation(token, playerId) });
  } catch (reason) {
    const status = Number((reason as { status?: number }).status ?? 500);
    return response({ ok: false, error: reason instanceof Error ? reason.message : "Friend conversation could not be loaded." }, status);
  }
}

export async function POST(request: Request) {
  try {
    const token = await requirePlayerToken(request);
    const body = await request.json() as Record<string, unknown>;
    if (String(body.action ?? "send") !== "send") return response({ ok: false, error: "Unknown friend-message action." }, 400);
    const message = await sendFriendMessage(token, body.playerId, body.body, body.attachment, body.clientMessageId);
    return response({ ok: true, message });
  } catch (reason) {
    const status = Number((reason as { status?: number }).status ?? 500);
    return response({ ok: false, error: reason instanceof Error ? reason.message : "Friend message could not be sent." }, status);
  }
}
