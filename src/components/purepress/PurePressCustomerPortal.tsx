"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import type { PurePressCustomerOrderProjection } from "@/lib/purepress/customerProjection";
import { purePressCustomerFetch, signOutPurePressCustomer } from "@/lib/purepress/auth/customerApi";
import {
  isPurePressCustomerTrustedDevice,
  loadPurePressCustomerOrder,
  loadPurePressCustomerOrders,
  savePurePressCustomerOrder,
  savePurePressCustomerOrders,
  setPurePressCustomerTrustedDevice,
} from "@/lib/purepress/offline/customer";
import styles from "./PurePressCustomerPortal.module.css";
import { usePurePressLanguage } from "./PurePressLanguageProvider";
import { formatPurePressDate, formatPurePressDateTime, formatPurePressMoney, type PurePressTranslationKey } from "@/lib/purepress/i18n";

async function jsonOrError<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) {
    const error = Object.assign(new Error(body.error || "We couldn’t complete that request."), { status: response.status });
    throw error;
  }
  return body;
}

function useCustomerSession() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next);
    if (!next) router.replace("/my-purepress/login");
  }), [router]);
  return user;
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}

function PortalHeader({ user, customerName }: { user: User; customerName?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <header className={styles.portalHeader}>
      <div className={styles.headerIdentity}>
        <Image src="/purepress/brand/purepress-mark.svg" alt="PurePress Printers" width={62} height={52} />
        <div><span>MY PUREPRESS</span>{customerName ? <strong>{customerName}</strong> : null}</div>
      </div>
      <button
        className={styles.textButton}
        type="button"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOutPurePressCustomer(user);
          router.replace("/my-purepress/login");
        }}
      >
        {signingOut ? "SIGNING OUT…" : "SIGN OUT"}
      </button>
    </header>
  );
}

function SavedBanner({ updatedAt }: { updatedAt?: string }) {
  const { locale } = usePurePressLanguage();
  return (
    <div className={styles.savedBanner} role="status">
      <strong>SAVED COPY</strong>
      <span>You’re offline. This is the last update saved on this device.</span>
      {updatedAt ? <span>LAST UPDATED {formatPurePressDateTime(locale, updatedAt)}</span> : null}
    </div>
  );
}

function TrustedDevice({ user, enabled, onChange, disabled = false }: { user: User; enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={styles.trustedDevice}>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy || disabled}
          onChange={async (event) => {
            const next = event.target.checked;
            setBusy(true);
            try { await setPurePressCustomerTrustedDevice(user.uid, next); onChange(next); }
            finally { setBusy(false); }
          }}
        />
        <span><strong>KEEP MY ORDERS ON THIS DEVICE</strong><small>This saves a private copy of your order status on this device so you can view it without internet.</small></span>
      </label>
    </div>
  );
}

function ActionButton({ order }: { order: PurePressCustomerOrderProjection }) {
  const action = order.status.action;
  if (action === "NONE") return <p className={styles.nothingNeeded}>NOTHING NEEDED FROM YOU RIGHT NOW.</p>;
  const label = action === "REVIEW_QUOTE" ? "REVIEW QUOTE" : action === "REVIEW_ARTWORK" ? "REVIEW ARTWORK" : "CONTACT PUREPRESS";
  if (action === "CONTACT_PUREPRESS") return <a className={styles.primaryButton} href="tel:+26778013297">{label}</a>;
  return <Link className={styles.primaryButton} href={`/my-purepress/orders/${encodeURIComponent(order.projectId)}#${action === "REVIEW_QUOTE" ? "quote-review" : "artwork-review"}`}>{label}</Link>;
}

function OrderCard({ order }: { order: PurePressCustomerOrderProjection }) {
  const { t } = usePurePressLanguage();
  return (
    <article className={styles.orderCard}>
      <p className={styles.orderReference}>ORDER {order.referenceCode}</p>
      <h2 data-pp-no-translate>{order.title}</h2>
      {order.quantity ? <p className={styles.recognition}>{order.quantity} item{order.quantity === 1 ? "" : "s"}{order.garmentSummary ? ` · ${order.garmentSummary}` : ""}</p> : order.garmentSummary ? <p className={styles.recognition}>{order.garmentSummary}</p> : null}
      <div className={styles.answerBlock}>
        <span>CURRENT STATUS</span>
        <strong>{t(order.status.headlineKey)}</strong>
      </div>
      <div className={styles.nextBlock}>
        <span>NEXT</span>
        <p>{t(order.status.nextKey)}</p>
      </div>
      {order.status.action !== "NONE" ? <div className={styles.needBlock}><strong>YOU NEED TO:</strong><p>{order.status.actionInstructionKey ? t(order.status.actionInstructionKey) : null}</p></div> : null}
      <ActionButton order={order} />
      {order.status.action === "NONE" ? <Link className={styles.secondaryButton} href={`/my-purepress/orders/${encodeURIComponent(order.projectId)}`}>VIEW ORDER</Link> : null}
    </article>
  );
}

