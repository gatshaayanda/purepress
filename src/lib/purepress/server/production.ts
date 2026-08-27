import "server-only";
import { getAdminDb } from "@/utils/firebaseAdmin";
import type { Customer, EmbroideryJob, ProductionUpdate, ProofState, QualityCheckItem, SupplySource } from "../domain";
import type { SupplyReceivingFact } from "../readiness";
import { canStartProduction, coherentProgress, deterministicNextAction, parseProductionAction, PurePressProductionError, qcCanPass, QC_CHECK_KEYS, QC_STATES } from "../production";
import { PUREPRESS_PROJECT_SCHEMA } from "../projectCompatibility";
import { PUREPRESS_CUSTOMERS_COLLECTION } from "./customers";
import { PUREPRESS_PROOF_STATES_COLLECTION } from "./proofs";

const PROJECTS = "projects";
const UPDATES = "productionUpdates";
const RECEIPTS = "mutationReceipts";
const DEFAULT_QC_LABELS: Record<string,string> = {
  placement_alignment:"Placement / alignment", orientation:"Orientation", thread_colour:"Thread colour", stitch_quality_tension:"Stitch quality / tension",
  backing_stabilisation:"Backing / stabilisation", hooping_marks:"Hooping / marks", loose_threads_cleanup:"Loose threads / cleanup", garment_damage:"Garment damage",
  quantity:"Quantity", names_monograms_variants:"Names / monograms / variants", overall_finish:"Overall finish",
};
function clean(value: unknown, max = 800) { return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max) : ""; }
function optionalInt(value: unknown, label: string, max = 1_000_000) {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > max) throw new PurePressProductionError(`${label} must be a whole number between 0 and ${max}.`); return n;
}
function readiness(job: EmbroideryJob) { return { payment:"not_required_yet", items:"unknown", artwork:"missing", proof:"not_started", sample:"not_required", production:"not_ready", qc:"not_started", ...(job.internal.readiness ?? {}) } as NonNullable<EmbroideryJob["internal"]["readiness"]>; }
function version(job: EmbroideryJob) { const v = job.internal.operationsVersion; return Number.isInteger(v) && Number(v) >= 0 ? Number(v) : 0; }
function defaultQc(): QualityCheckItem[] { return QC_CHECK_KEYS.map((key) => ({ key, label:DEFAULT_QC_LABELS[key] ?? key, state:"not_checked" })); }
function updateReceiving(job: EmbroideryJob, input: Record<string, unknown>, now: string, ownerUid: string) {
  const itemSpecification = clean(input.itemSpecification, 220) || "Job garments/items";
  const id = clean(input.receivingId, 80) || "primary";
  const expected = optionalInt(input.expectedQuantity, "Expected quantity"); const received = optionalInt(input.receivedQuantity, "Received quantity");
  const shortage = optionalInt(input.shortageQuantity, "Shortage quantity"); const extras = optionalInt(input.extraQuantity, "Extra quantity");
  const source = clean(input.supplySource, 40); const condition = clean(input.condition, 30); const issueNotes = clean(input.issueNotes, 600);
  if (expected !== undefined && received !== undefined && received + (shortage ?? 0) < expected && !issueNotes) throw new PurePressProductionError("Record the known shortage or issue when received quantity is below expected quantity.");
  const rows = [...(job.internal.receiving ?? [])]; const idx = rows.findIndex((x)=>x.id===id); const previous = idx >= 0 ? rows[idx] : undefined;
  const row: SupplyReceivingFact = { ...(previous ?? {}), id, itemSpecification, lastReceivingUpdateAt:now, receivedBy:ownerUid };
  if (["customer_supplied","purepress_supplied"].includes(source)) row.supplySource = source as SupplyReceivingFact["supplySource"];
  if (expected !== undefined) { row.quantityExpected=expected; row.quantityRequired=expected; }
  if (received !== undefined) row.quantityReceived=received;
  if (shortage !== undefined) row.shortage=shortage; if (extras !== undefined) row.extras=extras;
  if (["good","mixed","damaged","issue"].includes(condition)) row.condition=condition as SupplyReceivingFact["condition"];
  if (issueNotes) row.issueNotes=issueNotes; else if (input.resolveIssue===true) delete row.issueNotes;
  const receivedAt=clean(input.receivedAt,40); if (receivedAt) row.receivedDate=receivedAt; else if ((received??0)>0 && !row.receivedDate) row.receivedDate=now;
  if (idx>=0) rows[idx]=row; else rows.push(row);
  const r=readiness(job); const allExpected=rows.reduce((s,x)=>s+(x.quantityExpected??x.quantityRequired??0),0); const allReceived=rows.reduce((s,x)=>s+(x.quantityReceived??0),0);
  const hasIssue=rows.some((x)=>(x.shortage??0)>0 || x.condition==="damaged" || x.condition==="issue" || Boolean(x.issueNotes));
  if (hasIssue) r.items="issue"; else if (allExpected>0 && allReceived>=allExpected) r.items="received"; else if (allReceived>0) r.items="partially_received"; else if (input.procurementOrdered===true) r.items="ordered";
  return { rows, r, note: issueNotes || `${allReceived} of ${allExpected || "unrecorded"} item(s) received` };
}
function updatePlan(job: EmbroideryJob, input: Record<string, unknown>, now: string) {
  const plan={...(job.internal.productionPlan??{})}; const machine=clean(input.machineAssignment,120); const operator=clean(input.operatorName,120); const notes=clean(input.productionNotes,1600);
  if (Object.hasOwn(input,"machineAssignment")) { if(machine) plan.machineAssignment=machine; else delete plan.machineAssignment; }
  if (Object.hasOwn(input,"operatorName")) { if(operator) plan.operatorName=operator; else delete plan.operatorName; }
  if (Object.hasOwn(input,"productionNotes")) { if(notes) plan.productionNotes=notes; else delete plan.productionNotes; }
  for (const [key,field] of [["scheduledStartAt","scheduledStartAt"],["scheduledDueAt","scheduledDueAt"]] as const) { if(Object.hasOwn(input,key)){ const v=clean(input[key],40); if(v) plan[field]=v; else delete plan[field]; } }
  for (const [key,label] of [["targetQuantity","Target quantity"],["completedQuantity","Completed quantity"],["rejectedQuantity","Rejected quantity"],["reworkQuantity","Rework quantity"]] as const) { if(Object.hasOwn(input,key)){ const v=optionalInt(input[key],label); if(v===undefined) delete plan[key]; else plan[key]=v; } }
  const r=readiness(job); if (job.status==="approved_for_production" && plan.scheduledStartAt) r.production="scheduled"; else if (job.status==="approved_for_production" && r.production==="not_ready") r.production="ready";
  return {plan,r,note:machine ? `Machine: ${machine}` : notes || "Production plan updated"};
}
function publicResult(job: EmbroideryJob) { return { projectId:job.projectId, status:job.status, operationsVersion:version(job), readiness:job.internal.readiness, receiving:job.internal.receiving??[], productionPlan:job.internal.productionPlan??{}, qualityChecks:job.internal.qualityChecks??[], nextAction:job.internal.nextAction??null, completion:job.internal.completion??null, updatedAt:job.updatedAt }; }

