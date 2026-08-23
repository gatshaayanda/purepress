import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import { convertQuoteToOperationalJob } from "@/lib/purepress/server/jobs";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const { id } = await context.params;
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Conversion request is too large." }, { status: 413 });
    }
    const body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {};
    for (const key of Object.keys(body)) {
      if (key !== "existingCustomerId") {
        return NextResponse.json({ error: `${key} is not accepted for quote conversion.` }, { status: 400 });
      }
    }
    const existingCustomerId = typeof body.existingCustomerId === "string" ? body.existingCustomerId.trim() : undefined;
    if (existingCustomerId && existingCustomerId.length > 128) {
      return NextResponse.json({ error: "existingCustomerId is too long." }, { status: 400 });
    }
    const result = await convertQuoteToOperationalJob(id, { existingCustomerId });
    return NextResponse.json(result, {
      status: result.created ? 201 : 200,
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason
      ? Number((reason as { status?: number }).status) || 400
      : reason instanceof SyntaxError ? 400 : 500;
    return NextResponse.json(
      { error: status >= 500 ? "PurePress could not create this job." : reason instanceof Error ? reason.message : "Job conversion was rejected." },
      { status, headers: { "Cache-Control": "no-store, private" } },
    );
  }
}
