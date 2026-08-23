import "server-only";

import { randomBytes } from "node:crypto";
import { UTApi } from "uploadthing/server";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { JobFile, QuoteRequest } from "../domain";
import {
  deriveQuoteIntakeNextAction,
  parseQuoteRequestSubmission,
  type QuoteRequestSubmission,
} from "../quoteIntake";
import {
  assertStoredQuoteIntakeSession,
  QUOTE_INTAKE_SESSIONS_COLLECTION,
  QUOTE_JOB_FILES_COLLECTION,
} from "./quoteIntakeSessions";

export const QUOTE_REQUESTS_COLLECTION = "purepressQuoteRequests";

function referenceCode(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(5).toString("hex").slice(0, 8).toUpperCase();
  return `PPQ-${date}-${suffix}`;
}

function quoteDocument(submission: QuoteRequestSubmission, id: string): QuoteRequest {
  const now = new Date().toISOString();
  const organisation = submission.contact.organisation;
  return {
    id,
    referenceCode: referenceCode(),
    status: "new_request",
    source: "public_quote_form",
    customerVisible: {
      contact: {
        displayName: submission.contact.fullName,
        email: submission.contact.email,
        ...(submission.contact.phone ? { phone: submission.contact.phone } : {}),
        ...(organisation ? { companyName: organisation } : {}),
        preferredContactMethod: submission.contact.preferredContactMethod,
      },
      ...(organisation ? { organisation } : {}),
      itemCategory: submission.itemCategory,
      ...(submission.customItemDescription ? { customItemDescription: submission.customItemDescription } : {}),
      supplySource: submission.supplySource,
      quantity: submission.quantity,
      ...(submission.sizeBreakdown ? { sizeBreakdown: submission.sizeBreakdown } : {}),
      ...(submission.itemColours ? { itemColours: submission.itemColours } : {}),
      placements: submission.placements,
      artworkState: submission.artworkState,
      artworkFileIds: submission.artworkFileIds,
      ...(submission.requestedDate ? { requestedDate: submission.requestedDate } : {}),
      timingFlexible: submission.timingFlexible,
      ...(submission.fulfillmentIntent ? { fulfillmentIntent: submission.fulfillmentIntent } : {}),
      ...(submission.customerNotes ? { customerNotes: submission.customerNotes } : {}),
      processingAcknowledgedAt: now,
    },
    internal: {
      nextAction: {
        actor: "owner",
        action: deriveQuoteIntakeNextAction(submission),
        ...(submission.artworkFileIds.length ? { readinessArea: "artwork" as const } : {}),
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

export async function createPublicQuoteRequest(
  raw: unknown,
  credentials?: { intakeId?: string; token?: string },
) {
  const submission = parseQuoteRequestSubmission(raw);
  const db = getAdminDb();
  const quoteRef = db.collection(QUOTE_REQUESTS_COLLECTION).doc();
  const quote = quoteDocument(submission, quoteRef.id);

  if (submission.artworkFileIds.length === 0) {
    await quoteRef.set(quote);
    return { id: quote.id, referenceCode: quote.referenceCode, status: quote.status } as const;
  }

  const intakeId = credentials?.intakeId?.trim() ?? "";
  const token = credentials?.token?.trim() ?? "";
  if (!intakeId || !token) {
    throw Object.assign(new Error("Artwork was supplied without a valid quote intake authorization."), { status: 403 });
  }

  const sessionRef = db.collection(QUOTE_INTAKE_SESSIONS_COLLECTION).doc(intakeId);
  const fileRefs = submission.artworkFileIds.map((fileId) => db.collection(QUOTE_JOB_FILES_COLLECTION).doc(fileId));

  await db.runTransaction(async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) throw Object.assign(new Error("Quote intake session was not found."), { status: 404 });
    assertStoredQuoteIntakeSession(sessionSnapshot.data() ?? {}, token, submission.artworkFileIds);

    const fileSnapshots = [];
    for (const fileRef of fileRefs) fileSnapshots.push(await transaction.get(fileRef));
    for (const fileSnapshot of fileSnapshots) {
      if (!fileSnapshot.exists) throw Object.assign(new Error("A quote artwork file was not found."), { status: 404 });
      const data = fileSnapshot.data() ?? {};
      if (
        data.category !== "quote_artwork" ||
        data.quoteIntakeSessionId !== intakeId ||
        data.quoteRequestId
      ) {
        throw Object.assign(new Error("A quote artwork file is not eligible for this request."), { status: 403 });
      }
    }

    transaction.set(quoteRef, quote);
    for (const fileRef of fileRefs) {
      transaction.update(fileRef, { quoteRequestId: quote.id });
    }
    transaction.update(sessionRef, {
      state: "consumed",
      consumedAt: quote.createdAt,
      quoteRequestId: quote.id,
      updatedAt: quote.createdAt,
    });
  });

  return { id: quote.id, referenceCode: quote.referenceCode, status: quote.status } as const;
}

export async function listOwnerQuoteRequests(limit = 40) {
  const boundedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const snapshot = await getAdminDb()
    .collection(QUOTE_REQUESTS_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(boundedLimit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as QuoteRequest;
    return {
      id: doc.id,
      referenceCode: data.referenceCode,
      status: data.status,
      createdAt: data.createdAt,
      customer: data.customerVisible?.contact?.displayName ?? "Unknown customer",
      organisation: data.customerVisible?.organisation ?? data.customerVisible?.contact?.companyName ?? null,
      itemCategory: data.customerVisible?.itemCategory ?? null,
      customItemDescription: data.customerVisible?.customItemDescription ?? null,
      supplySource: data.customerVisible?.supplySource ?? "unknown",
      quantity: data.customerVisible?.quantity ?? null,
      requestedDate: data.customerVisible?.requestedDate ?? null,
      timingFlexible: data.customerVisible?.timingFlexible === true,
      artworkAttached: Boolean(data.customerVisible?.artworkFileIds?.length),
    };
  });
}

export async function getOwnerQuoteRequest(id: string) {
  const cleanId = id.trim();
  if (!cleanId) return null;
  const db = getAdminDb();
  const snapshot = await db.collection(QUOTE_REQUESTS_COLLECTION).doc(cleanId).get();
  if (!snapshot.exists) return null;
  const quote = snapshot.data() as QuoteRequest;
  const fileIds = quote.customerVisible?.artworkFileIds ?? [];
  const artworkFiles: Array<Pick<JobFile, "id" | "fileName" | "mimeType" | "sizeBytes"> & { viewUrl: string }> = [];
  for (const fileId of fileIds) {
    const fileSnapshot = await db.collection(QUOTE_JOB_FILES_COLLECTION).doc(fileId).get();
    if (!fileSnapshot.exists) continue;
    const file = fileSnapshot.data() as JobFile;
    if (file.category !== "quote_artwork" || file.quoteRequestId !== cleanId) continue;
    const signed = await createOwnerArtworkViewUrl(file.fileKey);
    artworkFiles.push({
      id: fileId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      viewUrl: signed.ufsUrl,
    });
  }
  return { ...quote, artworkFiles };
}

export async function getOwnerQuoteArtworkFile(quoteId: string, fileId: string) {
  const db = getAdminDb();
  const [quoteSnapshot, fileSnapshot] = await Promise.all([
    db.collection(QUOTE_REQUESTS_COLLECTION).doc(quoteId).get(),
    db.collection(QUOTE_JOB_FILES_COLLECTION).doc(fileId).get(),
  ]);
  if (!quoteSnapshot.exists || !fileSnapshot.exists) return null;
  const quote = quoteSnapshot.data() as QuoteRequest;
  const file = fileSnapshot.data() as JobFile;
  if (
    file.category !== "quote_artwork" ||
    file.quoteRequestId !== quoteId ||
    !quote.customerVisible?.artworkFileIds?.includes(fileId)
  ) return null;
  return file;
}

export async function createOwnerArtworkViewUrl(fileKey: string) {
  const utapi = new UTApi();
  return utapi.generateSignedURL(fileKey, { expiresIn: "2 minutes" });
}
