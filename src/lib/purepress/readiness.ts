import type { IsoDateString } from "./domain";

export type ReadinessArea = "payment" | "items" | "artwork" | "proof" | "sample" | "production" | "qc";
export type PaymentReadiness = "unknown" | "not_required_yet" | "pending" | "satisfied" | "issue";
export type ItemReadiness = "unknown" | "customer_supplied" | "needs_procurement" | "ordered" | "partially_received" | "received" | "issue";
export type ArtworkReadiness = "missing" | "received" | "needs_cleanup" | "needs_digitizing" | "digitizing" | "production_ready" | "issue";
export type ProofReadiness = "not_started" | "preparing" | "awaiting_customer" | "changes_requested" | "approved";
export type SampleReadiness = "not_required" | "pending" | "needs_review" | "approved" | "issue";
export type ProductionReadiness = "not_ready" | "ready" | "scheduled" | "running" | "paused" | "complete";
export type QualityReadiness = "not_started" | "pending" | "passed" | "issue";
export interface JobReadiness { payment: PaymentReadiness; items: ItemReadiness; artwork: ArtworkReadiness; proof: ProofReadiness; sample: SampleReadiness; production: ProductionReadiness; qc: QualityReadiness; }
export type NextActionActor = "owner" | "customer" | "supplier" | "system";
export interface OperationalNextAction { actor: NextActionActor; action: string; dueAt?: IsoDateString; readinessArea?: ReadinessArea; blocker?: string; }

export type ReceivingCondition = "good" | "mixed" | "damaged" | "issue";
export interface SupplyReceivingFact {
  id?: string;
  itemSpecification: string;
  supplySource?: "customer_supplied" | "purepress_supplied";
  supplier?: string;
  quantityRequired?: number;
  quantityExpected?: number;
  quantityOrdered?: number;
  quantityReceived?: number;
  shortage?: number;
  extras?: number;
  expectedDate?: IsoDateString;
  receivedDate?: IsoDateString;
  receivedBy?: string;
  condition?: ReceivingCondition;
  conditionNotes?: string;
  issueNotes?: string;
  lastReceivingUpdateAt?: IsoDateString;
  notes?: string;
}

export type DigitizingStatus = "not_started" | "required" | "in_progress" | "complete" | "not_required";
export interface EmbroideryProductionSpecification {
  decorationMethod?: "embroidery" | "other";
  threadColorIntent?: string;
  threadColorRefs?: string[];
  threadPaletteRefs?: string[];
  digitizingRequired?: boolean;
  digitizingStatus?: DigitizingStatus;
  digitizedAt?: IsoDateString;
  digitizedBy?: string;
  productionFileRefs?: string[];
  stitchCount?: number;
  sampleRequired?: boolean;
  sampleStatus?: SampleReadiness;
  machineAssignment?: string;
}
