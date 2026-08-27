import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { Customer, EmbroideryJob, JobFile, ProofDecision, ProofRevision, ProofState } from "../domain";
import { parseDecisionInput, parseProofIssueInput, PurePressArtworkProofError } from "../artworkProof";
import { PUREPRESS_PROJECT_SCHEMA } from "../projectCompatibility";
import { createPrivateJobFileViewUrl, PUREPRESS_JOB_FILES_COLLECTION } from "./jobFiles";
import { PUREPRESS_CUSTOMERS_COLLECTION } from "./customers";

export const PUREPRESS_PROOFS_COLLECTION = "purepressProofs";
export const PUREPRESS_PROOF_STATES_COLLECTION = "purepressProofStates";
export const PUREPRESS_PROOF_ACCESS_COLLECTION = "purepressProofAccess";

function tokenHash(token: string) { return createHash("sha256").update(token, "utf8").digest("hex"); }
function newToken() { return randomBytes(32).toString("base64url"); }
function appendUnique(values: string[] | undefined, value: string) { return values?.includes(value) ? values : [...(values ?? []), value]; }
function proofPath(token: string) { return `/proof/${encodeURIComponent(token)}`; }

export async function issueProofRevision(projectId: string, raw: unknown, ownerUid = "purepress-admin") {
  const input = parseProofIssueInput(raw); const token = newToken(); const hash = tokenHash(token); const db = getAdminDb();
  const projectRef=db.collection("projects").doc(projectId.trim()); const proofRef=db.collection(PUREPRESS_PROOFS_COLLECTION).doc();
  const stateRef=db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(proofRef.id); const accessRef=db.collection(PUREPRESS_PROOF_ACCESS_COLLECTION).doc(hash);
  const now=new Date().toISOString();
  const result=await db.runTransaction(async(transaction)=>{
    const projectSnapshot=await transaction.get(projectRef); if(!projectSnapshot.exists||projectSnapshot.data()?.purepress_schema!==PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("PurePress job not found."),{status:404});
    const job=projectSnapshot.data()?.purepress as EmbroideryJob;
    const fileRefs=input.proofFileIds.map((id)=>db.collection(PUREPRESS_JOB_FILES_COLLECTION).doc(id));
    const files=[]; for(const ref of fileRefs) files.push(await transaction.get(ref));
    for(const fileSnapshot of files){ const file=fileSnapshot.data() as JobFile|undefined; if(!fileSnapshot.exists||!file||file.projectId!==projectId||file.orderId!==projectId||file.category!=="proof"||file.visibility!=="internal") throw new PurePressArtworkProofError("Every issued proof file must be a private proof file for this job.",409); }
    const workflow={...(job.internal.artworkWorkflow??{})}; const revision=(workflow.currentProofRevision??0)+1;
    const proof:ProofRevision={id:proofRef.id,orderId:projectId,projectId,revision,proofFileIds:input.proofFileIds,...(input.customerVisibleNotes?{customerVisibleNotes:input.customerVisibleNotes}:{}),...(input.placementSummary?{placementSummary:input.placementSummary}:{}),...(input.designWidthMm?{designWidthMm:input.designWidthMm}:{}),...(input.designHeightMm?{designHeightMm:input.designHeightMm}:{}),...(input.threadColorSummary?{threadColorSummary:input.threadColorSummary}:{}),createdByUid:ownerUid,createdAt:now};
    const state:ProofState={proofId:proof.id,orderId:projectId,revision,status:"awaiting_customer",activeTokenHash:hash,issuedAt:now,updatedAt:now};
    transaction.create(proofRef,proof); transaction.create(stateRef,state); transaction.create(accessRef,{proofId:proof.id,orderId:projectId,tokenHash:hash,active:true,createdAt:now});
    workflow.currentProofId=proof.id; workflow.currentProofRevision=revision; workflow.proofRevisionIds=appendUnique(workflow.proofRevisionIds,proof.id);
    transaction.update(projectRef,{"purepress.status":"awaiting_proof_approval",purepress_order_status:"awaiting_proof_approval","purepress.internal.artworkWorkflow":workflow,"purepress.internal.readiness.proof":"awaiting_customer","purepress.internal.readiness.production":"not_ready","purepress.internal.nextAction":{actor:"customer",action:`Review artwork proof R${revision}`,readinessArea:"proof"},"purepress.updatedAt":now,updatedAt:now});
    return {proofId:proof.id,revision};
  });
  return {...result,sharePath:proofPath(token)} as const;
}

