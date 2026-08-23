"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import styles from "./PurePressQuoteRequests.module.css";

interface QuoteSummary {
  id: string;
  referenceCode: string;
  status: string;
  createdAt: string;
  customer: string;
  organisation: string | null;
  itemCategory: string | null;
  customItemDescription: string | null;
  supplySource: string;
  quantity: number | null;
  requestedDate: string | null;
  timingFlexible: boolean;
  artworkAttached: boolean;
  assignedProjectId: null;
}

interface ArtworkFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  viewUrl: string;
}

interface QuoteDetail {
  id: string;
  referenceCode: string;
  status: string;
  createdAt: string;
  customerVisible: {
    contact: {
      displayName: string;
      email: string;
      phone?: string;
      preferredContactMethod: string;
    };
    organisation?: string;
    itemCategory?: string;
    customItemDescription?: string;
    supplySource?: string;
    quantity?: number;
    sizeBreakdown?: string;
    itemColours?: string[];
    placements?: Array<{ position: string; notes?: string }>;
    artworkState?: string;
    requestedDate?: string;
    timingFlexible?: boolean;
    fulfillmentIntent?: string;
    customerNotes?: string;
  };
  internal?: {
    assignedProjectId?: string;
    nextAction?: { action?: string };
  };
  artworkFiles: ArtworkFile[];
}

const labels: Record<string, string> = {
  corporate_uniforms: "Corporate uniforms",
  school_items: "School items",
  team_wear: "Team wear",
  shirts_polos: "Shirts / polos",
  jackets_workwear: "Jackets / workwear",
  bags: "Bags",
  towels: "Towels",
  leather: "Leather",
  gifts_promotional: "Gifts / promotional items",
  custom: "Custom item",
  customer_supplied: "Customer supplied",
  purepress_supplied: "PurePress supplied",
  mixed: "Mixed supply",
  unknown: "Not decided",
  collect: "Collect from PurePress",
  delivery_may_be_needed: "Delivery may be needed",
  unsure: "Not sure yet",
};

const friendly = (value?: string | null) => value ? labels[value] ?? value.replaceAll("_", " ") : "—";

async function ownerFetch(url: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "include",
  });
}

