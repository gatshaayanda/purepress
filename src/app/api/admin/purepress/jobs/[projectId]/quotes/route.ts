import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import {
  createOwnerQuoteDraft,
  getOwnerQuoteBundle,
} from "@/lib/purepress/server/quotes";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "no-store, private" };

function errorStatus(reason: unknown, fallback = 500) {
  return typeof reason === "object" && reason && "status" in reason
    ? Number((reason as { status?: number }).status) || fallback
    : fallback;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const { projectId } = await context.params;
    const bundle = await getOwnerQuoteBundle(projectId);
    if (!bundle) return NextResponse.json({ error: "PurePress job not found." }, { status: 404, headers: PRIVATE_HEADERS });
    return NextResponse.json(bundle, { headers: PRIVATE_HEADERS });
  } catch (reason) {
    const status = errorStatus(reason, 500);
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not load quotations." : reason instanceof Error ? reason.message : "Quotation access was rejected." },
      { status, headers: PRIVATE_HEADERS },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 2048) {
      return NextResponse.json({ error: "Quotation request is too large." }, { status: 413, headers: PRIVATE_HEADERS });
    }
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > 2048) {
      return NextResponse.json({ error: "Quotation request is too large." }, { status: 413, headers: PRIVATE_HEADERS });
    }
    const body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {};
    if (Object.keys(body).some((key) => key !== "action") || (body.action !== undefined && body.action !== "create_draft")) {
      return NextResponse.json({ error: "Only create_draft is accepted here." }, { status: 400, headers: PRIVATE_HEADERS });
    }
    const { projectId } = await context.params;
    const result = await createOwnerQuoteDraft(projectId);
    return NextResponse.json(result, { status: result.created ? 201 : 200, headers: PRIVATE_HEADERS });
  } catch (reason) {
    const status = reason instanceof SyntaxError ? 400 : errorStatus(reason, 500);
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not create the quotation draft." : reason instanceof Error ? reason.message : "Quotation draft was rejected." },
      { status, headers: PRIVATE_HEADERS },
    );
  }
}
