"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import styles from "./PurePressJobWorkspace.module.css";

interface Readiness {
  payment: string; items: string; artwork: string; proof: string; sample: string; production: string; qc: string;
}
interface NextAction { actor: string; action: string; dueAt?: string; readinessArea?: string; blocker?: string; }
interface Job {
  id: string; projectId: string; referenceCode: string; sourceQuoteRequestId?: string; customerId: string; customerUid?: string;
  supplySource?: string; status: string; createdAt: string; updatedAt: string;
  customerVisible: {
    title: string; garmentSummary?: string; itemCategory?: string; customItemDescription?: string; quantity?: number;
    sizeBreakdown?: string; itemColours?: string[]; placements?: Array<{ position: string; notes?: string }>;
    requestedDate?: string; timingFlexible?: boolean; fulfillmentIntent?: string; customerNotes?: string;
  };
  internal: {
    source: string; ownerNotes?: string; readiness?: Readiness; nextAction?: NextAction; sourceQuoteReference?: string; convertedAt?: string;
  };
}
interface Customer { id: string; firebaseUid?: string; customerVisible: { displayName: string; email?: string; phone?: string; companyName?: string }; }
interface ArtworkFile { id: string; fileName: string; mimeType: string; sizeBytes: number; category: string; visibility: string; viewUrl: string; }
interface Detail { job: Job; customer: Customer | null; artworkFiles: ArtworkFile[]; classification: { attention: boolean; waitingOnCustomer: boolean; inProduction: boolean; readyDueNext: boolean; attentionReasons: string[] }; }

const statusLabels: Record<string,string> = {
  new_request: "New request", needs_information: "Needs information", quote_ready: "Quote ready", awaiting_quote_approval: "Awaiting quote approval",
  artwork_proof: "Artwork proof", awaiting_proof_approval: "Awaiting proof approval", approved_for_production: "Approved for production",
  in_production: "In production", quality_check: "Quality check", ready: "Ready", completed: "Completed", cancelled: "Cancelled",
};
const friendly = (value?: string) => value ? statusLabels[value] ?? value.replaceAll("_", " ") : "—";

async function ownerFetch(url: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers, cache: "no-store", credentials: "include" });
}

