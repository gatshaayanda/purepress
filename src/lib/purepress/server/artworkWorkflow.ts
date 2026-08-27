import "server-only";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { EmbroideryJob, JobFileCategory, ProofState } from "../domain";
import { canFinalizeArtwork, PurePressArtworkProofError } from "../artworkProof";
import { PUREPRESS_PROJECT_SCHEMA } from "../projectCompatibility";
import { requireOrderJobFile, projectFilesWithSignedUrls } from "./jobFiles";
import { getCurrentProofState, getProofHistory, issueProofRevision, recordOwnerProofApproval, replaceProofApprovalLink } from "./proofs";

const ARTWORK_STATES = ["missing","received","needs_cleanup","needs_digitizing","digitizing","production_ready","issue"] as const;
const SAMPLE_STATES = ["not_required","pending","needs_review","approved","issue"] as const;
const DIGITISING_STATES = ["not_started","required","in_progress","complete","not_required"] as const;
function clean(value: unknown, max = 800) { return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max) : ""; }
function positiveInt(value: unknown, max: number) { if (value === "" || value === null || value === undefined) return undefined; const n=Number(value); if (!Number.isInteger(n)||n<=0||n>max) throw new PurePressArtworkProofError("Numeric embroidery fact is invalid."); return n; }
async function loadJob(projectId: string) {
  const ref = getAdminDb().collection("projects").doc(projectId.trim()); const snap = await ref.get();
  if (!snap.exists || snap.data()?.purepress_schema !== PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("PurePress job not found."), { status:404 });
  return { ref, job:snap.data()?.purepress as EmbroideryJob };
}
export async function getArtworkProofBundle(projectId: string) {
  const { job } = await loadJob(projectId);
  const categories: JobFileCategory[] = ["quote_artwork","customer_artwork","proof","digitized_production_file","sample_evidence"];
  const [files, history, currentState] = await Promise.all([projectFilesWithSignedUrls(projectId, categories), getProofHistory(projectId), getCurrentProofState(projectId)]);
  return { projectId, referenceCode:job.referenceCode, status:job.status, readiness:job.internal.readiness, embroidery:job.internal.embroidery ?? {}, workflow:job.internal.artworkWorkflow ?? {}, sourceQuoteArtworkFileIds:job.internal.sourceArtworkFileIds ?? [], files, proofs:history, currentProofState:currentState };
}
export async function performArtworkProofAction(projectId: string, raw: Record<string, unknown>, ownerUid = "purepress-admin") {
  const action = String(raw.action ?? "");
  if (action === "issue_proof") return issueProofRevision(projectId, raw, ownerUid);
  if (action === "replace_approval_link") return replaceProofApprovalLink(projectId, ownerUid);
  if (action === "record_owner_approval") return recordOwnerProofApproval(projectId, raw, ownerUid);
  const db = getAdminDb(); const projectRef = db.collection("projects").doc(projectId.trim());
  if (action === "finalize_for_production") {
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(projectRef); if (!snapshot.exists || snapshot.data()?.purepress_schema !== PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("PurePress job not found."),{status:404});
      const job = snapshot.data()?.purepress as EmbroideryJob; const currentProofId = job.internal.artworkWorkflow?.currentProofId;
      if (!currentProofId) throw new PurePressArtworkProofError("A current approved proof is required.",409);
      const proofStateRef = db.collection("purepressProofStates").doc(currentProofId); const proofStateSnapshot = await transaction.get(proofStateRef);
      const state = proofStateSnapshot.exists ? proofStateSnapshot.data() as ProofState : null; const gate = canFinalizeArtwork(job,state);
      if (!gate.ok) throw new PurePressArtworkProofError(gate.reason,409);
      const now = new Date().toISOString(); const workflow={...(job.internal.artworkWorkflow??{}),finalArtworkReadyAt:now,finalArtworkReadyBy:ownerUid};
      transaction.update(projectRef,{ "purepress.status":"approved_for_production", purepress_order_status:"approved_for_production", "purepress.internal.artworkWorkflow":workflow, "purepress.internal.readiness.production":"not_ready", "purepress.internal.nextAction":{actor:"owner",action:"Production scheduling is outside Patch F",readinessArea:"production"}, "purepress.updatedAt":now, updatedAt:now });
      return { status:"approved_for_production", production:"not_ready" } as const;
    });
  }
  return db.runTransaction(async (transaction) => {
    const snapshot=await transaction.get(projectRef); if(!snapshot.exists||snapshot.data()?.purepress_schema!==PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("PurePress job not found."),{status:404});
    const job=snapshot.data()?.purepress as EmbroideryJob; const readiness={...(job.internal.readiness ?? {payment:"not_required_yet",items:"unknown",artwork:"missing",proof:"not_started",sample:"not_required",production:"not_ready",qc:"not_started"})};
    const embroidery={...(job.internal.embroidery??{})}; const now=new Date().toISOString();
    if(action==="set_artwork_readiness") { const value=String(raw.artwork ?? ""); if(!(ARTWORK_STATES as readonly string[]).includes(value)) throw new PurePressArtworkProofError("Artwork readiness is invalid."); readiness.artwork=value as typeof readiness.artwork; }
    else if(action==="set_digitising") { const value=String(raw.digitizingStatus??""); if(!(DIGITISING_STATES as readonly string[]).includes(value)) throw new PurePressArtworkProofError("Digitising status is invalid."); embroidery.digitizingStatus=value as typeof embroidery.digitizingStatus; embroidery.digitizingRequired=value!=="not_required"; readiness.artwork=value==="complete"?"production_ready":value==="in_progress"?"digitizing":"needs_digitizing"; if(value==="complete"){embroidery.digitizedAt=now;embroidery.digitizedBy=ownerUid;} }
    else if(action==="set_embroidery_facts") { const stitchCount=positiveInt(raw.stitchCount,10_000_000); const colors=Array.isArray(raw.threadColorRefs)?raw.threadColorRefs.map((v)=>clean(v,80)).filter(Boolean).slice(0,40):[]; if(stitchCount) embroidery.stitchCount=stitchCount; else delete embroidery.stitchCount; if(colors.length) embroidery.threadColorRefs=colors; else delete embroidery.threadColorRefs; embroidery.sampleRequired=raw.sampleRequired===true; if(embroidery.sampleRequired&&readiness.sample==="not_required") readiness.sample="pending"; if(!embroidery.sampleRequired) readiness.sample="not_required"; }
    else if(action==="set_sample_readiness") { const value=String(raw.sample??""); if(!(SAMPLE_STATES as readonly string[]).includes(value)) throw new PurePressArtworkProofError("Sample readiness is invalid."); readiness.sample=value as typeof readiness.sample; }
    else throw new PurePressArtworkProofError("Artwork action is not supported.");
    readiness.production="not_ready";
    transaction.update(projectRef,{"purepress.internal.readiness":readiness,"purepress.internal.embroidery":embroidery,"purepress.updatedAt":now,updatedAt:now});
    return { readiness, embroidery };
  });
}
export async function assertProofFiles(projectId: string, ids: readonly string[]) { for (const id of ids) await requireOrderJobFile(projectId,id,["proof"]); }
