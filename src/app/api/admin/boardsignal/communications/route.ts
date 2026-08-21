import { NextResponse } from "next/server";
import type { CommunicationCampaignDraft } from "@/lib/boardsignal/communications";
import {
  founderConversation,
  founderReply,
  listFounderCommunications,
  previewFounderCampaign,
  sendFounderCampaign,
  sendFounderTestBrowserAlert,
} from "@/lib/boardsignal/server/communications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const uid = url.searchParams.get("uid");
    const threadId = url.searchParams.get("threadId");
    if (uid && threadId) return response({ ok: true, conversation: await founderConversation(uid, threadId) });
    return response({ ok: true, ...(await listFounderCommunications()) });
  } catch (reason) {
    const status = Number((reason as { status?: number }).status ?? 500);
    return response({ ok: false, error: reason instanceof Error ? reason.message : "Founder Communications could not be loaded." }, status);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "preview") return response({ ok: true, preview: await previewFounderCampaign(body.draft as CommunicationCampaignDraft) });
    if (action === "send") return response({ ok: true, campaign: await sendFounderCampaign(body.draft as CommunicationCampaignDraft) });
    if (action === "reply") return response({ ok: true, result: await founderReply(body.uid, body.threadId, body.body, body.attachment, body.clientMessageId) });
    if (action === "testPush") return response({ ok: true, result: await sendFounderTestBrowserAlert(body.uid) });
    return response({ ok: false, error: "Unknown communications action." }, 400);
  } catch (reason) {
    const status = Number((reason as { status?: number }).status ?? 500);
    return response({ ok: false, error: reason instanceof Error ? reason.message : "Founder Communications action failed." }, status);
  }
}
