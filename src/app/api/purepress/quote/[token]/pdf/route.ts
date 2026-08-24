import { buildPurePressQuotationPdf } from "@/lib/purepress/server/quotePdf";
import { getPublicQuoteRevisionByToken } from "@/lib/purepress/server/quotes";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const quote = await getPublicQuoteRevisionByToken(token);
    const pdf = buildPurePressQuotationPdf(quote);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${quote.quoteNumber}-R${quote.revision}.pdf"`,
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (reason) {
    const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status?: number }).status) || 404 : 404;
    return Response.json({ error: status === 410 ? "This quotation link is no longer active." : "Quotation PDF was not found." }, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  }
}
