import "server-only";

import { randomBytes } from "node:crypto";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { Customer, EmbroideryJob, JobFile, QuoteRequest } from "../domain";
import {
  classifyJob,
  conciseReadinessSignal,
  initialReadinessFromOwnerJob,
  initialReadinessFromQuote,
  parseJobPatch,
  parseOwnerCreatedJob,
  type JobPatch,
} from "../jobDesk";
import { PUREPRESS_PROJECT_SCHEMA, toPurePressProjectCompatibilityFields } from "../projectCompatibility";
import { buildInternalCustomer, PUREPRESS_CUSTOMERS_COLLECTION } from "./customers";
import {
  createOwnerArtworkViewUrl,
  QUOTE_REQUESTS_COLLECTION,
} from "./quoteRequests";
import { QUOTE_JOB_FILES_COLLECTION } from "./quoteIntakeSessions";

export const PUREPRESS_PROJECTS_COLLECTION = "projects";

interface PurePressProjectDocument {
  purepress_schema: typeof PUREPRESS_PROJECT_SCHEMA;
  purepress_order_id: string;
  purepress_customer_id: string;
  purepress_customer_uid?: string;
  purepress_order_status: EmbroideryJob["status"];
  purepress: EmbroideryJob;
  createdAt: string;
  updatedAt: string;
}