export default function PurePressJobWorkspace({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load this PurePress job.");
      setDetail(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load this PurePress job."); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function patch(label: string, body: unknown) {
    setSaving(label); setError("");
    try {
      const response = await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}`, { method: "PATCH", body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update this job.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update this job."); }
    finally { setSaving(""); }
  }

  if (loading) return <p className={styles.state} role="status">Opening PurePress job…</p>;
  if (error && !detail) return <p className={styles.error} role="alert">{error}</p>;
  if (!detail) return <p className={styles.state}>Job not found.</p>;
  const { job, customer, artworkFiles } = detail;
  const readiness = job.internal.readiness;
  const earlyStatus = ["new_request", "needs_information", "cancelled"].includes(job.status);

  return (
    <div className={styles.workspace}>
      <div className={styles.backRow}><Link href="/admin">← Back to PurePress Studio</Link><span>{job.referenceCode}</span></div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <header className={styles.header}>
        <div><p className="pp-kicker">JOB WORKSPACE</p><h1>{customer?.customerVisible.displayName || "PurePress customer"}</h1><p>{job.customerVisible.title}</p></div>
        <div className={styles.headerFacts}><span>{friendly(job.status)}</span><strong>{job.customerVisible.quantity ?? "—"} item(s)</strong><small>{friendly(job.supplySource)}</small></div>
      </header>

      <section className={styles.nextAction} aria-labelledby="next-action-heading">
        <div className={styles.sectionTitle}><span>NEXT ACTION</span><h2 id="next-action-heading">What needs to happen next?</h2></div>
        <NextActionEditor action={job.internal.nextAction} saving={saving === "next"} onSave={(value) => patch("next", { nextAction: value })} onClear={() => patch("next", { nextAction: null })} />
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}><div className={styles.sectionTitle}><span>READINESS</span><h2>Operational facts</h2></div>
          {readiness ? <div className={styles.readinessGrid}>{Object.entries(readiness).map(([area,value]) => <div key={area}><span>{friendly(area)}</span><strong>{friendly(String(value))}</strong></div>)}</div> : <p>Readiness has not been recorded.</p>}
          {readiness && <ReadinessEditor readiness={readiness} saving={saving === "readiness"} onSave={(value) => patch("readiness", { readiness: value })} />}
        </section>

        <section className={styles.panel}><div className={styles.sectionTitle}><span>CUSTOMER BRIEF</span><h2>What was requested</h2></div>
          <Fact label="Item" value={job.customerVisible.customItemDescription || friendly(job.customerVisible.itemCategory) || job.customerVisible.title} />
          <Fact label="Sizes" value={job.customerVisible.sizeBreakdown || "Not recorded"} />
          <Fact label="Colours" value={job.customerVisible.itemColours?.join(", ") || "Not recorded"} />
          <Fact label="Placements" value={job.customerVisible.placements?.map((p) => `${friendly(p.position)}${p.notes ? ` — ${p.notes}` : ""}`).join("; ") || "Not recorded"} />
          <Fact label="Customer requested date" value={job.customerVisible.requestedDate || (job.customerVisible.timingFlexible ? "Flexible timing" : "Not recorded")} />
          <Fact label="Fulfilment intent" value={friendly(job.customerVisible.fulfillmentIntent)} />
          <Fact label="Customer notes" value={job.customerVisible.customerNotes || "No customer notes"} />
        </section>

        <section className={styles.panel}><div className={styles.sectionTitle}><span>ARTWORK</span><h2>Source material</h2></div>
          {artworkFiles.length ? <ul className={styles.files}>{artworkFiles.map((file) => <li key={file.id}><a href={file.viewUrl} target="_blank" rel="noreferrer">{file.fileName}</a><small>{friendly(file.category)} · private · {Math.max(1,Math.round(file.sizeBytes/1024))} KB</small></li>)}</ul> : <p>No source artwork file is linked.</p>}
          <p className={styles.warning}>Intake artwork is private source material. It is not automatically cleaned, digitised, proof-approved, production-ready, or public.</p>
        </section>

        <section className={styles.panel}><div className={styles.sectionTitle}><span>CUSTOMER</span><h2>Contact record</h2></div>
          <Fact label="Name" value={customer?.customerVisible.displayName || "Not found"} />
          <Fact label="Organisation" value={customer?.customerVisible.companyName || "—"} />
          <Fact label="Email" value={customer?.customerVisible.email || "—"} />
          <Fact label="Phone" value={customer?.customerVisible.phone || "—"} />
          <Fact label="Account link" value={customer?.firebaseUid ? "Firebase account linked" : "No customer account linked"} />
        </section>
      </div>

      <section className={styles.controls}><div className={styles.sectionTitle}><span>OWNER CONTROLS</span><h2>Owner updates</h2></div>
        <div className={styles.controlGrid}>
          <SupplyEditor value={job.supplySource || "unknown"} saving={saving === "supply"} onSave={(value) => patch("supply", { supplySource: value })} />
          {earlyStatus ? <StatusEditor value={job.status} saving={saving === "status"} onSave={(value) => patch("status", { status: value })} /> : <div className={styles.readOnlyControl}><strong>Status</strong><p>{friendly(job.status)} is managed by the active PurePress workflow.</p></div>}
          <NotesEditor value={job.internal.ownerNotes || ""} saving={saving === "notes"} onSave={(value) => patch("notes", { ownerNotes: value })} />
        </div>
      </section>

      <section className={styles.provenance}><div className={styles.sectionTitle}><span>SOURCE / PROVENANCE</span><h2>How this job entered PurePress</h2></div>
        <Fact label="Project / job ID" value={job.projectId} />
        <Fact label="Source" value={friendly(job.internal.source)} />
        <Fact label="Source quote" value={job.internal.sourceQuoteReference || job.sourceQuoteRequestId || "Owner-created / no source quote"} />
        <Fact label="Created" value={new Date(job.createdAt).toLocaleString()} />
        <Fact label="Converted" value={job.internal.convertedAt ? new Date(job.internal.convertedAt).toLocaleString() : "Not converted from a quote"} />
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div className={styles.fact}><strong>{label}</strong><span>{value}</span></div>; }

function NextActionEditor({ action, saving, onSave, onClear }: { action?: NextAction; saving: boolean; onSave: (value: NextAction) => Promise<void>; onClear: () => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await onSave({ actor: String(form.get("actor")), action: String(form.get("action")), dueAt: String(form.get("dueAt") || "") || undefined, readinessArea: String(form.get("readinessArea") || "") || undefined, blocker: String(form.get("blocker") || "") || undefined }); }
  return <form className={styles.editor} onSubmit={submit}><label>Actor<select name="actor" defaultValue={action?.actor || "owner"}><option value="owner">Owner</option><option value="customer">Customer</option><option value="supplier">Supplier</option><option value="system">System</option></select></label><label className={styles.wide}>Action<input name="action" required maxLength={240} defaultValue={action?.action || ""} placeholder="e.g. Review artwork" /></label><label>Internal due date<input name="dueAt" type="date" defaultValue={action?.dueAt || ""} /></label><label>Readiness area<select name="readinessArea" defaultValue={action?.readinessArea || ""}><option value="">None</option>{["payment","items","artwork","proof","sample","production","qc"].map((v) => <option key={v} value={v}>{friendly(v)}</option>)}</select></label><label className={styles.wide}>Blocker<input name="blocker" maxLength={300} defaultValue={action?.blocker || ""} /></label><div className={styles.actions}><button type="submit" disabled={saving}>{saving ? "SAVING…" : "SAVE NEXT ACTION"}</button>{action && <button type="button" className={styles.secondary} onClick={() => void onClear()} disabled={saving}>CLEAR</button>}</div></form>;
}

function ReadinessEditor({ readiness, saving, onSave }: { readiness: Readiness; saving: boolean; onSave: (value: {items:string;artwork:string}) => Promise<void> }) { async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await onSave({items:String(form.get("items")),artwork:String(form.get("artwork"))}); } return <form className={styles.miniEditor} onSubmit={submit}><label>Items<select name="items" defaultValue={readiness.items}>{["unknown","customer_supplied","needs_procurement","received","issue"].map((v)=><option key={v} value={v}>{friendly(v)}</option>)}</select></label><label>Artwork<select name="artwork" defaultValue={readiness.artwork}>{["missing","received","needs_cleanup","needs_digitizing","issue"].map((v)=><option key={v} value={v}>{friendly(v)}</option>)}</select></label><button type="submit" disabled={saving}>{saving?"SAVING…":"SAVE EARLY READINESS"}</button></form>; }
function SupplyEditor({ value, saving, onSave }: { value:string;saving:boolean;onSave:(value:string)=>Promise<void> }) { const [current,setCurrent]=useState(value); return <div className={styles.control}><strong>Supply</strong><select value={current} onChange={(e)=>setCurrent(e.target.value)}><option value="unknown">Not decided</option><option value="customer_supplied">Customer supplied</option><option value="purepress_supplied">PurePress supplied</option><option value="mixed">Mixed supply</option></select><button type="button" onClick={()=>void onSave(current)} disabled={saving}>{saving?"SAVING…":"SAVE SUPPLY"}</button></div>; }
function StatusEditor({ value, saving, onSave }: { value:string;saving:boolean;onSave:(value:string)=>Promise<void> }) { const [current,setCurrent]=useState(value); return <div className={styles.control}><strong>Early lifecycle state</strong><select value={current} onChange={(e)=>setCurrent(e.target.value)}><option value="new_request">New request</option><option value="needs_information">Needs information</option><option value="cancelled">Cancelled</option></select><button type="button" onClick={()=>void onSave(current)} disabled={saving}>{saving?"SAVING…":"SAVE STATUS"}</button></div>; }
function NotesEditor({ value, saving, onSave }: { value:string;saving:boolean;onSave:(value:string)=>Promise<void> }) { const [current,setCurrent]=useState(value); return <div className={styles.control}><strong>Internal notes</strong><textarea value={current} onChange={(e)=>setCurrent(e.target.value)} maxLength={4000} rows={5} /><button type="button" onClick={()=>void onSave(current)} disabled={saving}>{saving?"SAVING…":"SAVE NOTES"}</button></div>; }
