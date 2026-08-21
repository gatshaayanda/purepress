import type { PurePressOrderStatus } from "./orderStatus";

export type IsoDateString = string;
export type PurePressActorType = "customer" | "admin" | "system";
export type PurePressVisibility = "customer" | "internal";

export interface CustomerVisibleProfile {
  displayName: string;
  email: string;
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
  firebaseUid: string;
  customerVisible: CustomerVisibleProfile;
  internal: CustomerInternalProfile;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface QuoteRequestCustomerVisible {
  contact: CustomerVisibleProfile;
  garmentType?: string;
  quantity?: number;
  requestDetails: string;
  artworkNotes?: string;
  deadlineNotes?: string;
}

export interface QuoteRequestInternal {
  triageNotes?: string;
  assignedProjectId?: string;
}

/** Raw quote request is admin/server data; customer status is projected separately. */
export interface QuoteRequest {
  id: string;
  customerUid?: string;
  status: PurePressOrderStatus;
  customerVisible: QuoteRequestCustomerVisible;
  internal: QuoteRequestInternal;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface EmbroideryJobCustomerVisible {
  title: string;
  garmentSummary?: string;
  quantity?: number;
  nextStep?: string;
  customerNotes?: string;
}

export interface EmbroideryJobInternal {
  adminNotes?: string;
  productionInstructions?: string;
  qualityNotes?: string;
}

/**
 * Canonical PurePress order model. During the first iteration `projectId`
 * points at the inherited `projects` document used as the compatibility root.
 */
export interface EmbroideryJob {
  id: string;
  projectId: string;
  customerId: string;
  customerUid: string;
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
