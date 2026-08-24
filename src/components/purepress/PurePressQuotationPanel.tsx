"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import styles from "./PurePressQuotationPanel.module.css";

type QuoteStatus = "draft" | "ready" | "issued" | "changes_requested" | "accepted" | "superseded" | "void";
type LineCategory = "garment" | "embroidery" | "digitising" | "design" | "delivery" | "other";
interface QuoteLine { id: string; category: LineCategory; description: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number; }
interface Quote {
  id: string; projectId: string; quoteNumber: string; revision: number; currency: "BWP"; status: QuoteStatus;
  customerSnapshot: { displayName: string; organisation?: string; email?: string; phone?: string };
  jobSnapshot: { referenceCode: string; itemSummary: string; quantity?: number; supplySource: string; customerRequestedDate?: string; customerTimingFlexible?: boolean };
  lineItems: QuoteLine[]; subtotalMinor: number; discountMinor: number; tax: { mode: "none" } | { mode: "percentage"; taxRateBps: number; taxLabel?: string };
  taxMinor: number; totalMinor: number; validUntil?: string; customerVisibleNotes?: string; paymentTerms?: string; fulfillmentNotes?: string;
  estimatedTurnaroundText?: string; estimatedCompletionDate?: string; internalNotes?: string; createdAt: string; updatedAt: string; issuedAt?: string; supersededAt?: string;
  decision?: { type: "accepted" | "changes_requested"; source: "secure_link" | "owner_recorded"; decidedAt: string; acceptingName?: string; comment?: string };
}
interface QuoteState { draftQuoteId?: string; currentIssuedQuoteId?: string; latestRevision: number; }
interface Bundle { projectId: string; jobReference: string; jobStatus: string; deskLabel: string; state: QuoteState; quotes: Quote[]; }
interface DraftLine { id: string; category: LineCategory; description: string; quantity: string; unitPrice: string; }

const categoryLabels: Record<LineCategory, string> = {
  garment: "Garment / supplied item", embroidery: "Embroidery / branding", digitising: "Digitising / setup",
  design: "Design / artwork preparation", delivery: "Delivery", other: "Other",
};
const statusLabel = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

async function ownerFetch(url: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
}

function moneyInputToMinor(value: string) {
  const clean = value.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d{0,2})?$/.test(clean)) throw new Error("Money values must use at most two decimal places.");
  const [whole, decimals = ""] = clean.split(".");
  const minor = Number(`${whole}${decimals.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(minor)) throw new Error("Money value is too large.");
  return minor;
}

function percentToBps(value: string) {
  const clean = value.trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(clean)) throw new Error("Tax rate must use at most two decimal places.");
  const [whole, decimals = ""] = clean.split(".");
  const bps = Number(`${whole}${decimals.padEnd(2, "0")}`);
  if (!Number.isInteger(bps) || bps < 1 || bps > 10000) throw new Error("Tax rate must be greater than 0% and no more than 100%.");
  return bps;
}

function minorToInput(minor = 0) { return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`; }
function formatBwp(minor: number) { return `P ${Math.floor(minor / 100).toLocaleString("en-BW")}.${String(minor % 100).padStart(2, "0")}`; }
function newLine(index: number): DraftLine { return { id: `line-${Date.now()}-${index}`, category: "embroidery", description: "", quantity: "1", unitPrice: "0.00" }; }

