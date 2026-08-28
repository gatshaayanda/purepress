import type { PurePressOrderStatus } from "./orderStatus";
import type { PurePressTranslationKey } from "./i18n";

export const PUREPRESS_CUSTOMER_STAGES = ["QUOTE", "ARTWORK", "MAKING", "READY", "COMPLETE"] as const;
export type PurePressCustomerStage = (typeof PUREPRESS_CUSTOMER_STAGES)[number];
export type PurePressCustomerAction = "NONE" | "REVIEW_QUOTE" | "REVIEW_ARTWORK" | "CONTACT_PUREPRESS";

export interface PurePressCustomerStatusProjection {
  stage: PurePressCustomerStage | "CANCELLED";
  headline: string;
  explanation: string;
  next: string;
  action: PurePressCustomerAction;
  actionInstruction?: string;
}

export const PUREPRESS_CUSTOMER_STATUS_CODES = ["REQUEST_RECEIVED","NEEDS_INFORMATION","QUOTE_BEING_PREPARED","QUOTE_READY","ARTWORK_BEING_PREPARED","ARTWORK_READY","READY_FOR_PRODUCTION","IN_PRODUCTION","QUALITY_CHECK","READY_FOR_COLLECTION","COMPLETED","CANCELLED"] as const;
export type PurePressCustomerStatusCode = (typeof PUREPRESS_CUSTOMER_STATUS_CODES)[number];
export interface PurePressCustomerStatusSemanticProjection {
  code: PurePressCustomerStatusCode;
  stage: PurePressCustomerStage | "CANCELLED";
  headlineKey: PurePressTranslationKey;
  explanationKey: PurePressTranslationKey;
  nextKey: PurePressTranslationKey;
  action: PurePressCustomerAction;
  actionInstructionKey?: PurePressTranslationKey;
}
const STATUS_PROJECTION: Record<PurePressOrderStatus, PurePressCustomerStatusProjection> = {
  new_request: {
    stage: "QUOTE",
    headline: "We received your request.",
    explanation: "Your order request is with PurePress.",
    next: "We’ll prepare your quote and contact you if we need anything.",
    action: "NONE",
  },
  needs_information: {
    stage: "QUOTE",
    headline: "We need a few details from you.",
    explanation: "A little more information is needed before we can continue.",
    next: "Contact PurePress so we can continue your order.",
    action: "CONTACT_PUREPRESS",
    actionInstruction: "Contact PurePress about the missing order details.",
  },
  quote_ready: {
    stage: "QUOTE",
    headline: "PurePress is preparing your quote.",
    explanation: "Your quote is being finished before it is sent to you.",
    next: "We’ll send the quote when it is ready for your review.",
    action: "NONE",
  },
  awaiting_quote_approval: {
    stage: "QUOTE",
    headline: "Your quote is ready.",
    explanation: "Please check the current PurePress quote for this order.",
    next: "Review the quote before we continue with artwork.",
    action: "REVIEW_QUOTE",
    actionInstruction: "Review the quote and tell us if it is correct.",
  },
  artwork_proof: {
    stage: "ARTWORK",
    headline: "We’re preparing your artwork.",
    explanation: "PurePress is getting the artwork ready for you to check.",
    next: "We’ll let you know when your artwork is ready to review.",
    action: "NONE",
  },
  awaiting_proof_approval: {
    stage: "ARTWORK",
    headline: "Your artwork is ready to check.",
    explanation: "Please check the current artwork proof for this order.",
    next: "Review your artwork before we prepare the order for production.",
    action: "REVIEW_ARTWORK",
    actionInstruction: "Review the artwork and tell us if it is correct.",
  },
  approved_for_production: {
    stage: "MAKING",
    headline: "Everything is approved. We’re getting ready to make your order.",
    explanation: "Your quote and artwork are approved.",
    next: "PurePress will move your approved order into production.",
    action: "NONE",
  },
  in_production: {
    stage: "MAKING",
    headline: "We’re making your order.",
    explanation: "Your order is now in production.",
    next: "We’ll check every finished item before collection.",
    action: "NONE",
  },
  quality_check: {
    stage: "MAKING",
    headline: "We’re checking your finished order.",
    explanation: "PurePress is checking the finished work before collection.",
    next: "We’ll let you know when your order is ready for collection.",
    action: "NONE",
  },
  ready: {
    stage: "READY",
    headline: "Your order is ready for collection.",
    explanation: "Your PurePress order is ready.",
    next: "You can collect your order from PurePress Printers in Gaborone West.",
    action: "NONE",
  },
  completed: {
    stage: "COMPLETE",
    headline: "Your order is complete. Thank you.",
    explanation: "This PurePress order has been completed.",
    next: "Nothing else is needed for this order.",
    action: "NONE",
  },
  cancelled: {
    stage: "CANCELLED",
    headline: "This order was cancelled.",
    explanation: "PurePress is no longer progressing this order.",
    next: "Contact PurePress if you have questions about this order.",
    action: "CONTACT_PUREPRESS",
    actionInstruction: "Contact PurePress if you need help with this cancelled order.",
  },
};

