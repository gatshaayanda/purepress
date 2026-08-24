import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import { PurePressQuoteValidationError } from "@/lib/purepress/quotation";
import {
  createOwnerQuoteRevision,
  getOwnerQuoteRevision,
  issueOwnerQuote,
  markOwnerQuoteReady,
  recordOwnerQuoteAcceptance,
  returnOwnerQuoteToDraft,
  rotateOwnerQuoteApprovalLink,
  saveOwnerQuoteDraft,
} from "@/lib/purepress/server/quotes";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 48 * 1024;
const PRIVATE_HEADERS = { "Cache-Control": "no-store, private" };

function statusOf(reason: unknown) {
  if (reason instanceof PurePressQuoteValidationError) return reason.status;
  if (reason instanceof SyntaxError) return 400;
  return typeof reason === "object" && reason && "status" in reason
    ? Number((reason as { status?: number }).status) || 500
    : 500;
}

function assertActionShape(body: Record<string, unknown>, action: string) {
  const allowed = action === "record_acceptance"
    ? new Set(["action", "confirmed", "acceptingName", "comment"])
    : new Set(["action"]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw new PurePressQuoteValidationError(`${key} is not accepted for ${action}.`, key);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; quoteId: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const { projectId, quoteId } = await context.params;
    const quote = await getOwnerQuoteRevision(projectId, quoteId);
    if (!quote) return NextResponse.json({ error: "Quotation not found." }, { status: 404, headers: PRIVATE_HEADERS });
    return NextResponse.json({ quote }, { headers: PRIVATE_HEADERS });
  } catch (reason) {
    const status = statusOf(reason);
    return NextResponse.json({ error: status >= 500 ? "PurePress could not load this quotation." : reason instanceof Error ? reason.message : "Quotation access was rejected." }, { status, headers: PRIVATE_HEADERS });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; quoteId: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Quotation draft is too large." }, { status: 413, headers: PRIVATE_HEADERS });
    }
    const body = JSON.parse(bodyText);
    const { projectId, quoteId } = await context.params;
    const result = await saveOwnerQuoteDraft(projectId, quoteId, body);
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (reason) {
    const status = statusOf(reason);
    return NextResponse.json({ error: status >= 500 ? "PurePress could not save this quotation." : reason instanceof Error ? reason.message : "Quotation update was rejected." }, { status, headers: PRIVATE_HEADERS });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; quoteId: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > 8 * 1024) {
      return NextResponse.json({ error: "Quotation action is too large." }, { status: 413, headers: PRIVATE_HEADERS });
    }
    const body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {};
    const action = typeof body.action === "string" ? body.action : "";
    if (!["mark_ready", "return_to_draft", "issue", "create_revision", "rotate_link", "record_acceptance"].includes(action)) {
      throw new PurePressQuoteValidationError("A supported quotation action is required.", "action");
    }
    assertActionShape(body, action);
    const { projectId, quoteId } = await context.params;
    const result = action === "mark_ready"
      ? await markOwnerQuoteReady(projectId, quoteId)
      : action === "return_to_draft"
        ? await returnOwnerQuoteToDraft(projectId, quoteId)
        : action === "issue"
          ? await issueOwnerQuote(projectId, quoteId)
          : action === "create_revision"
            ? await createOwnerQuoteRevision(projectId, quoteId)
            : action === "rotate_link"
              ? await rotateOwnerQuoteApprovalLink(projectId, quoteId)
              : await recordOwnerQuoteAcceptance(projectId, quoteId, {
                  confirmed: body.confirmed,
                  acceptingName: body.acceptingName,
                  comment: body.comment,
                });
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (reason) {
    const status = statusOf(reason);
    return NextResponse.json({ error: status >= 500 ? "PurePress could not complete this quotation action." : reason instanceof Error ? reason.message : "Quotation action was rejected." }, { status, headers: PRIVATE_HEADERS });
  }
}