export async function replaceProofApprovalLink(projectId:string, ownerUid="purepress-admin"){
  const token=newToken(); const hash=tokenHash(token); const db=getAdminDb(); const projectRef=db.collection("projects").doc(projectId.trim()); const now=new Date().toISOString();
  const result=await db.runTransaction(async(transaction)=>{
    const projectSnapshot=await transaction.get(projectRef); if(!projectSnapshot.exists||projectSnapshot.data()?.purepress_schema!==PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("PurePress job not found."),{status:404});
    const job=projectSnapshot.data()?.purepress as EmbroideryJob; const proofId=job.internal.artworkWorkflow?.currentProofId; if(!proofId) throw new PurePressArtworkProofError("No current proof exists.",409);
    const stateRef=db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(proofId); const stateSnapshot=await transaction.get(stateRef); if(!stateSnapshot.exists) throw new PurePressArtworkProofError("Current proof state is missing.",409);
    const state=stateSnapshot.data() as ProofState; if(state.status!=="awaiting_customer") throw new PurePressArtworkProofError("Only an awaiting-customer proof can receive a replacement link.",409);
    if(state.activeTokenHash) transaction.update(db.collection(PUREPRESS_PROOF_ACCESS_COLLECTION).doc(state.activeTokenHash),{active:false,replacedAt:now,replacedBy:ownerUid});
    transaction.create(db.collection(PUREPRESS_PROOF_ACCESS_COLLECTION).doc(hash),{proofId,orderId:projectId,tokenHash:hash,active:true,createdAt:now,replacement:true});
    transaction.update(stateRef,{activeTokenHash:hash,tokenReplacedAt:now,updatedAt:now}); return {proofId,revision:state.revision};
  });
  return {...result,sharePath:proofPath(token)} as const;
}

async function resolveTokenRecord(token:string){
  if(!token||token.length<24) throw Object.assign(new Error("Proof link is invalid."),{status:404}); const hash=tokenHash(token); const db=getAdminDb(); const accessRef=db.collection(PUREPRESS_PROOF_ACCESS_COLLECTION).doc(hash); const accessSnapshot=await accessRef.get();
  if(!accessSnapshot.exists||accessSnapshot.data()?.active!==true||accessSnapshot.data()?.tokenHash!==hash) throw Object.assign(new Error("This proof link is invalid or has been replaced."),{status:404});
  return {hash,accessRef,proofId:String(accessSnapshot.data()?.proofId||""),orderId:String(accessSnapshot.data()?.orderId||"")};
}

export async function getProofByToken(token:string){
  const resolved=await resolveTokenRecord(token); const db=getAdminDb(); const [proofSnapshot,stateSnapshot,projectSnapshot]=await Promise.all([db.collection(PUREPRESS_PROOFS_COLLECTION).doc(resolved.proofId).get(),db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(resolved.proofId).get(),db.collection("projects").doc(resolved.orderId).get()]);
  if(!proofSnapshot.exists||!stateSnapshot.exists||!projectSnapshot.exists) throw Object.assign(new Error("Proof is unavailable."),{status:404}); const proof=proofSnapshot.data() as ProofRevision; const state=stateSnapshot.data() as ProofState;
  if(state.activeTokenHash!==resolved.hash||state.proofId!==proof.id||proof.orderId!==resolved.orderId) throw Object.assign(new Error("This proof link is no longer active."),{status:404});
  const job=projectSnapshot.data()?.purepress as EmbroideryJob|undefined; if(!job||projectSnapshot.data()?.purepress_schema!==PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("Proof order is unavailable."),{status:404});
  const customerSnapshot=await db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(job.customerId).get(); const customer=customerSnapshot.exists?customerSnapshot.data() as Customer:null;
  const proofFiles=[]; for(const fileId of proof.proofFileIds){ const fileSnapshot=await db.collection(PUREPRESS_JOB_FILES_COLLECTION).doc(fileId).get(); const file=fileSnapshot.exists?fileSnapshot.data() as JobFile:null; if(!file||file.projectId!==job.projectId||file.category!=="proof"||file.visibility!=="internal") continue; const signed=await createPrivateJobFileViewUrl(file.fileKey); proofFiles.push({id:file.id,fileName:file.fileName,mimeType:file.mimeType,sizeBytes:file.sizeBytes,viewUrl:signed.ufsUrl}); }
  return {reference:job.referenceCode,customerName:customer?.customerVisible.displayName,organisation:customer?.customerVisible.companyName,revision:proof.revision,status:state.status,proofFiles,customerVisibleNotes:proof.customerVisibleNotes,placementSummary:proof.placementSummary,designWidthMm:proof.designWidthMm,designHeightMm:proof.designHeightMm,threadColorSummary:proof.threadColorSummary,issuedAt:state.issuedAt,decision:state.decision};
}

function decisionFor(parsed:ReturnType<typeof parseDecisionInput>,source:ProofDecision["source"],uid?:string):ProofDecision { return {type:parsed.decision,source,approverName:parsed.approverName,...(parsed.comment?{comment:parsed.comment}:{}),...(uid?{decidedByUid:uid}:{}),decidedAt:new Date().toISOString()}; }

