import type { EmbroideryJob, ProofState, ProductionPlan, QualityCheckItem, QualityCheckState } from "./domain";
import { canFinalizeArtwork } from "./artworkProof";

export const PUREPRESS_PRODUCTION_ACTIONS = [
  "update_receiving", "update_plan", "schedule", "start", "pause", "resume", "progress", "finish", "update_qc", "pass_qc", "complete", "update_next_action", "add_note",
] as const;
export type PurePressProductionAction = (typeof PUREPRESS_PRODUCTION_ACTIONS)[number];
export const QC_CHECK_KEYS = ["placement_alignment","orientation","thread_colour","stitch_quality_tension","backing_stabilisation","hooping_marks","loose_threads_cleanup","garment_damage","quantity","names_monograms_variants","overall_finish"] as const;
export type QualityCheckKey = (typeof QC_CHECK_KEYS)[number];
export const QC_STATES: readonly QualityCheckState[] = ["not_checked","passed","issue","not_applicable"];

export class PurePressProductionError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) { super(message); this.name = "PurePressProductionError"; this.status = status; this.code = code; }
}
function clean(value: unknown, max = 600) { return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : ""; }
export function boundedInt(value: unknown, label: string, max = 1_000_000, allowZero = true) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1) || n > max) throw new PurePressProductionError(`${label} must be a whole number between ${allowZero ? 0 : 1} and ${max}.`);
  return n;
}
export function parseProductionAction(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new PurePressProductionError("A production action is required.");
  const input = raw as Record<string, unknown>; const action = clean(input.action, 60) as PurePressProductionAction;
  if (!(PUREPRESS_PRODUCTION_ACTIONS as readonly string[]).includes(action)) throw new PurePressProductionError("Production action is not supported.");
  const clientMutationId = clean(input.clientMutationId, 100);
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(clientMutationId)) throw new PurePressProductionError("A valid operation ID is required.");
  const baseVersion = boundedInt(input.baseVersion ?? 0, "Saved job version", Number.MAX_SAFE_INTEGER);
  const expectedUpdatedAt = clean(input.expectedUpdatedAt, 50) || undefined;
  return { input, action, clientMutationId, baseVersion, expectedUpdatedAt };
}
export function coherentProgress(plan: ProductionPlan) {
  const target = plan.targetQuantity ?? 0, completed = plan.completedQuantity ?? 0, rejected = plan.rejectedQuantity ?? 0, rework = plan.reworkQuantity ?? 0;
  if (![target, completed, rejected, rework].every(Number.isInteger) || [target, completed, rejected, rework].some((n) => n < 0)) return { ok:false, reason:"Production quantities must be non-negative whole numbers." } as const;
  if (target <= 0) return { ok:false, reason:"Set a production target quantity before finishing." } as const;
  if (completed + rejected > target + rework) return { ok:false, reason:"Completed and rejected quantities exceed the supported production total." } as const;
  if (completed < target) return { ok:false, reason:`Production progress is ${completed} of ${target}; record the full run before finishing.` } as const;
  return { ok:true } as const;
}
export function receivingGate(job: EmbroideryJob) {
  const readiness = job.internal.readiness;
  if (!readiness) return { ok:false, reason:"Job readiness is missing." } as const;
  if (readiness.items === "issue") return { ok:false, reason:"Resolve the receiving issue before production." } as const;
  const expected = job.internal.receiving?.reduce((sum, row) => sum + (row.quantityExpected ?? row.quantityRequired ?? 0), 0) ?? 0;
  const received = job.internal.receiving?.reduce((sum, row) => sum + (row.quantityReceived ?? 0), 0) ?? 0;
  const issues = job.internal.receiving?.filter((row) => (row.shortage ?? 0) > 0 || row.condition === "issue" || row.condition === "damaged" || Boolean(row.issueNotes?.trim())) ?? [];
  if (issues.length) return { ok:false, reason:"Receiving has an unresolved shortage or garment issue." } as const;
  const requiredForRun = job.internal.productionPlan?.targetQuantity ?? job.customerVisible.quantity ?? expected;
  if (received <= 0) return { ok:false, reason:"Record the garments/items physically available for this production run before starting." } as const;
  if (expected > 0 && received < expected) return { ok:false, reason:`Only ${received} of ${expected} expected item(s) are recorded as received.` } as const;
  if (requiredForRun > 0 && received < requiredForRun) return { ok:false, reason:`Only ${received} of ${requiredForRun} item(s) required for this run are recorded as available.` } as const;
  if (readiness.items !== "received" && readiness.items !== "partially_received") return { ok:false, reason:"Required garments/items are not deliberately recorded as received." } as const;
  return { ok:true } as const;
}
export function canStartProduction(job: EmbroideryJob, proofState?: ProofState | null) {
  if (job.status !== "approved_for_production") return { ok:false, reason:"Only an approved-for-production job can be started." } as const;
  const artwork = canFinalizeArtwork(job, proofState); if (!artwork.ok) return artwork;
  if (!job.internal.artworkWorkflow?.finalArtworkReadyAt) return { ok:false, reason:"Patch F final artwork readiness has not been recorded." } as const;
  const receiving = receivingGate(job); if (!receiving.ok) return receiving;
  return { ok:true } as const;
}
export function qcHasIssues(checks: readonly QualityCheckItem[] | undefined) { return Boolean(checks?.some((item) => item.state === "issue")); }
export function qcCanPass(checks: readonly QualityCheckItem[] | undefined) {
  if (!checks?.length) return { ok:false, reason:"Record the applicable quality checks before passing QC." } as const;
  if (qcHasIssues(checks)) return { ok:false, reason:"Resolve quality-check issues before marking the job ready." } as const;
  const applicable = checks.filter((item) => item.state !== "not_applicable");
  if (!applicable.length || applicable.some((item) => item.state !== "passed")) return { ok:false, reason:"Every applicable quality check must be deliberately passed." } as const;
  return { ok:true } as const;
}
export function deterministicNextAction(job: EmbroideryJob) {
  const r = job.internal.readiness; const plan = job.internal.productionPlan;
  if (r?.items === "issue" || (job.internal.receiving ?? []).some((x)=>(x.shortage??0)>0 || Boolean(x.issueNotes))) return { actor:"owner", action:"Resolve garment receiving issue", readinessArea:"items", blocker:"Receiving issue" } as const;
  if (job.status === "approved_for_production" && r?.production === "not_ready") return { actor:"owner", action: plan?.machineAssignment ? "Start production" : "Assign machine and schedule embroidery", readinessArea:"production" } as const;
  if (job.status === "in_production" && r?.production === "paused") return { actor:"owner", action:`Resume ${plan?.machineAssignment || "production"}`, readinessArea:"production" } as const;
  if (job.status === "in_production") return { actor:"owner", action:`Continue ${plan?.machineAssignment || "production"} run`, readinessArea:"production" } as const;
  if (job.status === "quality_check" && r?.qc === "issue") return { actor:"owner", action:"Resolve quality-check issue", readinessArea:"qc", blocker:"QC issue" } as const;
  if (job.status === "quality_check") return { actor:"owner", action:"Run final quality check", readinessArea:"qc" } as const;
  if (job.status === "ready") return { actor:"customer", action:"Contact customer for collection", readinessArea:"production" } as const;
  return job.internal.nextAction ?? { actor:"owner", action:"Review job", readinessArea:"production" } as const;
}