export default function PurePressQuoteRequests() {
  const [requests, setRequests] = useState<QuoteSummary[]>([]);
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void ownerFetch("/api/admin/purepress/quote-requests")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load quote requests.");
        if (active) setRequests(data.requests ?? []);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Could not load quote requests."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function openQuote(id: string) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await ownerFetch(`/api/admin/purepress/quote-requests/${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load this quote request.");
      setDetail(data.quote);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this quote request.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function createJob(quoteId: string) {
    setConverting(true);
    setError("");
    try {
      const response = await ownerFetch(`/api/admin/purepress/quote-requests/${encodeURIComponent(quoteId)}/convert`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create an operational job.");
      setRequests((current) => current.filter((request) => request.id !== quoteId));
      setDetail((current) => current ? { ...current, internal: { ...current.internal, assignedProjectId: data.projectId } } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create an operational job.");
    } finally {
      setConverting(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="new-quote-requests-heading">
      <div className={styles.headingRow}>
        <div>
          <p className="pp-kicker">NEW QUOTE REQUESTS</p>
          <h2 id="new-quote-requests-heading">Intake waiting for review.</h2>
          <p className={styles.headingNote}>Only unconverted requests stay in this intake queue. Once a job exists, its operational truth lives in the Order Desk.</p>
        </div>
        <span className={styles.count}>{requests.length}</span>
      </div>

      {loading && <p className={styles.state} role="status">Loading quotation intake…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && !error && requests.length === 0 && !detail && (
        <p className={styles.state}>No unprocessed quotation requests are waiting in the Studio.</p>
      )}

      {(!loading && (requests.length > 0 || detail)) && (
        <div className={styles.layout}>
          <div className={styles.queue} aria-label="Quote request queue">
            {requests.map((request) => (
              <button key={request.id} type="button" className={detail?.id === request.id ? styles.cardSelected : styles.card} onClick={() => void openQuote(request.id)}>
                <span className={styles.reference}>{request.referenceCode}</span>
                <strong>{request.customer}{request.organisation ? ` · ${request.organisation}` : ""}</strong>
                <span>{friendly(request.customItemDescription || request.itemCategory)} · {request.quantity ?? "—"} item(s)</span>
                <span>{friendly(request.supplySource)} · {request.artworkAttached ? "Artwork attached" : "No artwork attached"}</span>
                <small>{request.requestedDate ? `Customer requested ${request.requestedDate}` : request.timingFlexible ? "Customer timing flexible" : "Timing not supplied"} · {new Date(request.createdAt).toLocaleString()}</small>
              </button>
            ))}
            {requests.length === 0 && <p className={styles.state}>No remaining requests in the active intake queue.</p>}
          </div>

          <div className={styles.detail}>
            {detailLoading && <p role="status">Opening request…</p>}
            {!detailLoading && !detail && <p className={styles.state}>Open a request to review the original customer brief.</p>}
            {!detailLoading && detail && <QuoteDetailView quote={detail} converting={converting} onCreateJob={createJob} />}
          </div>
        </div>
      )}
    </section>
  );
}

function QuoteDetailView({ quote, converting, onCreateJob }: { quote: QuoteDetail; converting: boolean; onCreateJob: (id: string) => Promise<void> }) {
  const visible = quote.customerVisible;
  const projectId = quote.internal?.assignedProjectId;
  return (
    <article aria-label={`Quote request ${quote.referenceCode}`}>
      <div className={styles.detailHeader}>
        <div>
          <span className={styles.reference}>{quote.referenceCode}</span>
          <h3>{visible.contact.displayName}</h3>
        </div>
        <span className={styles.status}>{friendly(quote.status)}</span>
      </div>
      <div className={styles.conversionAction}>
        {projectId ? (
          <><strong>This request already has one operational job.</strong><Link className={styles.jobButton} href={`/admin/purepress/jobs/${encodeURIComponent(projectId)}`}>OPEN JOB</Link></>
        ) : (
          <><div><strong>Ready to operationalise this work?</strong><p>Creating the job preserves this original request and moves status/readiness/next-action ownership to the project record.</p></div><button className={styles.jobButton} type="button" disabled={converting} onClick={() => void onCreateJob(quote.id)}>{converting ? "CREATING JOB…" : "CREATE JOB"}</button></>
        )}
      </div>
      <DetailBlock title="CUSTOMER">
        <p>{visible.organisation || "No organisation supplied"}</p>
        <p><a href={`mailto:${visible.contact.email}`}>{visible.contact.email}</a>{visible.contact.phone ? ` · ${visible.contact.phone}` : ""}</p>
        <p>Preferred contact: {friendly(visible.contact.preferredContactMethod)}</p>
      </DetailBlock>
      <DetailBlock title="WHAT THEY ARE BRANDING"><p>{friendly(visible.customItemDescription || visible.itemCategory)}</p></DetailBlock>
      <DetailBlock title="WHO SUPPLIES THE ITEMS"><p>{friendly(visible.supplySource)}</p></DetailBlock>
      <DetailBlock title="QUANTITY / KNOWN VARIANTS">
        <p>{visible.quantity ?? "—"} item(s)</p>
        {visible.sizeBreakdown && <p>Sizes: {visible.sizeBreakdown}</p>}
        {visible.itemColours?.length ? <p>Colours: {visible.itemColours.join(", ")}</p> : null}
      </DetailBlock>
      <DetailBlock title="PLACEMENTS">
        {visible.placements?.length ? <ul>{visible.placements.map((placement, index) => <li key={`${placement.position}-${index}`}>{friendly(placement.position)}{placement.notes ? ` — ${placement.notes}` : ""}</li>)}</ul> : <p>—</p>}
      </DetailBlock>
      <DetailBlock title="ARTWORK">
        <p>{friendly(visible.artworkState)}</p>
        {quote.artworkFiles.length ? <ul>{quote.artworkFiles.map((file) => <li key={file.id}><a href={file.viewUrl} target="_blank" rel="noreferrer">{file.fileName}</a> <small>({Math.max(1, Math.round(file.sizeBytes / 1024))} KB)</small></li>)}</ul> : <p>No file attached.</p>}
        <p className={styles.note}>Customer artwork is intake material only. It is not a digitised or production-ready embroidery file.</p>
      </DetailBlock>
      <DetailBlock title="REQUESTED TIMING"><p>{visible.timingFlexible ? "Flexible" : visible.requestedDate || "—"}</p></DetailBlock>
      <DetailBlock title="FULFILMENT INTENT"><p>{friendly(visible.fulfillmentIntent)}</p></DetailBlock>
      <DetailBlock title="CUSTOMER NOTES"><p>{visible.customerNotes || "No additional notes."}</p></DetailBlock>
      <DetailBlock title="NEXT ACTION"><p className={styles.nextAction}>{projectId ? "Open the operational job" : quote.internal?.nextAction?.action || "Review request"}</p></DetailBlock>
    </article>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.detailBlock}><strong>{title}</strong><div>{children}</div></section>;
}
