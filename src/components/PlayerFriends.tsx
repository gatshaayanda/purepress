"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Ban, Check, CircleUserRound, LoaderCircle, MessageCircle, Search, Shield, Swords, UserMinus, UserPlus, X } from "lucide-react";
import type { HeadToHeadPayload, SocialPlayerCard } from "@/lib/boardsignal/social";
import { shouldRunInitialFriendsLoad } from "@/lib/boardsignal/friendsLoader";
import { boardSignalPresentationLabel } from "@/lib/boardsignal/presentationLanguage";
import { useBoardSignalConnectivity } from "@/components/ConnectivityProvider";
import { loadSocialOfflineSnapshot, saveSocialComparisonOfflineSnapshot, saveSocialOverviewOfflineSnapshot } from "@/lib/boardsignal/offline/snapshots";
import FriendConversation from "@/components/FriendConversation";

type Overview = {
  friends: SocialPlayerCard[];
  incoming: SocialPlayerCard[];
  outgoing: SocialPlayerCard[];
  rivalWatch: Array<{ player: SocialPlayerCard; label: string; detail: string }>;
  socialPulse: Array<{ id: string; playerId: number; eyebrow: string; headline: string; supportingFact: string; publishedAt: string }>;
};

type Props = {
  uid: string;
  token: string;
  initialComparePlayerId?: number;
  onChanged?: (overview: Overview) => void;
};

