import { NextResponse } from "next/server";
import { PurePressQuoteValidationError } from "@/lib/purepress/quotation";
import { decidePublicQuote } from "@/lib/purepress/server/quotes";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const bodyText = await request.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Quotation response is too large." }, { status: 413, headers: { "Cache-Control": "no-store, private" } });
    }
    const body = JSON.parse(bodyText);
    const { token } = await context.params;
    const result = await decidePublicQuote(token, body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch (reason) {
    const status = reason instanceof PurePressQuoteValidationError
      ? reason.status
      : reason instanceof SyntaxError
        ? 400
        : typeof reason === "object" && reason && "status" in reason
          ? Number((reason as { status?: number }).status) || 500
          : 500;
    return NextResponse.json({ error: status >= 500 ? "PurePress could not record this quotation response." : reason instanceof Error ? reason.message : "Quotation response was rejected." }, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  }
}
