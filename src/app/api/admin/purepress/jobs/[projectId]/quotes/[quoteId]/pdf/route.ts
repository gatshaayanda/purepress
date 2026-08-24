import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import { buildPurePressQuotationPdf } from "@/lib/purepress/server/quotePdf";
import { getOwnerQuoteRevision } from "@/lib/purepress/server/quotes";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; quoteId: string }> },
) {
  try {
    await requirePurePressAdmin(request);
    const { projectId, quoteId } = await context.params;
    const quote = await getOwnerQuoteRevision(projectId, quoteId);
    if (!quote) return Response.json({ error: "Quotation not found." }, { status: 404, headers: { "Cache-Control": "no-store, private" } });
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
    const status = typeof reason === "object" && reason && "status" in reason ? Number((reason as { status?: number }).status) || 500 : 500;
    return Response.json({ error: status >= 500 ? "PurePress could not generate this quotation PDF." : "PurePress owner authorization is required." }, { status, headers: { "Cache-Control": "no-store, private" } });
  }
}
