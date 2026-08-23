import type {
  EmbroideryJob,
  FulfillmentIntent,
  QuoteItemCategory,
  QuotePlacement,
  QuoteRequest,
  SupplySource,
} from "./domain";
import type {
  ArtworkReadiness,
  ItemReadiness,
  JobReadiness,
  OperationalNextAction,
  ReadinessArea,
} from "./readiness";
import type { PurePressOrderStatus } from "./orderStatus";
import {
  FULFILLMENT_INTENTS,
  QUOTE_ITEM_CATEGORIES,
  QUOTE_PLACEMENTS,
  SUPPLY_SOURCES,
} from "./quoteIntake";

export const PATCH_D_MUTABLE_STATUSES = [
  "new_request",
  "needs_information",
  "cancelled",
] as const satisfies readonly PurePressOrderStatus[];

export const PATCH_D_ITEM_READINESS = [
  "unknown",
  "customer_supplied",
  "needs_procurement",
  "received",
  "issue",
] as const satisfies readonly ItemReadiness[];

export const PATCH_D_ARTWORK_READINESS = [
  "missing",
  "received",
  "needs_cleanup",
  "needs_digitizing",
  "issue",
] as const satisfies readonly ArtworkReadiness[];

export const NEXT_ACTION_ACTORS = ["owner", "customer", "supplier", "system"] as const;
export const READINESS_AREAS = ["payment", "items", "artwork", "proof", "sample", "production", "qc"] as const;

export class PurePressJobValidationError extends Error {
  readonly status = 400;
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "PurePressJobValidationError";
    this.field = field;
  }
}

function record(value: unknown, field = "body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PurePressJobValidationError(`${field} must be an object.`, field);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number, field: string, required = false) {
  const cleaned = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (required && !cleaned) throw new PurePressJobValidationError(`${field} is required.`, field);
  if (cleaned.length > max) throw new PurePressJobValidationError(`${field} is too long.`, field);
  return cleaned;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new PurePressJobValidationError(`${field} has an invalid value.`, field);
  }
  return value as T;
}

function dateOnly(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PurePressJobValidationError(`${field} must use YYYY-MM-DD.`, field);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new PurePressJobValidationError(`${field} is not a valid date.`, field);
  }
  return value;
}

function normalizeEmail(value: unknown, required = false) {
  const email = text(value, 254, "email", required).toLowerCase();
  if (!email) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PurePressJobValidationError("email is invalid.", "email");
  }
  return email;
}

function normalizePhone(value: unknown) {
  const raw = text(value, 40, "phone");
  if (!raw) return undefined;
  const normalized = raw.replace(/(?!^)\+/g, "").replace(/[^\d+]/g, "");
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 20) {
    throw new PurePressJobValidationError("phone is invalid.", "phone");
  }
  return normalized;
}

function placements(value: unknown): QuotePlacement[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new PurePressJobValidationError("placements must contain between 1 and 8 entries.", "placements");
  }
  return value.map((entry, index) => {
    const item = record(entry, `placements[${index}]`);
    for (const key of Object.keys(item)) {
      if (key !== "position" && key !== "notes") {
        throw new PurePressJobValidationError(`placements[${index}].${key} is not accepted.`, `placements[${index}].${key}`);
      }
    }
    const notes = text(item.notes, 200, `placements[${index}].notes`);
    return {
      position: enumValue(item.position, QUOTE_PLACEMENTS, `placements[${index}].position`),
      ...(notes ? { notes } : {}),
    };
  });
}

export function initialReadinessFromQuote(quote: Pick<QuoteRequest, "customerVisible">): JobReadiness {
  const supply = quote.customerVisible.supplySource ?? "unknown";
  const items: ItemReadiness = supply === "customer_supplied"
    ? "customer_supplied"
    : supply === "purepress_supplied"
      ? "needs_procurement"
      : "unknown";
  const artwork: ArtworkReadiness = quote.customerVisible.artworkFileIds?.length ? "received" : "missing";
  return {
    payment: "not_required_yet",
    items,
    artwork,
    proof: "not_started",
    sample: "not_required",
    production: "not_ready",
    qc: "not_started",
  };
}

export function initialReadinessFromOwnerJob(input: Pick<OwnerCreatedJobInput, "supplySource">): JobReadiness {
  const items: ItemReadiness = input.supplySource === "customer_supplied"
    ? "customer_supplied"
    : input.supplySource === "purepress_supplied"
      ? "needs_procurement"
      : "unknown";
  return {
    payment: "not_required_yet",
    items,
    artwork: "missing",
    proof: "not_started",
    sample: "not_required",
    production: "not_ready",
    qc: "not_started",
  };
}

