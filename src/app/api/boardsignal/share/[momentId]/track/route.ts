import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/utils/firebaseAdmin";
import { loadPublicShareMoment } from "@/lib/boardsignal/server/universePulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS = new Set(["share_viewed", "share_tapped", "cta_clicked", "beta_request_started", "beta_request_submitted"]);

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ momentId: string }> }) {
  try {
    const { momentId } = await params;
    const body = await request.json() as { eventType?: unknown; source?: unknown };
    const eventType = String(body.eventType ?? "");
    if (!EVENTS.has(eventType)) return response({ ok: false, error: "Unknown share attribution event." }, 400);
    const moment = await loadPublicShareMoment(momentId);
    if (!moment) return response({ ok: false, error: "Share Moment not found." }, 404);

    const source = body.source === "boardSignalShare" ? "boardSignalShare" : "boardSignalShare";
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
    const agent = request.headers.get("user-agent") ?? "unknown";
    const hour = new Date().toISOString().slice(0, 13);
    const anonymousKey = createHash("sha256").update(`${forwarded}:${agent}`).digest("hex").slice(0, 32);
    const id = createHash("sha256").update(`${momentId}:${eventType}:${hour}:${anonymousKey}`).digest("hex");
    await getAdminDb().collection("shareAttribution").doc(id).set({
      shareMomentId: momentId,
      eventType,
      source,
      occurredAt: new Date().toISOString(),
      anonymousKey,
    }, { merge: true });
    return response({ ok: true });
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : "Share attribution could not be recorded." }, 500);
  }
}
