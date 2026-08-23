"use client";

import { useEffect, useState } from "react";
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
  internal?: { nextAction?: { action?: string } };
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

async function ownerFetch(url: string) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
}

export default function PurePressQuoteRequests() {
  const [requests, setRequests] = useState<QuoteSummary[]>([]);
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
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

  return (
    <section className={styles.section} aria-labelledby="new-quote-requests-heading">
      <div className={styles.headingRow}>
        <div>
          <p className="pp-kicker">NEW QUOTE REQUESTS</p>
          <h2 id="new-quote-requests-heading">Intake waiting for review.</h2>
        </div>
        <span className={styles.count}>{requests.length}</span>
      </div>

      {loading && <p className={styles.state} role="status">Loading quotation intake…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && !error && requests.length === 0 && (
        <p className={styles.state}>No quotation requests are waiting in the Studio yet.</p>
      )}

      {!loading && requests.length > 0 && (
        <div className={styles.layout}>
          <div className={styles.queue} aria-label="Quote request queue">
            {requests.map((request) => (
              <button key={request.id} type="button" className={detail?.id === request.id ? styles.cardSelected : styles.card} onClick={() => void openQuote(request.id)}>
                <span className={styles.reference}>{request.referenceCode}</span>
                <strong>{request.customer}{request.organisation ? ` · ${request.organisation}` : ""}</strong>
                <span>{friendly(request.customItemDescription || request.itemCategory)} · {request.quantity ?? "—"} item(s)</span>
                <span>{friendly(request.supplySource)} · {request.artworkAttached ? "Artwork attached" : "No artwork attached"}</span>
                <small>{request.requestedDate ? `Requested ${request.requestedDate}` : request.timingFlexible ? "Timing flexible" : "Timing not supplied"} · {new Date(request.createdAt).toLocaleString()}</small>
              </button>
            ))}
          </div>

          <div className={styles.detail}>
            {detailLoading && <p role="status">Opening request…</p>}
            {!detailLoading && !detail && <p className={styles.state}>Open a request to review the original customer brief.</p>}
            {!detailLoading && detail && <QuoteDetailView quote={detail} />}
          </div>
        </div>
      )}
    </section>
  );
}

function QuoteDetailView({ quote }: { quote: QuoteDetail }) {
  const visible = quote.customerVisible;
  return (
    <article aria-label={`Quote request ${quote.referenceCode}`}>
      <div className={styles.detailHeader}>
        <div>
          <span className={styles.reference}>{quote.referenceCode}</span>
          <h3>{visible.contact.displayName}</h3>
        </div>
        <span className={styles.status}>{friendly(quote.status)}</span>
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
      <DetailBlock title="NEXT ACTION"><p className={styles.nextAction}>{quote.internal?.nextAction?.action || "Review request"}</p></DetailBlock>
    </article>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={styles.detailBlock}><strong>{title}</strong><div>{children}</div></section>;
}
