export const PUREPRESS_ORDER_STATUSES = [
  "new_request",
  "needs_information",
  "quote_ready",
  "awaiting_quote_approval",
  "artwork_proof",
  "awaiting_proof_approval",
  "approved_for_production",
  "in_production",
  "quality_check",
  "ready",
  "completed",
  "cancelled",
] as const;

export type PurePressOrderStatus = (typeof PUREPRESS_ORDER_STATUSES)[number];

export type PurePressOrderPhase = "intake" | "quote" | "proof" | "production" | "fulfilment" | "closed";

export interface PurePressOrderStatusMetadata {
  label: string;
  customerLabel: string;
  phase: PurePressOrderPhase;
  terminal: boolean;
}

export const PUREPRESS_ORDER_STATUS_META: Record<PurePressOrderStatus, PurePressOrderStatusMetadata> = {
  new_request: { label: "New request", customerLabel: "Request received", phase: "intake", terminal: false },
  needs_information: { label: "Needs information", customerLabel: "More information needed", phase: "intake", terminal: false },
  quote_ready: { label: "Quote ready", customerLabel: "Quote ready", phase: "quote", terminal: false },
  awaiting_quote_approval: { label: "Awaiting quote approval", customerLabel: "Awaiting your quote approval", phase: "quote", terminal: false },
  artwork_proof: { label: "Artwork proof", customerLabel: "Artwork proof in preparation", phase: "proof", terminal: false },
  awaiting_proof_approval: { label: "Awaiting proof approval", customerLabel: "Awaiting your proof approval", phase: "proof", terminal: false },
  approved_for_production: { label: "Approved for production", customerLabel: "Approved for production", phase: "production", terminal: false },
  in_production: { label: "In production", customerLabel: "In production", phase: "production", terminal: false },
  quality_check: { label: "Quality check", customerLabel: "Quality check", phase: "production", terminal: false },
  ready: { label: "Ready", customerLabel: "Ready", phase: "fulfilment", terminal: false },
  completed: { label: "Completed", customerLabel: "Completed", phase: "closed", terminal: true },
  cancelled: { label: "Cancelled", customerLabel: "Cancelled", phase: "closed", terminal: true },
};

export function isPurePressOrderStatus(value: unknown): value is PurePressOrderStatus {
  return typeof value === "string" && (PUREPRESS_ORDER_STATUSES as readonly string[]).includes(value);
}
