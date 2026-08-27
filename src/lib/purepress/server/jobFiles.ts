import "server-only";
import { UTApi } from "uploadthing/server";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { EmbroideryJob, JobFile, JobFileCategory } from "../domain";
import { PUREPRESS_PROJECT_SCHEMA } from "../projectCompatibility";
import { PUREPRESS_UPLOAD_POLICIES } from "../uploads";
import { QUOTE_JOB_FILES_COLLECTION } from "./quoteIntakeSessions";

export const PUREPRESS_JOB_FILES_COLLECTION = QUOTE_JOB_FILES_COLLECTION;
export const PRIVATE_FILE_URL_TTL = "5 minutes" as const;

function cleanName(value: string) { return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 240) || "PurePress file"; }
function appendUnique(values: string[] | undefined, value: string) { return values?.includes(value) ? values : [...(values ?? []), value]; }

export async function recordPurePressJobFileUpload(
  metadata: { category: JobFileCategory; jobId: string; actorRole: "admin" | "customer"; actorUid: string },
  file: { key: string; name: string; type: string; size: number },
) {
  const policy = PUREPRESS_UPLOAD_POLICIES[metadata.category];
  if (!policy.requiresJob || !metadata.jobId?.trim()) throw new Error("A durable PurePress order file requires an order context.");
  const db = getAdminDb();
  const projectRef = db.collection("projects").doc(metadata.jobId.trim());
  const fileRef = db.collection(PUREPRESS_JOB_FILES_COLLECTION).doc();
  const now = new Date().toISOString();
  const record: JobFile = {
    id: fileRef.id, projectId: metadata.jobId.trim(), orderId: metadata.jobId.trim(), category: metadata.category,
    fileKey: file.key, fileName: cleanName(file.name), mimeType: file.type, sizeBytes: file.size, visibility: "internal",
    uploadedBy: metadata.actorRole === "admin" ? "admin" : "customer", uploadedByUid: metadata.actorUid, createdAt: now,
  };
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(projectRef);
    if (!snapshot.exists || snapshot.data()?.purepress_schema !== PUREPRESS_PROJECT_SCHEMA) throw new Error("PurePress order context no longer exists.");
    const job = snapshot.data()?.purepress as EmbroideryJob;
    const workflow = { ...(job.internal.artworkWorkflow ?? {}) };
    const embroidery = { ...(job.internal.embroidery ?? {}) };
    if (metadata.category === "customer_artwork") workflow.customerArtworkFileIds = appendUnique(workflow.customerArtworkFileIds, fileRef.id);
    if (metadata.category === "digitized_production_file") {
      workflow.productionFileIds = appendUnique(workflow.productionFileIds, fileRef.id);
      embroidery.productionFileRefs = appendUnique(embroidery.productionFileRefs, fileRef.id);
    }
    if (metadata.category === "sample_evidence") workflow.sampleEvidenceFileIds = appendUnique(workflow.sampleEvidenceFileIds, fileRef.id);
    transaction.set(fileRef, record);
    transaction.update(projectRef, { "purepress.internal.artworkWorkflow": workflow, "purepress.internal.embroidery": embroidery, "purepress.updatedAt": now, updatedAt: now });
  });
  return { jobFileId: fileRef.id, fileName: record.fileName, category: record.category, published: false } as const;
}

export async function getJobFile(fileId: string) {
  const snapshot = await getAdminDb().collection(PUREPRESS_JOB_FILES_COLLECTION).doc(fileId.trim()).get();
  return snapshot.exists ? snapshot.data() as JobFile : null;
}
export async function requireOrderJobFile(projectId: string, fileId: string, allowed?: readonly JobFileCategory[]) {
  const file = await getJobFile(fileId);
  if (!file || file.projectId !== projectId || file.orderId !== projectId || file.visibility !== "internal") throw Object.assign(new Error("Private PurePress file was not found for this order."), { status: 404 });
  if (allowed && !allowed.includes(file.category)) throw Object.assign(new Error("Private PurePress file has the wrong workflow category."), { status: 409 });
  return file;
}
export async function createPrivateJobFileViewUrl(fileKey: string) {
  const utapi = new UTApi();
  return utapi.generateSignedURL(fileKey, { expiresIn: PRIVATE_FILE_URL_TTL });
}
export async function projectFilesWithSignedUrls(projectId: string, categories?: readonly JobFileCategory[]) {
  const snapshot = await getAdminDb().collection(PUREPRESS_JOB_FILES_COLLECTION).where("projectId", "==", projectId).get();
  const rows = snapshot.docs.map((doc) => doc.data() as JobFile).filter((file) => file.visibility === "internal" && (!categories || categories.includes(file.category)));
  const result = [];
  for (const file of rows) {
    const signed = await createPrivateJobFileViewUrl(file.fileKey);
    result.push({ id:file.id, category:file.category, fileName:file.fileName, mimeType:file.mimeType, sizeBytes:file.sizeBytes, createdAt:file.createdAt, viewUrl:signed.ufsUrl });
  }
  return result;
}