export function PurePressCustomerOrders() {
  const user = useCustomerSession();
  const online = useOnline();
  const [orders, setOrders] = useState<PurePressCustomerOrderProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedCopy, setSavedCopy] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (currentUser: User) => {
    setLoading(true); setError("");
    const trustedDevice = await isPurePressCustomerTrustedDevice(currentUser.uid).catch(() => false);
    setTrusted(trustedDevice);
    if (!navigator.onLine) {
      const cached = await loadPurePressCustomerOrders(currentUser.uid).catch(() => []);
      setOrders(cached.map((record) => record.value));
      setSavedCopy(cached.length > 0);
      setLoading(false);
      return;
    }
    try {
      const response = await purePressCustomerFetch(currentUser, "/api/purepress/customer/orders");
      const body = await jsonOrError<{ orders: PurePressCustomerOrderProjection[] }>(response);
      setOrders(body.orders); setSavedCopy(false);
      if (trustedDevice) await savePurePressCustomerOrders(currentUser.uid, body.orders);
    } catch (reason) {
      if ((reason as { status?: number })?.status === 401) return;
      const cached = trustedDevice ? await loadPurePressCustomerOrders(currentUser.uid).catch(() => []) : [];
      if (cached.length) { setOrders(cached.map((record) => record.value)); setSavedCopy(true); }
      else setError("WE COULDN’T LOAD YOUR LATEST ORDERS");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) void load(user); }, [user, online, load]);
  if (!user || loading) return <main className={styles.portalPage}><div className={styles.loadingCard}>OPENING MY PUREPRESS…</div></main>;
  const customerName = orders.find((order) => order.customerName)?.customerName;
  return (
    <main className={styles.portalPage}>
      <div className={styles.portalShell}>
        <PortalHeader user={user} customerName={customerName} />
        {savedCopy || !online ? <SavedBanner updatedAt={orders[0]?.updatedAt} /> : null}
        <section className={styles.homeHeading}><p className={styles.kicker}>MY PUREPRESS</p><h1>YOUR ORDERS</h1></section>
        {error ? <div className={styles.errorPanel} role="alert"><strong>{error}</strong><button className={styles.primaryButton} type="button" onClick={() => void load(user)}>TRY AGAIN</button></div> : null}
        {!error && orders.length === 0 ? (
          <section className={styles.emptyState}>
            <h2>NO ORDERS FOUND FOR THIS EMAIL.</h2>
            <p>If PurePress used a different email for your order, contact us and we’ll help.</p>
            <a className={styles.primaryButton} href="tel:+26778013297">CALL PUREPRESS</a>
            <a className={styles.secondaryButton} href="mailto:purepressprinters@gmail.com">EMAIL PUREPRESS</a>
            <Link className={styles.secondaryButton} href="/request-a-quote">REQUEST A QUOTE</Link>
          </section>
        ) : <section className={styles.orderList}>{orders.map((order) => <OrderCard key={order.projectId} order={order} />)}</section>}
        <TrustedDevice user={user} enabled={trusted} onChange={async (next) => { setTrusted(next); if (next) await savePurePressCustomerOrders(user.uid, orders); }} />
      </div>
    </main>
  );
}

function Progress({ order }: { order: PurePressCustomerOrderProjection }) {
  const { t } = usePurePressLanguage();
  const stageKey = (stage: string): PurePressTranslationKey => ({ QUOTE:"customer.progress.quote", ARTWORK:"customer.progress.artwork", MAKING:"customer.progress.making", READY:"customer.progress.ready", COMPLETE:"customer.progress.complete" } as const)[stage as "QUOTE"|"ARTWORK"|"MAKING"|"READY"|"COMPLETE"];
  if (!order.progress.length) return <p className={styles.cancelledProgress}>CANCELLED ORDER</p>;
  return <ol className={styles.progress}>{order.progress.map((step) => <li key={step.stage} data-state={step.state}><span>{step.state === "done" ? "DONE" : step.state === "current" ? "NOW" : "NEXT"}</span><strong>{t(stageKey(step.stage))}</strong></li>)}</ol>;
}