export async function decideProofByToken(token:string,raw:unknown){
  const parsed=parseDecisionInput(raw); const resolved=await resolveTokenRecord(token); const db=getAdminDb(); const now=new Date().toISOString();
  return db.runTransaction(async(transaction)=>{
    const accessSnapshot=await transaction.get(resolved.accessRef); if(!accessSnapshot.exists||accessSnapshot.data()?.active!==true) throw new PurePressArtworkProofError("This proof link is no longer active.",409);
    const stateRef=db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(resolved.proofId); const projectRef=db.collection("projects").doc(resolved.orderId); const [stateSnapshot,projectSnapshot]=await Promise.all([transaction.get(stateRef),transaction.get(projectRef)]);
    if(!stateSnapshot.exists||!projectSnapshot.exists) throw new PurePressArtworkProofError("Proof state is unavailable.",409); const state=stateSnapshot.data() as ProofState; const job=projectSnapshot.data()?.purepress as EmbroideryJob;
    if(state.status!=="awaiting_customer"||state.activeTokenHash!==resolved.hash||job.internal.artworkWorkflow?.currentProofId!==resolved.proofId) throw new PurePressArtworkProofError("Only the current awaiting proof can be decided.",409);
    const decision=decisionFor(parsed,"secure_link"); transaction.update(resolved.accessRef,{decisionRecordedAt:now}); transaction.update(stateRef,{status:decision.type,decision,updatedAt:now});
    transaction.update(projectRef,{"purepress.status":"artwork_proof",purepress_order_status:"artwork_proof","purepress.internal.readiness.proof":decision.type,"purepress.internal.readiness.production":"not_ready","purepress.internal.nextAction":decision.type==="approved"?{actor:"owner",action:"Confirm final artwork and sample readiness",readinessArea:"artwork"}:{actor:"owner",action:"Prepare a revised artwork proof",readinessArea:"proof",blocker:"Customer requested changes"},"purepress.updatedAt":now,updatedAt:now});
    return {status:decision.type};
  });
}

export async function recordOwnerProofApproval(projectId:string,raw:unknown,ownerUid="purepress-admin"){
  const parsed=parseDecisionInput({...((raw&&typeof raw==="object")?raw:{}),decision:"approve"}); const db=getAdminDb(); const projectRef=db.collection("projects").doc(projectId.trim()); const now=new Date().toISOString();
  return db.runTransaction(async(transaction)=>{
    const projectSnapshot=await transaction.get(projectRef); if(!projectSnapshot.exists||projectSnapshot.data()?.purepress_schema!==PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("PurePress job not found."),{status:404}); const job=projectSnapshot.data()?.purepress as EmbroideryJob; const proofId=job.internal.artworkWorkflow?.currentProofId; if(!proofId) throw new PurePressArtworkProofError("No current proof exists.",409);
    const stateRef=db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(proofId); const stateSnapshot=await transaction.get(stateRef); if(!stateSnapshot.exists) throw new PurePressArtworkProofError("Current proof state is missing.",409); const state=stateSnapshot.data() as ProofState; if(state.status!=="awaiting_customer") throw new PurePressArtworkProofError("This proof already has a decision.",409);
    const decision=decisionFor(parsed,"owner_recorded",ownerUid); if(state.activeTokenHash) transaction.update(db.collection(PUREPRESS_PROOF_ACCESS_COLLECTION).doc(state.activeTokenHash),{decisionRecordedAt:now});
    transaction.update(stateRef,{status:"approved",decision,updatedAt:now}); transaction.update(projectRef,{"purepress.status":"artwork_proof",purepress_order_status:"artwork_proof","purepress.internal.readiness.proof":"approved","purepress.internal.readiness.production":"not_ready","purepress.internal.nextAction":{actor:"owner",action:"Confirm final artwork and sample readiness",readinessArea:"artwork"},"purepress.updatedAt":now,updatedAt:now}); return {status:"approved",proofId};
  });
}

export async function getCurrentProofState(projectId:string){ const db=getAdminDb(); const projectSnapshot=await db.collection("projects").doc(projectId.trim()).get(); const proofId=(projectSnapshot.data()?.purepress as EmbroideryJob|undefined)?.internal.artworkWorkflow?.currentProofId; if(!proofId)return null; const state=await db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(proofId).get(); return state.exists?state.data() as ProofState:null; }
export async function getProofHistory(projectId:string){ const snapshot=await getAdminDb().collection(PUREPRESS_PROOFS_COLLECTION).where("projectId","==",projectId).get(); const proofs=snapshot.docs.map((d)=>d.data() as ProofRevision).sort((a,b)=>b.revision-a.revision); const rows=[]; for(const proof of proofs){const state=await getAdminDb().collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(proof.id).get();rows.push({...proof,state:state.exists?state.data() as ProofState:null});} return rows; }