function makeReference(prefix: "PPJ", now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(5).toString("hex").slice(0, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

function quoteTitle(quote: QuoteRequest) {
  return quote.customerVisible.customItemDescription
    || quote.customerVisible.garmentType
    || quote.customerVisible.itemCategory?.replaceAll("_", " ")
    || "Embroidery job";
}

function jobFromQuote(
  quote: QuoteRequest,
  projectId: string,
  customerId: string,
  now: string,
): EmbroideryJob {
  const visible = quote.customerVisible;
  return {
    id: projectId,
    projectId,
    referenceCode: makeReference("PPJ", new Date(now)),
    sourceQuoteRequestId: quote.id,
    customerId,
    ...(quote.customerUid ? { customerUid: quote.customerUid } : {}),
    supplySource: visible.supplySource ?? "unknown",
    status: "new_request",
    customerVisible: {
      title: quoteTitle(quote),
      ...(visible.garmentType ? { garmentSummary: visible.garmentType } : {}),
      ...(visible.itemCategory ? { itemCategory: visible.itemCategory } : {}),
      ...(visible.customItemDescription ? { customItemDescription: visible.customItemDescription } : {}),
      ...(visible.quantity ? { quantity: visible.quantity } : {}),
      ...(visible.sizeBreakdown ? { sizeBreakdown: visible.sizeBreakdown } : {}),
      ...(visible.itemColours?.length ? { itemColours: visible.itemColours } : {}),
      ...(visible.placements?.length ? { placements: visible.placements } : {}),
      ...(visible.requestedDate ? { requestedDate: visible.requestedDate } : {}),
      ...(typeof visible.timingFlexible === "boolean" ? { timingFlexible: visible.timingFlexible } : {}),
      ...(visible.fulfillmentIntent ? { fulfillmentIntent: visible.fulfillmentIntent } : {}),
      ...(visible.customerNotes ? { customerNotes: visible.customerNotes } : {}),
    },
    internal: {
      source: "quote_request",
      readiness: initialReadinessFromQuote(quote),
      nextAction: quote.internal?.nextAction ?? { actor: "owner", action: "Review job details" },
      sourceArtworkFileIds: visible.artworkFileIds ?? [],
      sourceQuoteReference: quote.referenceCode,
      convertedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function projectDocument(job: EmbroideryJob): PurePressProjectDocument {
  return {
    ...toPurePressProjectCompatibilityFields(job),
    purepress: job,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function convertQuoteToOperationalJob(
  quoteId: string,
  options?: { existingCustomerId?: string },
) {
  const cleanQuoteId = quoteId.trim();
  if (!cleanQuoteId) throw Object.assign(new Error("Quote request ID is required."), { status: 400 });
  const db = getAdminDb();
  const quoteRef = db.collection(QUOTE_REQUESTS_COLLECTION).doc(cleanQuoteId);
  const proposedProjectRef = db.collection(PUREPRESS_PROJECTS_COLLECTION).doc();
  const proposedCustomerRef = db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc();
  const requestedCustomerId = options?.existingCustomerId?.trim() || "";

  return db.runTransaction(async (transaction) => {
    const quoteSnapshot = await transaction.get(quoteRef);
    if (!quoteSnapshot.exists) throw Object.assign(new Error("Quote request not found."), { status: 404 });
    const quote = quoteSnapshot.data() as QuoteRequest;
    const assignedProjectId = quote.internal?.assignedProjectId?.trim();
    if (assignedProjectId) {
      const existingSnapshot = await transaction.get(db.collection(PUREPRESS_PROJECTS_COLLECTION).doc(assignedProjectId));
      if (!existingSnapshot.exists) {
        throw Object.assign(new Error("This quote is already linked to a missing operational job and requires repair."), { status: 409 });
      }
      const existing = (existingSnapshot.data() as PurePressProjectDocument).purepress;
      return { projectId: assignedProjectId, referenceCode: existing.referenceCode, created: false } as const;
    }

    let customerId = proposedCustomerRef.id;
    let customer: Customer;
    if (requestedCustomerId) {
      const existingCustomerRef = db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(requestedCustomerId);
      const customerSnapshot = await transaction.get(existingCustomerRef);
      if (!customerSnapshot.exists) throw Object.assign(new Error("Selected PurePress customer was not found."), { status: 404 });
      customerId = requestedCustomerId;
      customer = customerSnapshot.data() as Customer;
    } else {
      customer = buildInternalCustomer(proposedCustomerRef.id, {
        displayName: quote.customerVisible.contact.displayName,
        email: quote.customerVisible.contact.email,
        phone: quote.customerVisible.contact.phone,
        companyName: quote.customerVisible.organisation ?? quote.customerVisible.contact.companyName,
        source: "quote_request",
      });
    }

    const now = new Date().toISOString();
    const job = jobFromQuote(quote, proposedProjectRef.id, customerId, now);
    if (customer.firebaseUid) job.customerUid = customer.firebaseUid;

    const artworkIds = quote.customerVisible.artworkFileIds ?? [];
    const artworkRefs = artworkIds.map((id) => db.collection(QUOTE_JOB_FILES_COLLECTION).doc(id));
    const artworkSnapshots = [];
    for (const artworkRef of artworkRefs) artworkSnapshots.push(await transaction.get(artworkRef));
    for (const artworkSnapshot of artworkSnapshots) {
      if (!artworkSnapshot.exists) throw Object.assign(new Error("Source quote artwork is missing."), { status: 409 });
      const file = artworkSnapshot.data() as JobFile;
      if (file.category !== "quote_artwork" || file.quoteRequestId !== quote.id || file.visibility !== "internal") {
        throw Object.assign(new Error("Source artwork provenance is invalid."), { status: 409 });
      }
    }

    if (!requestedCustomerId) transaction.set(proposedCustomerRef, customer);
    transaction.set(proposedProjectRef, projectDocument(job));
    for (const artworkRef of artworkRefs) {
      transaction.update(artworkRef, { projectId: proposedProjectRef.id, orderId: proposedProjectRef.id });
    }
    transaction.update(quoteRef, {
      "internal.assignedProjectId": proposedProjectRef.id,
      "internal.convertedAt": now,
      updatedAt: now,
    });

    return { projectId: proposedProjectRef.id, referenceCode: job.referenceCode, created: true } as const;
  });
}

export async function createOwnerOperationalJob(raw: unknown) {
  const input = parseOwnerCreatedJob(raw);
  const db = getAdminDb();
  const projectRef = db.collection(PUREPRESS_PROJECTS_COLLECTION).doc();
  const customerRef = db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc();
  const now = new Date().toISOString();
  const customer = buildInternalCustomer(customerRef.id, {
    displayName: input.customerName,
    email: input.email,
    phone: input.phone,
    companyName: input.organisation,
    source: "owner_created",
  }, now);
  const job: EmbroideryJob = {
    id: projectRef.id,
    projectId: projectRef.id,
    referenceCode: makeReference("PPJ", new Date(now)),
    customerId: customer.id,
    supplySource: input.supplySource,
    status: input.status,
    customerVisible: {
      title: input.customItemDescription || input.itemCategory.replaceAll("_", " "),
      itemCategory: input.itemCategory,
      ...(input.customItemDescription ? { customItemDescription: input.customItemDescription } : {}),
      quantity: input.quantity,
      ...(input.sizeBreakdown ? { sizeBreakdown: input.sizeBreakdown } : {}),
      ...(input.itemColours?.length ? { itemColours: input.itemColours } : {}),
      placements: input.placements,
      ...(input.requestedDate ? { requestedDate: input.requestedDate } : {}),
      timingFlexible: input.timingFlexible,
      ...(input.fulfillmentIntent ? { fulfillmentIntent: input.fulfillmentIntent } : {}),
      ...(input.customerNotes ? { customerNotes: input.customerNotes } : {}),
    },
    internal: {
      source: "owner_created",
      readiness: initialReadinessFromOwnerJob(input),
      nextAction: input.status === "needs_information"
        ? { actor: "customer", action: "Collect missing customer information" }
        : { actor: "owner", action: "Review job details" },
      ...(input.internalNotes ? { ownerNotes: input.internalNotes } : {}),
    },
    createdAt: now,
    updatedAt: now,
  };
  await db.runTransaction(async (transaction) => {
    transaction.set(customerRef, customer);
    transaction.set(projectRef, projectDocument(job));
  });
  return { projectId: projectRef.id, referenceCode: job.referenceCode, created: true } as const;
}

function toSummary(job: EmbroideryJob, customer?: Customer | null) {
  return {
    projectId: job.projectId,
    referenceCode: job.referenceCode,
    customer: customer?.customerVisible.displayName ?? "Customer",
    organisation: customer?.customerVisible.companyName ?? null,
    itemSummary: job.customerVisible.customItemDescription || job.customerVisible.title,
    quantity: job.customerVisible.quantity ?? null,
    supplySource: job.supplySource ?? "unknown",
    status: job.status,
    nextAction: job.internal.nextAction ?? null,
    blocker: job.internal.nextAction?.blocker ?? null,
    readinessSignal: conciseReadinessSignal(job.internal.readiness),
    requestedDate: job.customerVisible.requestedDate ?? null,
    timingFlexible: job.customerVisible.timingFlexible === true,
    updatedAt: job.updatedAt,
    classification: classifyJob(job),
  };
}

export async function listOwnerOperationalJobs(limit = 100) {
  const bounded = Math.max(1, Math.min(150, Math.floor(limit)));
  const db = getAdminDb();
  const snapshot = await db.collection(PUREPRESS_PROJECTS_COLLECTION)
    .where("purepress_schema", "==", PUREPRESS_PROJECT_SCHEMA)
    .limit(bounded)
    .get();
  const rows: Array<{ job: EmbroideryJob; customerId: string }> = [];
  for (const doc of snapshot.docs) {
    const data = doc.data() as Partial<PurePressProjectDocument>;
    if (data.purepress?.projectId === doc.id) rows.push({ job: data.purepress, customerId: data.purepress.customerId });
  }
  const uniqueCustomerIds = [...new Set(rows.map((row) => row.customerId))];
  const customerMap = new Map<string, Customer>();
  for (const customerId of uniqueCustomerIds) {
    const customerSnapshot = await db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(customerId).get();
    if (customerSnapshot.exists) customerMap.set(customerId, customerSnapshot.data() as Customer);
  }
  return rows
    .map(({ job }) => toSummary(job, customerMap.get(job.customerId)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getOwnerOperationalJob(projectId: string) {
  const cleanId = projectId.trim();
  if (!cleanId) return null;
  const db = getAdminDb();
  const projectSnapshot = await db.collection(PUREPRESS_PROJECTS_COLLECTION).doc(cleanId).get();
  if (!projectSnapshot.exists) return null;
  const data = projectSnapshot.data() as Partial<PurePressProjectDocument>;
  const job = data.purepress;
  if (!job || data.purepress_schema !== PUREPRESS_PROJECT_SCHEMA || job.projectId !== cleanId) return null;
  const customerSnapshot = await db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(job.customerId).get();
  const customer = customerSnapshot.exists ? customerSnapshot.data() as Customer : null;
  const artworkFiles: Array<Pick<JobFile, "id" | "fileName" | "mimeType" | "sizeBytes" | "category" | "visibility"> & { viewUrl: string }> = [];
  for (const fileId of job.internal.sourceArtworkFileIds ?? []) {
    const fileSnapshot = await db.collection(QUOTE_JOB_FILES_COLLECTION).doc(fileId).get();
    if (!fileSnapshot.exists) continue;
    const file = fileSnapshot.data() as JobFile;
    if (
      file.category !== "quote_artwork" ||
      file.visibility !== "internal" ||
      file.projectId !== cleanId ||
      file.quoteRequestId !== job.sourceQuoteRequestId
    ) continue;
    const signed = await createOwnerArtworkViewUrl(file.fileKey);
    artworkFiles.push({
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      category: file.category,
      visibility: file.visibility,
      viewUrl: signed.ufsUrl,
    });
  }
  return { job, customer, artworkFiles, classification: classifyJob(job) };
}

function applyPatch(job: EmbroideryJob, patch: JobPatch, now: string): EmbroideryJob {
  let internal = { ...job.internal };
  if (Object.hasOwn(patch, "nextAction")) {
    if (patch.nextAction === null) {
      const { nextAction: _removed, ...rest } = internal;
      internal = rest;
    } else if (patch.nextAction) {
      internal.nextAction = patch.nextAction;
    }
  }
  if (Object.hasOwn(patch, "ownerNotes")) {
    if (patch.ownerNotes) internal.ownerNotes = patch.ownerNotes;
    else {
      const { ownerNotes: _removedOwnerNotes, ...rest } = internal;
      internal = rest;
    }
  }
  if (patch.readiness) {
    internal.readiness = {
      ...(job.internal.readiness ?? {
        payment: "not_required_yet",
        items: "unknown",
        artwork: "missing",
        proof: "not_started",
        sample: "not_required",
        production: "not_ready",
        qc: "not_started",
      }),
      ...patch.readiness,
    };
  }
  return {
    ...job,
    ...(patch.supplySource ? { supplySource: patch.supplySource } : {}),
    ...(patch.status ? { status: patch.status } : {}),
    internal,
    updatedAt: now,
  };
}

export async function updateOwnerOperationalJob(projectId: string, raw: unknown) {
  const patch = parseJobPatch(raw);
  const db = getAdminDb();
  const projectRef = db.collection(PUREPRESS_PROJECTS_COLLECTION).doc(projectId.trim());
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(projectRef);
    if (!snapshot.exists) throw Object.assign(new Error("PurePress job not found."), { status: 404 });
    const data = snapshot.data() as Partial<PurePressProjectDocument>;
    const job = data.purepress;
    if (!job || data.purepress_schema !== PUREPRESS_PROJECT_SCHEMA) {
      throw Object.assign(new Error("This project is not a PurePress operational job."), { status: 409 });
    }
    const now = new Date().toISOString();
    const updated = applyPatch(job, patch, now);
    transaction.update(projectRef, {
      purepress: updated,
      purepress_order_status: updated.status,
      updatedAt: now,
    });
    return { job: updated, classification: classifyJob(updated) };
  });
}
