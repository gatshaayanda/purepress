import type { PurePressOrderStatus } from "./orderStatus";
import type {
  EmbroideryProductionSpecification,
  JobReadiness,
  OperationalNextAction,
  SupplyReceivingFact,
} from "./readiness";

export type IsoDateString = string;
export type PurePressActorType = "customer" | "admin" | "system";
export type PurePressVisibility = "customer" | "internal";

export type SupplySource =
  | "customer_supplied"
  | "purepress_supplied"
  | "mixed"
  | "unknown";

export type QuoteItemCategory =
  | "corporate_uniforms"
  | "school_items"
  | "team_wear"
  | "shirts_polos"
  | "jackets_workwear"
  | "bags"
  | "towels"
  | "leather"
  | "gifts_promotional"
  | "custom";

export type QuotePlacementPosition =
  | "left_chest"
  | "right_chest"
  | "sleeve"
  | "back"
  | "badge_position"
  | "pocket"
  | "bag_towel_position"
  | "other";

export type QuoteArtworkState =
  | "artwork_ready"
  | "artwork_needs_work"
  | "needs_design_help"
  | "unsure";

export type PreferredContactMethod = "email" | "phone" | "whatsapp";

export type FulfillmentIntent =
  | "collect"
  | "delivery_may_be_needed"
  | "unsure";

export interface CustomerVisibleProfile {
  displayName: string;
  email?: string;
  phone?: string;
  companyName?: string;
}

export interface CustomerInternalProfile {
  notes?: string;
  source?: string;
  legacyProjectIds?: string[];
}

/** Server/admin record. Never expose this object directly to a customer client. */
export interface Customer {
  id: string;
  firebaseUid?: string;
  customerVisible: CustomerVisibleProfile;
  internal: CustomerInternalProfile;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface QuotePlacement {
  position: QuotePlacementPosition;
  notes?: string;
}

export interface QuoteRequestContact extends CustomerVisibleProfile {
  email: string;
  preferredContactMethod: PreferredContactMethod;
}

export interface QuoteRequestCustomerVisible {
  contact: QuoteRequestContact;
  organisation?: string;
  itemCategory?: QuoteItemCategory;
  customItemDescription?: string;
  supplySource?: SupplySource;
  quantity?: number;
  sizeBreakdown?: string;
  itemColours?: string[];
  placements?: QuotePlacement[];
  artworkState?: QuoteArtworkState;
  artworkFileIds?: string[];
  requestedDate?: IsoDateString;
  timingFlexible?: boolean;
  fulfillmentIntent?: FulfillmentIntent;
  customerNotes?: string;
  processingAcknowledgedAt?: IsoDateString;

  /** Patch A compatibility fields retained while intake moves to the richer shape. */
  garmentType?: string;
  requestDetails?: string;
  artworkNotes?: string;
  deadlineNotes?: string;
}

export interface QuoteRequestInternal {
  triageNotes?: string;
  assignedProjectId?: string;
  convertedAt?: IsoDateString;
  nextAction?: OperationalNextAction;
}

/** Raw quote request is admin/server data; customer status is projected separately. */
export interface QuoteRequest {
  id: string;
  referenceCode: string;
  customerUid?: string;
  status: PurePressOrderStatus;
  source: "public_quote_form" | "owner_created" | "legacy";
  customerVisible: QuoteRequestCustomerVisible;
  internal: QuoteRequestInternal;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export type PurePressJobSource = "quote_request" | "owner_created" | "legacy";

export interface EmbroideryJobCustomerVisible {
  title: string;
  garmentSummary?: string;
  itemCategory?: QuoteItemCategory;
  customItemDescription?: string;
  quantity?: number;
  sizeBreakdown?: string;
  itemColours?: string[];
  placements?: QuotePlacement[];
  requestedDate?: IsoDateString;
  timingFlexible?: boolean;
  fulfillmentIntent?: FulfillmentIntent;
  nextStep?: string;
  customerNotes?: string;
}

export interface EmbroideryJobInternal {
  source: PurePressJobSource;
  ownerNotes?: string;
  adminNotes?: string;
  productionInstructions?: string;
  qualityNotes?: string;
  readiness?: JobReadiness;
  nextAction?: OperationalNextAction;
  receiving?: SupplyReceivingFact[];
  embroidery?: EmbroideryProductionSpecification;
  sourceArtworkFileIds?: string[];
  sourceQuoteReference?: string;
  convertedAt?: IsoDateString;
}

/**
 * Canonical PurePress operational order model. `projectId` is the inherited
 * `projects` compatibility root and remains the mutable source of truth.
 */
export interface EmbroideryJob {
  id: string;
  projectId: string;
  referenceCode: string;
  sourceQuoteRequestId?: string;
  reorderSourceOrderId?: string;
  customerId: string;
  customerUid?: string;
  supplySource?: SupplySource;
  status: PurePressOrderStatus;
  customerVisible: EmbroideryJobCustomerVisible;
  internal: EmbroideryJobInternal;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export type Order = EmbroideryJob;

export type JobFileCategory =
  | "quote_artwork"
  | "customer_artwork"
  | "proof"
  | "order_document"
  | "order_message_attachment"
  | "completion_media"
  | "public_gallery_candidate";

export interface JobFile {
  id: string;
  projectId?: string;
  orderId?: string;
  quoteRequestId?: string;
  quoteIntakeSessionId?: string;
  category: JobFileCategory;
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: PurePressVisibility;
  uploadedBy: PurePressActorType;
  uploadedByUid?: string;
  createdAt: IsoDateString;
}

export type ProofApprovalDecision = "pending" | "approved" | "changes_requested";

export interface ProofApproval {
  id: string;
  orderId: string;
  proofFileId: string;
  decision: ProofApprovalDecision;
  customerComment?: string;
  decidedByUid?: string;
  decidedAt?: IsoDateString;
  internal: { adminNotes?: string };
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ProductionUpdate {
  id: string;
  orderId: string;
  status: PurePressOrderStatus;
  customerVisible: { message: string };
  internal: { adminNotes?: string };
  createdBy: PurePressActorType;
  createdAt: IsoDateString;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  customerUid: string;
  senderType: "customer" | "admin";
  senderUid?: string;
  visibility: PurePressVisibility;
  text?: string;
  attachmentFileIds?: string[];
  createdAt: IsoDateString;
}

export interface MarketingMediaPermission {
  grantedByUid?: string;
  grantedAt: IsoDateString;
  scope: string;
  withdrawnAt?: IsoDateString;
}

/** Public media is a deliberate projection, never the upload record itself. */
export interface PublicWorkMedia {
  id: string;
  sourceOrderId: string;
  sourceFileId: string;
  mediaUrl: string;
  altText: string;
  caption?: string;
  safePublic: boolean;
  published: boolean;
  permission?: MarketingMediaPermission;
  publishedAt?: IsoDateString;
  publishedByUid?: string;
}

/** Customer-readable projection only. It intentionally has no internal field. */
export interface CustomerOrderView {
  orderId: string;
  projectId: string;
  customerId: string;
  customerUid: string;
  status: PurePressOrderStatus;
  title: string;
  summary?: string;
  quantity?: number;
  nextStep?: string;
  updatedAt: IsoDateString;
}
