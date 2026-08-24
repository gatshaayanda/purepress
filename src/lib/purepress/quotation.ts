import type {
  Customer,
  EmbroideryJob,
  QuotePlacement,
  SupplySource,
} from "./domain";

export const PUREPRESS_QUOTE_CURRENCY = "BWP" as const;
export const PUREPRESS_QUOTE_LINE_CATEGORIES = [
  "garment",
  "embroidery",
  "digitising",
  "design",
  "delivery",
  "other",
] as const;

export type PurePressQuoteCurrency = typeof PUREPRESS_QUOTE_CURRENCY;
export type PurePressQuoteLineCategory = (typeof PUREPRESS_QUOTE_LINE_CATEGORIES)[number];
export type PurePressQuoteRevisionStatus =
  | "draft"
  | "ready"
  | "issued"
  | "changes_requested"
  | "accepted"
  | "superseded"
  | "void";
export type PurePressQuoteDecisionSource = "secure_link" | "owner_recorded";
export type PurePressQuoteDecisionType = "accepted" | "changes_requested";
export type PurePressQuoteTaxMode = "none" | "percentage";
export type PurePressQuoteApprovalTokenState =
  | "active"
  | "accepted"
  | "changes_requested"
  | "superseded"
  | "disabled";

export interface PurePressQuoteLine {
  id: string;
  category: PurePressQuoteLineCategory;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface PurePressQuoteTaxNone {
  mode: "none";
}

export interface PurePressQuoteTaxPercentage {
  mode: "percentage";
  taxRateBps: number;
  taxLabel?: string;
}

export type PurePressQuoteTaxConfiguration = PurePressQuoteTaxNone | PurePressQuoteTaxPercentage;

export interface PurePressQuoteCustomerSnapshot {
  displayName: string;
  organisation?: string;
  email?: string;
  phone?: string;
}

export interface PurePressQuoteJobSnapshot {
  referenceCode: string;
  itemSummary: string;
  quantity?: number;
  supplySource: SupplySource;
  placements?: QuotePlacement[];
  customerRequestedDate?: string;
  customerTimingFlexible?: boolean;
}

export interface PurePressQuoteDecision {
  type: PurePressQuoteDecisionType;
  source: PurePressQuoteDecisionSource;
  revision: number;
  decidedAt: string;
  acceptingName?: string;
  comment?: string;
}

export interface PurePressQuoteApprovalAuthorization {
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  disabledAt?: string;
}

/**
 * Versioned commercial document. Operational lifecycle remains on projects/{projectId}.
 * Monetary source-of-truth values are integer BWP minor units (thebe).
 */
export interface PurePressQuote {
  id: string;
  projectId: string;
  quoteNumber: string;
  revision: number;
  currency: PurePressQuoteCurrency;
  status: PurePressQuoteRevisionStatus;
  customerSnapshot: PurePressQuoteCustomerSnapshot;
  jobSnapshot: PurePressQuoteJobSnapshot;
  lineItems: PurePressQuoteLine[];
  subtotalMinor: number;
  discountMinor: number;
  tax: PurePressQuoteTaxConfiguration;
  taxMinor: number;
  totalMinor: number;
  validUntil?: string;
  customerVisibleNotes?: string;
  paymentTerms?: string;
  fulfillmentNotes?: string;
  estimatedTurnaroundText?: string;
  estimatedCompletionDate?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
  issuedAt?: string;
  supersededAt?: string;
  decision?: PurePressQuoteDecision;
  approval?: PurePressQuoteApprovalAuthorization;
}

/** Lightweight pointers/facts only; no mutable price duplication on the job. */
export interface PurePressProjectQuoteState {
  quoteNumber?: string;
  latestRevision: number;
  latestQuoteId?: string;
  draftQuoteId?: string;
  draftRevision?: number;
  draftStatus?: "draft" | "ready";
  currentIssuedQuoteId?: string;
  currentIssuedRevision?: number;
  currentIssuedStatus?: "issued" | "changes_requested" | "accepted" | "superseded";
  currentValidUntil?: string;
  updatedAt: string;
}

export interface PurePressQuoteDraftInput {
  lineItems: Array<{
    id?: string;
    category: PurePressQuoteLineCategory;
    description: string;
    quantity: number;
    unitPriceMinor: number;
  }>;
  discountMinor: number;
  tax: PurePressQuoteTaxConfiguration;
  validUntil?: string;
  customerVisibleNotes?: string;
  paymentTerms?: string;
  fulfillmentNotes?: string;
  estimatedTurnaroundText?: string;
  estimatedCompletionDate?: string;
  internalNotes?: string;
}

export interface PurePressQuoteTotals {
  lineItems: PurePressQuoteLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface PublicPurePressQuoteView {
  quoteNumber: string;
  revision: number;
  currency: PurePressQuoteCurrency;
  state: "issued" | "changes_requested" | "accepted" | "superseded" | "expired";
  customer: PurePressQuoteCustomerSnapshot;
  job: PurePressQuoteJobSnapshot;
  lineItems: PurePressQuoteLine[];
  subtotalMinor: number;
  discountMinor: number;
  tax?: { label: string; ratePercent: string; amountMinor: number };
  totalMinor: number;
  issueDate?: string;
  validUntil?: string;
  customerVisibleNotes?: string;
  paymentTerms?: string;
  fulfillmentNotes?: string;
  estimatedTurnaroundText?: string;
  estimatedCompletionDate?: string;
  decision?: {
    type: PurePressQuoteDecisionType;
    source: PurePressQuoteDecisionSource;
    decidedAt: string;
    acceptingName?: string;
    comment?: string;
  };
  canAccept: boolean;
  canRequestChanges: boolean;
}

export const PUREPRESS_QUOTE_MAX_LINES = 50;
export const PUREPRESS_QUOTE_MAX_QUANTITY = 100_000;
export const PUREPRESS_QUOTE_MAX_UNIT_PRICE_MINOR = 100_000_000;
export const PUREPRESS_QUOTE_MAX_DISCOUNT_MINOR = 1_000_000_000_000;
export const PUREPRESS_QUOTE_MAX_DESCRIPTION = 240;
export const PUREPRESS_QUOTE_MAX_NOTE = 2_000;
export const PUREPRESS_QUOTE_MAX_INTERNAL_NOTE = 4_000;
export const PUREPRESS_QUOTE_MAX_TAX_BPS = 10_000;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export class PurePressQuoteValidationError extends Error {
  readonly status = 400;
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "PurePressQuoteValidationError";
    this.field = field;
  }
}

function asRecord(value: unknown, field = "body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PurePressQuoteValidationError(`${field} must be an object.`, field);
  }
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, max: number, field: string, required = false) {
  const cleaned = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (required && !cleaned) throw new PurePressQuoteValidationError(`${field} is required.`, field);
  if (cleaned.length > max) throw new PurePressQuoteValidationError(`${field} is too long.`, field);
  return cleaned;
}