function QuoteReview({ order, user, online, reload }: { order: PurePressCustomerOrderProjection; user: User; online: boolean; reload: () => Promise<void> }) {
  const { locale, t } = usePurePressLanguage();
  const quote = order.quote;
  const [changes, setChanges] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!quote) return null;
  async function decide(decision: "accept" | "request_changes") {
    if (!online) { setMessage("CONNECT TO THE INTERNET TO APPROVE THIS QUOTE."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await purePressCustomerFetch(user, `/api/purepress/customer/orders/${encodeURIComponent(order.projectId)}/quote-decision`, { method: "POST", body: JSON.stringify({ decision, comment: decision === "request_changes" ? comment : undefined }) });
      await jsonOrError(response);
      await reload();
      setMessage(decision === "accept" ? "QUOTE APPROVED" : "CHANGES REQUESTED");
    } catch (reason) {
      if ((reason as { status?: number })?.status === 409) { await reload(); setMessage("THIS ORDER WAS UPDATED. We’ve refreshed it with the latest information."); }
      else setMessage(reason instanceof Error ? reason.message : "We couldn’t record your quote response.");
    } finally { setBusy(false); }
  }
  return (
    <section className={styles.detailSection} id="quote-review">
      <h2>QUOTE</h2><p className={styles.stateLabel}>{t(quote.labelKey)}</p>
      {typeof quote.totalMinor === "number" ? <p className={styles.bigTotal}>TOTAL <strong>{formatPurePressMoney(locale, quote.totalMinor)}</strong></p> : null}
      {quote.lineItems?.length ? <div className={styles.lineItems}>{quote.lineItems.map((line, i) => <div key={`${line.description}-${i}`}><span data-pp-no-translate>{line.description}<small>{line.quantity} × {formatPurePressMoney(locale, line.unitPriceMinor)}</small></span><strong>{formatPurePressMoney(locale, line.lineTotalMinor)}</strong></div>)}</div> : null}
      {quote.validUntil ? <p>Valid until: <strong>{formatPurePressDate(locale, quote.validUntil)}</strong></p> : null}
      {quote.customerVisibleNotes ? <p data-pp-no-translate>{quote.customerVisibleNotes}</p> : null}
      {quote.paymentTerms ? <p><strong>Payment:</strong> {quote.paymentTerms}</p> : null}
      {quote.canReview ? (
        <div className={styles.reviewBox}>
          <h3>APPROVE THIS QUOTE?</h3>
          <p>PurePress will continue with your order using this quote.</p>
          <p className={styles.bigTotal}>TOTAL <strong>{formatPurePressMoney(locale, quote.totalMinor)}</strong></p>
          {!online ? <p className={styles.offlineAction}>CONNECT TO THE INTERNET TO APPROVE THIS QUOTE.</p> : null}
          <button className={styles.primaryButton} type="button" disabled={!online || busy} onClick={() => void decide("accept")}>APPROVE QUOTE</button>
          <button className={styles.secondaryButton} type="button" disabled={!online || busy} onClick={() => setChanges((value) => !value)}>REQUEST CHANGES</button>
          {changes ? <form className={styles.changeForm} onSubmit={(event: FormEvent) => { event.preventDefault(); void decide("request_changes"); }}><label>What should PurePress change?<textarea required maxLength={1200} value={comment} onChange={(event) => setComment(event.target.value)} /></label><button className={styles.primaryButton} disabled={!online || busy || !comment.trim()} type="submit">SEND CHANGE REQUEST</button></form> : null}
        </div>
      ) : null}
      {message ? <p className={styles.actionMessage} role="status">{message}</p> : null}
    </section>
  );
}