const STATUS_SEMANTIC: Record<PurePressOrderStatus, PurePressCustomerStatusSemanticProjection> = {
  new_request:{code:"REQUEST_RECEIVED",stage:"QUOTE",headlineKey:"customer.status.REQUEST_RECEIVED.headline",explanationKey:"customer.status.REQUEST_RECEIVED.explanation",nextKey:"customer.status.REQUEST_RECEIVED.next",action:"NONE"},
  needs_information:{code:"NEEDS_INFORMATION",stage:"QUOTE",headlineKey:"customer.status.NEEDS_INFORMATION.headline",explanationKey:"customer.status.NEEDS_INFORMATION.explanation",nextKey:"customer.status.NEEDS_INFORMATION.next",action:"CONTACT_PUREPRESS",actionInstructionKey:"customer.status.NEEDS_INFORMATION.action"},
  quote_ready:{code:"QUOTE_BEING_PREPARED",stage:"QUOTE",headlineKey:"customer.status.QUOTE_BEING_PREPARED.headline",explanationKey:"customer.status.QUOTE_BEING_PREPARED.explanation",nextKey:"customer.status.QUOTE_BEING_PREPARED.next",action:"NONE"},
  awaiting_quote_approval:{code:"QUOTE_READY",stage:"QUOTE",headlineKey:"customer.status.QUOTE_READY.headline",explanationKey:"customer.status.QUOTE_READY.explanation",nextKey:"customer.status.QUOTE_READY.next",action:"REVIEW_QUOTE",actionInstructionKey:"customer.status.QUOTE_READY.action"},
  artwork_proof:{code:"ARTWORK_BEING_PREPARED",stage:"ARTWORK",headlineKey:"customer.status.ARTWORK_BEING_PREPARED.headline",explanationKey:"customer.status.ARTWORK_BEING_PREPARED.explanation",nextKey:"customer.status.ARTWORK_BEING_PREPARED.next",action:"NONE"},
  awaiting_proof_approval:{code:"ARTWORK_READY",stage:"ARTWORK",headlineKey:"customer.status.ARTWORK_READY.headline",explanationKey:"customer.status.ARTWORK_READY.explanation",nextKey:"customer.status.ARTWORK_READY.next",action:"REVIEW_ARTWORK",actionInstructionKey:"customer.status.ARTWORK_READY.action"},
  approved_for_production:{code:"READY_FOR_PRODUCTION",stage:"MAKING",headlineKey:"customer.status.READY_FOR_PRODUCTION.headline",explanationKey:"customer.status.READY_FOR_PRODUCTION.explanation",nextKey:"customer.status.READY_FOR_PRODUCTION.next",action:"NONE"},
  in_production:{code:"IN_PRODUCTION",stage:"MAKING",headlineKey:"customer.status.IN_PRODUCTION.headline",explanationKey:"customer.status.IN_PRODUCTION.explanation",nextKey:"customer.status.IN_PRODUCTION.next",action:"NONE"},
  quality_check:{code:"QUALITY_CHECK",stage:"MAKING",headlineKey:"customer.status.QUALITY_CHECK.headline",explanationKey:"customer.status.QUALITY_CHECK.explanation",nextKey:"customer.status.QUALITY_CHECK.next",action:"NONE"},
  ready:{code:"READY_FOR_COLLECTION",stage:"READY",headlineKey:"customer.status.READY_FOR_COLLECTION.headline",explanationKey:"customer.status.READY_FOR_COLLECTION.explanation",nextKey:"customer.status.READY_FOR_COLLECTION.next",action:"NONE"},
  completed:{code:"COMPLETED",stage:"COMPLETE",headlineKey:"customer.status.COMPLETED.headline",explanationKey:"customer.status.COMPLETED.explanation",nextKey:"customer.status.COMPLETED.next",action:"NONE"},
  cancelled:{code:"CANCELLED",stage:"CANCELLED",headlineKey:"customer.status.CANCELLED.headline",explanationKey:"customer.status.CANCELLED.explanation",nextKey:"customer.status.CANCELLED.next",action:"CONTACT_PUREPRESS",actionInstructionKey:"customer.status.CANCELLED.action"}
};
export function projectPurePressCustomerStatusSemantic(status: PurePressOrderStatus): PurePressCustomerStatusSemanticProjection { return STATUS_SEMANTIC[status]; }