function integer(value: unknown, min: number, max: number, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new PurePressQuoteValidationError(`${field} must be a whole number between ${min} and ${max}.`, field);
  }
  return value;
}

function dateOnly(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PurePressQuoteValidationError(`${field} must use YYYY-MM-DD.`, field);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new PurePressQuoteValidationError(`${field} is not a valid date.`, field);
  }
  return value;
}

function quoteLineCategory(value: unknown, field: string): PurePressQuoteLineCategory {
  if (typeof value !== "string" || !(PUREPRESS_QUOTE_LINE_CATEGORIES as readonly string[]).includes(value)) {
    throw new PurePressQuoteValidationError(`${field} has an invalid category.`, field);
  }
  return value as PurePressQuoteLineCategory;
}

function safeNumber(value: bigint, field: string) {
  if (value < BigInt(0) || value > MAX_SAFE_BIGINT) {
    throw new PurePressQuoteValidationError(`${field} exceeds the supported money range.`, field);
  }
  return Number(value);
}

export function lineTotalMinor(quantity: number, unitPriceMinor: number) {
  integer(quantity, 1, PUREPRESS_QUOTE_MAX_QUANTITY, "quantity");
  integer(unitPriceMinor, 0, PUREPRESS_QUOTE_MAX_UNIT_PRICE_MINOR, "unitPriceMinor");
  return safeNumber(BigInt(quantity) * BigInt(unitPriceMinor), "lineTotalMinor");
}

export function calculatePercentageTaxMinor(discountedSubtotalMinor: number, taxRateBps: number) {
  integer(discountedSubtotalMinor, 0, Number.MAX_SAFE_INTEGER, "discountedSubtotalMinor");
  integer(taxRateBps, 1, PUREPRESS_QUOTE_MAX_TAX_BPS, "tax.taxRateBps");
  const numerator = BigInt(discountedSubtotalMinor) * BigInt(taxRateBps);
  // Deterministic integer rounding to nearest minor unit, half up.
  return safeNumber((numerator + BigInt(5000)) / BigInt(10000), "taxMinor");
}