function ArtworkReview({ order, user, online, reload }: { order: PurePressCustomerOrderProjection; user: User; online: boolean; reload: () => Promise<void> }) {
  const { t } = usePurePressLanguage();
  const artwork = order.artwork;
  const [preview, setPreview] = useState("");
  const [changes, setChanges] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!artwork?.previewCount || !online) { setPreview(""); return; }
    let active = true;
    void purePressCustomerFetch(user, `/api/purepress/customer/orders/${encodeURIComponent(order.projectId)}/proof-file/0`)
      .then((response) => jsonOrError<{ url: string }>(response))
      .then((body) => { if (active) setPreview(body.url); })
      .catch(() => { if (active) setPreview(""); });
    return () => { active = false; };
  }, [artwork?.previewCount, online, order.projectId, user]);
  if (!artwork) return null;
  async function decide(decision: "approve" | "request_changes") {
    if (!online) { setMessage("CONNECT TO THE INTERNET TO APPROVE THIS ARTWORK."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await purePressCustomerFetch(user, `/api/purepress/customer/orders/${encodeURIComponent(order.projectId)}/proof-decision`, { method: "POST", body: JSON.stringify({ decision, comment: decision === "request_changes" ? comment : undefined }) });
      await jsonOrError(response);
      await reload();
      setMessage(decision === "approve" ? "ARTWORK APPROVED" : "CHANGES REQUESTED");
    } catch (reason) {
      if ((reason as { status?: number })?.status === 409) { await reload(); setMessage("THIS ORDER WAS UPDATED. We’ve refreshed it with the latest information."); }
      else setMessage(reason instanceof Error ? reason.message : "We couldn’t record your artwork response.");
    } finally { setBusy(false); }
  }
  return (
    <section className={styles.detailSection} id="artwork-review">
      <h2>ARTWORK</h2><p className={styles.stateLabel}>{t(artwork.labelKey)}</p>
      {artwork.revision ? <p>PROOF REVISION <strong>R{artwork.revision}</strong></p> : null}
      {preview ? <img className={styles.proofImage} src={preview} alt={`Artwork proof revision ${artwork.revision ?? "current"}`} /> : artwork.previewCount && !online ? <p className={styles.offlineAction}>Connect to the internet to open the artwork file.</p> : null}
      {artwork.placementSummary ? <p><strong>Placement:</strong> {artwork.placementSummary}</p> : null}
      {artwork.designWidthMm || artwork.designHeightMm ? <p><strong>Size:</strong> {artwork.designWidthMm ?? "—"} × {artwork.designHeightMm ?? "—"} mm</p> : null}
      {artwork.threadColorSummary ? <p><strong>Thread colours:</strong> {artwork.threadColorSummary}</p> : null}
      {artwork.customerVisibleNotes ? <p data-pp-no-translate>{artwork.customerVisibleNotes}</p> : null}
      {artwork.canReview ? <div className={styles.reviewBox}><h3>ARTWORK FOR YOUR ORDER</h3><p>Please check this artwork before PurePress prepares production.</p>{!online ? <p className={styles.offlineAction}>CONNECT TO THE INTERNET TO APPROVE THIS ARTWORK.</p> : null}<button className={styles.primaryButton} type="button" disabled={!online || busy} onClick={() => void decide("approve")}>APPROVE ARTWORK</button><button className={styles.secondaryButton} type="button" disabled={!online || busy} onClick={() => setChanges((value) => !value)}>REQUEST CHANGES</button>{changes ? <form className={styles.changeForm} onSubmit={(event: FormEvent) => { event.preventDefault(); void decide("request_changes"); }}><label>What should PurePress change?<textarea required maxLength={1200} value={comment} onChange={(event) => setComment(event.target.value)} /></label><button className={styles.primaryButton} disabled={!online || busy || !comment.trim()} type="submit">SEND CHANGE REQUEST</button></form> : null}</div> : null}
      {message ? <p className={styles.actionMessage} role="status">{message}</p> : null}
    </section>
  );
}