export default function PurePressQuotationPanel({ projectId }: { projectId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [shareLink, setShareLink] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}/quotes`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load quotation state.");
      setBundle(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load quotation state."); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function createDraft() {
    setBusy("create"); setError("");
    try {
      const response = await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}/quotes`, { method: "POST", body: JSON.stringify({ action: "create_draft" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not create quote.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create quote."); }
    finally { setBusy(""); }
  }

  async function action(quoteId: string, actionName: string, extra: Record<string, unknown> = {}) {
    setBusy(actionName); setError("");
    try {
      const response = await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quoteId)}`, { method: "POST", body: JSON.stringify({ action: actionName, ...extra }) });
      const data = await response.json();
      if (!response.ok) {
        const diagnostic = typeof data.diagnosticId === "string" ? ` Reference: ${data.diagnosticId}.` : "";
        throw new Error(`${data.error || "Quotation action failed."}${diagnostic}`);
      }
      if (typeof data.sharePath === "string" && data.sharePath) setShareLink(`${window.location.origin}${data.sharePath}`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Quotation action failed."); }
    finally { setBusy(""); }
  }

  async function pdf(quote: Quote) {
    setBusy("pdf"); setError("");
    try {
      const response = await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quote.id)}/pdf`);
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Could not generate PDF."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not generate PDF."); }
    finally { setBusy(""); }
  }

  if (loading) return <section className={styles.panel}><p role="status">Loading quotation…</p></section>;
  if (!bundle) return <section className={styles.panel}><p className={styles.error}>{error || "Quotation state unavailable."}</p></section>;
  const draft = bundle.state.draftQuoteId ? bundle.quotes.find((quote) => quote.id === bundle.state.draftQuoteId) : undefined;
  const currentIssued = bundle.state.currentIssuedQuoteId ? bundle.quotes.find((quote) => quote.id === bundle.state.currentIssuedQuoteId) : undefined;
  const primary = draft || currentIssued || bundle.quotes[0];

  return (
    <section className={styles.panel} aria-labelledby="purepress-quotation-heading">
      <div className={styles.heading}>
        <div><p className="pp-kicker">QUOTATION</p><h2 id="purepress-quotation-heading">Commercial quote</h2><p>Price the work, issue an immutable revision, then collect an auditable customer decision.</p></div>
        <span className={styles.stateBadge}>{bundle.deskLabel}</span>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!primary && <div className={styles.empty}><p>No commercial quote exists for this job yet.</p><button type="button" onClick={() => void createDraft()} disabled={busy === "create"}>{busy === "create" ? "CREATING…" : "CREATE QUOTE"}</button></div>}
      {primary?.status === "draft" && <DraftEditor quote={primary} projectId={projectId} busy={busy} onBusy={setBusy} onError={setError} onReload={load} onMarkReady={() => action(primary.id, "mark_ready")} onPdf={() => pdf(primary)} />}
      {primary?.status === "ready" && <ReadyCard quote={primary} busy={busy} onAction={action} onPdf={() => pdf(primary)} />}
      {primary && ["issued","changes_requested","accepted","superseded"].includes(primary.status) && <IssuedCard quote={primary} busy={busy} shareLink={shareLink} onAction={action} onPdf={() => pdf(primary)} />}
      {bundle.quotes.length > 0 && <RevisionHistory quotes={bundle.quotes} onPdf={pdf} busy={busy} />}
    </section>
  );
}