export function calculateQuoteTotals(
  rawLines: PurePressQuoteDraftInput["lineItems"],
  discountMinor: number,
  tax: PurePressQuoteTaxConfiguration,
): PurePressQuoteTotals {
  if (!Array.isArray(rawLines) || rawLines.length > PUREPRESS_QUOTE_MAX_LINES) {
    throw new PurePressQuoteValidationError(`lineItems may contain at most ${PUREPRESS_QUOTE_MAX_LINES} entries.`, "lineItems");
  }
  const lineItems = rawLines.map((line, index): PurePressQuoteLine => {
    const quantity = integer(line.quantity, 1, PUREPRESS_QUOTE_MAX_QUANTITY, `lineItems[${index}].quantity`);
    const unitPriceMinor = integer(line.unitPriceMinor, 0, PUREPRESS_QUOTE_MAX_UNIT_PRICE_MINOR, `lineItems[${index}].unitPriceMinor`);
    return {
      id: boundedText(line.id, 80, `lineItems[${index}].id`) || `line-${index + 1}`,
      category: quoteLineCategory(line.category, `lineItems[${index}].category`),
      description: boundedText(line.description, PUREPRESS_QUOTE_MAX_DESCRIPTION, `lineItems[${index}].description`, true),
      quantity,
      unitPriceMinor,
      lineTotalMinor: lineTotalMinor(quantity, unitPriceMinor),
    };
  });
  let subtotal = BigInt(0);
  for (const line of lineItems) subtotal += BigInt(line.lineTotalMinor);
  const subtotalMinor = safeNumber(subtotal, "subtotalMinor");
  const boundedDiscount = integer(discountMinor, 0, PUREPRESS_QUOTE_MAX_DISCOUNT_MINOR, "discountMinor");
  if (boundedDiscount > subtotalMinor) {
    throw new PurePressQuoteValidationError("discountMinor cannot exceed the quotation subtotal.", "discountMinor");
  }
  const discountedSubtotalMinor = subtotalMinor - boundedDiscount;
  const taxMinor = tax.mode === "percentage"
    ? calculatePercentageTaxMinor(discountedSubtotalMinor, tax.taxRateBps)
    : 0;
  const totalMinor = safeNumber(BigInt(discountedSubtotalMinor) + BigInt(taxMinor), "totalMinor");
  return { lineItems, subtotalMinor, discountMinor: boundedDiscount, taxMinor, totalMinor };
}

function parseTax(value: unknown): PurePressQuoteTaxConfiguration {
  const tax = asRecord(value, "tax");
  const keys = Object.keys(tax);
  for (const key of keys) {
    if (!["mode", "taxRateBps", "taxLabel"].includes(key)) {
      throw new PurePressQuoteValidationError(`tax.${key} is not accepted.`, `tax.${key}`);
    }
  }
  if (tax.mode === "none") return { mode: "none" };
  if (tax.mode !== "percentage") {
    throw new PurePressQuoteValidationError("tax.mode must be none or percentage.", "tax.mode");
  }
  const taxRateBps = integer(tax.taxRateBps, 1, PUREPRESS_QUOTE_MAX_TAX_BPS, "tax.taxRateBps");
  const taxLabel = boundedText(tax.taxLabel, 40, "tax.taxLabel");
  return { mode: "percentage", taxRateBps, ...(taxLabel ? { taxLabel } : {}) };
}

function parseLines(value: unknown): PurePressQuoteDraftInput["lineItems"] {
  if (!Array.isArray(value) || value.length > PUREPRESS_QUOTE_MAX_LINES) {
    throw new PurePressQuoteValidationError(`lineItems may contain at most ${PUREPRESS_QUOTE_MAX_LINES} entries.`, "lineItems");
  }
  return value.map((entry, index) => {
    const line = asRecord(entry, `lineItems[${index}]`);
    for (const key of Object.keys(line)) {
      if (!["id", "category", "description", "quantity", "unitPriceMinor"].includes(key)) {
        throw new PurePressQuoteValidationError(`lineItems[${index}].${key} is not accepted.`, `lineItems[${index}].${key}`);
      }
    }
    const id = boundedText(line.id, 80, `lineItems[${index}].id`);
    return {
      ...(id ? { id } : {}),
      category: quoteLineCategory(line.category, `lineItems[${index}].category`),
      description: boundedText(line.description, PUREPRESS_QUOTE_MAX_DESCRIPTION, `lineItems[${index}].description`, true),
      quantity: integer(line.quantity, 1, PUREPRESS_QUOTE_MAX_QUANTITY, `lineItems[${index}].quantity`),
      unitPriceMinor: integer(line.unitPriceMinor, 0, PUREPRESS_QUOTE_MAX_UNIT_PRICE_MINOR, `lineItems[${index}].unitPriceMinor`),
    };
  });
}

