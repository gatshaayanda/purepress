import type {
  FulfillmentIntent,
  PreferredContactMethod,
  QuoteArtworkState,
  QuoteItemCategory,
  QuotePlacement,
  QuotePlacementPosition,
  SupplySource,
} from "./domain";

export const QUOTE_ITEM_CATEGORIES = [
  "corporate_uniforms",
  "school_items",
  "team_wear",
  "shirts_polos",
  "jackets_workwear",
  "bags",
  "towels",
  "leather",
  "gifts_promotional",
  "custom",
] as const satisfies readonly QuoteItemCategory[];

export const SUPPLY_SOURCES = [
  "customer_supplied",
  "purepress_supplied",
  "mixed",
  "unknown",
] as const satisfies readonly SupplySource[];

export const QUOTE_PLACEMENTS = [
  "left_chest",
  "right_chest",
  "sleeve",
  "back",
  "badge_position",
  "pocket",
  "bag_towel_position",
  "other",
] as const satisfies readonly QuotePlacementPosition[];

export const QUOTE_ARTWORK_STATES = [
  "artwork_ready",
  "artwork_needs_work",
  "needs_design_help",
  "unsure",
] as const satisfies readonly QuoteArtworkState[];

export const PREFERRED_CONTACT_METHODS = [
  "email",
  "phone",
  "whatsapp",
] as const satisfies readonly PreferredContactMethod[];

export const FULFILLMENT_INTENTS = [
  "collect",
  "delivery_may_be_needed",
  "unsure",
] as const satisfies readonly FulfillmentIntent[];

const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  "itemCategory",
  "customItemDescription",
  "supplySource",
  "quantity",
  "sizeBreakdown",
  "itemColours",
  "placements",
  "artworkState",
  "artworkFileIds",
  "requestedDate",
  "timingFlexible",
  "contact",
  "fulfillmentIntent",
  "customerNotes",
  "processingAcknowledged",
]);

const ALLOWED_CONTACT_FIELDS = new Set([
  "fullName",
  "organisation",
  "email",
  "phone",
  "preferredContactMethod",
]);

const ALLOWED_PLACEMENT_FIELDS = new Set(["position", "notes"]);

const FORBIDDEN_CLIENT_FIELDS = new Set([
  "status",
  "source",
  "referenceCode",
  "createdAt",
  "updatedAt",
  "customerUid",
  "internal",
  "readiness",
  "production",
  "productionInformation",
  "publicMedia",
  "publicWorkMedia",
  "published",
  "publicationState",
  "adminIdentity",
  "admin",
  "adminNotes",
  "ownerNotes",
  "assignedProjectId",
  "assignedJobId",
  "projectId",
  "orderId",
  "promisedDate",
  "productionDueDate",
]);

export interface QuoteRequestSubmission {
  itemCategory: QuoteItemCategory;
  customItemDescription?: string;
  supplySource: SupplySource;
  quantity: number;
  sizeBreakdown?: string;
  itemColours?: string[];
  placements: QuotePlacement[];
  artworkState: QuoteArtworkState;
  artworkFileIds: string[];
  requestedDate?: string;
  timingFlexible: boolean;
  contact: {
    fullName: string;
    organisation?: string;
    email: string;
    phone?: string;
    preferredContactMethod: PreferredContactMethod;
  };
  fulfillmentIntent?: FulfillmentIntent;
  customerNotes?: string;
  processingAcknowledged: true;
}

export class QuoteIntakeValidationError extends Error {
  readonly status = 400;
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "QuoteIntakeValidationError";
    this.field = field;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QuoteIntakeValidationError("A valid quote request body is required.");
  }
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, maxLength: number, field: string, required = false) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (required && !text) throw new QuoteIntakeValidationError(`${field} is required.`, field);
  if (text.length > maxLength) throw new QuoteIntakeValidationError(`${field} is too long.`, field);
  return text;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new QuoteIntakeValidationError(`${field} has an invalid value.`, field);
  }
  return value as T;
}

function normalizeEmail(value: unknown) {
  const email = cleanText(value, 254, "Email", true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new QuoteIntakeValidationError("Enter a valid email address.", "email");
  }
  return email;
}

function normalizePhone(value: unknown, required: boolean) {
  const raw = cleanText(value, 40, "Phone", required);
  if (!raw) return undefined;
  const normalized = raw.replace(/(?!^)\+/g, "").replace(/[^\d+]/g, "");
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 20) {
    throw new QuoteIntakeValidationError("Enter a valid phone number.", "phone");
  }
  return normalized;
}

function validateDate(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new QuoteIntakeValidationError("Requested date must use YYYY-MM-DD.", "requestedDate");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new QuoteIntakeValidationError("Requested date is not valid.", "requestedDate");
  }
  return value;
}

