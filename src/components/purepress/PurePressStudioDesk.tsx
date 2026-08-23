"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import styles from "./PurePressStudioDesk.module.css";

interface NextAction {
  actor: "owner" | "customer" | "supplier" | "system";
  action: string;
  dueAt?: string;
  readinessArea?: string;
  blocker?: string;
}

interface JobSummary {
  projectId: string;
  referenceCode: string;
  customer: string;
  organisation: string | null;
  itemSummary: string;
  quantity: number | null;
  supplySource: string;
  status: string;
  nextAction: NextAction | null;
  blocker: string | null;
  readinessSignal: string;
  requestedDate: string | null;
  timingFlexible: boolean;
  updatedAt: string;
  classification: {
    attention: boolean;
    waitingOnCustomer: boolean;
    inProduction: boolean;
    readyDueNext: boolean;
    attentionReasons: string[];
  };
}

type DeskView = "attention" | "waiting" | "production" | "ready" | "all";

const categoryOptions = [
  ["corporate_uniforms", "Corporate uniforms"], ["school_items", "School items"],
  ["team_wear", "Team wear"], ["shirts_polos", "Shirts / polos"],
  ["jackets_workwear", "Jackets / workwear"], ["bags", "Bags"], ["towels", "Towels"],
  ["leather", "Leather"], ["gifts_promotional", "Gifts / promotional"], ["custom", "Custom item"],
] as const;

const placementOptions = [
  ["left_chest", "Left chest"], ["right_chest", "Right chest"], ["sleeve", "Sleeve"],
  ["back", "Back"], ["badge_position", "Badge position"], ["pocket", "Pocket"],
  ["bag_towel_position", "Bag / towel position"], ["other", "Other"],
] as const;

const supplyLabels: Record<string, string> = {
  customer_supplied: "Customer supplied",
  purepress_supplied: "PurePress supplied",
  mixed: "Mixed supply",
  unknown: "Not decided",
};

const friendly = (value: string) => supplyLabels[value] ?? value.replaceAll("_", " ");

async function ownerFetch(url: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers, cache: "no-store", credentials: "include" });
}

export default function PurePressStudioDesk() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [view, setView] = useState<DeskView>("attention");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await ownerFetch("/api/admin/purepress/jobs");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load the PurePress order desk.");
      setJobs(data.jobs ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the PurePress order desk.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  const groups = useMemo(() => ({
    attention: jobs.filter((job) => job.classification.attention),
    waiting: jobs.filter((job) => job.classification.waitingOnCustomer),
    production: jobs.filter((job) => job.classification.inProduction),
    ready: jobs.filter((job) => job.classification.readyDueNext),
    all: jobs,
  }), [jobs]);
  const visibleJobs = groups[view];

  return (
    <section className={styles.shell} aria-labelledby="purepress-order-desk-heading">
      <div className={styles.heroRow}>
        <div>
          <p className="pp-kicker">PUREPRESS STUDIO</p>
          <h1 id="purepress-order-desk-heading">Order Desk</h1>
          <p>Real jobs, current readiness, and the next useful action—without turning WhatsApp or memory into the production system.</p>
        </div>
        <button type="button" className={styles.addButton} onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? "CLOSE ADD JOB" : "ADD JOB"}
        </button>
      </div>

      {showCreate && <OwnerCreatedJobForm onCreated={async () => { setShowCreate(false); await loadJobs(); }} />}

      <div className={styles.viewTabs} role="tablist" aria-label="Order desk views">
        <DeskTab active={view === "attention"} label="ATTENTION" count={groups.attention.length} onClick={() => setView("attention")} />
        <DeskTab active={view === "waiting"} label="WAITING ON CUSTOMER" count={groups.waiting.length} onClick={() => setView("waiting")} />
        <DeskTab active={view === "production"} label="IN PRODUCTION" count={groups.production.length} onClick={() => setView("production")} />
        <DeskTab active={view === "ready"} label="READY / DUE NEXT" count={groups.ready.length} onClick={() => setView("ready")} />
        <DeskTab active={view === "all"} label="ALL JOBS" count={groups.all.length} onClick={() => setView("all")} />
      </div>

      {loading && <p className={styles.state} role="status">Loading operational jobs…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && !error && visibleJobs.length === 0 && (
        <p className={styles.state}>No real jobs currently match this desk view.</p>
      )}
      {!loading && !error && visibleJobs.length > 0 && (
        <div className={styles.jobs}>
          {visibleJobs.map((job) => <JobRow key={job.projectId} job={job} />)}
        </div>
      )}
    </section>
  );
}

