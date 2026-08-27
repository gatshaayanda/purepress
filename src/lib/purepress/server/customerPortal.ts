import "server-only";

import { getAdminDb } from "@/utils/firebaseAdmin";
import type { Customer, EmbroideryJob, JobFile, ProofRevision, ProofState } from "../domain";
import {
  PUREPRESS_COLLECTION_DETAILS,
  customerProgressFor,
  projectPurePressCustomerStatus,
  sortPurePressCustomerOrders,
  type PurePressCustomerOrderProjection,
  type PurePressCustomerProofProjection,
  type PurePressCustomerQuoteProjection,
} from "../customerProjection";
import type { PurePressProjectQuoteState, PurePressQuote } from "../quotation";
import { PUREPRESS_PROJECT_SCHEMA } from "../projectCompatibility";
import type { PurePressCustomerIdentity } from "../auth/server";
import { normalizePurePressServerEmail } from "../auth/server";
import { PUREPRESS_CUSTOMERS_COLLECTION } from "./customers";
import { createPrivateJobFileViewUrl, PUREPRESS_JOB_FILES_COLLECTION } from "./jobFiles";
import { PUREPRESS_PROOFS_COLLECTION, PUREPRESS_PROOF_STATES_COLLECTION } from "./proofs";

const PROJECTS = "projects";
const QUOTES = "quotes";
const PROFILE_COLLECTION = "purepressCustomerProfiles";
const ACCESS_COLLECTION = "purepressJobAccess";

interface PurePressCustomerProjectDocument {
  purepress_schema?: string;
  purepress?: EmbroideryJob;
  purepress_customer_uid?: string;
  purepress_quote_state?: PurePressProjectQuoteState;
  updatedAt?: string;
}

function unavailableOrder() {
  return Object.assign(new Error("We couldn’t find this order for your My PurePress account."), { status: 404 });
}

function validProject(data: PurePressCustomerProjectDocument, projectId: string) {
  return data.purepress_schema === PUREPRESS_PROJECT_SCHEMA
    && data.purepress?.projectId === projectId
    ? data.purepress
    : null;
}

function linkedToAnother(value: unknown, uid: string) {
  return typeof value === "string" && value.trim() !== "" && value.trim() !== uid;
}

/**
 * The only H self-link path. It re-reads project + canonical customer in one
 * transaction and only writes the stable Firebase UID after an exact normalized
 * verified-email match. Existing same-UID links are idempotent.
 */
async function claimOrConfirmProject(identity: PurePressCustomerIdentity, projectId: string, strict: boolean) {
  const db = getAdminDb();
  const cleanProjectId = projectId.trim();
  if (!cleanProjectId || cleanProjectId.includes("/") || cleanProjectId.length > 180) {
    if (strict) throw unavailableOrder();
    return null;
  }
  const projectRef = db.collection(PROJECTS).doc(cleanProjectId);

  try {
    return await db.runTransaction(async (transaction) => {
      const projectSnapshot = await transaction.get(projectRef);
      if (!projectSnapshot.exists) throw unavailableOrder();
      const projectData = projectSnapshot.data() as PurePressCustomerProjectDocument;
      const job = validProject(projectData, cleanProjectId);
      if (!job) throw unavailableOrder();

      const customerRef = db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(job.customerId);
      const customerSnapshot = await transaction.get(customerRef);
      if (!customerSnapshot.exists) throw unavailableOrder();
      const customer = customerSnapshot.data() as Customer;

      if (linkedToAnother(job.customerUid, identity.uid) || linkedToAnother(customer.firebaseUid, identity.uid)) {
        throw unavailableOrder();
      }

      const jobAlreadyLinked = job.customerUid === identity.uid;
      const customerAlreadyLinked = customer.firebaseUid === identity.uid;
      if (!jobAlreadyLinked && !customerAlreadyLinked) {
        const canonicalEmail = normalizePurePressServerEmail(customer.customerVisible.email);
        if (!canonicalEmail || canonicalEmail !== identity.email) throw unavailableOrder();
      }

      const now = new Date().toISOString();
      const linkedJob: EmbroideryJob = jobAlreadyLinked ? job : { ...job, customerUid: identity.uid, updatedAt: now };
      if (!customerAlreadyLinked) transaction.update(customerRef, { firebaseUid: identity.uid, updatedAt: now });
      if (!jobAlreadyLinked) {
        transaction.update(projectRef, {
          purepress: linkedJob,
          purepress_customer_uid: identity.uid,
          updatedAt: now,
        });
      }

      transaction.set(
        db.collection(ACCESS_COLLECTION).doc(identity.uid).collection("jobs").doc(cleanProjectId),
        { customerUid: identity.uid, customerId: job.customerId, jobId: cleanProjectId, linkedAt: now, updatedAt: now },
        { merge: true },
      );
      transaction.set(
        db.collection(PROFILE_COLLECTION).doc(identity.uid),
        {
          uid: identity.uid,
          customerId: job.customerId,
          email: identity.email,
          displayName: identity.displayName ?? customer.customerVisible.displayName,
          updatedAt: now,
        },
        { merge: true },
      );

      return { projectData: { ...projectData, purepress: linkedJob, purepress_customer_uid: identity.uid }, job: linkedJob, customer };
    });
  } catch (error) {
    if (strict) throw error;
    return null;
  }
}