export function parseNextAction(value: unknown): OperationalNextAction {
  const input = record(value, "nextAction");
  const allowed = new Set(["actor", "action", "dueAt", "readinessArea", "blocker"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new PurePressJobValidationError(`nextAction.${key} is not accepted.`, `nextAction.${key}`);
  }
  const dueAt = dateOnly(input.dueAt, "nextAction.dueAt");
  const readinessArea = input.readinessArea === undefined || input.readinessArea === ""
    ? undefined
    : enumValue(input.readinessArea, READINESS_AREAS, "nextAction.readinessArea") as ReadinessArea;
  const blocker = text(input.blocker, 300, "nextAction.blocker");
  return {
    actor: enumValue(input.actor, NEXT_ACTION_ACTORS, "nextAction.actor"),
    action: text(input.action, 240, "nextAction.action", true),
    ...(dueAt ? { dueAt } : {}),
    ...(readinessArea ? { readinessArea } : {}),
    ...(blocker ? { blocker } : {}),
  };
}

export interface OwnerCreatedJobInput {
  customerName: string;
  organisation?: string;
  email?: string;
  phone?: string;
  itemCategory: QuoteItemCategory;
  customItemDescription?: string;
  supplySource: SupplySource;
  quantity: number;
  sizeBreakdown?: string;
  itemColours?: string[];
  placements: QuotePlacement[];
  requestedDate?: string;
  timingFlexible: boolean;
  fulfillmentIntent?: FulfillmentIntent;
  customerNotes?: string;
  internalNotes?: string;
  status: "new_request" | "needs_information";
}

export function parseOwnerCreatedJob(value: unknown): OwnerCreatedJobInput {
  const input = record(value);
  const allowed = new Set([
    "customerName", "organisation", "email", "phone", "itemCategory", "customItemDescription",
    "supplySource", "quantity", "sizeBreakdown", "itemColours", "placements", "requestedDate",
    "timingFlexible", "fulfillmentIntent", "customerNotes", "internalNotes", "status",
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new PurePressJobValidationError(`${key} is not accepted for an owner-created job.`, key);
  }
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) throw new PurePressJobValidationError("Provide an email address or phone number.", "contact");
  const itemCategory = enumValue(input.itemCategory, QUOTE_ITEM_CATEGORIES, "itemCategory");
  const customItemDescription = text(input.customItemDescription, 300, "customItemDescription");
  if (itemCategory === "custom" && !customItemDescription) {
    throw new PurePressJobValidationError("customItemDescription is required for a custom item.", "customItemDescription");
  }
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    throw new PurePressJobValidationError("quantity must be a whole number between 1 and 100000.", "quantity");
  }
  const timingFlexible = input.timingFlexible === true;
  const requestedDate = dateOnly(input.requestedDate, "requestedDate");
  if (!timingFlexible && !requestedDate) {
    throw new PurePressJobValidationError("Choose a requested date or mark timing flexible.", "requestedDate");
  }
  let colours: string[] | undefined;
  if (input.itemColours !== undefined) {
    if (!Array.isArray(input.itemColours) || input.itemColours.length > 12) {
      throw new PurePressJobValidationError("itemColours must contain at most 12 entries.", "itemColours");
    }
    const cleaned = input.itemColours.map((entry, index) => text(entry, 50, `itemColours[${index}]`)).filter(Boolean);
    if (cleaned.length) colours = cleaned;
  }
  const fulfillmentIntent = input.fulfillmentIntent === undefined || input.fulfillmentIntent === ""
    ? undefined
    : enumValue(input.fulfillmentIntent, FULFILLMENT_INTENTS, "fulfillmentIntent");
  const status = input.status === undefined || input.status === ""
    ? "new_request"
    : enumValue(input.status, ["new_request", "needs_information"] as const, "status");
  const organisation = text(input.organisation, 160, "organisation");
  const sizeBreakdown = text(input.sizeBreakdown, 500, "sizeBreakdown");
  const customerNotes = text(input.customerNotes, 1500, "customerNotes");
  const internalNotes = text(input.internalNotes, 4000, "internalNotes");
  return {
    customerName: text(input.customerName, 120, "customerName", true),
    ...(organisation ? { organisation } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    itemCategory,
    ...(customItemDescription ? { customItemDescription } : {}),
    supplySource: enumValue(input.supplySource, SUPPLY_SOURCES, "supplySource"),
    quantity,
    ...(sizeBreakdown ? { sizeBreakdown } : {}),
    ...(colours ? { itemColours: colours } : {}),
    placements: placements(input.placements),
    ...(requestedDate ? { requestedDate } : {}),
    timingFlexible,
    ...(fulfillmentIntent ? { fulfillmentIntent } : {}),
    ...(customerNotes ? { customerNotes } : {}),
    ...(internalNotes ? { internalNotes } : {}),
    status,
  };
}

export interface JobPatch {
  nextAction?: OperationalNextAction | null;
  ownerNotes?: string;
  supplySource?: SupplySource;
  status?: PurePressOrderStatus;
  readiness?: Partial<Pick<JobReadiness, "items" | "artwork">>;
}

export function parseJobPatch(value: unknown): JobPatch {
  const input = record(value);
  const allowed = new Set(["nextAction", "ownerNotes", "supplySource", "status", "readiness"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new PurePressJobValidationError(`${key} is not an accepted Patch D job mutation.`, key);
  }
  const output: JobPatch = {};
  if (Object.hasOwn(input, "nextAction")) output.nextAction = input.nextAction === null ? null : parseNextAction(input.nextAction);
  if (Object.hasOwn(input, "ownerNotes")) output.ownerNotes = text(input.ownerNotes, 4000, "ownerNotes");
  if (Object.hasOwn(input, "supplySource")) output.supplySource = enumValue(input.supplySource, SUPPLY_SOURCES, "supplySource");
  if (Object.hasOwn(input, "status")) output.status = enumValue(input.status, PATCH_D_MUTABLE_STATUSES, "status");
  if (Object.hasOwn(input, "readiness")) {
    const readiness = record(input.readiness, "readiness");
    for (const key of Object.keys(readiness)) {
      if (key !== "items" && key !== "artwork") {
        throw new PurePressJobValidationError(`readiness.${key} is display-only in Patch D.`, `readiness.${key}`);
      }
    }
    output.readiness = {
      ...(Object.hasOwn(readiness, "items") ? { items: enumValue(readiness.items, PATCH_D_ITEM_READINESS, "readiness.items") } : {}),
      ...(Object.hasOwn(readiness, "artwork") ? { artwork: enumValue(readiness.artwork, PATCH_D_ARTWORK_READINESS, "readiness.artwork") } : {}),
    };
  }
  return output;
}

export interface JobDeskClassification {
  attention: boolean;
  waitingOnCustomer: boolean;
  inProduction: boolean;
  readyDueNext: boolean;
  attentionReasons: string[];
}

function dueDateRelation(dueAt: string | undefined, today: string) {
  if (!dueAt) return "none" as const;
  if (dueAt < today) return "past" as const;
  return "future" as const;
}

export function classifyJob(job: EmbroideryJob, now = new Date()): JobDeskClassification {
  const today = now.toISOString().slice(0, 10);
  const next = job.internal.nextAction;
  const due = dueDateRelation(next?.dueAt, today);
  const readiness = job.internal.readiness;
  const reasons: string[] = [];
  if (job.status === "new_request") reasons.push("new_request");
  if (next?.actor === "owner" && due === "past") reasons.push("overdue_owner_action");
  if (next?.blocker) reasons.push("blocker");
  if (readiness && Object.values(readiness).includes("issue")) reasons.push("readiness_issue");
  if (readiness?.artwork === "missing" && next?.actor !== "customer") reasons.push("artwork_missing");
  return {
    attention: !["completed", "cancelled"].includes(job.status) && reasons.length > 0,
    waitingOnCustomer:
      job.status === "needs_information" ||
      job.status === "awaiting_quote_approval" ||
      job.status === "awaiting_proof_approval" ||
      next?.actor === "customer",
    inProduction: job.status === "in_production" || job.status === "quality_check",
    readyDueNext: job.status === "ready" || due === "future",
    attentionReasons: reasons,
  };
}

export function conciseReadinessSignal(readiness?: JobReadiness) {
  if (!readiness) return "Readiness not recorded";
  const issues = Object.entries(readiness).filter(([, value]) => value === "issue").map(([area]) => area);
  if (issues.length) return `Issue: ${issues.join(", ")}`;
  if (readiness.artwork === "missing") return "Artwork missing";
  if (readiness.items === "needs_procurement") return "Items need procurement";
  if (readiness.production === "running") return "Production running";
  if (readiness.qc === "passed") return "QC passed";
  return `Items ${readiness.items.replaceAll("_", " ")} · Artwork ${readiness.artwork.replaceAll("_", " ")}`;
}
