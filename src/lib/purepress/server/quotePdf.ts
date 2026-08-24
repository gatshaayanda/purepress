import "server-only";

import { jsPDF } from "jspdf";
import { formatBwp, type PurePressQuote } from "../quotation";

const CYAN = [0, 174, 239] as const;
const MAGENTA = [236, 22, 140] as const;
const YELLOW = [255, 229, 0] as const;
const CHARCOAL = [35, 38, 41] as const;
const MUTED = [92, 99, 105] as const;
const LIGHT = [242, 246, 247] as const;

function cleanPdfText(value: string | undefined) {
  return (value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

function placementSummary(quote: PurePressQuote) {
  return quote.jobSnapshot.placements?.map((placement) => {
    const base = placement.position.replaceAll("_", " ");
    return placement.notes ? `${base} — ${placement.notes}` : base;
  }).join("; ") || "";
}

export function buildPurePressQuotationPdf(quote: PurePressQuote) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 16;
  const right = pageWidth - 16;
  let y = 18;

  const ensure = (height: number) => {
    if (y + height <= pageHeight - 22) return;
    doc.addPage();
    y = 18;
    doc.setDrawColor(...CYAN);
    doc.setLineWidth(1.2);
    doc.line(left, 11, right, 11);
  };

  const textBlock = (label: string, value?: string) => {
    const safe = cleanPdfText(value);
    if (!safe) return;
    ensure(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), left, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...CHARCOAL);
    const lines = doc.splitTextToSize(safe, right - left);
    doc.text(lines, left, y);
    y += lines.length * 4.4 + 4;
  };

  // PurePress mark + identity. Vector artwork keeps the PDF self-contained and deterministic.
  doc.setFillColor(...CYAN);
  doc.roundedRect(left, y, 8, 8, 1.2, 1.2, "F");
  doc.setFillColor(...MAGENTA);
  doc.roundedRect(left + 9.5, y, 8, 8, 1.2, 1.2, "F");
  doc.setFillColor(...YELLOW);
  doc.roundedRect(left + 19, y, 8, 8, 1.2, 1.2, "F");
  doc.setTextColor(...CHARCOAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("PUREPRESS PRINTERS", left + 32, y + 4.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Your Vision, Fully Printed", left + 32, y + 9);
  y += 18;

  doc.setFillColor(...CHARCOAL);
  doc.rect(left, y, right - left, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("QUOTATION", left + 5, y + 9);
  doc.setFontSize(9);
  doc.text(`QUOTE: ${quote.quoteNumber} · REVISION ${quote.revision}`, left + 5, y + 16);
  doc.setFont("helvetica", "normal");
  const issueDate = quote.issuedAt ? quote.issuedAt.slice(0, 10) : "DRAFT";
  doc.text(`Issue: ${issueDate}`, right - 48, y + 8);
  doc.text(`Valid until: ${quote.validUntil || "Not set"}`, right - 48, y + 15);
  y += 29;

  doc.setTextColor(...CHARCOAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CUSTOMER", left, y);
  doc.text("JOB", left + 94, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const customerLines = [
    quote.customerSnapshot.displayName,
    quote.customerSnapshot.organisation,
    quote.customerSnapshot.email,
    quote.customerSnapshot.phone,
  ].filter(Boolean).map((value) => cleanPdfText(value));
  doc.text(customerLines, left, y);
  const jobLines = [
    `JOB: ${quote.jobSnapshot.referenceCode}`,
    quote.jobSnapshot.itemSummary,
    quote.jobSnapshot.quantity ? `${quote.jobSnapshot.quantity} item(s)` : undefined,
    `Supply: ${quote.jobSnapshot.supplySource.replaceAll("_", " ")}`,
  ].filter(Boolean).map((value) => cleanPdfText(value));
  doc.text(jobLines, left + 94, y);
  y += Math.max(customerLines.length, jobLines.length) * 4.6 + 7;

  const placement = placementSummary(quote);
  if (placement) textBlock("Placement", placement);
  if (quote.jobSnapshot.customerRequestedDate) {
    textBlock("Customer requested date", quote.jobSnapshot.customerRequestedDate);
  } else if (quote.jobSnapshot.customerTimingFlexible) {
    textBlock("Customer requested timing", "Flexible");
  }
  if (quote.estimatedCompletionDate) textBlock("Estimated completion", quote.estimatedCompletionDate);
  if (quote.estimatedTurnaroundText) textBlock("Estimated turnaround", quote.estimatedTurnaroundText);

  ensure(28);
  doc.setFillColor(...LIGHT);
  doc.rect(left, y, right - left, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...CHARCOAL);
  doc.text("DESCRIPTION", left + 2, y + 5.2);
  doc.text("QTY", right - 55, y + 5.2, { align: "right" });
  doc.text("UNIT", right - 28, y + 5.2, { align: "right" });
  doc.text("TOTAL", right - 2, y + 5.2, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const line of quote.lineItems) {
    const description = doc.splitTextToSize(cleanPdfText(line.description), 102);
    const rowHeight = Math.max(8, description.length * 4.2 + 2);
    ensure(rowHeight + 3);
    doc.setTextColor(...CHARCOAL);
    doc.text(description, left + 2, y + 3.8);
    doc.text(String(line.quantity), right - 55, y + 3.8, { align: "right" });
    doc.text(formatBwp(line.unitPriceMinor), right - 28, y + 3.8, { align: "right" });
    doc.text(formatBwp(line.lineTotalMinor), right - 2, y + 3.8, { align: "right" });
    doc.setDrawColor(220, 224, 226);
    doc.line(left, y + rowHeight, right, y + rowHeight);
    y += rowHeight + 2;
  }

  ensure(35);
  const totalX = right - 72;
  const totalValueX = right - 2;
  const moneyRow = (label: string, value: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(...CHARCOAL);
    doc.text(label, totalX, y, { align: "left" });
    doc.text(formatBwp(value), totalValueX, y, { align: "right" });
    y += bold ? 6.5 : 5;
  };
  moneyRow("Subtotal", quote.subtotalMinor);
  if (quote.discountMinor > 0) moneyRow("Discount", quote.discountMinor);
  if (quote.tax.mode === "percentage" && quote.taxMinor > 0) {
    const label = cleanPdfText(quote.tax.taxLabel) || "Tax";
    const rate = (quote.tax.taxRateBps / 100).toFixed(2).replace(/\.00$/, "");
    moneyRow(`${label} (${rate}%)`, quote.taxMinor);
  }
  doc.setDrawColor(...MAGENTA);
  doc.setLineWidth(0.8);
  doc.line(totalX, y - 2, right, y - 2);
  moneyRow("TOTAL BWP", quote.totalMinor, true);
  y += 3;

  textBlock("Payment terms", quote.paymentTerms);
  textBlock("Fulfilment / delivery", quote.fulfillmentNotes);
  textBlock("Quotation notes", quote.customerVisibleNotes);

  ensure(34);
  y = Math.max(y + 4, pageHeight - 34);
  doc.setDrawColor(...CYAN);
  doc.setLineWidth(1.2);
  doc.line(left, y, right, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...CHARCOAL);
  doc.text("PurePress Printers", left, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Plot 17879, Gaborone West · Gaborone, Botswana", left, y + 4.5);
  doc.text("purepressprinters@gmail.com · +267 78 013 297 · +267 77 116 195", left, y + 9);

  const output = doc.output("arraybuffer");
  return Buffer.from(output);
}