async function loadQuote(projectId: string, state?: PurePressProjectQuoteState) {
  const quoteId = state?.currentIssuedQuoteId?.trim();
  if (!quoteId) return null;
  const snapshot = await getAdminDb().collection(PROJECTS).doc(projectId).collection(QUOTES).doc(quoteId).get();
  if (!snapshot.exists) return null;
  const quote = snapshot.data() as PurePressQuote;
  return quote.projectId === projectId && quote.id === quoteId ? quote : null;
}

async function loadProof(job: EmbroideryJob) {
  const proofId = job.internal.artworkWorkflow?.currentProofId?.trim();
  if (!proofId) return null;
  const db = getAdminDb();
  const [proofSnapshot, stateSnapshot] = await Promise.all([
    db.collection(PUREPRESS_PROOFS_COLLECTION).doc(proofId).get(),
    db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(proofId).get(),
  ]);
  if (!proofSnapshot.exists || !stateSnapshot.exists) return null;
  const proof = proofSnapshot.data() as ProofRevision;
  const state = stateSnapshot.data() as ProofState;
  if (proof.projectId !== job.projectId || proof.id !== proofId || state.proofId !== proofId || state.orderId !== job.projectId) return null;
  return { proof, state };
}

function quoteProjection(job: EmbroideryJob, quote: PurePressQuote | null): PurePressCustomerQuoteProjection | undefined {
  if (!quote) {
    if (["new_request", "needs_information", "quote_ready"].includes(job.status)) {
      return { state: "being_prepared", label: "QUOTE BEING PREPARED", canReview: false };
    }
    return undefined;
  }
  const state = quote.status === "accepted"
    ? "approved"
    : quote.status === "changes_requested"
      ? "changes_requested"
      : "ready";
  const label = state === "approved"
    ? "QUOTE APPROVED"
    : state === "changes_requested"
      ? "CHANGES REQUESTED"
      : `QUOTE READY — ${formatBwpMinor(quote.totalMinor)}`;
  return {
    state,
    label,
    quoteNumber: quote.quoteNumber,
    revision: quote.revision,
    currency: "BWP",
    totalMinor: quote.totalMinor,
    ...(quote.validUntil ? { validUntil: quote.validUntil } : {}),
    ...(quote.estimatedCompletionDate ? { estimatedCompletionDate: quote.estimatedCompletionDate } : {}),
    ...(quote.customerVisibleNotes ? { customerVisibleNotes: quote.customerVisibleNotes } : {}),
    ...(quote.paymentTerms ? { paymentTerms: quote.paymentTerms } : {}),
    ...(quote.fulfillmentNotes ? { fulfillmentNotes: quote.fulfillmentNotes } : {}),
    lineItems: quote.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor: line.lineTotalMinor,
    })),
    canReview: job.status === "awaiting_quote_approval" && quote.status === "issued",
  };
}

function proofProjection(job: EmbroideryJob, loaded: Awaited<ReturnType<typeof loadProof>>): PurePressCustomerProofProjection | undefined {
  if (!loaded) {
    if (job.status === "artwork_proof") return { state: "being_prepared", label: "ARTWORK BEING PREPARED", previewCount: 0, canReview: false };
    return undefined;
  }
  const { proof, state } = loaded;
  const projectedState = state.status === "approved" ? "approved" : state.status === "changes_requested" ? "changes_requested" : "ready";
  return {
    state: projectedState,
    label: projectedState === "approved" ? "ARTWORK APPROVED" : projectedState === "changes_requested" ? "CHANGES REQUESTED" : "ARTWORK READY TO CHECK",
    revision: proof.revision,
    ...(proof.customerVisibleNotes ? { customerVisibleNotes: proof.customerVisibleNotes } : {}),
    ...(proof.placementSummary ? { placementSummary: proof.placementSummary } : {}),
    ...(proof.designWidthMm ? { designWidthMm: proof.designWidthMm } : {}),
    ...(proof.designHeightMm ? { designHeightMm: proof.designHeightMm } : {}),
    ...(proof.threadColorSummary ? { threadColorSummary: proof.threadColorSummary } : {}),
    previewCount: proof.proofFileIds.length,
    canReview: job.status === "awaiting_proof_approval" && state.status === "awaiting_customer" && job.internal.artworkWorkflow?.currentProofId === proof.id,
  };
}