function DraftEditor({ quote, projectId, busy, onBusy, onError, onReload, onMarkReady, onPdf }: { quote: Quote; projectId: string; busy: string; onBusy:(v:string)=>void; onError:(v:string)=>void; onReload:()=>Promise<void>; onMarkReady:()=>Promise<void>; onPdf:()=>Promise<void> }) {
  const [lines, setLines] = useState<DraftLine[]>(quote.lineItems.length ? quote.lineItems.map((line) => ({ id: line.id, category: line.category, description: line.description, quantity: String(line.quantity), unitPrice: minorToInput(line.unitPriceMinor) })) : [newLine(1)]);
  const [discount, setDiscount] = useState(minorToInput(quote.discountMinor));
  const [taxMode, setTaxMode] = useState<"none"|"percentage">(quote.tax.mode);
  const [taxRate, setTaxRate] = useState(quote.tax.mode === "percentage" ? String(quote.tax.taxRateBps / 100) : "");
  const [taxLabel, setTaxLabel] = useState(quote.tax.mode === "percentage" ? quote.tax.taxLabel || "" : "");
  const preview = useMemo(() => {
    try {
      const lineValues = lines.map((line) => ({ quantity: Number(line.quantity), unitPriceMinor: moneyInputToMinor(line.unitPrice) }));
      const subtotal = lineValues.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0);
      const discountMinor = moneyInputToMinor(discount || "0");
      const discounted = Math.max(0, subtotal - discountMinor);
      const taxMinor = taxMode === "percentage" && taxRate ? Math.round(discounted * percentToBps(taxRate) / 10000) : 0;
      return { subtotal, discountMinor, taxMinor, total: discounted + taxMinor };
    } catch { return null; }
  }, [lines, discount, taxMode, taxRate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); onBusy("save"); onError("");
    try {
      const form = new FormData(event.currentTarget);
      const payload = {
        lineItems: lines.map((line) => ({ id: line.id, category: line.category, description: line.description, quantity: Number(line.quantity), unitPriceMinor: moneyInputToMinor(line.unitPrice) })),
        discountMinor: moneyInputToMinor(discount || "0"),
        tax: taxMode === "none" ? { mode: "none" } : { mode: "percentage", taxRateBps: percentToBps(taxRate), taxLabel: taxLabel.trim() },
        validUntil: String(form.get("validUntil") || ""), customerVisibleNotes: String(form.get("customerVisibleNotes") || ""),
        paymentTerms: String(form.get("paymentTerms") || ""), fulfillmentNotes: String(form.get("fulfillmentNotes") || ""),
        estimatedTurnaroundText: String(form.get("estimatedTurnaroundText") || ""), estimatedCompletionDate: String(form.get("estimatedCompletionDate") || ""),
        internalNotes: String(form.get("internalNotes") || ""),
      };
      const response = await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quote.id)}`, { method: "PATCH", body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save quotation draft.");
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.value === "ready") await onMarkReady();
      else await onReload();
    } catch (reason) { onError(reason instanceof Error ? reason.message : "Could not save quotation draft."); }
    finally { onBusy(""); }
  }

  return <form className={styles.editor} onSubmit={submit}>
    <div className={styles.quoteMeta}><strong>{quote.quoteNumber} · R{quote.revision}</strong><span>DRAFT — editable</span></div>
    <div className={styles.lines}>
      {lines.map((line, index) => <div className={styles.line} key={line.id}>
        <label>Type<select value={line.category} onChange={(e)=>setLines((current)=>current.map((item,i)=>i===index?{...item,category:e.target.value as LineCategory}:item))}>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className={styles.description}>Description<input required maxLength={240} value={line.description} onChange={(e)=>setLines((current)=>current.map((item,i)=>i===index?{...item,description:e.target.value}:item))} /></label>
        <label>Qty<input required inputMode="numeric" value={line.quantity} onChange={(e)=>setLines((current)=>current.map((item,i)=>i===index?{...item,quantity:e.target.value}:item))} /></label>
        <label>Unit price (BWP)<input required inputMode="decimal" value={line.unitPrice} onChange={(e)=>setLines((current)=>current.map((item,i)=>i===index?{...item,unitPrice:e.target.value}:item))} /></label>
        <button type="button" className={styles.remove} onClick={()=>setLines((current)=>current.filter((_,i)=>i!==index))} disabled={lines.length===1}>REMOVE</button>
      </div>)}
      <button type="button" className={styles.secondary} onClick={()=>setLines((current)=>[...current,newLine(current.length+1)])} disabled={lines.length>=50}>ADD LINE</button>
    </div>
    <div className={styles.commercialGrid}>
      <label>Discount (BWP)<input inputMode="decimal" value={discount} onChange={(e)=>setDiscount(e.target.value)} /></label>
      <label>Tax<select value={taxMode} onChange={(e)=>setTaxMode(e.target.value as "none"|"percentage")}><option value="none">No tax configured</option><option value="percentage">Percentage tax</option></select></label>
      {taxMode === "percentage" && <><label>Tax rate %<input inputMode="decimal" value={taxRate} onChange={(e)=>setTaxRate(e.target.value)} /></label><label>Tax label<input maxLength={40} placeholder="e.g. VAT — only if applicable" value={taxLabel} onChange={(e)=>setTaxLabel(e.target.value)} /></label></>}
      <label>Valid until<input name="validUntil" type="date" defaultValue={quote.validUntil || ""} /></label>
      <label>Estimated completion<input name="estimatedCompletionDate" type="date" defaultValue={quote.estimatedCompletionDate || ""} /><small>Optional PurePress estimate — not customer requested date.</small></label>
      <label className={styles.wide}>Estimated turnaround<textarea name="estimatedTurnaroundText" maxLength={500} rows={2} defaultValue={quote.estimatedTurnaroundText || ""} /></label>
      <label className={styles.wide}>Payment terms<textarea name="paymentTerms" maxLength={2000} rows={2} defaultValue={quote.paymentTerms || ""} /></label>
      <label className={styles.wide}>Fulfilment / delivery notes<textarea name="fulfillmentNotes" maxLength={2000} rows={2} defaultValue={quote.fulfillmentNotes || ""} /></label>
      <label className={styles.wide}>Customer-visible quote notes<textarea name="customerVisibleNotes" maxLength={2000} rows={3} defaultValue={quote.customerVisibleNotes || ""} /></label>
      <label className={styles.wide}>Internal quotation notes<textarea name="internalNotes" maxLength={4000} rows={3} defaultValue={quote.internalNotes || ""} /></label>
    </div>
    <div className={styles.totals}>{preview ? <><span>Subtotal <strong>{formatBwp(preview.subtotal)}</strong></span>{preview.discountMinor>0&&<span>Discount <strong>{formatBwp(preview.discountMinor)}</strong></span>}{preview.taxMinor>0&&<span>Tax <strong>{formatBwp(preview.taxMinor)}</strong></span>}<span className={styles.grand}>Total BWP <strong>{formatBwp(preview.total)}</strong></span></> : <p>Enter valid line prices to preview totals.</p>}</div>
    <p className={styles.note}>The browser preview is convenience only. The server recalculates every line, discount, tax and total in integer thebe before saving or issuing.</p>
    <div className={styles.actions}><button type="submit" value="save" disabled={Boolean(busy)}>{busy==="save"?"SAVING…":"SAVE DRAFT"}</button><button type="submit" value="ready" disabled={Boolean(busy)}>{busy==="save"?"VALIDATING…":"SAVE + MARK QUOTE READY"}</button><button type="button" className={styles.secondary} onClick={()=>void onPdf()} disabled={Boolean(busy)}>PREVIEW PDF</button></div>
  </form>;
}

function ReadyCard({ quote, busy, onAction, onPdf }: { quote: Quote; busy:string; onAction:(id:string,action:string,extra?:Record<string,unknown>)=>Promise<void>; onPdf:()=>Promise<void> }) {
  return <div className={styles.summary}><div className={styles.quoteMeta}><strong>{quote.quoteNumber} · R{quote.revision}</strong><span>READY</span></div><QuoteCommercialSummary quote={quote} /><p className={styles.note}><strong>Issue Quote does not send anything automatically.</strong> It freezes this revision and creates a secure approval link for you to copy and send to the customer yourself.</p><div className={styles.actions}><button type="button" onClick={()=>void onAction(quote.id,"issue")} disabled={Boolean(busy)}>{busy==="issue"?"ISSUING…":"ISSUE QUOTE"}</button><button type="button" className={styles.secondary} onClick={()=>void onAction(quote.id,"return_to_draft")} disabled={Boolean(busy)}>RETURN TO DRAFT</button><button type="button" className={styles.secondary} onClick={()=>void onPdf()} disabled={Boolean(busy)}>PREVIEW PDF</button></div></div>;
}

function IssuedCard({ quote, busy, shareLink, onAction, onPdf }: { quote:Quote;busy:string;shareLink:string;onAction:(id:string,action:string,extra?:Record<string,unknown>)=>Promise<void>;onPdf:()=>Promise<void> }) {
  const [acceptingName,setAcceptingName]=useState(""); const [acceptNote,setAcceptNote]=useState(""); const [confirmed,setConfirmed]=useState(false);
  const customerAction = quote.status === "issued" || quote.status === "changes_requested";
  return <div className={styles.summary}><div className={styles.quoteMeta}><strong>{quote.quoteNumber} · R{quote.revision}</strong><span>{statusLabel(quote.status)}</span></div><QuoteCommercialSummary quote={quote} />
    {shareLink ? <div className={styles.share}><strong>SECURE CUSTOMER APPROVAL LINK</strong><input readOnly value={shareLink} aria-label="Secure quotation approval link" /><button type="button" className={styles.secondary} onClick={()=>void navigator.clipboard.writeText(shareLink)}>COPY LINK</button></div> : quote.status==="issued" && <p className={styles.note}>For security, the raw approval link is not stored after it is shown. If this page was reloaded, generate a fresh approval link below; the previous link will be disabled.</p>}
    {quote.decision && <p className={styles.decision}>{quote.decision.type === "accepted" ? "Accepted" : "Changes requested"} · {quote.decision.source === "owner_recorded" ? "recorded by owner" : "secure customer link"} · {new Date(quote.decision.decidedAt).toLocaleString()}{quote.decision.comment?` — ${quote.decision.comment}`:""}</p>}
    <div className={styles.actions}><button type="button" className={styles.secondary} onClick={()=>void onPdf()} disabled={Boolean(busy)}>VIEW EXACT PDF</button>{quote.status==="issued"&&<button type="button" className={styles.secondary} onClick={()=>void onAction(quote.id,"rotate_link")} disabled={Boolean(busy)}>{busy==="rotate_link"?"GENERATING…":"GENERATE FRESH APPROVAL LINK"}</button>}{customerAction&&quote.status!=="accepted"&&<button type="button" className={styles.secondary} onClick={()=>void onAction(quote.id,"create_revision")} disabled={Boolean(busy)}>{busy==="create_revision"?"CREATING…":"CREATE REVISION"}</button>}</div>
    {quote.status==="issued"&&<div className={styles.offlineAcceptance}><h3>Record customer acceptance</h3><p>Use only when the customer accepted by phone, WhatsApp, walk-in or another offline channel. This records <b>owner_recorded</b>, never secure_link.</p><label>Customer / approver name (optional)<input value={acceptingName} onChange={(e)=>setAcceptingName(e.target.value)} maxLength={120} /></label><label>Note (optional)<textarea value={acceptNote} onChange={(e)=>setAcceptNote(e.target.value)} maxLength={1200} rows={2}/></label><label className={styles.check}><input type="checkbox" checked={confirmed} onChange={(e)=>setConfirmed(e.target.checked)}/>I confirm the customer accepted this exact issued revision.</label><button type="button" onClick={()=>void onAction(quote.id,"record_acceptance",{confirmed,acceptingName,comment:acceptNote})} disabled={!confirmed||Boolean(busy)}>{busy==="record_acceptance"?"RECORDING…":"RECORD CUSTOMER ACCEPTANCE"}</button></div>}
    {quote.status==="accepted"&&<p className={styles.handoff}>QUOTE ACCEPTED — the job is handed to artwork/proof. No proof, production or payment completion has been created automatically.</p>}
  </div>;
}

function QuoteCommercialSummary({ quote }: { quote: Quote }) { return <div className={styles.commercialSummary}><div><span>Customer</span><strong>{quote.customerSnapshot.displayName}</strong></div><div><span>Job</span><strong>{quote.jobSnapshot.referenceCode}</strong></div><div><span>Valid until</span><strong>{quote.validUntil||"Not set"}</strong></div><div><span>Total</span><strong>{formatBwp(quote.totalMinor)}</strong></div></div>; }
function RevisionHistory({ quotes, onPdf, busy }: { quotes:Quote[];onPdf:(quote:Quote)=>Promise<void>;busy:string }) { return <div className={styles.history}><h3>Revision history</h3>{quotes.map((quote)=><div key={quote.id}><span>{quote.quoteNumber} · R{quote.revision}</span><strong>{statusLabel(quote.status)}</strong><span>{formatBwp(quote.totalMinor)}</span><button type="button" className={styles.linkButton} onClick={()=>void onPdf(quote)} disabled={Boolean(busy)}>PDF</button></div>)}</div>; }