function validatePlacements(value: unknown): QuotePlacement[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new QuoteIntakeValidationError("Choose between 1 and 8 embroidery placements.", "placements");
  }
  return value.map((raw, index) => {
    const item = asRecord(raw);
    for (const key of Object.keys(item)) {
      if (!ALLOWED_PLACEMENT_FIELDS.has(key)) {
        throw new QuoteIntakeValidationError(`placements[${index}].${key} is not an accepted quote intake field.`, `placements[${index}].${key}`);
      }
    }
    return {
      position: enumValue(item.position, QUOTE_PLACEMENTS, `placements[${index}].position`),
      ...(cleanText(item.notes, 200, `placements[${index}].notes`)
        ? { notes: cleanText(item.notes, 200, `placements[${index}].notes`) }
        : {}),
    };
  });
}

function validateColours(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > 12) {
    throw new QuoteIntakeValidationError("Item colours must contain at most 12 entries.", "itemColours");
  }
  const colours = value
    .map((entry, index) => cleanText(entry, 50, `itemColours[${index}]`))
    .filter(Boolean);
  return colours.length ? colours : undefined;
}

function validateFileIds(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 3) {
    throw new QuoteIntakeValidationError("At most 3 quote artwork files may be attached.", "artworkFileIds");
  }
  const ids = value.map((entry, index) => cleanText(entry, 120, `artworkFileIds[${index}]`, true));
  if (new Set(ids).size !== ids.length) {
    throw new QuoteIntakeValidationError("Artwork file references must be unique.", "artworkFileIds");
  }
  return ids;
}

export function parseQuoteRequestSubmission(value: unknown): QuoteRequestSubmission {
  const input = asRecord(value);
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_CLIENT_FIELDS.has(key)) {
      throw new QuoteIntakeValidationError(`${key} is server-controlled and cannot be supplied by the browser.`, key);
    }
    if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) {
      throw new QuoteIntakeValidationError(`${key} is not an accepted quote intake field.`, key);
    }
  }

  const contact = asRecord(input.contact);
  for (const key of Object.keys(contact)) {
    if (!ALLOWED_CONTACT_FIELDS.has(key)) {
      throw new QuoteIntakeValidationError(`contact.${key} is not an accepted quote intake field.`, `contact.${key}`);
    }
  }
  const preferredContactMethod = enumValue(
    contact.preferredContactMethod,
    PREFERRED_CONTACT_METHODS,
    "preferredContactMethod",
  );
  const phone = normalizePhone(
    contact.phone,
    preferredContactMethod === "phone" || preferredContactMethod === "whatsapp",
  );

  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    throw new QuoteIntakeValidationError("Quantity must be a whole number between 1 and 100000.", "quantity");
  }

  const itemCategory = enumValue(input.itemCategory, QUOTE_ITEM_CATEGORIES, "itemCategory");
  const customItemDescription = cleanText(input.customItemDescription, 300, "customItemDescription");
  if (itemCategory === "custom" && !customItemDescription) {
    throw new QuoteIntakeValidationError("Tell us what custom item you want branded.", "customItemDescription");
  }

  const timingFlexible = input.timingFlexible === true;
  const requestedDate = validateDate(input.requestedDate);
  if (!timingFlexible && !requestedDate) {
    throw new QuoteIntakeValidationError("Choose a requested date or tell us your timing is flexible.", "requestedDate");
  }

  if (input.processingAcknowledged !== true) {
    throw new QuoteIntakeValidationError(
      "Please confirm PurePress may use these details to prepare and follow up on this request.",
      "processingAcknowledged",
    );
  }

  const organisation = cleanText(contact.organisation, 160, "organisation");
  const sizeBreakdown = cleanText(input.sizeBreakdown, 500, "sizeBreakdown");
  const itemColours = validateColours(input.itemColours);
  const customerNotes = cleanText(input.customerNotes, 1500, "customerNotes");

  return {
    itemCategory,
    ...(customItemDescription ? { customItemDescription } : {}),
    supplySource: enumValue(input.supplySource, SUPPLY_SOURCES, "supplySource"),
    quantity,
    ...(sizeBreakdown ? { sizeBreakdown } : {}),
    ...(itemColours ? { itemColours } : {}),
    placements: validatePlacements(input.placements),
    artworkState: enumValue(input.artworkState, QUOTE_ARTWORK_STATES, "artworkState"),
    artworkFileIds: validateFileIds(input.artworkFileIds),
    ...(requestedDate ? { requestedDate } : {}),
    timingFlexible,
    contact: {
      fullName: cleanText(contact.fullName, 120, "Full name", true),
      ...(organisation ? { organisation } : {}),
      email: normalizeEmail(contact.email),
      ...(phone ? { phone } : {}),
      preferredContactMethod,
    },
    ...(input.fulfillmentIntent === undefined || input.fulfillmentIntent === ""
      ? {}
      : { fulfillmentIntent: enumValue(input.fulfillmentIntent, FULFILLMENT_INTENTS, "fulfillmentIntent") }),
    ...(customerNotes ? { customerNotes } : {}),
    processingAcknowledged: true,
  };
}

export function deriveQuoteIntakeNextAction(submission: QuoteRequestSubmission) {
  if (submission.artworkFileIds.length > 0) return "Review supplied artwork";
  if (submission.artworkState === "artwork_ready" || submission.artworkState === "artwork_needs_work") {
    return "Request missing artwork";
  }
  return "Review request";
}
