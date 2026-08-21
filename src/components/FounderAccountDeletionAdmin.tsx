"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle, RefreshCcw, Trash2, X } from "lucide-react";
import type { FounderPlayerIdentityRow } from "@/lib/boardsignal/account";

const SUCCESS_KEY = "boardsignal:founder-account-deletion-success";

type DeletionSummary = { canonicalUsername: string };

type AdminResponse = {
  ok: boolean;
  players?: FounderPlayerIdentityRow[];
  deletion?: DeletionSummary;
  code?: string;
  stage?: string;
  error?: string;
};

export default function FounderAccountDeletionAdmin() {
  const [players, setPlayers] = useState<FounderPlayerIdentityRow[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [target, setTarget] = useState<FounderPlayerIdentityRow | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [deletedUsername, setDeletedUsername] = useState("");

  const selected = useMemo(() => players.find((player) => player.playerId === selectedPlayerId) ?? null, [players, selectedPlayerId]);
  const confirmationMatches = Boolean(target && confirmation.trim().toLowerCase() === target.username.trim().toLowerCase());

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/beta-access", { cache: "no-store" });
      const body = await response.json() as AdminResponse;
      if (!response.ok || !body.ok || !body.players) throw new Error(body.error ?? "BoardSignal players could not be loaded.");
      setPlayers(body.players);
      setSelectedPlayerId((current) => body.players?.some((player) => player.playerId === current) ? current : body.players?.[0]?.playerId ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "BoardSignal players could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SUCCESS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { username?: string };
        if (parsed.username) setDeletedUsername(parsed.username);
        window.sessionStorage.removeItem(SUCCESS_KEY);
      }
    } catch { /* success continuity is optional */ }
    void loadPlayers();
  }, [loadPlayers]);

  function openDeleteConfirmation() {
    if (!selected) return;
    setTarget(selected);
    setConfirmation("");
    setError("");
  }

  function closeDeleteConfirmation() {
    if (deleting) return;
    setTarget(null);
    setConfirmation("");
  }

  async function permanentlyDelete() {
    if (!target || !confirmationMatches || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/beta-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "deleteAccount", playerId: target.playerId, confirmationUsername: confirmation.trim() }),
      });
      const body = await response.json() as AdminResponse;
      if (!response.ok || !body.ok || !body.deletion) {
        const stage = body.stage ? ` (${body.stage})` : "";
        throw new Error(`${body.error ?? "BoardSignal account deletion did not complete."}${stage}`);
      }
      try { window.sessionStorage.setItem(SUCCESS_KEY, JSON.stringify({ username: body.deletion.canonicalUsername })); } catch { /* page reload still refreshes the Founder list */ }
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "BoardSignal account deletion did not complete.");
      setDeleting(false);
    }
  }

  return <section className="desk-section founder-account-deletion-zone" aria-labelledby="founder-delete-heading">
    <div className="founder-directory-heading">
      <div><p className="kicker">DESTRUCTIVE ACCOUNT LIFECYCLE</p><h2 id="founder-delete-heading">Delete BoardSignal account</h2><p><strong>Revoke Access</strong> preserves the player account and history. <strong>Delete BoardSignal Account</strong> permanently removes the BoardSignal lifecycle so the same Chess.com player can onboard again from the beginning.</p></div>
      <button className="button button-quiet" type="button" onClick={() => void loadPlayers()} disabled={loading || deleting}><RefreshCcw size={15}/> Refresh</button>
    </div>

    {deletedUsername ? <div className="founder-account-deletion-success" role="status"><strong>ACCOUNT DELETED</strong><p>{deletedUsername} has been removed from BoardSignal. If this player returns, they will start BoardSignal onboarding again.</p></div> : null}
    {error ? <div className="founder-account-deletion-error" role="alert"><AlertTriangle size={18}/><div><strong>Deletion did not complete</strong><p>{error}</p><p>The operation is fail-closed and can be retried.</p></div></div> : null}

    {loading ? <div className="founder-directory-loading"><LoaderCircle className="button-spinner"/> Loading player identities</div> : players.length ? <div className="founder-account-deletion-picker">
      <label htmlFor="founder-delete-player">BoardSignal player account</label>
      <select id="founder-delete-player" value={selectedPlayerId ?? ""} disabled={deleting} onChange={(event) => setSelectedPlayerId(Number(event.target.value))}>
        {players.map((player) => <option key={player.playerId} value={player.playerId}>{player.username} · Chess.com ID {player.playerId}</option>)}
      </select>
      <button className="button founder-delete-account-button" type="button" onClick={openDeleteConfirmation} disabled={!selected || deleting}><Trash2 size={15}/> DELETE BOARDSIGNAL ACCOUNT</button>
    </div> : <div className="universe-empty"><p>No persistent BoardSignal player accounts exist to delete.</p></div>}

    {target ? <div className="founder-account-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="founder-delete-confirm-title">
      <div className="founder-account-delete-dialog-card">
        <button className="founder-account-delete-close" type="button" aria-label="Cancel account deletion" onClick={closeDeleteConfirmation} disabled={deleting}><X size={18}/></button>
        <AlertTriangle size={26}/>
        <div><p className="kicker">PERMANENT DELETION</p><h3 id="founder-delete-confirm-title">Delete {target.username} from BoardSignal?</h3></div>
        <p>This permanently removes their BoardSignal account, private reviews, progress, settings, access credentials and BoardSignal public presence.</p>
        <p>If they return later, they will begin onboarding again as a new player.</p>
        <div className="founder-account-delete-identity"><span>Stable Chess.com player ID</span><strong>{target.playerId}</strong></div>
        <label htmlFor="founder-delete-confirmation">Type <strong>{target.username}</strong> to confirm</label>
        <input id="founder-delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={deleting}/>
        <div className="founder-account-delete-actions"><button className="button button-quiet" type="button" onClick={closeDeleteConfirmation} disabled={deleting}>Cancel</button><button className="button founder-delete-account-permanently" type="button" onClick={() => void permanentlyDelete()} disabled={!confirmationMatches || deleting}>{deleting ? <><LoaderCircle className="button-spinner" size={15}/> Deleting</> : <><Trash2 size={15}/> DELETE ACCOUNT PERMANENTLY</>}</button></div>
      </div>
    </div> : null}
  </section>;
}
