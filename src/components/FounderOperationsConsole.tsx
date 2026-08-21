"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, RefreshCcw, Search } from "lucide-react";
import {
  filterFounderOperationRows,
  sortFounderOperationRows,
  type FounderOperationComparableRow,
  type FounderOperationFilter,
  type FounderOperationSort,
  type FounderOpsContactMethod,
} from "@/lib/boardsignal/founderOperationsLogic";

type OperationsRow = FounderOperationComparableRow & {
  playerId?: number;
  profileUrl?: string;
  avatar?: string;
  accountStatus?: string;
  identityStatus?: string;
  identityReviewStatus?: string;
  publicHighlightsStatus?: string;
  preferredContactMethod?: string;
  preferredContactValue?: string;
  latestReview?: { periodStart?: string; periodEnd?: string; periodLabel?: string; publishedAt?: string };
  reviewPeriods: Array<{ periodStart: string; periodEnd: string; periodLabel?: string; source: "original" | "live" }>;
  lastContactedAt?: string;
  lastContactMethod?: FounderOpsContactMethod;
  followUpSnoozedUntil?: string;
  pendingRequestId?: string;
  exceptionTitles: string[];
  accessStatus?: string;
};

type OperationsResponse = {
  generatedAt: string;
  attention: { newRequests: number; followUpsDue: number; unreadReplies: number; exceptions: number; identityConflicts: number };
  metrics: { activePlayers: number; reviewsForming: number; reviewsReady: number; followUpsDue: number; notSeenRecently: number; unreadReplies: number };
  validation: { playersServed: number; verifiedReviews: number; originalReviews: number; liveReviews: number; originalToLive: number; r2Plus: number; r3Plus: number; r4: number; dataCompleteness: string };
  rows: OperationsRow[];
};

const PAGE_SIZE = 20;
const FILTERS: Array<[FounderOperationFilter, string]> = [
  ["all", "ALL"], ["attention", "ATTENTION"], ["new_requests", "NEW REQUESTS"], ["follow_up_due", "FOLLOW-UP DUE"], ["reviews_ready", "REVIEWS READY"],
  ["reviews_forming", "REVIEWS FORMING"], ["unread_replies", "UNREAD REPLIES"], ["not_seen", "NOT SEEN 7D+"], ["identity", "IDENTITY"], ["exceptions", "EXCEPTIONS"],
];
const SORTS: Array<[FounderOperationSort, string]> = [["attention", "ATTENTION"], ["next_review", "NEXT REVIEW"], ["last_seen", "LAST SEEN"], ["review_count", "REVIEW COUNT"], ["username", "USERNAME"]];
const CONTACT_METHODS: Array<[FounderOpsContactMethod, string]> = [["email", "EMAIL"], ["discord", "DISCORD"], ["telegram", "TELEGRAM"], ["chesscom", "CHESS.COM"], ["other", "OTHER"]];

