import { NextResponse } from "next/server";
import { requirePlayerToken } from "@/lib/boardsignal/server/persistence";
import {
  listPlayerConversation,
  listPlayerInbox,
  markInboxMessageRead,
  registerPlayerPushToken,
  replyToFounder,
  unregisterPlayerPushToken,
} from "@/lib/boardsignal/server/communications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function GET(request: Request) {
  try {
    const token = await requirePlayerToken(request);
    const threadId = new URL(request.url).searchParams.get("threadId");
    if (threadId) return response({ ok: true, conversation: await listPlayerConversation(token, threadId) });
    return response({ ok: true, inbox: await listPlayerInbox(token) });
  } catch (reason) {
    const status = Number((reason as { status?: number }).status ?? 500);
    return response({ ok: false, error: reason instanceof Error ? reason.message : "Inbox could not be loaded." }, status);
  }
}

export async function POST(request: Request) {
  try {
    const token = await requirePlayerToken(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "markRead") return response({ ok: true, result: await markInboxMessageRead(token, body.messageId) });
    if (action === "reply") return response({ ok: true, message: await replyToFounder(token, body.threadId, body.body, body.attachment, body.clientMessageId) });
    if (action === "registerPush") return response({ ok: true, result: await registerPlayerPushToken(token, body.fcmToken, body.userAgent) });
    if (action === "unregisterPush") return response({ ok: true, result: await unregisterPlayerPushToken(token, body.fcmToken) });
    return response({ ok: false, error: "Unknown Inbox action." }, 400);
  } catch (reason) {
    const status = Number((reason as { status?: number }).status ?? 500);
    return response({ ok: false, error: reason instanceof Error ? reason.message : "Inbox action failed." }, status);
  }
}