function DeskTab({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={active ? styles.tabActive : styles.tab} onClick={onClick}>
      <span>{label}</span><strong>{count}</strong>
    </button>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  const next = job.nextAction;
  return (
    <article className={styles.jobRow}>
      <div className={styles.jobIdentity}>
        <span className={styles.reference}>{job.referenceCode}</span>
        <h2>{job.customer}{job.organisation ? <small> · {job.organisation}</small> : null}</h2>
        <p>{job.itemSummary} · {job.quantity ?? "—"} item(s) · {friendly(job.supplySource)}</p>
      </div>
      <div className={styles.jobOperational}>
        <span className={styles.status}>{friendly(job.status)}</span>
        <strong>{next?.action || "No next action set"}</strong>
        <p>{next ? `Owner: ${friendly(next.actor)}` : "Set the next operational action"}{next?.dueAt ? ` · Due ${next.dueAt}` : ""}</p>
        {next?.blocker && <p className={styles.blocker}>Blocker: {next.blocker}</p>}
      </div>
      <div className={styles.jobFacts}>
        <span>{job.readinessSignal}</span>
        <span>{job.requestedDate ? `Customer requested: ${job.requestedDate}` : job.timingFlexible ? "Customer timing: flexible" : "Customer timing: not recorded"}</span>
        <small>Updated {new Date(job.updatedAt).toLocaleString()}</small>
      </div>
      <Link className={styles.openButton} href={`/admin/purepress/jobs/${encodeURIComponent(job.projectId)}`}>OPEN JOB</Link>
    </article>
  );
}

function OwnerCreatedJobForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [flexible, setFlexible] = useState(true);
  const [placements, setPlacements] = useState<string[]>(["left_chest"]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const colours = String(form.get("itemColours") || "").split(",").map((value) => value.trim()).filter(Boolean);
    const payload = {
      customerName: form.get("customerName"), organisation: form.get("organisation"),
      email: form.get("email"), phone: form.get("phone"), itemCategory: form.get("itemCategory"),
      customItemDescription: form.get("customItemDescription"), supplySource: form.get("supplySource"),
      quantity: Number(form.get("quantity")), sizeBreakdown: form.get("sizeBreakdown"), itemColours: colours,
      placements: placements.map((position) => ({ position })), requestedDate: flexible ? "" : form.get("requestedDate"),
      timingFlexible: flexible, fulfillmentIntent: form.get("fulfillmentIntent"), customerNotes: form.get("customerNotes"),
      internalNotes: form.get("internalNotes"), status: form.get("status"),
    };
    try {
      const response = await ownerFetch("/api/admin/purepress/jobs", { method: "POST", body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add this job.");
      await onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add this job.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.createForm} onSubmit={submit}>
      <div className={styles.formHeading}><div><span>OFFLINE / OWNER-CREATED WORK</span><h2>Record a customer job</h2></div><p>Phone, WhatsApp, walk-in and existing-customer work use the same operational job model.</p></div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.formGrid}>
        <label>Customer name<input name="customerName" required maxLength={120} /></label>
        <label>Organisation<input name="organisation" maxLength={160} /></label>
        <label>Email<input name="email" type="email" maxLength={254} /></label>
        <label>Phone<input name="phone" maxLength={40} /></label>
        <label>Item category<select name="itemCategory" defaultValue="shirts_polos">{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Custom item description<input name="customItemDescription" maxLength={300} /></label>
        <label>Supply<select name="supplySource" defaultValue="unknown"><option value="unknown">Not decided</option><option value="customer_supplied">Customer supplied</option><option value="purepress_supplied">PurePress supplied</option><option value="mixed">Mixed supply</option></select></label>
        <label>Quantity<input name="quantity" type="number" min={1} max={100000} required defaultValue={1} /></label>
        <label>Size notes<textarea name="sizeBreakdown" maxLength={500} rows={3} /></label>
        <label>Item colours <small>(comma separated)</small><input name="itemColours" maxLength={600} /></label>
      </div>
      <fieldset className={styles.placementFieldset}><legend>Embroidery placement</legend><div>{placementOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={placements.includes(value)} onChange={(event) => setPlacements((current) => event.target.checked ? [...current, value] : current.filter((entry) => entry !== value))} />{label}</label>)}</div></fieldset>
      <div className={styles.formGrid}>
        <label className={styles.checkboxLabel}><input type="checkbox" checked={flexible} onChange={(event) => setFlexible(event.target.checked)} />Customer timing is flexible</label>
        <label>Customer requested date<input name="requestedDate" type="date" disabled={flexible} required={!flexible} /></label>
        <label>Fulfilment intent<select name="fulfillmentIntent" defaultValue="unsure"><option value="unsure">Not sure yet</option><option value="collect">Collect from PurePress</option><option value="delivery_may_be_needed">Delivery may be needed</option></select></label>
        <label>Starting state<select name="status" defaultValue="new_request"><option value="new_request">New request</option><option value="needs_information">Needs information</option></select></label>
        <label>Customer notes<textarea name="customerNotes" maxLength={1500} rows={4} /></label>
        <label>Internal notes<textarea name="internalNotes" maxLength={4000} rows={4} /></label>
      </div>
      <p className={styles.formNote}>Customer requested dates are requests, not promised completion dates. Creating this record does not mark quotation, proof, production or QC work complete.</p>
      <button className={styles.addButton} type="submit" disabled={submitting || placements.length === 0}>{submitting ? "ADDING JOB…" : "ADD OPERATIONAL JOB"}</button>
    </form>
  );
}