function displayDate(value?: string, empty = "—") {
  if (!value) return empty;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : empty;
}
function relativeSeen(value?: string) {
  if (!value) return "NEVER / NOT RECORDED";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "NOT RECORDED";
  const days = Math.max(0, Math.floor((Date.now() - parsed) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}
function followUpLabel(row: OperationsRow) {
  if (row.followUpStatus === "snoozed") return `SNOOZED UNTIL ${displayDate(row.followUpSnoozedUntil)}`;
  if (row.followUpStatus === "due") return "DUE NOW";
  if (row.followUpStatus === "upcoming") return displayDate(row.followUpDueAt);
  if (row.followUpStatus === "check") return "CHECK";
  return "No follow-up";
}
function stateTone(row: OperationsRow) {
  if (row.exceptionCount || row.reviewCheckRequired || row.identityConflict) return "error";
  if (row.unreadReplies || row.pendingRequest || row.readyNotSeen || row.followUpStatus === "due") return "processing";
  return "ready";
}
function defaultContactMethod(row: OperationsRow): FounderOpsContactMethod {
  if (row.lastContactMethod) return row.lastContactMethod;
  if (row.preferredContactMethod === "email" || row.preferredContactMethod === "discord" || row.preferredContactMethod === "telegram") return row.preferredContactMethod;
  return row.profileUrl ? "chesscom" : "other";
}

export default function FounderOperationsConsole() {
  const [operations, setOperations] = useState<OperationsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FounderOperationFilter>("attention");
  const [sort, setSort] = useState<FounderOperationSort>("attention");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [contactMethods, setContactMethods] = useState<Record<string, FounderOpsContactMethod>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/operations", { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; operations?: OperationsResponse; error?: string };
      if (!response.ok || !body.ok || !body.operations) throw new Error(body.error ?? "Founder operations could not be loaded.");
      setOperations(body.operations);
      const hasAttention = body.operations.rows.some((row) => row.attentionReasons.length > 0);
      setFilter((current) => current === "attention" && !hasAttention ? "all" : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Founder operations could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter, sort, search]);

  const filtered = useMemo(() => operations ? sortFounderOperationRows(filterFounderOperationRows(operations.rows, filter, search), sort) as OperationsRow[] : [], [filter, operations, search, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);

  async function mutate(row: OperationsRow, action: "markContacted" | "snooze" | "clearSnooze", extra: Record<string, unknown> = {}) {
    if (row.uid.startsWith("request:")) return;
    setBusy(`${row.uid}:${action}`); setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/operations", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ action, uid: row.uid, ...extra }) });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Founder follow-up state could not be updated.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Founder follow-up state could not be updated."); }
    finally { setBusy(null); }
  }

  function chooseFilter(next: FounderOperationFilter) { setFilter(next); document.getElementById("founder-live-operations")?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  if (error && !operations) return <p className="form-error" role="alert">{error}</p>;
  if (!operations) return <div className="founder-directory-loading"><LoaderCircle className="button-spinner" /> Loading live Founder operations</div>;

  const attentionCards: Array<[string, number, FounderOperationFilter]> = [
    ["New requests", operations.attention.newRequests, "new_requests"], ["Follow-ups due", operations.attention.followUpsDue, "follow_up_due"], ["Unread replies", operations.attention.unreadReplies, "unread_replies"],
    ["Review / system exceptions", operations.attention.exceptions, "exceptions"], ["Identity conflicts", operations.attention.identityConflicts, "identity"],
  ];
  const liveMetrics = [["ACTIVE PLAYERS", operations.metrics.activePlayers], ["REVIEWS FORMING", operations.metrics.reviewsForming], ["REVIEWS READY", operations.metrics.reviewsReady], ["FOLLOW-UPS DUE", operations.metrics.followUpsDue], ["NOT SEEN RECENTLY", operations.metrics.notSeenRecently], ["UNREAD REPLIES", operations.metrics.unreadReplies]];
  const validation = [["PLAYERS SERVED", operations.validation.playersServed], ["VERIFIED REVIEWS", operations.validation.verifiedReviews], ["ORIGINAL REVIEWS", operations.validation.originalReviews], ["LIVE REVIEWS", operations.validation.liveReviews], ["ORIGINAL → LIVE", operations.validation.originalToLive], ["R2+", operations.validation.r2Plus], ["R3+", operations.validation.r3Plus], ["R4", operations.validation.r4]];

  return <div className="founder-ops-console">
    <section className="founder-attention-section" aria-labelledby="attention-now-heading">
      <div className="founder-ops-heading"><div><p className="kicker">ATTENTION NOW</p><h2 id="attention-now-heading">What needs action.</h2><p>Deterministic operational state only. No player scoring or behavioural profiling.</p></div><button className="button button-quiet" type="button" onClick={() => void load()} disabled={loading}>{loading ? <LoaderCircle className="button-spinner" size={15}/> : <RefreshCcw size={15}/>} Refresh</button></div>
      <div className="founder-attention-grid">{attentionCards.map(([label, value, target]) => <button type="button" key={label} className={value ? "has-attention" : ""} onClick={() => chooseFilter(target)}><span>{label}</span><strong>{value}</strong><small>{value ? "Open matching players" : "Nothing flagged"}</small></button>)}</div>
    </section>

    <section className="founder-live-metrics" aria-labelledby="live-ops-metrics-heading"><div className="founder-ops-heading"><div><p className="kicker">LIVE OPERATIONS</p><h2 id="live-ops-metrics-heading">Current player lifecycle.</h2><p>“Reviews ready” means a completed Review was published after the player's last recorded visit — not proof that the Review itself was opened.</p></div></div><div className="founder-compact-metrics">{liveMetrics.map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong>{label === "REVIEWS READY" ? <small>Ready · not seen since</small> : null}</article>)}</div></section>

    <section className="founder-validation-section" aria-labelledby="validation-heading"><div className="founder-ops-heading"><div><p className="kicker">VALIDATION TO DATE</p><h2 id="validation-heading">What BoardSignal can prove.</h2><p>Product evidence from durable BoardSignal Review records and legitimate Original Beta history.</p></div></div><div className="founder-validation-grid">{validation.map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div><p className="founder-data-completeness">{operations.validation.dataCompleteness}</p></section>

    <section className="founder-live-directory" id="founder-live-operations" aria-labelledby="live-player-operations-heading">
      <div className="founder-ops-heading"><div><p className="kicker">LIVE PLAYER OPERATIONS</p><h2 id="live-player-operations-heading">Players and the next operational action.</h2><p>{filtered.length} matching row{filtered.length === 1 ? "" : "s"} · at most {PAGE_SIZE} shown per page.</p></div></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="founder-ops-controls">
        <label className="founder-ops-search"><span>Search player or contact</span><div><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Username or contact" /></div></label>
        <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as FounderOperationSort)}>{SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="founder-filter-strip" aria-label="Player operation filters">{FILTERS.map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      {shown.length ? <div className="founder-ops-table" role="table" aria-label="Live player operations">
        <div className="founder-ops-table-head" role="row"><span>PLAYER</span><span>REVIEWS</span><span>CURRENT STATE</span><span>LAST SEEN</span><span>NEXT REVIEW</span><span>FOLLOW-UP</span><span>CONTACT</span><span>ACTION</span></div>
        {shown.map((row) => <article className="founder-ops-row" role="row" key={row.uid}>
          <div className="founder-ops-main-row">
            <div data-label="PLAYER"><strong>{row.username}</strong>{row.playerId ? <small>Chess.com ID {row.playerId}</small> : <small>Pending request</small>}</div>
            <div data-label="REVIEWS"><strong>{row.reviewCount} / 4</strong></div>
            <div data-label="CURRENT STATE"><span className={`state-pill ${stateTone(row)}`}>{row.currentState}</span></div>
            <div data-label="LAST SEEN"><strong>{relativeSeen(row.lastSeenAt)}</strong></div>
            <div data-label="NEXT REVIEW"><strong>{displayDate(row.nextDeskDueAt)}</strong></div>
            <div data-label="FOLLOW-UP"><strong>{followUpLabel(row)}</strong></div>
            <div data-label="CONTACT"><strong>{row.preferredContactMethod ? row.preferredContactMethod.toUpperCase() : row.profileUrl ? "CHESS.COM" : "—"}</strong><small>{row.preferredContactValue ?? (row.profileUrl ? "Profile available" : "Not confirmed")}</small></div>
            <div data-label="ACTION"><Link className="button button-quiet" href={row.pendingRequestId ? `/admin/players?request=${encodeURIComponent(row.pendingRequestId)}` : `/admin/players?player=${encodeURIComponent(String(row.playerId ?? row.username))}`}>MANAGE</Link></div>
          </div>
          <details className="founder-ops-details"><summary>Details</summary><div className="founder-ops-detail-grid">
            <dl><div><dt>Stable Chess.com ID</dt><dd>{row.playerId ?? "Not yet recorded"}</dd></div><div><dt>Identity</dt><dd>{row.identityStatus ?? "Not recorded"}{row.identityReviewStatus ? ` · ${row.identityReviewStatus}` : ""}</dd></div><div><dt>Account</dt><dd>{row.accountStatus ?? "Pending request"}</dd></div><div><dt>Public highlights</dt><dd>{row.publicHighlightsStatus ?? "Not available yet"}</dd></div><div><dt>Preferred contact</dt><dd>{row.preferredContactMethod && row.preferredContactValue ? `${row.preferredContactMethod}: ${row.preferredContactValue}` : "Not confirmed"}</dd></div><div><dt>Latest Review</dt><dd>{row.latestReview?.periodLabel ?? "No completed Review"}</dd></div><div><dt>Current forming</dt><dd>{row.forming ? "Yes" : "No"}</dd></div><div><dt>nextDeskDueAt</dt><dd>{row.nextDeskDueAt ?? "Not recorded"}</dd></div><div><dt>Unread replies</dt><dd>{row.unreadReplies}</dd></div><div><dt>Last Founder contact</dt><dd>{row.lastContactedAt ? `${new Date(row.lastContactedAt).toLocaleString()}${row.lastContactMethod ? ` · ${row.lastContactMethod}` : ""}` : "Not recorded"}</dd></div><div><dt>Follow-up reason</dt><dd>{row.attentionReasons.join(" · ") || "No operational attention"}</dd></div><div><dt>Access status</dt><dd>{row.accessStatus ?? "Request pending"}</dd></div></dl>
            <div className="founder-review-periods"><span>LATEST VERIFIED REVIEW PERIODS</span>{row.reviewPeriods.length ? <ol>{row.reviewPeriods.map((review) => <li key={`${review.periodStart}:${review.periodEnd}`}><strong>{review.periodLabel ?? `${review.periodStart} → ${review.periodEnd}`}</strong><small>{review.source === "original" ? "Original Beta provenance" : "Live digital Review"}</small></li>)}</ol> : <p>No verified completed Review periods stored.</p>}{row.exceptionTitles.length ? <div className="founder-ops-exceptions"><strong>Operational exceptions</strong>{row.exceptionTitles.map((title) => <p key={title}>{title}</p>)}</div> : null}</div>
          </div>
          <div className="founder-followup-actions">
            <div><label htmlFor={`contact-${row.uid}`}>Contact method</label><select id={`contact-${row.uid}`} value={contactMethods[row.uid] ?? defaultContactMethod(row)} disabled={row.uid.startsWith("request:") || busy !== null} onChange={(event) => setContactMethods((values) => ({ ...values, [row.uid]: event.target.value as FounderOpsContactMethod }))}>{CONTACT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="button button-dark" type="button" disabled={row.uid.startsWith("request:") || busy !== null} onClick={() => void mutate(row, "markContacted", { method: contactMethods[row.uid] ?? defaultContactMethod(row) })}>{busy === `${row.uid}:markContacted` ? <LoaderCircle className="button-spinner" size={14}/> : null} MARK CONTACTED</button><small>Records that you contacted this player. It does not send anything.</small></div>
            <div><span>Snooze normal follow-up</span><div>{[1,3,7].map((days) => <button className="button button-outline" type="button" key={days} disabled={row.uid.startsWith("request:") || busy !== null} onClick={() => void mutate(row, "snooze", { days })}>{days} DAY{days === 1 ? "" : "S"}</button>)}{row.followUpSnoozedUntil ? <button className="button button-quiet" type="button" disabled={busy !== null} onClick={() => void mutate(row, "clearSnooze")}>CLEAR SNOOZE</button> : null}</div><small>Snooze never hides unread replies, identity conflicts or system exceptions.</small></div>
            {row.profileUrl ? <a className="text-link" href={row.profileUrl} target="_blank" rel="noreferrer">Open Chess.com profile <ExternalLink size={14}/></a> : null}
          </div></details>
        </article>)}
      </div> : <div className="universe-empty"><p>No players match this operational view.</p></div>}
      <nav className="founder-pagination" aria-label="Player operations pages"><button type="button" className="button button-quiet" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15}/> Previous</button><span>Page {Math.min(page, pages)} of {pages}</span><button type="button" className="button button-quiet" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next <ChevronRight size={15}/></button></nav>
    </section>
  </div>;
}
