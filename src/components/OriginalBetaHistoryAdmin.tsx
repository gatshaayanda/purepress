"use client";

import { useCallback, useEffect, useState } from "react";
import { Clipboard, LoaderCircle, RefreshCcw } from "lucide-react";
type OriginalBetaInventoryRow = {
  handle: string; periodStart: string; periodEnd: string; games: number; record: string; sourceRichness: "FULL_DESK" | "STRUCTURED_REVIEW" | "NARROW_SEED";
  liveAccountStatus: "NONE" | "EXISTS"; historicalReviewStatus: "MISSING" | "PRESENT" | "RETIRED"; identityStatus?: string; identityReviewStatus?: string; legacyBetaAccessStatus?: "ACTIVE" | "REVOKED" | "MISSING" | "UNKNOWN";
  cohort: "A · SEED + EXISTING LIVE ACCOUNT" | "B · SEED ONLY" | "C · SEED + IDENTITY CONFLICT"; seedReviewCount: number;
  liveCompletedReviewCount: number; storedCompletedReviewCount: number; missingHistoricalPeriods: string[]; reconciledTotal: number; status: "SEED ONLY" | "LIVE · HISTORY MISSING" | "LIVE · RECONCILED" | "IDENTITY CHECK REQUIRED";
  playerId?: number; uid?: string; canonicalUsername?: string; cadenceCompatible?: boolean; accessReady?: boolean; conflict?: string;
};

type OriginalBetaReconcileSummary = {
  seededPlayersChecked: number; liveAccountsMatched: number; historicalReviewsAttached: number; historicalReviewsUpgraded: number; alreadyReconciled: number;
  retiredByRetention: number; seedOnly: number; identityConflicts: number; errors: Array<{ handle: string; error: string }>;
};

type AccessResult = {
  magicLink?: string;
  magicAccessExpiresAt?: string;
  player?: { username?: string };
};

function stateClass(status: OriginalBetaInventoryRow["status"]) {
  if (status === "LIVE · RECONCILED") return "ready";
  if (status === "IDENTITY CHECK REQUIRED") return "error";
  return "processing";
}