function formatBwpMinor(value: number) {
  return `P${(value / 100).toLocaleString("en-BW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function projectCustomerOrder(
  projectData: PurePressCustomerProjectDocument,
  job: EmbroideryJob,
  customer: Customer,
): Promise<PurePressCustomerOrderProjection> {
  const [quote, proof] = await Promise.all([
    loadQuote(job.projectId, projectData.purepress_quote_state),
    loadProof(job),
  ]);
  const commercial = quoteProjection(job, quote);
  const artwork = proofProjection(job, proof);
  return {
    projectId: job.projectId,
    referenceCode: job.referenceCode,
    title: job.customerVisible.title,
    ...(job.customerVisible.garmentSummary ? { garmentSummary: job.customerVisible.garmentSummary } : {}),
    ...(job.customerVisible.quantity ? { quantity: job.customerVisible.quantity } : {}),
    ...(job.customerVisible.requestedDate ? { requestedDate: job.customerVisible.requestedDate } : {}),
    ...(commercial?.estimatedCompletionDate ? { promisedDate: commercial.estimatedCompletionDate } : {}),
    ...(customer.customerVisible.displayName ? { customerName: customer.customerVisible.displayName } : {}),
    status: projectPurePressCustomerStatus(job.status),
    progress: customerProgressFor(job.status),
    ...(commercial ? { quote: commercial } : {}),
    ...(artwork ? { artwork } : {}),
    ...(job.status === "completed" && job.internal.completion?.completedAt ? { completedAt: job.internal.completion.completedAt } : {}),
    updatedAt: job.updatedAt,
    collection: PUREPRESS_COLLECTION_DETAILS,
  };
}

export async function listPurePressCustomerOrders(identity: PurePressCustomerIdentity) {
  const snapshot = await getAdminDb().collection(PROJECTS).where("purepress_schema", "==", PUREPRESS_PROJECT_SCHEMA).get();
  const owned = [] as Array<Awaited<ReturnType<typeof claimOrConfirmProject>>>;
  for (const document of snapshot.docs) {
    const data = document.data() as PurePressCustomerProjectDocument;
    const job = validProject(data, document.id);
    if (!job || linkedToAnother(job.customerUid, identity.uid)) continue;
    const confirmed = await claimOrConfirmProject(identity, document.id, false);
    if (confirmed) owned.push(confirmed);
  }
  const projections: PurePressCustomerOrderProjection[] = [];
  for (const row of owned) {
    if (row) projections.push(await projectCustomerOrder(row.projectData, row.job, row.customer));
  }
  return sortPurePressCustomerOrders(projections);
}

export async function getPurePressCustomerOrder(identity: PurePressCustomerIdentity, projectId: string) {
  const confirmed = await claimOrConfirmProject(identity, projectId, true);
  if (!confirmed) throw unavailableOrder();
  return projectCustomerOrder(confirmed.projectData, confirmed.job, confirmed.customer);
}

export async function requirePurePressCustomerOrderOwnership(identity: PurePressCustomerIdentity, projectId: string) {
  const confirmed = await claimOrConfirmProject(identity, projectId, true);
  if (!confirmed) throw unavailableOrder();
  return confirmed;
}

export async function createCustomerProofFileView(identity: PurePressCustomerIdentity, projectId: string, indexInput: string) {
  const confirmed = await requirePurePressCustomerOrderOwnership(identity, projectId);
  const index = Number(indexInput);
  if (!Number.isInteger(index) || index < 0 || index > 7) throw unavailableOrder();
  const proofId = confirmed.job.internal.artworkWorkflow?.currentProofId;
  if (!proofId) throw unavailableOrder();
  const proofSnapshot = await getAdminDb().collection(PUREPRESS_PROOFS_COLLECTION).doc(proofId).get();
  if (!proofSnapshot.exists) throw unavailableOrder();
  const proof = proofSnapshot.data() as ProofRevision;
  if (proof.projectId !== projectId || proof.id !== proofId) throw unavailableOrder();
  const fileId = proof.proofFileIds[index];
  if (!fileId) throw unavailableOrder();
  const fileSnapshot = await getAdminDb().collection(PUREPRESS_JOB_FILES_COLLECTION).doc(fileId).get();
  if (!fileSnapshot.exists) throw unavailableOrder();
  const file = fileSnapshot.data() as JobFile;
  if (file.projectId !== projectId || file.orderId !== projectId || file.category !== "proof" || file.visibility !== "internal") throw unavailableOrder();
  const signed = await createPrivateJobFileViewUrl(file.fileKey);
  return { url: signed.ufsUrl, fileName: file.fileName, mimeType: file.mimeType, expiresIn: "5 minutes" } as const;
}