async function api<T>(token: string, path: string, init?: RequestInit, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort("timeout"), 12000);
  const abortFromParent = () => controller.abort(parentSignal?.reason ?? "unmounted");
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener("abort", abortFromParent, { once: true });
  }
  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const body = await response.json() as { ok: boolean; error?: string } & T;
    if (!response.ok || !body.ok) throw new Error(body.error ?? "BoardSignal social request failed.");
    return body;
  } catch (reason) {
    if (controller.signal.aborted) throw new Error(controller.signal.reason === "timeout" ? "BoardSignal connections took too long to respond. Try again." : "BoardSignal connections request was cancelled.");
    throw reason;
  } finally {
    window.clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export default function PlayerFriends({ uid, token, initialComparePlayerId, onChanged }: Props) {
  const connectivity = useBoardSignalConnectivity();
  const [overview, setOverview] = useState<Overview>({ friends: [], incoming: [], outgoing: [], rivalWatch: [], socialPulse: [] });
  const [suggested, setSuggested] = useState<SocialPlayerCard[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SocialPlayerCard[]>([]);
  const [comparison, setComparison] = useState<HeadToHeadPayload | null>(null);
  const [messageTarget, setMessageTarget] = useState<SocialPlayerCard | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [suggestionsUnavailable, setSuggestionsUnavailable] = useState(false);
  const onChangedRef = useRef(onChanged);
  const uidRef = useRef(uid);
  const loadedTokenRef = useRef<string | undefined>(undefined);

  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);
  useEffect(() => { uidRef.current = uid; }, [uid]);
  useEffect(() => { setMessageTarget(null); }, [uid]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const overviewBody = await api<{ overview: Overview }>(token, "/api/boardsignal/social?view=overview", undefined, signal);
    const suggestedBody = await api<{ players: SocialPlayerCard[] }>(token, "/api/boardsignal/social?view=suggested", undefined, signal)
      .catch((reason) => {
        if (signal?.aborted) throw reason;
        setSuggestionsUnavailable(true);
        return { ok: true as const, players: [] as SocialPlayerCard[] };
      });
    setOverview(overviewBody.overview);
    setSuggested(suggestedBody.players);
    if (messageTarget && !overviewBody.overview.friends.some((friend) => friend.playerId === messageTarget.playerId)) setMessageTarget(null);
    void saveSocialOverviewOfflineSnapshot(uidRef.current, overviewBody.overview).then(() => window.dispatchEvent(new CustomEvent("boardsignal:offline-saved"))).catch(() => undefined);
    onChangedRef.current?.(overviewBody.overview);
  }, [messageTarget, token]);

  useEffect(() => {
    if (connectivity.state === "checking" || connectivity.state === "reconnecting") return;
    if (!connectivity.online) {
      let active = true;
      setLoading(true);
      setError("");
      void loadSocialOfflineSnapshot(uid)
        .then((saved) => {
          if (!active) return;
          if (saved?.overview) { setOverview(saved.overview); onChangedRef.current?.(saved.overview); }
          if (initialComparePlayerId) {
            const savedComparison = saved?.comparisons.find((item) => item.right.playerId === initialComparePlayerId);
            if (savedComparison) setComparison(savedComparison);
          }
        })
        .catch(() => undefined)
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
    if (!shouldRunInitialFriendsLoad(loadedTokenRef.current, token)) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSuggestionsUnavailable(false);
    load(controller.signal)
      .then(() => { loadedTokenRef.current = token; })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Friends could not be loaded.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort("unmounted");
  }, [connectivity.online, connectivity.state, initialComparePlayerId, load, token, uid]);

  const compare = useCallback(async (playerId: number) => {
    setBusy(`compare:${playerId}`);
    setError("");
    try {
      if (!connectivity.online) {
        const saved = await loadSocialOfflineSnapshot(uid);
        const savedComparison = saved?.comparisons.find((item) => item.right.playerId === playerId);
        if (!savedComparison) throw new Error("This Head-to-Head has not been saved on this device yet. Reconnect to load it.");
        setComparison(savedComparison);
        return;
      }
      const body = await api<{ comparison: HeadToHeadPayload }>(token, `/api/boardsignal/social?view=compare&playerId=${encodeURIComponent(String(playerId))}`);
      setComparison(body.comparison);
      void saveSocialComparisonOfflineSnapshot(uid, body.comparison).then(() => window.dispatchEvent(new CustomEvent("boardsignal:offline-saved"))).catch(() => undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Head-to-Head could not be loaded.");
    } finally { setBusy(""); }
  }, [connectivity.online, token, uid]);

  useEffect(() => {
    if (!initialComparePlayerId || loading) return;
    if (overview.friends.some((friend) => friend.playerId === initialComparePlayerId)) void compare(initialComparePlayerId);
  }, [compare, initialComparePlayerId, loading, overview.friends]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("boardsignal:context", { detail: comparison
      ? { activeTab: "head-to-head", visibleEntityId: comparison.right.playerId }
      : messageTarget ? { activeTab: "friends", visibleEntityId: messageTarget.playerId }
        : { activeTab: "friends" } }));
  }, [comparison, messageTarget]);

  async function socialAction(action: string, playerId: number, pinned?: boolean) {
    if (!connectivity.online) { setError("Reconnect to change your BoardSignal connections."); return; }
    setBusy(`${action}:${playerId}`);
    setError("");
    try {
      await api(token, "/api/boardsignal/social", { method: "POST", body: JSON.stringify({ action, playerId, pinned }) });
      if (action === "unfriend" || action === "block") {
        setComparison(null);
        if (messageTarget?.playerId === playerId) setMessageTarget(null);
      }
      await load();
      if (query.trim().length >= 2) await search(query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The social update could not be saved.");
    } finally { setBusy(""); }
  }

  async function search(value = query) {
    if (!connectivity.online) { setError("Reconnect to search active BoardSignal players."); return; }
    const normalized = value.trim();
    if (normalized.length < 2) { setResults([]); return; }
    setBusy("search");
    setError("");
    try {
      const body = await api<{ players: SocialPlayerCard[] }>(token, `/api/boardsignal/social?view=search&q=${encodeURIComponent(normalized)}`);
      setResults(body.players);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Player search failed.");
    } finally { setBusy(""); }
  }

  const hasConnections = overview.friends.length + overview.incoming.length + overview.outgoing.length > 0;
  const lookup = useMemo(() => new Map([
    ...overview.friends.map((player) => [player.playerId, "friends"] as const),
    ...overview.incoming.map((player) => [player.playerId, "incoming"] as const),
    ...overview.outgoing.map((player) => [player.playerId, "outgoing"] as const),
  ]), [overview]);

  if (loading) return <section className="friends-surface"><div className="social-loading"><LoaderCircle className="button-spinner" /><span>Loading your BoardSignal connections</span></div></section>;

  return <section className="friends-surface">
    {!connectivity.online ? <div className="offline-action-note" role="status">Offline · saved connection state is read-only. Reconnect to change connections or send private friend messages.</div> : null}
    <div className="room-section-heading"><div><p className="kicker">FRIENDS</p><h2>Recent chess gets more interesting when the gap has a name.</h2><p>Connect using stable BoardSignal identities. Accepted friends can also message privately; private Signals, evidence, contact details and founder messages never enter friend chat.</p></div></div>
    {error ? <div className="notice notice-error social-load-error" role="alert"><p>{error}</p><button type="button" className="button button-quiet" onClick={() => { loadedTokenRef.current = undefined; setLoading(true); setError(""); void load().then(() => { loadedTokenRef.current = token; }).catch((reason) => setError(reason instanceof Error ? reason.message : "Friends could not be loaded.")).finally(() => setLoading(false)); }}>Try again</button></div> : null}

    {overview.socialPulse.length ? <section className="social-panel"><p className="kicker">SOCIAL PULSE</p><div className="social-pulse-grid">{overview.socialPulse.map((event) => <article key={event.id}><span>{event.eyebrow}</span><h3>{event.headline}</h3><p>{event.supportingFact}</p><small>{new Date(event.publishedAt).toLocaleDateString()}</small></article>)}</div></section> : null}

    {overview.incoming.length || overview.outgoing.length ? <section className="social-panel"><p className="kicker">REQUESTS</p><div className="friend-card-grid">
      {overview.incoming.map((player) => <FriendCard key={`in:${player.playerId}`} player={player} status="incoming" actions={<><button className="button button-lime" type="button" disabled={Boolean(busy) || !connectivity.online} onClick={() => socialAction("accept", player.playerId)}><Check size={15}/> Accept</button><button className="button button-quiet" type="button" disabled={Boolean(busy) || !connectivity.online} onClick={() => socialAction("decline", player.playerId)}><X size={15}/> Decline</button></>} />)}
      {overview.outgoing.map((player) => <FriendCard key={`out:${player.playerId}`} player={player} status="outgoing" actions={<button className="button button-quiet" type="button" disabled={Boolean(busy) || !connectivity.online} onClick={() => socialAction("cancel", player.playerId)}><X size={15}/> Cancel</button>} />)}
    </div></section> : null}

    {overview.friends.length ? <section className="social-panel"><div className="social-panel-heading"><p className="kicker">FRIENDS</p><span>{overview.friends.length} connected</span></div><div className="friend-card-grid">{overview.friends.map((player) => <FriendCard key={player.playerId} player={player} status="friends" actions={<>
      <button className="button button-blue" type="button" disabled={Boolean(busy)} onClick={() => compare(player.playerId)}><Swords size={15}/> Compare</button>
      <button className="button button-lime" type="button" disabled={Boolean(busy) || !connectivity.online} onClick={() => { setComparison(null); setMessageTarget(player); }}><MessageCircle size={15}/> Message</button>
      <button className="button button-quiet" type="button" disabled={Boolean(busy) || !connectivity.online} onClick={() => socialAction("pin", player.playerId, !player.rivalPinned)}>{player.rivalPinned ? "Unpin rival" : "Pin to Rival Watch"}</button>
      <button className="button button-quiet" type="button" disabled={Boolean(busy) || !connectivity.online} onClick={() => socialAction("unfriend", player.playerId)}><UserMinus size={15}/> Unfriend</button>
      <button className="button button-quiet" type="button" disabled={Boolean(busy) || !connectivity.online} onClick={() => socialAction("block", player.playerId)}><Ban size={15}/> Block</button>
    </>} />)}</div></section> : null}

    {messageTarget ? <FriendConversation uid={uid} token={token} friend={messageTarget} online={connectivity.online} onClose={() => setMessageTarget(null)} /> : null}

    {overview.rivalWatch.length ? <section className="social-panel rival-watch-panel"><p className="kicker">RIVAL WATCH</p><div className="rival-watch-grid">{overview.rivalWatch.map((item) => <article key={item.player.playerId}><span>{item.label}</span><h3>{item.player.canonicalUsername}</h3><p>{item.detail}</p><button type="button" className="text-link social-text-button" disabled={Boolean(busy)} onClick={() => compare(item.player.playerId)}>Open Head-to-Head</button></article>)}</div></section> : null}

    {comparison ? <HeadToHead comparison={comparison} onClose={() => setComparison(null)} /> : null}

    <section className="social-panel find-friends-panel"><div className="social-panel-heading"><div><p className="kicker">FIND PLAYERS</p><h3>{hasConnections ? "Add someone else to your board." : "Your board gets better with people you know."}</h3></div></div><p>Search active BoardSignal members by canonical Chess.com username. Blocked players are never suggested.</p><div className="social-search"><label htmlFor="friend-search">Chess.com username</label><div><input id="friend-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Search BoardSignal players"/><button className="button button-dark" type="button" disabled={!connectivity.online || busy === "search" || query.trim().length < 2} onClick={() => search()}>{busy === "search" ? <LoaderCircle className="button-spinner" size={15}/> : <Search size={15}/>} Search</button></div></div>
      {results.length ? <div className="friend-card-grid social-search-results">{results.map((player) => <DiscoveryCard key={player.playerId} player={player} status={lookup.get(player.playerId)} busy={Boolean(busy)} online={connectivity.online} onAction={socialAction} onCompare={compare}/>)}</div> : null}
      {!query.trim() && suggested.length ? <><p className="social-suggestion-label">ACTIVE PLAYERS TO DISCOVER</p><div className="friend-card-grid">{suggested.map((player) => <DiscoveryCard key={player.playerId} player={player} status={lookup.get(player.playerId)} busy={Boolean(busy)} online={connectivity.online} onAction={socialAction} onCompare={compare}/>)}</div></> : null}
      {!query.trim() && suggestionsUnavailable ? <p className="social-empty-note">Active player suggestions are temporarily unavailable. Search still works.</p> : null}
    </section>
  </section>;
}

function FriendCard({ player, status, actions }: { player: SocialPlayerCard; status: "incoming" | "outgoing" | "friends"; actions: ReactNode }) {
  return <article className="friend-card"><div className="friend-card-ident"><div className="social-avatar">{player.avatar ? <img src={player.avatar} alt=""/> : <CircleUserRound aria-hidden="true"/>}</div><div><span>{status === "friends" ? "FRIEND" : status === "incoming" ? "REQUEST RECEIVED" : "REQUEST SENT"}</span><h3>{player.canonicalUsername}</h3></div></div><div className="friend-card-facts">{player.latestDeskPeriod ? <p><strong>Latest Review</strong>{player.latestDeskPeriod}</p> : null}{player.primaryPool ? <p><strong>Primary pool</strong>{player.primaryPool}</p> : null}{player.universePlacement ? <p><strong>Universe</strong>{player.universePlacement}</p> : null}{player.safeHighlight ? <p><strong>Recent moment</strong>{player.safeHighlight}</p> : null}</div><div className="friend-card-actions">{actions}<Link href={`/player/${encodeURIComponent(player.canonicalUsername)}`} className="text-link">Open player <ArrowRight size={14}/></Link></div></article>;
}

function DiscoveryCard({ player, status, busy, online, onAction, onCompare }: { player: SocialPlayerCard; status?: string; busy: boolean; online: boolean; onAction: (action: string, playerId: number, pinned?: boolean) => Promise<void>; onCompare: (playerId: number) => Promise<void> }) {
  return <article className="friend-card discovery-card"><div className="friend-card-ident"><div className="social-avatar">{player.avatar ? <img src={player.avatar} alt=""/> : <CircleUserRound aria-hidden="true"/>}</div><div><span>BOARDSIGNAL PLAYER</span><h3>{player.canonicalUsername}</h3></div></div>{player.safeHighlight ? <p>{player.safeHighlight}</p> : <p>{player.universePlacement ?? "Active Founding Access player."}</p>}<div className="friend-card-actions">{status === "friends" ? <button className="button button-blue" type="button" disabled={busy} onClick={() => onCompare(player.playerId)}><Swords size={15}/> Compare</button> : status === "outgoing" ? <button className="button button-quiet" type="button" disabled>Request pending</button> : status === "incoming" ? <button className="button button-lime" type="button" disabled={busy || !online} onClick={() => onAction("accept", player.playerId)}><Check size={15}/> Accept request</button> : <button className="button button-lime" type="button" disabled={busy || !online} onClick={() => onAction("send", player.playerId)}><UserPlus size={15}/> Add Friend</button>}<Link href={`/player/${encodeURIComponent(player.canonicalUsername)}`} className="text-link">Open player</Link></div></article>;
}

function HeadToHead({ comparison, onClose }: { comparison: HeadToHeadPayload; onClose: () => void }) {
  return <section className="head-to-head" aria-labelledby="head-to-head-title"><div className="head-to-head-heading"><div><p className="kicker">HEAD TO HEAD</p><h2 id="head-to-head-title">{comparison.left.canonicalUsername} <span>vs</span> {comparison.right.canonicalUsername}</h2><p>{boardSignalPresentationLabel(comparison.recentFourLabel)}. Pools stay separate. Old Reviews leave the comparison when they leave active four-Review memory.</p></div><button type="button" className="button button-quiet" onClick={onClose}>Close</button></div><div className="head-to-head-ident"><article><span>{comparison.left.desksAvailable} active Reviews</span><strong>{comparison.left.canonicalUsername}</strong></article><div aria-hidden="true">VS</div><article><span>{comparison.right.desksAvailable} active Reviews</span><strong>{comparison.right.canonicalUsername}</strong></article></div>{comparison.comparablePools.length ? <p className="comparison-pools">Comparable pools: {comparison.comparablePools.map((pool) => pool.toUpperCase()).join(" · ")}</p> : <div className="social-empty-note"><Shield size={16}/><p>No comparable pool sample is currently available. BoardSignal will not manufacture a winner.</p></div>}<div className="comparison-grid">{comparison.metrics.map((metric) => <article key={metric.key}><div><span>{boardSignalPresentationLabel(metric.label)}</span>{metric.scope ? <b>{metric.scope}</b> : null}</div><div className="comparison-values"><strong>{metric.leftValue}</strong><span>vs</span><strong>{metric.rightValue}</strong></div>{metric.note ? <p>{metric.note}</p> : null}</article>)}</div>{comparison.universe.length ? <div className="comparison-universe"><p className="kicker">UNIVERSE</p>{comparison.universe.slice(0,6).map((item) => <article key={`${item.categoryId}:${item.scopeLabel ?? "all"}`}><span>{item.categoryTitle}{item.scopeLabel ? ` · ${item.scopeLabel}` : ""}</span><strong>#{item.leftRank} vs #{item.rightRank}</strong><p>{item.note ?? `${item.leftValueLabel} · ${item.rightValueLabel}`}</p></article>)}</div> : null}<div className="social-private-rule"><Shield size={17}/><p><strong>Public coverage. Private weakness.</strong> Head-to-Head excludes Red, private Amber, Blue, evidence, recurrence, contact information and private messages. Game links remain controlled by each player's existing public-game-link preference.</p></div></section>;
}