export default function OriginalBetaHistoryAdmin() {
  const [players, setPlayers] = useState<OriginalBetaInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<OriginalBetaReconcileSummary | null>(null);
  const [magic, setMagic] = useState<{ handle: string; link: string; expiresAt?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/original-beta-history", { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; players?: OriginalBetaInventoryRow[]; error?: string };
      if (!response.ok || !body.ok || !body.players) throw new Error(body.error ?? "Original beta history could not be loaded.");
      setPlayers(body.players);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Original beta history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(action: "reconcileAll" | "attach" | "prepareAccess" | "regenerateMagic", handle?: string) {
    const key = handle ? `${action}:${handle}` : action;
    setBusy(key);
    setError("");
    setSummary(null);
    setMagic(null);
    try {
      const response = await fetch("/api/admin/boardsignal/original-beta-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, handle }),
      });
      const body = await response.json() as {
        ok?: boolean;
        error?: string;
        summary?: OriginalBetaReconcileSummary;
        access?: AccessResult;
      };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Original beta history update failed.");
      if (body.summary) setSummary(body.summary);
      if (body.access?.magicLink && handle) setMagic({ handle, link: body.access.magicLink, expiresAt: body.access.magicAccessExpiresAt });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Original beta history update failed.");
    } finally {
      setBusy(null);
    }
  }

  return <section className="desk-section founder-player-directory">
    <div className="founder-directory-heading">
      <div>
        <p className="kicker">ORIGINAL BETA HISTORY</p>
        <h2>One player. One continuous BoardSignal history.</h2>
        <p>All real betaDesks periods are inventoried here. Cohort A live players reconcile missing history in place; Cohort B seed-only players may prepare access; Cohort C identity conflicts stay blocked for review.</p>
      </div>
      <button className="button button-lime" type="button" disabled={busy !== null || loading} onClick={() => void act("reconcileAll")}>
        {busy === "reconcileAll" ? <LoaderCircle className="button-spinner" size={15}/> : <RefreshCcw size={15}/>} Reconcile Original Beta History
      </button>
    </div>

    {summary ? <div className="founding-field-note" role="status"><strong>Reconciliation complete</strong><p>{summary.seededPlayersChecked} seeded players checked · {summary.liveAccountsMatched} live matches · {summary.historicalReviewsAttached} attached · {summary.historicalReviewsUpgraded} upgraded · {summary.alreadyReconciled} already reconciled · {summary.seedOnly} seed-only · {summary.identityConflicts} identity conflicts{summary.errors.length ? ` · ${summary.errors.length} errors reported below` : ""}.</p></div> : null}
    {magic ? <div className="one-time-access-code" aria-live="polite"><div><p className="kicker">ONE-TIME ORIGINAL BETA ACCESS</p><h3>{magic.handle}</h3><p>Copy this private magic link now. Regenerating it invalidates the previous one-time link but does not revoke the player's active Firebase session.</p><code>{magic.link}</code>{magic.expiresAt ? <small>Expires {new Date(magic.expiresAt).toLocaleString()}</small> : null}<div className="one-time-code-actions"><button className="button button-dark" type="button" onClick={async () => { await navigator.clipboard.writeText(magic.link); setCopied(true); }}><Clipboard size={15}/> {copied ? "Link copied" : "Copy link"}</button></div></div></div> : null}
    {error ? <p className="founder-access-error" role="alert">{error}</p> : null}

    {loading ? <div className="founder-directory-loading"><LoaderCircle className="button-spinner"/> Auditing original beta history</div> : <div className="founder-player-grid">{players.map((player) => <article className="founder-player-card" key={`${player.handle}:${player.periodStart}:${player.periodEnd}`}>
      <header><div className="universal-avatar">{player.handle.slice(0,2).toUpperCase()}</div><div><h3>{player.handle}</h3><code>{player.periodStart} → {player.periodEnd}</code></div><span className={`state-pill ${stateClass(player.status)}`}>{player.status}</span></header>
      <dl>
        <div><dt>COHORT</dt><dd>{player.cohort}</dd></div>
        <div><dt>SOURCE</dt><dd>{player.sourceRichness}</dd></div>
        <div><dt>ORIGINAL REVIEW</dt><dd>{player.games} games · {player.record}</dd></div>
        <div><dt>LIVE ACCOUNT</dt><dd>{player.liveAccountStatus}{player.playerId ? ` · Chess.com ID ${player.playerId}` : ""}</dd></div>
        <div><dt>HISTORICAL PERIOD</dt><dd>{player.historicalReviewStatus}</dd></div>
        <div><dt>LIVE COMPLETED</dt><dd>{player.liveCompletedReviewCount}</dd></div>
        <div><dt>REVIEWS STORED NOW</dt><dd>{player.storedCompletedReviewCount} of 4</dd></div>
        <div><dt>AFTER RECONCILE</dt><dd>{player.reconciledTotal} of 4</dd></div>
        <div><dt>IDENTITY</dt><dd>{player.identityStatus ?? (player.liveAccountStatus === "NONE" ? "Seed only" : "Legacy / status not recorded")}{player.identityReviewStatus ? ` · ${player.identityReviewStatus}` : ""}</dd></div>
        <div><dt>LEGACY BETA ACCESS</dt><dd>{player.legacyBetaAccessStatus ?? (player.liveAccountStatus === "NONE" ? "Not created" : "Unknown")}</dd></div>
        <div><dt>CADENCE</dt><dd>{player.cadenceCompatible === false ? "CHECK REQUIRED" : player.liveAccountStatus === "EXISTS" ? "Compatible / preserved" : "Derived on activation"}</dd></div>
      </dl>
      {player.conflict ? <p className="founder-access-error">{player.conflict}</p> : null}
      {player.missingHistoricalPeriods.length ? <p>Missing: {player.missingHistoricalPeriods.join(" · ")}</p> : null}
      <div className="founder-player-actions">
        {player.cohort === "A · SEED + EXISTING LIVE ACCOUNT" && player.status === "LIVE · HISTORY MISSING" ? <button className="button button-outline" type="button" disabled={busy !== null} onClick={() => void act("attach", player.handle)}>{busy === `attach:${player.handle}` ? <LoaderCircle className="button-spinner" size={14}/> : <RefreshCcw size={14}/>} Attach Missing History</button> : null}
        {player.cohort === "B · SEED ONLY" ? <button className="button button-lime" type="button" disabled={busy !== null} onClick={() => void act("prepareAccess", player.handle)}>{busy === `prepareAccess:${player.handle}` ? <LoaderCircle className="button-spinner" size={14}/> : null} Prepare App Access</button> : null}
        {player.cohort === "A · SEED + EXISTING LIVE ACCOUNT" && player.status !== "IDENTITY CHECK REQUIRED" ? <button className="button button-quiet" type="button" disabled={busy !== null} onClick={() => void act("regenerateMagic", player.handle)}>{busy === `regenerateMagic:${player.handle}` ? <LoaderCircle className="button-spinner" size={14}/> : <RefreshCcw size={14}/>} Recovery Magic Link</button> : null}
      </div>
    </article>)}</div>}
  </section>;
}