export async function getProductionBundle(projectId: string) {
  const db=getAdminDb(); const ref=db.collection(PROJECTS).doc(projectId.trim()); const snap=await ref.get();
  if(!snap.exists || snap.data()?.purepress_schema!==PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("PurePress job not found."),{status:404});
  const job=snap.data()?.purepress as EmbroideryJob; const history=await ref.collection(UPDATES).orderBy("createdAt","desc").limit(80).get();
  return {...publicResult(job), referenceCode:job.referenceCode, quantity:job.customerVisible.quantity??null, supplySource:job.supplySource??"unknown", history:history.docs.map((d)=>d.data() as ProductionUpdate)};
}

export async function listProductionDesk(limit=120) {
  const db=getAdminDb(); const snapshot=await db.collection(PROJECTS).where("purepress_schema","==",PUREPRESS_PROJECT_SCHEMA).limit(Math.max(1,Math.min(150,limit))).get(); const rows=[] as any[];
  for(const doc of snapshot.docs){ const job=doc.data().purepress as EmbroideryJob; if(!job || ["completed","cancelled"].includes(job.status)) continue; const customerSnap=await db.collection(PUREPRESS_CUSTOMERS_COLLECTION).doc(job.customerId).get(); const customer=customerSnap.exists ? customerSnap.data() as Customer : null; const plan=job.internal.productionPlan??{}; const r=readiness(job); const receiving=job.internal.receiving??[]; rows.push({projectId:job.projectId,referenceCode:job.referenceCode,customer:customer?.customerVisible.displayName??"Customer",organisation:customer?.customerVisible.companyName??null,itemSummary:job.customerVisible.customItemDescription||job.customerVisible.title,quantity:job.customerVisible.quantity??null,requestedDate:job.customerVisible.requestedDate??null,timingFlexible:job.customerVisible.timingFlexible===true,supplySource:job.supplySource??"unknown",status:job.status,itemsReadiness:r.items,artworkReadiness:r.artwork,proofReadiness:r.proof,productionReadiness:r.production,qcReadiness:r.qc,machineAssignment:plan.machineAssignment??null,targetQuantity:plan.targetQuantity??job.customerVisible.quantity??null,completedQuantity:plan.completedQuantity??0,rejectedQuantity:plan.rejectedQuantity??0,receivingExpected:receiving.reduce((s,x)=>s+(x.quantityExpected??x.quantityRequired??0),0),receivingReceived:receiving.reduce((s,x)=>s+(x.quantityReceived??0),0),blocker:job.internal.nextAction?.blocker??null,nextAction:job.internal.nextAction??deterministicNextAction(job),operationsVersion:version(job),updatedAt:job.updatedAt}); }
  return rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function performProductionMutation(projectId:string, raw:unknown, ownerUid:string) {
  const {input,action,clientMutationId,baseVersion,expectedUpdatedAt}=parseProductionAction(raw); const db=getAdminDb(); const projectRef=db.collection(PROJECTS).doc(projectId.trim()); const receiptRef=projectRef.collection(RECEIPTS).doc(clientMutationId); const updateRef=projectRef.collection(UPDATES).doc();
  return db.runTransaction(async(transaction)=>{
    const [projectSnap,receiptSnap]=await Promise.all([transaction.get(projectRef),transaction.get(receiptRef)]);
    if(receiptSnap.exists) return {replayed:true,...(receiptSnap.data()?.result??{})};
    if(!projectSnap.exists || projectSnap.data()?.purepress_schema!==PUREPRESS_PROJECT_SCHEMA) throw Object.assign(new Error("PurePress job not found."),{status:404});
    let job=projectSnap.data()?.purepress as EmbroideryJob; const currentVersion=version(job); if(baseVersion!==currentVersion || (expectedUpdatedAt && expectedUpdatedAt!==job.updatedAt)) throw new PurePressProductionError("This job changed while you were offline. Review the latest job before applying this saved update.",409,"operations_conflict");
    let proofState:ProofState|null=null; if(action==="start"){ const proofId=job.internal.artworkWorkflow?.currentProofId; if(proofId){const proofSnap=await transaction.get(db.collection(PUREPRESS_PROOF_STATES_COLLECTION).doc(proofId)); proofState=proofSnap.exists?proofSnap.data() as ProofState:null;} }
    const now=new Date().toISOString(); const r=readiness(job); let internal={...job.internal,readiness:r}; let historyType:ProductionUpdate["type"]="production_note"; let note=clean(input.note,1000); const fromState=`${job.status}/${r.production}/${r.qc}`;
    if(action==="update_receiving"){const x=updateReceiving(job,input,now,ownerUid); internal={...internal,receiving:x.rows,readiness:x.r}; historyType="receiving_update"; note=x.note;}
    else if(action==="update_plan"||action==="schedule"){const x=updatePlan(job,input,now); internal={...internal,productionPlan:x.plan,readiness:x.r};historyType=action==="schedule"||x.r.production==="scheduled"?"scheduled":"production_note";note=x.note;}
    else if(action==="start"){const gate=canStartProduction(job,proofState);if(!gate.ok)throw new PurePressProductionError(gate.reason,409);const plan={...(internal.productionPlan??{})};if(!(plan.targetQuantity&&plan.targetQuantity>0))throw new PurePressProductionError("Set the production target quantity before starting.",409);plan.productionStartedAt=now;delete plan.productionPausedAt;r.production="running";r.qc="not_started";job={...job,status:"in_production"};internal={...internal,productionPlan:plan,readiness:r};historyType="production_started";note=note||"Production started";}
    else if(action==="pause"){if(job.status!=="in_production"||r.production!=="running")throw new PurePressProductionError("Only a running production job can be paused.",409);const plan={...(internal.productionPlan??{}),productionPausedAt:now};r.production="paused";internal={...internal,productionPlan:plan,readiness:r};historyType="paused";note=note||"Production paused";}
    else if(action==="resume"){if(job.status!=="in_production"||r.production!=="paused")throw new PurePressProductionError("Only a paused production job can be resumed.",409);const plan={...(internal.productionPlan??{})};delete plan.productionPausedAt;r.production="running";internal={...internal,productionPlan:plan,readiness:r};historyType="resumed";note=note||"Production resumed";}
    else if(action==="progress"){if(job.status!=="in_production"||!["running","paused"].includes(r.production))throw new PurePressProductionError("Production progress can only be recorded during an active run.",409);const plan={...(internal.productionPlan??{})};for(const [k,l] of [["completedQuantity","Completed quantity"],["rejectedQuantity","Rejected quantity"],["reworkQuantity","Rework quantity"]] as const){if(Object.hasOwn(input,k)){const v=optionalInt(input[k],l);if(v!==undefined)plan[k]=v;}}const target=plan.targetQuantity??0;if((plan.completedQuantity??0)>target)throw new PurePressProductionError("Completed quantity cannot exceed the production target without revising the target first.");if((plan.rejectedQuantity??0)>target+(plan.reworkQuantity??0))throw new PurePressProductionError("Rejected quantity is not coherent with the target and rework quantity.");internal={...internal,productionPlan:plan};historyType="progress";note=note||`Progress ${plan.completedQuantity??0} of ${target}`;}
    else if(action==="finish"){if(job.status!=="in_production")throw new PurePressProductionError("Only an in-production job can be finished.",409);const plan={...(internal.productionPlan??{})};const coherent=coherentProgress(plan);if(!coherent.ok)throw new PurePressProductionError(coherent.reason,409);plan.productionCompletedAt=now;r.production="complete";r.qc="pending";job={...job,status:"quality_check"};internal={...internal,productionPlan:plan,qualityChecks:internal.qualityChecks?.length?internal.qualityChecks:defaultQc(),readiness:r};historyType="production_finished";note=note||"Production finished; final quality check required";}
    else if(action==="update_qc"){if(job.status!=="quality_check")throw new PurePressProductionError("Quality checks are available after production is finished.",409);const key=clean(input.key,80);const state=clean(input.state,30);if(!QC_CHECK_KEYS.includes(key as any)||!QC_STATES.includes(state as any))throw new PurePressProductionError("Quality-check item or result is invalid.");const checks=[...(internal.qualityChecks?.length?internal.qualityChecks:defaultQc())];const idx=checks.findIndex(x=>x.key===key);const issueNote=clean(input.issueNote,600);if(state==="issue"&&!issueNote)throw new PurePressProductionError("Describe the quality issue before saving it.");checks[idx]={...checks[idx],state:state as any,updatedAt:now,updatedBy:ownerUid,...(issueNote?{issueNote}: {})};if(state!=="issue")delete checks[idx].issueNote;r.qc=checks.some(x=>x.state==="issue")?"issue":"pending";internal={...internal,qualityChecks:checks,readiness:r};historyType=state==="issue"?"qc_issue":"qc_started";note=issueNote||`${checks[idx].label}: ${state.replaceAll("_"," ")}`;}
    else if(action==="pass_qc"){if(job.status!=="quality_check"||r.production!=="complete")throw new PurePressProductionError("Production must be complete before final QC can pass.",409);const gate=qcCanPass(internal.qualityChecks);if(!gate.ok)throw new PurePressProductionError(gate.reason,409);r.qc="passed";job={...job,status:"ready"};internal={...internal,readiness:r};historyType="ready";note=note||"Final quality check passed; job ready";}
    else if(action==="complete"){if(job.status!=="ready"||r.qc!=="passed")throw new PurePressProductionError("Only a genuinely ready job can be completed.",409);job={...job,status:"completed"};internal={...internal,completion:{completedAt:now,completedBy:ownerUid,...(note?{completionNote:note}:{})}};historyType="completed";note=note||"Customer handoff completed";}
    else if(action==="update_next_action"){const next=clean(input.nextAction,240);if(!next)throw new PurePressProductionError("Next action is required.");internal={...internal,nextAction:{actor:"owner",action:next,...(clean(input.blocker,300)?{blocker:clean(input.blocker,300)}:{})}};historyType="next_action";note=next;}
    else if(action==="add_note"){if(!note)throw new PurePressProductionError("Production note is required.");historyType="production_note";const plan={...(internal.productionPlan??{}),productionNotes:note};internal={...internal,productionPlan:plan};}
    const newVersion=currentVersion+1; const tentative={...job,internal:{...internal,operationsVersion:newVersion},updatedAt:now}; if(action!=="update_next_action")tentative.internal.nextAction=deterministicNextAction(tentative); job=tentative;
    const toState=`${job.status}/${job.internal.readiness?.production}/${job.internal.readiness?.qc}`; const history:ProductionUpdate={id:updateRef.id,projectId:job.projectId,orderId:job.id,type:historyType,createdAt:now,actor:"owner",actorUid:ownerUid,...(note?{note}:{}),...(job.internal.productionPlan?.machineAssignment?{machineAssignment:job.internal.productionPlan.machineAssignment}:{}),...(job.internal.productionPlan?.completedQuantity!==undefined?{quantityCompleted:job.internal.productionPlan.completedQuantity}:{}),...(job.internal.productionPlan?.rejectedQuantity!==undefined?{quantityRejected:job.internal.productionPlan.rejectedQuantity}:{}),...(job.internal.productionPlan?.reworkQuantity!==undefined?{quantityRework:job.internal.productionPlan.reworkQuantity}:{}),fromState,toState};
    const result=publicResult(job); transaction.update(projectRef,{purepress:job,purepress_order_status:job.status,updatedAt:now}); transaction.create(updateRef,history); transaction.create(receiptRef,{id:clientMutationId,projectId:job.projectId,clientMutationId,action,operationsVersion:newVersion,createdAt:now,result}); return {replayed:false,...result};
  });
}