export function projectPurePressCustomerStatus(status: PurePressOrderStatus): PurePressCustomerStatusProjection {
  return STATUS_PROJECTION[status];
}

export function customerProgressFor(status: PurePressOrderStatus) {
  const projected = projectPurePressCustomerStatus(status);
  if (projected.stage === "CANCELLED") return [] as Array<{ stage: PurePressCustomerStage; state: "done" | "current" | "future" }>;
  const currentIndex = PUREPRESS_CUSTOMER_STAGES.indexOf(projected.stage);
  return PUREPRESS_CUSTOMER_STAGES.map((stage, index) => ({
    stage,
    state: index < currentIndex ? "done" as const : index === currentIndex ? "current" as const : "future" as const,
  }));
}

export interface PurePressCustomerQuoteProjection {
  state: "being_prepared" | "ready" | "approved" | "changes_requested";
  labelKey: PurePressTranslationKey;
  quoteNumber?: string;
  revision?: number;
  currency?: "BWP";
  totalMinor?: number;
  validUntil?: string;
  estimatedCompletionDate?: string;
  customerVisibleNotes?: string;
  paymentTerms?: string;
  fulfillmentNotes?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }>;
  canReview: boolean;
}

export interface PurePressCustomerProofProjection {
  state: "being_prepared" | "ready" | "approved" | "changes_requested";
  labelKey: PurePressTranslationKey;
  revision?: number;
  customerVisibleNotes?: string;
  placementSummary?: string;
  designWidthMm?: number;
  designHeightMm?: number;
  threadColorSummary?: string;
  previewCount: number;
  canReview: boolean;
}

export interface PurePressCustomerOrderProjection {
  projectId: string;
  referenceCode: string;
  title: string;
  garmentSummary?: string;
  quantity?: number;
  requestedDate?: string;
  promisedDate?: string;
  customerName?: string;
  status: PurePressCustomerStatusSemanticProjection;
  progress: ReturnType<typeof customerProgressFor>;
  quote?: PurePressCustomerQuoteProjection;
  artwork?: PurePressCustomerProofProjection;
  completedAt?: string;
  updatedAt: string;
  collection: {
    name: "PurePress Printers";
    address: "Plot 17879, Gaborone West, Gaborone, Botswana";
    phones: readonly ["+267 78 013 297", "+267 77 116 195"];
    email: "purepressprinters@gmail.com";
  };
}

export const PUREPRESS_COLLECTION_DETAILS = {
  name: "PurePress Printers",
  address: "Plot 17879, Gaborone West, Gaborone, Botswana",
  phones: ["+267 78 013 297", "+267 77 116 195"] as const,
  email: "purepressprinters@gmail.com",
} as const;

export function customerOrderPriority(order: PurePressCustomerOrderProjection) {
  if (order.status.action !== "NONE") return 0;
  if (order.status.stage === "READY") return 2;
  if (order.status.stage === "COMPLETE" || order.status.stage === "CANCELLED") return 3;
  return 1;
}

export function sortPurePressCustomerOrders(orders: PurePressCustomerOrderProjection[]) {
  return [...orders].sort((a, b) => {
    const priority = customerOrderPriority(a) - customerOrderPriority(b);
    return priority || b.updatedAt.localeCompare(a.updatedAt);
  });
}
