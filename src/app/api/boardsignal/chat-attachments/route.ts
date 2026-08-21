import { NextResponse } from "next/server";
import { discardUnclaimedChatAttachment, resolveBoardSignalChatUploadActor } from "@/lib/boardsignal/server/chatAttachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function POST(request: Request) {
  try {
    const actor = await resolveBoardSignalChatUploadActor(request);
    const body = await request.json() as Record<string, unknown>;
    if (String(body.action ?? "") !== "discard") return response({ ok: false, error: "Unknown attachment action." }, 400);
    return response({ ok: true, result: await discardUnclaimedChatAttachment(actor, body.fileKey) });
  } catch (reason) {
    const status = Number((reason as { status?: number }).status ?? 500);
    return response({ ok: false, error: reason instanceof Error ? reason.message : "Attachment cleanup failed." }, status);
  }
}