export function PurePressCustomerOrder() {
  const { locale, t } = usePurePressLanguage();
  const user = useCustomerSession();
  const online = useOnline();
  const params = useParams<{ projectId: string }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const [order, setOrder] = useState<PurePressCustomerOrderProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedCopy, setSavedCopy] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user || !projectId) return;
    setLoading(true); setError("");
    const trustedDevice = await isPurePressCustomerTrustedDevice(user.uid).catch(() => false); setTrusted(trustedDevice);
    if (!navigator.onLine) {
      const cached = await loadPurePressCustomerOrder(user.uid, projectId).catch(() => undefined);
      setOrder(cached?.value ?? null); setSavedCopy(Boolean(cached)); setLoading(false); return;
    }
    try {
      const response = await purePressCustomerFetch(user, `/api/purepress/customer/orders/${encodeURIComponent(projectId)}`);
      const body = await jsonOrError<{ order: PurePressCustomerOrderProjection }>(response);
      setOrder(body.order); setSavedCopy(false); if (trustedDevice) await savePurePressCustomerOrder(user.uid, body.order);
    } catch (reason) {
      const cached = trustedDevice ? await loadPurePressCustomerOrder(user.uid, projectId).catch(() => undefined) : undefined;
      if (cached) { setOrder(cached.value); setSavedCopy(true); }
      else setError((reason as { status?: number })?.status === 401 ? "YOUR SIGN-IN HAS EXPIRED" : "WE COULDN’T LOAD YOUR LATEST ORDER");
    } finally { setLoading(false); }
  }, [projectId, user]);

  useEffect(() => { if (user) void load(); }, [user, online, load]);
  const customerName = order?.customerName;
  if (!user || loading) return <main className={styles.portalPage}><div className={styles.loadingCard}>OPENING YOUR ORDER…</div></main>;
  return (
    <main className={styles.portalPage}>
      <div className={styles.portalShell}>
        <PortalHeader user={user} customerName={customerName} />
        {savedCopy || !online ? <SavedBanner updatedAt={order?.updatedAt} /> : null}
        <Link className={styles.backLink} href="/my-purepress">← BACK TO MY ORDERS</Link>
        {error || !order ? <section className={styles.errorPanel}><h1>{error || "WE COULDN’T FIND AN ORDER FOR THIS EMAIL"}</h1><button className={styles.primaryButton} type="button" onClick={() => void load()}>TRY AGAIN</button><a className={styles.secondaryButton} href="tel:+26778013297">CONTACT PUREPRESS</a></section> : (
          <>
            <section className={styles.orderIdentity}><p className={styles.orderReference}>ORDER {order.referenceCode}</p><h1>{order.title}</h1>{order.garmentSummary ? <p>{order.garmentSummary}</p> : null}</section>
            <section className={styles.dominantStatus}><p>WHERE YOUR ORDER IS</p><h2>{t(order.status.headlineKey).toUpperCase()}</h2><span>{t(order.status.explanationKey)}</span></section>
            <section className={styles.whatNext}><p>WHAT HAPPENS NEXT</p><h2>{t(order.status.nextKey)}</h2>{order.status.action !== "NONE" ? <div className={styles.needBlock}><strong>YOU NEED TO:</strong><p>{order.status.actionInstructionKey ? t(order.status.actionInstructionKey) : null}</p></div> : <p className={styles.nothingNeeded}>NOTHING NEEDED FROM YOU RIGHT NOW.</p>}<ActionButton order={order} /></section>
            <Progress order={order} />
            {order.status.stage === "READY" ? <section className={styles.readyPanel}><h2>YOUR ORDER IS READY FOR COLLECTION</h2><strong>{order.collection.name}</strong><p>Plot 17879, Gaborone West<br />Gaborone, Botswana</p><p><a href="tel:+26778013297">+267 78 013 297</a><br /><a href="tel:+26777116195">+267 77 116 195</a><br /><a href="mailto:purepressprinters@gmail.com">purepressprinters@gmail.com</a></p><a className={styles.primaryButton} href="tel:+26778013297">CALL PUREPRESS</a></section> : null}
            <section className={styles.detailSection}><h2>ORDER DETAILS</h2><dl className={styles.detailsGrid}><div><dt>Order</dt><dd>{order.referenceCode}</dd></div><div><dt>Description</dt><dd data-pp-no-translate>{order.title}</dd></div>{order.quantity ? <div><dt>Quantity</dt><dd>{order.quantity}</dd></div> : null}{order.requestedDate ? <div><dt>Requested date</dt><dd>{formatPurePressDate(locale, order.requestedDate)}</dd></div> : null}{order.promisedDate ? <div><dt>Confirmed date</dt><dd>{formatPurePressDate(locale, order.promisedDate)}</dd></div> : null}{order.completedAt ? <div><dt>Completed</dt><dd>{formatPurePressDate(locale, order.completedAt)}</dd></div> : null}</dl></section>
            <QuoteReview order={order} user={user} online={online} reload={load} />
            <ArtworkReview order={order} user={user} online={online} reload={load} />
            <p className={styles.lastUpdated}>LAST UPDATED {formatPurePressDateTime(locale, order.updatedAt)}</p>
            <TrustedDevice user={user} enabled={trusted} onChange={async (next) => { setTrusted(next); if (next && order) await savePurePressCustomerOrder(user.uid, order); }} />
          </>
        )}
      </div>
    </main>
  );
}