export function parseQuoteDraftInput(value: unknown): PurePressQuoteDraftInput {
  const input = asRecord(value);
  const allowed = new Set([
    "lineItems",
    "discountMinor",
    "tax",
    "validUntil",
    "customerVisibleNotes",
    "paymentTerms",
    "fulfillmentNotes",
    "estimatedTurnaroundText",
    "estimatedCompletionDate",
    "internalNotes",
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new PurePressQuoteValidationError(`${key} is not an accepted quotation draft field.`, key);
  }
  const lineItems = parseLines(input.lineItems ?? []);
  const discountMinor = integer(input.discountMinor ?? 0, 0, PUREPRESS_QUOTE_MAX_DISCOUNT_MINOR, "discountMinor");
  const tax = input.tax === undefined ? { mode: "none" as const } : parseTax(input.tax);
  // Run arithmetic now so malformed/overflowing drafts are rejected before persistence.
  calculateQuoteTotals(lineItems, discountMinor, tax);
  const validUntil = dateOnly(input.validUntil, "validUntil");
  const estimatedCompletionDate = dateOnly(input.estimatedCompletionDate, "estimatedCompletionDate");
  const customerVisibleNotes = boundedText(input.customerVisibleNotes, PUREPRESS_QUOTE_MAX_NOTE, "customerVisibleNotes");
  const paymentTerms = boundedText(input.paymentTerms, PUREPRESS_QUOTE_MAX_NOTE, "paymentTerms");
  const fulfillmentNotes = boundedText(input.fulfillmentNotes, PUREPRESS_QUOTE_MAX_NOTE, "fulfillmentNotes");
  const estimatedTurnaroundText = boundedText(input.estimatedTurnaroundText, 500, "estimatedTurnaroundText");
  const internalNotes = boundedText(input.internalNotes, PUREPRESS_QUOTE_MAX_INTERNAL_NOTE, "internalNotes");
  return {
    lineItems,
    discountMinor,
    tax,
    ...(validUntil ? { validUntil } : {}),
    ...(customerVisibleNotes ? { customerVisibleNotes } : {}),
    ...(paymentTerms ? { paymentTerms } : {}),
    ...(fulfillmentNotes ? { fulfillmentNotes } : {}),
    ...(estimatedTurnaroundText ? { estimatedTurnaroundText } : {}),
    ...(estimatedCompletionDate ? { estimatedCompletionDate } : {}),
    ...(internalNotes ? { internalNotes } : {}),
  };
}

export function assertQuoteReadyForIssue(quote: PurePressQuote, today: string) {
  if (quote.status !== "ready") {
    throw new PurePressQuoteValidationError("Only a commercially ready quotation can be issued.", "status");
  }
  if (quote.lineItems.length < 1) {
    throw new PurePressQuoteValidationError("Add at least one quotation line before issue.", "lineItems");
  }
  if (!quote.validUntil) {
    throw new PurePressQuoteValidationError("Set a valid-until date before issue.", "validUntil");
  }
  if (quote.validUntil < today) {
    throw new PurePressQuoteValidationError("The quotation valid-until date has already passed.", "validUntil");
  }
  // Recalculate to prove persisted totals agree with the persisted commercial inputs.
  const totals = calculateQuoteTotals(quote.lineItems, quote.discountMinor, quote.tax);
  if (
    totals.subtotalMinor !== quote.subtotalMinor ||
    totals.taxMinor !== quote.taxMinor ||
    totals.totalMinor !== quote.totalMinor
  ) {
    throw new PurePressQuoteValidationError("Quotation totals do not match the commercial lines.", "totals");
  }
}

export function customerSnapshotFrom(customer: Customer | null | undefined): PurePressQuoteCustomerSnapshot {
  const visible = customer?.customerVisible;
  return {
    displayName: visible?.displayName?.trim() || "PurePress customer",
    ...(visible?.companyName?.trim() ? { organisation: visible.companyName.trim() } : {}),
    ...(visible?.email?.trim() ? { email: visible.email.trim() } : {}),
    ...(visible?.phone?.trim() ? { phone: visible.phone.trim() } : {}),
  };
}

export function jobSnapshotFrom(job: EmbroideryJob): PurePressQuoteJobSnapshot {
  return {
    referenceCode: job.referenceCode,
    itemSummary: job.customerVisible.customItemDescription || job.customerVisible.title,
    ...(job.customerVisible.quantity ? { quantity: job.customerVisible.quantity } : {}),
    supplySource: job.supplySource ?? "unknown",
    ...(job.customerVisible.placements?.length ? { placements: job.customerVisible.placements } : {}),
    ...(job.customerVisible.requestedDate ? { customerRequestedDate: job.customerVisible.requestedDate } : {}),
    ...(typeof job.customerVisible.timingFlexible === "boolean" ? { customerTimingFlexible: job.customerVisible.timingFlexible } : {}),
  };
}

export function isQuoteExpired(quote: Pick<PurePressQuote, "validUntil">, today: string) {
  return Boolean(quote.validUntil && quote.validUntil < today);
}

export function quotationDeskLabel(
  state: PurePressProjectQuoteState | undefined,
  today: string,
) {
  if (!state || state.latestRevision < 1) return "No quote";
  const draft = state.draftRevision
    ? `${state.draftStatus === "ready" ? "Ready" : "Draft"} R${state.draftRevision}`
    : "";
  let issued = "";
  if (state.currentIssuedRevision) {
    if (state.currentIssuedStatus === "accepted") issued = `Accepted R${state.currentIssuedRevision}`;
    else if (state.currentIssuedStatus === "changes_requested") issued = `Changes requested R${state.currentIssuedRevision}`;
    else if (state.currentValidUntil && state.currentValidUntil < today) issued = `Expired R${state.currentIssuedRevision}`;
    else issued = `Awaiting customer R${state.currentIssuedRevision}`;
  }
  return [draft, issued].filter(Boolean).join(" · ") || `Revision ${state.latestRevision}`;
}

export function publicQuoteView(quote: PurePressQuote, today: string): PublicPurePressQuoteView {
  const expired = isQuoteExpired(quote, today);
  const state: PublicPurePressQuoteView["state"] = expired && quote.status === "issued"
    ? "expired"
    : quote.status === "changes_requested"
      ? "changes_requested"
      : quote.status === "accepted"
        ? "accepted"
        : quote.status === "superseded"
          ? "superseded"
          : "issued";
  const canDecide = quote.status === "issued" && !expired;
  return {
    quoteNumber: quote.quoteNumber,
    revision: quote.revision,
    currency: quote.currency,
    state,
    customer: quote.customerSnapshot,
    job: quote.jobSnapshot,
    lineItems: quote.lineItems,
    subtotalMinor: quote.subtotalMinor,
    discountMinor: quote.discountMinor,
    ...(quote.tax.mode === "percentage"
      ? {
          tax: {
            label: quote.tax.taxLabel || "Tax",
            ratePercent: (quote.tax.taxRateBps / 100).toFixed(2).replace(/\.00$/, ""),
            amountMinor: quote.taxMinor,
          },
        }
      : {}),
    totalMinor: quote.totalMinor,
    ...(quote.issuedAt ? { issueDate: quote.issuedAt.slice(0, 10) } : {}),
    ...(quote.validUntil ? { validUntil: quote.validUntil } : {}),
    ...(quote.customerVisibleNotes ? { customerVisibleNotes: quote.customerVisibleNotes } : {}),
    ...(quote.paymentTerms ? { paymentTerms: quote.paymentTerms } : {}),
    ...(quote.fulfillmentNotes ? { fulfillmentNotes: quote.fulfillmentNotes } : {}),
    ...(quote.estimatedTurnaroundText ? { estimatedTurnaroundText: quote.estimatedTurnaroundText } : {}),
    ...(quote.estimatedCompletionDate ? { estimatedCompletionDate: quote.estimatedCompletionDate } : {}),
    ...(quote.decision
      ? {
          decision: {
            type: quote.decision.type,
            source: quote.decision.source,
            decidedAt: quote.decision.decidedAt,
            ...(quote.decision.acceptingName ? { acceptingName: quote.decision.acceptingName } : {}),
            ...(quote.decision.comment ? { comment: quote.decision.comment } : {}),
          },
        }
      : {}),
    canAccept: canDecide,
    canRequestChanges: canDecide,
  };
}

export function formatBwp(minor: number) {
  integer(minor, 0, Number.MAX_SAFE_INTEGER, "minor");
  const pula = Math.floor(minor / 100);
  const thebe = String(minor % 100).padStart(2, "0");
  return `P ${pula.toLocaleString("en-BW")}.${thebe}`;
}
