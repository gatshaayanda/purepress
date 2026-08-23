import { NextResponse } from "next/server";
import { QuoteIntakeValidationError } from "@/lib/purepress/quoteIntake";
import { createPublicQuoteRequest } from "@/lib/purepress/server/quoteRequests";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Quote request is too large." }, { status: 413 });
    }
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Quote request is too large." }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Quote request body is not valid JSON." }, { status: 400 });
    }

    const result = await createPublicQuoteRequest(body, {
      intakeId: request.headers.get("x-purepress-intake-id") ?? undefined,
      token: request.headers.get("x-purepress-intake-token") ?? undefined,
    });
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (reason) {
    const knownStatus = reason instanceof QuoteIntakeValidationError
      ? reason.status
      : typeof reason === "object" && reason && "status" in reason
        ? Number((reason as { status?: number }).status) || 400
        : 500;
    return NextResponse.json(
      {
        error: knownStatus >= 500
          ? "PurePress could not save the quote request. Please try again."
          : reason instanceof Error ? reason.message : "Quote request was rejected.",
        ...(reason instanceof QuoteIntakeValidationError && reason.field ? { field: reason.field } : {}),
      },
      { status: knownStatus, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Quote requests are not publicly readable." }, { status: 405 });
}
