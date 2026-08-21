"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { BarChart3, CalendarDays, Inbox, LoaderCircle, ShieldCheck, Target, TrendingUp } from "lucide-react";
import BetaAgreementGate from "@/components/BetaAgreementGate";
import ChessComLoginPanel from "@/components/ChessComLoginPanel";
import PlayerInbox from "@/components/PlayerInbox";
import PlayerFriends from "@/components/PlayerFriends";
import PlayerPreferencesGate from "@/components/PlayerPreferencesGate";
import PlayerProfileNotifications from "@/components/PlayerProfileNotifications";
import PlayerRoomQuickRead from "@/components/PlayerRoomQuickRead";
import UniversalPlayerDesk from "@/components/UniversalPlayerDesk";
import ShareMomentActions from "@/components/ShareMomentActions";
import UsernameDeskForm from "@/components/UsernameDeskForm";
import { removeBoardSignalBrowserPush } from "@/components/BrowserPushControl";
import { hasAcceptedCurrentBetaAgreement, type BoardSignalAccount } from "@/lib/boardsignal/account";
import type { CurrentEpisodeWithNextGameGuidance } from "@/lib/boardsignal/activeWeekGuidance";
import type { PlayerPulse, PublicUniverseEvent, SafeShareMoment } from "@/lib/boardsignal/pulse";
import {
  deskKeyFor,
  type DeskSummary,
  type PersonalRecords,
  type ProgressSeries,
  type RecurringPattern,
} from "@/lib/boardsignal/memory";
import { shouldMountAutomaticReviewGenerator } from "@/lib/boardsignal/firstReviewGeneration.mjs";
import type { BoardSignalDesk, DeskEngineResult } from "@/lib/boardsignal/types";
import type { FactualReviewDraft } from "@/lib/boardsignal/factualReview";
import type { CompletedReviewHistoryItem } from "@/lib/boardsignal/reviewHistory";
import { boardSignalPresentationLabel } from "@/lib/boardsignal/presentationLanguage";
import { buildPlayerRoomQuickRead } from "@/lib/boardsignal/playerRoomPresentation";
import { auth } from "@/utils/firebaseConfig";
import { useBoardSignalConnectivity } from "@/components/ConnectivityProvider";
import { clearBoardSignalPrivateOfflineData } from "@/lib/boardsignal/offline/db";
import { loadPlayerRoomOfflineSnapshot, requestPersistentStorageBestEffort, savePlayerRoomOfflineSnapshot } from "@/lib/boardsignal/offline/snapshots";
import type { OfflinePlayerRoomSnapshot } from "@/lib/boardsignal/offline/types";
import { markBoardSignalPwaEngaged } from "@/lib/boardsignal/offline/install";
import { clearBoardSignalAppBadge, syncBoardSignalAppBadge } from "@/lib/boardsignal/offline/badge";
import OfflinePlayerRoom from "@/components/OfflinePlayerRoom";
import DeskReturnChannelPrompt from "@/components/DeskReturnChannelPrompt";

type DeskBundle = { desk: BoardSignalDesk; engineResults: Record<string, DeskEngineResult>; summary: DeskSummary };
type Snapshot = {
  account: BoardSignalAccount;
  desks: DeskBundle[];
  reviewHistory?: CompletedReviewHistoryItem[];
  originalBetaReturn?: boolean;
  progress: ProgressSeries[];
  recurringPatterns: RecurringPattern[];
  personalRecords: PersonalRecords;
  currentEpisode?: CurrentEpisodeWithNextGameGuidance;
  pendingFactualReview?: FactualReviewDraft;
  progressUnavailable?: string;
  pulseUnavailable?: string;
  generationRequired: boolean;
  pulse?: PlayerPulse;
  shareMoments?: Array<SafeShareMoment & { activeDesk?: boolean }>;
};
type RoomTab = "desk" | "progress" | "universe" | "friends" | "inbox" | "profile";
type SocialSummaryPlayer = { playerId: number; canonicalUsername: string; relationshipStatus?: "incoming" | "outgoing" | "friends" };

const FOCUS_REFRESH_THROTTLE_MS = 75_000;

export default function BoardSignalPlayerRoom() {
  const connectivity = useBoardSignalConnectivity();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RoomTab>("desk");
  const [unreadCount, setUnreadCount] = useState(0);
  const [socialPlayers, setSocialPlayers] = useState<Record<string, SocialSummaryPlayer>>({});
  const [friendCompareTarget, setFriendCompareTarget] = useState<number | undefined>();
  const [offlineSnapshot, setOfflineSnapshot] = useState<OfflinePlayerRoomSnapshot | null>(null);
  const [offlineReadyNotice, setOfflineReadyNotice] = useState(false);
  const activeUidRef = useRef<string | undefined>(undefined);
  const reconnectRefreshRef = useRef(false);
  const focusRefreshRef = useRef(false);
  const lastFocusRefreshAtRef = useRef(0);
  const publishedDeskKeyThisSessionRef = useRef<string | undefined>(undefined);

  const loadRoom = useCallback(async (activeUser: User, quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const idToken = await activeUser.getIdToken();
      setToken(idToken);
      const response = await fetch("/api/boardsignal/player-room", { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
      const body = await response.json() as { ok: boolean; snapshot?: Snapshot; error?: string };
      if (!response.ok || !body.ok || !body.snapshot) throw new Error(body.error ?? "My BoardSignal could not be loaded.");
      setSnapshot(body.snapshot);
      setOfflineSnapshot(null);
      void savePlayerRoomOfflineSnapshot(activeUser.uid, body.snapshot).then(({ firstReady }) => {
        window.dispatchEvent(new CustomEvent("boardsignal:offline-saved"));
        if (body.snapshot?.desks?.length) markBoardSignalPwaEngaged();
        if (firstReady) { setOfflineReadyNotice(true); window.setTimeout(() => setOfflineReadyNotice(false), 4200); void requestPersistentStorageBestEffort(activeUser.uid); }
      }).catch(() => undefined);
      try {
        if (window.sessionStorage.getItem("boardsignal:pwa-recovery-refresh") === "1") {
          window.sessionStorage.removeItem("boardsignal:pwa-recovery-refresh");
          window.dispatchEvent(new CustomEvent("boardsignal:refresh-complete"));
        }
      } catch { /* recovery acknowledgement is optional */ }
      return true;
    } catch (reason) {
      const saved = await loadPlayerRoomOfflineSnapshot(activeUser.uid).catch(() => undefined);
      if (saved) {
        setOfflineSnapshot(saved);
        setError("");
        return false;
      }
      setError(reason instanceof Error ? reason.message : "My BoardSignal could not be loaded.");
      throw reason;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (activeUser) => {
    const previousUid = activeUidRef.current;
    const nextUid = activeUser?.uid;
    if (previousUid && previousUid !== nextUid) publishedDeskKeyThisSessionRef.current = undefined;
    if (previousUid && nextUid && previousUid !== nextUid) {
      // Invalidate Player A immediately before any Player B read begins. The async purge is defense-in-depth.
      setSnapshot(null);
      setOfflineSnapshot(null);
      setToken("");
      setSocialPlayers({});
      setUnreadCount(0);
      void clearBoardSignalAppBadge();
      void clearBoardSignalPrivateOfflineData(previousUid);
    }
    activeUidRef.current = nextUid;
    setUser(activeUser);
    setAuthReady(true);
    if (activeUser) void loadRoom(activeUser).catch((reason) => { setError(reason instanceof Error ? reason.message : "My BoardSignal could not be loaded."); setLoading(false); });
    else { setSnapshot(null); setOfflineSnapshot(null); setToken(""); setLoading(false); }
  }), [loadRoom]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (["desk", "progress", "universe", "friends", "inbox", "profile"].includes(requestedTab ?? "")) setTab(requestedTab as RoomTab);
    const compare = Number(new URLSearchParams(window.location.search).get("compare"));
    if (Number.isSafeInteger(compare) && compare > 0) setFriendCompareTarget(compare);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("boardsignal:context", { detail: { activeTab: tab } }));
  }, [tab]);

  useEffect(() => {
    const reconnected = () => {
      if (!user || reconnectRefreshRef.current || focusRefreshRef.current) return;
      reconnectRefreshRef.current = true;
      lastFocusRefreshAtRef.current = Date.now();
      void loadRoom(user, true)
        .then((refreshed) => { if (refreshed) window.dispatchEvent(new CustomEvent("boardsignal:refresh-complete")); })
        .catch(() => undefined)
        .finally(() => { reconnectRefreshRef.current = false; });
    };
    window.addEventListener("boardsignal:reconnected", reconnected);
    return () => window.removeEventListener("boardsignal:reconnected", reconnected);
  }, [loadRoom, user]);

  useEffect(() => {
    if (!user || !connectivity.online) return;

    const refreshAfterReturn = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastFocusRefreshAtRef.current < FOCUS_REFRESH_THROTTLE_MS) return;
      if (focusRefreshRef.current || reconnectRefreshRef.current) return;

      lastFocusRefreshAtRef.current = now;
      focusRefreshRef.current = true;
      void loadRoom(user, true)
        .catch(() => undefined)
        .finally(() => { focusRefreshRef.current = false; });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshAfterReturn();
    };

    window.addEventListener("focus", refreshAfterReturn);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshAfterReturn);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [connectivity.online, loadRoom, user]);

  // If a live Player Room loses reachability after it has already rendered,
  // swap to the same UID-scoped saved shell instead of leaving live-only controls active.
  useEffect(() => {
    if (connectivity.state !== "offline" || !user) return;
    let active = true;
    void loadPlayerRoomOfflineSnapshot(user.uid)
      .then((saved) => { if (active && saved) setOfflineSnapshot(saved); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [connectivity.state, user]);

  const refreshSocialSummary = useCallback(async () => {
    if (!token) return;
    const response = await fetch("/api/boardsignal/social?view=overview", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json() as { ok?: boolean; overview?: { friends?: SocialSummaryPlayer[]; incoming?: SocialSummaryPlayer[]; outgoing?: SocialSummaryPlayer[] } };
    if (!response.ok || !body.ok || !body.overview) return;
    const players = [...(body.overview.friends ?? []), ...(body.overview.incoming ?? []), ...(body.overview.outgoing ?? [])];
    setSocialPlayers(Object.fromEntries(players.map((player) => [player.canonicalUsername.toLowerCase(), player])));
  }, [token]);

  useEffect(() => { if (token && snapshot?.account.preferencesConfirmedAt) void refreshSocialSummary(); }, [refreshSocialSummary, snapshot?.account.preferencesConfirmedAt, token]);

  const handleFriendsChanged = useCallback((overview: { friends: SocialSummaryPlayer[]; incoming: SocialSummaryPlayer[]; outgoing: SocialSummaryPlayer[] }) => {
    const players = [...overview.friends, ...overview.incoming, ...overview.outgoing];
    setSocialPlayers(Object.fromEntries(players.map((player) => [player.canonicalUsername.toLowerCase(), player])));
  }, []);

  const socialActionFromUniverse = useCallback(async (username: string) => {
    if (!connectivity.online) { setTab("friends"); return; }
    const known = socialPlayers[username.toLowerCase()];
    if (known?.relationshipStatus === "friends") { setFriendCompareTarget(known.playerId); setTab("friends"); return; }
    if (known) { setTab("friends"); return; }
    if (!token) return;
    const search = await fetch(`/api/boardsignal/social?view=search&q=${encodeURIComponent(username)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const found = await search.json() as { ok?: boolean; players?: SocialSummaryPlayer[] };
    const target = found.players?.find((player) => player.canonicalUsername.toLowerCase() === username.toLowerCase());
    if (!search.ok || !found.ok || !target) { setTab("friends"); return; }
    await fetch("/api/boardsignal/social", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", playerId: target.playerId }) });
    await refreshSocialSummary();
  }, [connectivity.online, refreshSocialSummary, socialPlayers, token]);

  useEffect(() => {
    if (!user || !token || !snapshot?.account.preferencesConfirmedAt) return;
    fetch("/api/boardsignal/inbox", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((response) => response.json())
      .then((body: { ok?: boolean; inbox?: { unreadCount?: number } }) => setUnreadCount(Number(body.inbox?.unreadCount ?? 0)))
      .catch(() => undefined);
  }, [snapshot?.account.preferencesConfirmedAt, token, user]);

  useEffect(() => {
    if (!user?.uid) { void clearBoardSignalAppBadge(); return; }
    void syncBoardSignalAppBadge(unreadCount).catch(() => undefined);
  }, [unreadCount, user?.uid]);

  async function acceptAgreement() {
    if (!connectivity.online) throw new Error("Reconnect before accepting the Founding Access Agreement.");
    const response = await fetch("/api/boardsignal/player-room", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acceptAgreement" }),
    });
    const body = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !body.ok) throw new Error(body.error ?? "The agreement could not be recorded.");
    if (user) await loadRoom(user);
  }

  async function confirmPreferences(
    contact: {
      preferredContactMethod: import("@/lib/boardsignal/account").BoardSignalContactMethod;
      preferredContactValue: string;
      betaContactConsent: true;
    },
    notificationPreferences: import("@/lib/boardsignal/account").BoardSignalNotificationPreferences,
  ) {
    if (!snapshot) return;
    if (!connectivity.online) throw new Error("Reconnect before changing BoardSignal account or communication settings.");
    const response = await fetch("/api/boardsignal/player-room", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updatePreferences",
        privacy: { ...snapshot.account.privacy, publicPlayerPage: true, universeCoverage: true },
        notificationPreferences,
        contact,
      }),
    });
    const body = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !body.ok) throw new Error(body.error ?? "Communication setup could not be saved.");
    if (user) await loadRoom(user);
  }

  const saveFactualReview = useCallback(async (desk: BoardSignalDesk) => {
    if (!connectivity.online) throw new Error("Your factual week is available in this session, but reconnect before BoardSignal can save it for return.");
    const response = await fetch("/api/boardsignal/player-room", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveFactualReview", desk }),
    });
    const body = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !body.ok) throw new Error(body.error ?? "Your factual week is available in this session, but BoardSignal could not save it for return yet.");
  }, [connectivity.online, token]);

  const publishDesk = useCallback(async (desk: BoardSignalDesk, engineResults: Record<string, DeskEngineResult>) => {
    if (!connectivity.online) throw new Error("Reconnect before finishing or saving a review.");
    const response = await fetch("/api/boardsignal/player-room", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publishDesk", desk, engineResults }),
    });
    const body = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !body.ok) throw new Error(body.error ?? "The completed review could not be saved.");
    publishedDeskKeyThisSessionRef.current = deskKeyFor(desk);
    if (user) await loadRoom(user);
  }, [connectivity.online, loadRoom, token, user]);

  const signOutPlayer = useCallback(async () => {
    if (token && connectivity.online) await removeBoardSignalBrowserPush(token).catch(() => undefined);
    if (user?.uid) await clearBoardSignalPrivateOfflineData(user.uid).catch(() => undefined);
    setOfflineSnapshot(null);
    setSnapshot(null);
    setUnreadCount(0);
    await clearBoardSignalAppBadge().catch(() => false);
    await signOut(auth);
  }, [connectivity.online, token, user?.uid]);

  const latest = snapshot?.desks[0];
  const quickRead = latest && snapshot ? buildPlayerRoomQuickRead({ latest: latest.desk, recurringPatterns: snapshot.recurringPatterns, currentEpisode: snapshot.currentEpisode }) : undefined;
  const reviewHistory = snapshot?.reviewHistory ?? [];
  const hasOriginalHistory = reviewHistory.some((review) => review.source === "original_beta");
  const originalCadenceAnchor = snapshot?.account.cadenceAnchor;
  const automaticGenerationRequired = snapshot ? shouldMountAutomaticReviewGenerator({
    generationRequired: snapshot.generationRequired,
    latestDeskKey: latest?.summary.deskKey,
    publishedDeskKeyThisSession: publishedDeskKeyThisSessionRef.current,
  }) : false;

  if (!authReady || loading) return <RoomLoading />;
  if (!user && connectivity.state === "offline") return (
    <div id="main" className="container player-room-entry bs-surface-paper">
      <p className="kicker">MY BOARDSIGNAL · OFFLINE</p><h1>Reconnect to sign in.</h1>
      <p>BoardSignal never performs access verification or authentication offline. If this device already has a saved My BoardSignal, it becomes available only after Firebase recognizes that same signed-in account locally.</p>
      <Link className="button button-dark" href="/offline/player-room">Open saved My BoardSignal</Link>
    </div>
  );
  if (!user) return (
    <div id="main" className="container player-room-entry">
      <p className="kicker">MY BOARDSIGNAL</p><h1>Your games, your review, your progress.</h1>
      <ChessComLoginPanel />
      <div className="oauth-pending-divider"><span>Need Founding Access?</span></div>
      <UsernameDeskForm />
    </div>
  );
  if (offlineSnapshot && user) return <OfflinePlayerRoom uid={user.uid} initialSnapshot={offlineSnapshot} embedded />;
  if (error || !snapshot) return <RoomError error={error || "My BoardSignal could not be loaded."} />;
  if (!hasAcceptedCurrentBetaAgreement(snapshot.account)) return <>{snapshot.originalBetaReturn ? <OriginalBetaWelcome /> : null}<BetaAgreementGate onAccept={acceptAgreement} /></>;
  if (!snapshot.account.preferencesConfirmedAt || !snapshot.account.contactConfirmedAt) return <>{snapshot.originalBetaReturn ? <OriginalBetaWelcome /> : null}<PlayerPreferencesGate account={snapshot.account} onContinue={confirmPreferences} /></>;

  if (automaticGenerationRequired && !hasOriginalHistory) {
    return (
      <div id="main" className="player-room-authenticated">
        <RoomIdentity account={snapshot.account} />
        <div className="container member-first-desk-note"><p className="kicker">REVIEW 1 · PERSISTENT ACCOUNT</p><h2>Your first review belongs here.</h2><p>{connectivity.online ? "BoardSignal is building the latest completed week for your Chess.com identity. When the evidence checks are complete, the review is saved here in My BoardSignal." : "You're offline. BoardSignal will not retrieve new Chess.com games or build a review until you reconnect."}</p><button className="button button-quiet" type="button" onClick={signOutPlayer}>Sign out</button></div>
        {connectivity.online ? <UniversalPlayerDesk requestedUsername={snapshot.account.chessCom.canonicalUsername} ownerToken={token} cadenceAnchor={snapshot.account.cadenceAnchor} onFactualReviewReady={saveFactualReview} onDeskPublished={publishDesk} embedded /> : <div className="container offline-network-action"><strong>Building a new review needs a connection.</strong><p>Your account is unchanged. Reconnect and BoardSignal will continue your review.</p></div>}
      </div>
    );
  }

  return (
    <div id="main" className="player-room-authenticated">
      <RoomIdentity account={snapshot.account} />
      <RoomNav tab={tab} setTab={setTab} unreadCount={unreadCount} />
      {offlineReadyNotice ? <div className="container offline-ready-note" role="status">Your latest BoardSignal is available offline on this device.</div> : null}

      {tab === "desk" ? <section id="player-room-panel-desk" role="tabpanel" aria-labelledby="player-room-tab-desk" className="g3-room-panel g3-review-tab">
        <div className="container player-room-memory g3-review-flow">
          {quickRead ? <PlayerRoomQuickRead quickRead={quickRead} /> : null}
          {snapshot.currentEpisode ? <CurrentEpisodeCard episode={snapshot.currentEpisode} uid={user.uid} online={connectivity.online} /> : <div className="founding-field-note"><CalendarDays size={18} /><div><strong>This week's check is unavailable</strong><p>{snapshot.progressUnavailable ?? "Your last completed review remains unchanged."}</p></div></div>}
        </div>
        {snapshot.pendingFactualReview ? <UniversalPlayerDesk requestedUsername={snapshot.account.chessCom.canonicalUsername} ownerToken={token} cadenceAnchor={snapshot.account.cadenceAnchor} pendingFactualReview={snapshot.pendingFactualReview} onFactualReviewReady={saveFactualReview} onDeskPublished={publishDesk} embedded /> : latest ? <><UniversalPlayerDesk requestedUsername={latest.desk.player.username} publishedDesk={latest.desk} publishedEngineResults={latest.engineResults} presentationMode="player-room" embedded /><div className="container player-room-memory g3-post-review">{latest ? <ShareMomentsSection moments={(snapshot.shareMoments ?? []).filter((moment) => moment.deskKey === latest.summary.deskKey).slice(0, 3)} /> : null}<DeskReturnChannelPrompt uid={snapshot.account.uid} idToken={token} browserPushEnabled={snapshot.account.notificationPreferences.browserPush === true} emailActive={snapshot.account.notificationPreferences.email === true} onEnabled={async () => { if (user) await loadRoom(user, true); }} /></div></> : automaticGenerationRequired && hasOriginalHistory ? <div className="container player-room-memory"><div className="founding-field-note"><CalendarDays size={18}/><div><strong>Your original Review is already here.</strong><p>{connectivity.online ? "BoardSignal is building the next eligible LIVE Review from your preserved seven-day cadence." : "Reconnect before BoardSignal retrieves new Chess.com games for your next Review."}</p></div></div>{connectivity.online ? <UniversalPlayerDesk requestedUsername={snapshot.account.chessCom.canonicalUsername} ownerToken={token} cadenceAnchor={originalCadenceAnchor} onFactualReviewReady={saveFactualReview} onDeskPublished={publishDesk} embedded /> : null}</div> : null}
      </section> : null}

      {tab === "progress" ? <section id="player-room-panel-progress" role="tabpanel" aria-labelledby="player-room-tab-progress" className="g3-room-panel"><div className="container player-room-memory"><ProgressSection history={reviewHistory} progress={snapshot.progress} patterns={snapshot.recurringPatterns} records={snapshot.personalRecords} /></div></section> : null}
      {tab === "universe" ? <section id="player-room-panel-universe" role="tabpanel" aria-labelledby="player-room-tab-universe" className="g3-room-panel"><div className="container player-room-memory"><UniverseRoomPanel account={snapshot.account} pulse={snapshot.pulse} unavailable={snapshot.pulseUnavailable} socialPlayers={socialPlayers} onSocialAction={socialActionFromUniverse} /></div></section> : null}
      {tab === "friends" ? <section id="player-room-panel-friends" role="tabpanel" aria-labelledby="player-room-tab-friends" className="g3-room-panel"><div className="container player-room-memory"><PlayerFriends uid={user.uid} token={token} initialComparePlayerId={friendCompareTarget} onChanged={handleFriendsChanged} /></div></section> : null}
      {tab === "inbox" ? <section id="player-room-panel-inbox" role="tabpanel" aria-labelledby="player-room-tab-inbox" className="g3-room-panel"><div className="container player-room-memory"><PlayerInbox token={token} onUnreadChange={setUnreadCount} /></div></section> : null}
      {tab === "profile" ? <section id="player-room-panel-profile" role="tabpanel" aria-labelledby="player-room-tab-profile" className="g3-room-panel"><div className="container player-room-memory"><PlayerProfileNotifications account={snapshot.account} uid={user.uid} token={token} onSaved={async () => { if (user) await loadRoom(user, true); }} onSignOut={signOutPlayer} /></div></section> : null}
    </div>
  );
}

function OriginalBetaWelcome() {
  return <div className="container founding-field-note"><CalendarDays size={18}/><div><p className="kicker">WELCOME BACK TO BOARDSIGNAL</p><strong>You were one of BoardSignal's original beta players.</strong><p>Your first Review is already here.</p></div></div>;
}

function RoomIdentity({ account }: { account: BoardSignalAccount }) {
  return <header className="container player-room-identity"><div className="universal-avatar">{account.chessCom.canonicalUsername.slice(0, 2).toUpperCase()}</div><div><span>MY BOARDSIGNAL</span><h1>{account.chessCom.canonicalUsername}</h1><p>Founding Access · Private Review</p></div></header>;
}

function RoomNav({ tab, setTab, unreadCount }: { tab: RoomTab; setTab: (tab: RoomTab) => void; unreadCount: number }) {
  const items: Array<{ id: RoomTab; label: string }> = [
    { id: "desk", label: "Review" },
    { id: "progress", label: "Progress" },
    { id: "universe", label: "Around BoardSignal" },
    { id: "friends", label: "Friends" },
    { id: "inbox", label: "Inbox" },
    { id: "profile", label: "Profile" },
  ];
  const activate = (nextTab: RoomTab) => {
    setTab(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState({}, "", url);
    }
  };
  const focusTab = (index: number) => {
    const next = items[index];
    if (!next) return;
    activate(next.id);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => document.getElementById(`player-room-tab-${next.id}`)?.focus());
    }
  };
  return <nav className="container room-tab-nav" aria-label="My BoardSignal sections"><div role="tablist" aria-label="My BoardSignal">{items.map((item, index) => <button type="button" role="tab" id={`player-room-tab-${item.id}`} aria-controls={`player-room-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} data-nav-group={index < 4 ? "primary" : "utility"} key={item.id} className={tab === item.id ? "active" : ""} onClick={() => activate(item.id)} onKeyDown={(event) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    focusTab(nextIndex);
  }}>{item.label}{item.id === "inbox" && unreadCount > 0 ? <span className="unread-badge" aria-label={`${unreadCount} unread`}>{unreadCount}</span> : null}</button>)}</div></nav>;
}

function CurrentEpisodeCard({ episode, uid, online }: { episode: CurrentEpisodeWithNextGameGuidance; uid: string; online: boolean }) {
  const [liveStatus, setLiveStatus] = useState<"new" | "updated" | null>(null);
  const latestGameId = episode.latestGame?.gameId;

  useEffect(() => {
    if (!online || !latestGameId || typeof window === "undefined") {
      setLiveStatus(null);
      return;
    }
    const key = `boardsignal:last-current-game:${uid}:${episode.periodStart}`;
    try {
      const previous = window.localStorage.getItem(key);
      window.localStorage.setItem(key, latestGameId);
      if (!previous || previous === latestGameId) {
        setLiveStatus(null);
        return;
      }
      setLiveStatus("new");
      const settle = window.setTimeout(() => setLiveStatus("updated"), 2600);
      return () => window.clearTimeout(settle);
    } catch {
      setLiveStatus(null);
    }
  }, [episode.periodStart, latestGameId, online, uid]);

  const strongestRun = episode.currentWinRun >= episode.currentLossRun
    ? episode.currentWinRun > 1 ? `${episode.currentWinRun} consecutive wins are the strongest live run so far.` : undefined
    : episode.currentLossRun > 1 ? `${episode.currentLossRun} consecutive losses are the longest negative run so far.` : undefined;
  const leadPool = [...episode.pools].filter((pool) => pool.ratingDelta !== undefined).sort((a, b) => Math.abs(b.ratingDelta ?? 0) - Math.abs(a.ratingDelta ?? 0))[0];
  const factualStandout = strongestRun
    ?? (leadPool?.ratingDelta !== undefined ? `${leadPool.pool} is currently ${leadPool.ratingDelta >= 0 ? "+" : ""}${leadPool.ratingDelta} across ${leadPool.games} game${leadPool.games === 1 ? "" : "s"}.` : undefined)
    ?? (episode.games ? `${episode.games} games are already shaping this week's record.` : "BoardSignal is waiting for the first games of this week.");
  const guidance = episode.nextGameGuidance;
  const hasGuidance = guidance.status === "available" || guidance.status === "fallback_previous_review";
  const isCurrentGuidance = guidance.status === "available" && guidance.source !== "previous_review";
  const evidenceCount = guidance.evidenceCount ?? 0;
  const evidenceLabel = isCurrentGuidance
    ? guidance.family === "loss_run"
      ? `Current run: ${evidenceCount} loss${evidenceCount === 1 ? "" : "es"} · ${guidance.gamesConsidered} game${guidance.gamesConsidered === 1 ? "" : "s"} this week.`
      : `Seen in ${evidenceCount} of ${guidance.gamesConsidered} game${guidance.gamesConsidered === 1 ? "" : "s"} this week.`
    : undefined;
  const guidanceSource = guidance.source === "previous_review"
    ? `FROM YOUR LAST REVIEW${guidance.previousReviewPeriod ? ` · ${guidance.previousReviewPeriod}` : ""}`
    : isCurrentGuidance ? "THIS WEEK · PROVISIONAL" : undefined;
  // B.1 rendered `Based on ${guidance.gamesConsidered}` before F.4 introduced evidence-aware counts.
  const noGuidanceCopy = guidance.reason === "no_games"
    ? "Play the first game of this week and BoardSignal will look for one safe thing to carry into the next one."
    : guidance.reason === "derivation_unavailable"
      ? "BoardSignal has your current week. Next-game guidance isn't available yet."
      : "Nothing in the current games has enough factual support for a useful next-game action yet.";
  const latest = episode.latestGame;
  const mostRecentExample = isCurrentGuidance && guidance.family !== "loss_run" ? guidance.supportingFacts[0] : undefined;
  const formatWhen = (occurredAt?: number) => occurredAt
    ? new Date(occurredAt * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : undefined;
  const resultLabel = latest ? `${latest.result.slice(0, 1).toUpperCase()}${latest.result.slice(1)}` : "";
  const poolLabel = latest ? `${latest.pool.slice(0, 1).toUpperCase()}${latest.pool.slice(1)}` : "";
  const latestNote = guidance.latestGameNote
    ?? (latest
      ? guidance.reason === "derivation_unavailable"
        ? "BoardSignal saw this game. Next-game guidance isn't available yet."
        : "BoardSignal saw this game. Nothing in the current week has crossed the evidence threshold for a specific next-game cue yet."
      : undefined);

  return <section className="current-episode-card g3-current-week" aria-labelledby="g3-current-week-title">
    <div className="current-episode-heading"><div><p className="kicker">CURRENT WEEK · PROVISIONAL</p><h2 id="g3-current-week-title">THIS WEEK</h2><p>{episode.games ? `${episode.games} games so far. This is the forming week, not the completed Review.` : "Your current week will start taking shape as new Chess.com games arrive."}</p></div><small>{episode.periodLabel}</small></div>
    <div className="current-episode-stats g3-current-week-stats" aria-label="Current week facts"><div><span>Games so far</span><strong>{episode.games}</strong></div><div><span>Record so far</span><strong>{episode.wins}W · {episode.draws}D · {episode.losses}L</strong></div><div><span>Week progress</span><strong>{episode.daysComplete} of 7 days</strong></div></div>
    <article className="g3-before-next-game">
      {liveStatus ? <div className={`corner-live-status ${liveStatus === "new" ? "is-new" : "is-updated"}`} role="status" aria-live="polite"><i className="corner-live-dot" aria-hidden="true" />{liveStatus === "new" ? "NEW GAME SEEN" : "UPDATED AFTER YOUR LAST GAME"}</div> : null}
      <span>BEFORE YOUR NEXT GAME</span>
      {guidance.cornerFraming ? <p className="corner-framing">{guidance.cornerFraming}</p> : null}
      {hasGuidance ? <><h3>{guidance.title}</h3><p>{guidance.copy}</p>{guidanceSource ? <small>{guidanceSource}</small> : null}{evidenceLabel ? <small className="corner-evidence-count">{evidenceLabel}</small> : null}</> : <><h3>Nothing specific yet.</h3><p>{noGuidanceCopy}</p><small>{guidance.gamesConsidered ? `${guidance.gamesConsidered} game${guidance.gamesConsidered === 1 ? "" : "s"} checked this week.` : "No current-week evidence yet."}</small></>}
    </article>
    <p className="g3-review-due"><strong>When the Review is due:</strong> {episode.nextDeskDueAt} · {episode.daysRemaining} day{episode.daysRemaining === 1 ? "" : "s"} remaining in this fixed week.</p>
    <details className="g3-disclosure g3-current-week-details">
      <summary>CURRENT WEEK DETAILS</summary>
      <div className="g3-disclosure-body">
        <div className="current-episode-stats g3-current-detail-stats"><div><span>Sessions</span><strong>{episode.sessions}</strong></div><div><span>Current win run</span><strong>{episode.currentWinRun}</strong></div><div><span>Current loss run</span><strong>{episode.currentLossRun}</strong></div></div>
        {episode.pools.length ? <div className="forming-pools">{episode.pools.map((pool) => <article key={pool.pool}><span>{pool.pool}</span><strong>{pool.games} games</strong><p>{pool.wins}W · {pool.draws}D · {pool.losses}L{pool.ratingDelta !== undefined ? ` · ${pool.ratingDelta >= 0 ? "+" : ""}${pool.ratingDelta}` : ""}</p></article>)}</div> : null}
        <div className="g3-current-detail-grid">
          {latest ? <article className="corner-latest-game"><span>YOUR LAST GAME</span><strong>{resultLabel} vs {latest.opponent} · {poolLabel}</strong>{formatWhen(latest.occurredAt) ? <small>{formatWhen(latest.occurredAt)}</small> : null}{latestNote ? <p>{latestNote}</p> : null}{latest.supportsSelectedGuidance && latest.supportingSummary ? <p className="corner-supported-summary">{latest.supportingSummary}</p> : null}</article> : null}
          {mostRecentExample ? <article className="corner-recent-example"><span>MOST RECENT SUPPORTING EXAMPLE</span>{mostRecentExample.opponent ? <strong>vs {mostRecentExample.opponent}</strong> : null}{(mostRecentExample.pool || mostRecentExample.occurredAt) ? <small>{[mostRecentExample.pool, formatWhen(mostRecentExample.occurredAt)].filter(Boolean).join(" · ")}</small> : null}{mostRecentExample.movePlayed && mostRecentExample.opponentReply ? <b>{mostRecentExample.movePlayed} → {mostRecentExample.opponentReply}</b> : null}<p>{mostRecentExample.summary}</p>{mostRecentExample.gameUrl ? <a className="text-link" href={mostRecentExample.gameUrl} target="_blank" rel="noreferrer">Open game</a> : null}</article> : null}
          {guidance.reinforcement ? <article className="corner-reinforcement"><span>{guidance.reinforcement.label}</span><p>{guidance.reinforcement.copy}</p></article> : null}
          <article><span>WHAT'S STARTING TO STAND OUT?</span><h3>So far, this is factual.</h3><p>{factualStandout}</p><small>This describes the forming week; it is not the final diagnosis.</small></article>
          <article><span>WHAT BOARDSIGNAL IS WATCHING</span><h3>What the next games add.</h3><p>BoardSignal is watching whether the current factual events repeat, strengthen or give way to something else as this fixed week continues.</p><small>Position-based conclusions still wait for the completed Review.</small></article>
        </div>
        <p className="forming-note"><ShieldCheck size={15} /> Your next-game cue is deliberately narrow. The completed Review remains the authority for durable Signals and position conclusions.</p>
      </div>
    </details>
  </section>;
}

function ReviewHistorySection({ history, embedded = false }: { history: CompletedReviewHistoryItem[]; embedded?: boolean }) {
  if (!history.length) return null;
  const ordered = [...history].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  return <section className={embedded ? "g3-review-history-section" : "my-progress-section"}><div className="universal-section-heading"><span><CalendarDays size={16}/></span><div><p className="kicker">REVIEW HISTORY</p><h2>Your completed BoardSignal history.</h2><p>Original beta Reviews and later LIVE Reviews share the same four-Review memory without inventing missing historical detail.</p></div></div><div className="desk-sequence">{ordered.map((review, index) => <article key={review.reviewKey}><span>REVIEW {index + 1}{review.source === "original_beta" ? " · ORIGINAL BETA" : " · LIVE"}</span><strong>{review.periodLabel}</strong><p>{review.games} games · {review.wins}W · {review.draws}D · {review.losses}L · {review.scorePct.toFixed(1)}%</p><p>{review.headline}</p>{review.source === "original_beta" ? <><small>{review.sourceRichness} · {review.provenanceLabel}</small>{review.green ? <p><b>Green:</b> {review.green.title}</p> : null}{review.red ? <p><b>Red:</b> {review.red.title}</p> : null}{review.blue ? <p><b>Blue:</b> {review.blue.copy || review.blue.title}</p> : null}{review.publicCoverageHref ? <Link className="text-link" href={review.publicCoverageHref}>Open historical public story</Link> : null}</> : null}</article>)}</div></section>;
}

function ProgressSection({ history, progress, patterns, records }: { history: CompletedReviewHistoryItem[]; progress: ProgressSeries[]; patterns: RecurringPattern[]; records: PersonalRecords }) {
  const chronological = [...history].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const metric = (label: string, values: Array<number | undefined>, suffix = "") => {
    const present = values.filter((value): value is number => value !== undefined);
    return present.length >= 2 ? <article><span>{label}</span><strong>{present.map((value) => `${value}${suffix}`).join(" → ")}</strong></article> : null;
  };
  return <section className="my-progress-section g3-progress-section">
    <div className="universal-section-heading"><span><TrendingUp size={16} /></span><div><p className="kicker">PROGRESS AT A GLANCE</p><h2>Your latest four completed Reviews.</h2><p>Pool ratings stay separate. Missing historical fields stay out of trend claims.</p></div></div>
    <div className="personal-record-strip"><BarChart3 size={18} /><div><span>Personal record</span><strong>{records.personalBestWinRun} straight wins</strong></div><div><span>Reviews completed</span><strong>{records.desksCompleted}</strong></div></div>
    {patterns.length ? <div className="recurring-patterns"><p className="kicker">RECURRING PATTERNS</p>{patterns.map((pattern) => <article key={`${pattern.family}:${pattern.status}`}><Target size={16} /><div><strong>{pattern.family.replaceAll("_", " ")}</strong><p>{pattern.message}</p></div></article>)}</div> : <div className="universe-empty"><p>More completed Reviews with compatible signal families are needed before BoardSignal can name a recurring pattern.</p></div>}
    <div className="g3-progress-trends"><p className="kicker">COMPATIBLE TRENDS</p>{progress.map((series) => <div className="pool-progress" key={series.pool}><h3>{series.pool} progress</h3><div>{metric("Score", series.points.map((point) => point.scorePct), "%")}{metric("Rating movement", series.points.map((point) => point.ratingDelta))}</div></div>)}<div className="cross-desk-metrics">{metric("Winning run", chronological.map((review) => review.longestWinRun))}{metric("Median game length", chronological.map((review) => review.medianGameLength))}{metric("Black score", chronological.map((review) => review.blackScorePct), "%")}</div></div>
    <details className="g3-disclosure g3-review-history-disclosure"><summary>REVIEW HISTORY</summary><div className="g3-disclosure-body"><ReviewHistorySection history={history} embedded /></div></details>
  </section>;
}

function ShareMomentsSection({ moments }: { moments: SafeShareMoment[] }) {
  if (!moments.length) return null;
  return <section className="share-moments-section"><div className="universal-section-heading"><span>↗</span><div><p className="kicker">YOUR SHAREABLE MOMENTS</p><h2>Up to three public-safe facts from this completed review.</h2><p>Private improvement guidance, reviewed positions and recurring patterns never become public highlights.</p></div></div><div className="share-moment-grid">{moments.map((moment) => <article key={moment.id} className="share-moment-card"><span>{moment.statLabel}</span><h3>{moment.headline}</h3><strong>{moment.statValue}</strong><p>{moment.supportingFact}</p><ShareMomentActions moment={moment} /></article>)}</div></section>;
}

function PulseCards({ cards }: { cards: NonNullable<PlayerPulse["boardMoved"]> }) {
  if (!cards.length) return null;
  return <div className="pulse-card-grid">{cards.map((card) => <article className={`pulse-card pulse-${card.kind}`} key={card.id}><div className="pulse-card-label"><span>{card.eyebrow}</span><b>{card.finality === "provisional" ? "PROVISIONAL" : "OFFICIAL"}</b></div><h3>{card.title}</h3><p>{card.body}</p>{card.facts?.length ? <ul>{card.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}</article>)}</div>;
}

function UniverseEventCards({ events, heading, account, socialPlayers, onSocialAction }: { events: PublicUniverseEvent[]; heading: string; account: BoardSignalAccount; socialPlayers: Record<string, SocialSummaryPlayer>; onSocialAction: (username: string) => Promise<void> }) {
  if (!events.length) return null;
  return <section className="pulse-universe-block"><div className="pulse-block-heading"><p className="kicker">{heading}</p></div><div className="pulse-event-grid">{events.map((event) => { const social = socialPlayers[event.canonicalUsername.toLowerCase()]; const canConnect = event.playerId !== String(account.chessCom.playerId); return <article key={event.eventId}><div className="pulse-event-meta"><span>{boardSignalPresentationLabel(event.eventType)}</span><b>OFFICIAL</b></div><h3>{event.headline}</h3><p>{event.supportingFact}</p><small>{new Date(event.publishedAt).toLocaleDateString()}</small>{canConnect ? <button type="button" className="text-link social-text-button" onClick={() => void onSocialAction(event.canonicalUsername)}>{social?.relationshipStatus === "friends" ? "Compare" : social ? "Open Friends" : "Add Friend"}</button> : null}</article>; })}</div></section>;
}

function UniverseRoomPanel({ account, pulse, unavailable, socialPlayers, onSocialAction }: { account: BoardSignalAccount; pulse?: PlayerPulse; unavailable?: string; socialPlayers: Record<string, SocialSummaryPlayer>; onSocialAction: (username: string) => Promise<void> }) {
  const standings = pulse?.standings ?? [];
  const groups = pulse?.groups ?? [];
  const learning = groups.flatMap((group) => group.boards.flatMap((board) => board.entries.slice(0, 1).map((entry) => ({ group, board, entry })))).filter(({ entry }) => entry.player.toLowerCase() !== account.chessCom.canonicalUsername.toLowerCase()).slice(0, 3);
  return <section className="player-universe-panel">{unavailable ? <p className="notice notice-subtle">{unavailable}</p> : null}<div className="room-section-heading"><div><p className="kicker">AROUND BOARDSIGNAL</p><h2>Your week, the players around you, and what changed.</h2><p>Official standings use completed eligible reviews. This week's unfinished comparisons are always labelled provisional.</p></div><Link href={`/player/${encodeURIComponent(account.chessCom.canonicalUsername)}`} className="button button-outline">Open my highlights</Link></div>
    {pulse?.boardMoved?.length ? <section className="pulse-universe-block"><p className="kicker">YOUR BOARD MOVED</p><PulseCards cards={pulse.boardMoved} /></section> : null}
    {pulse?.sinceAway ? <section className="pulse-universe-block"><PulseCards cards={[pulse.sinceAway]} /></section> : null}
    {pulse?.proximity?.length ? <section className="pulse-universe-block"><p className="kicker">IN REACH · ON YOUR RADAR</p><PulseCards cards={pulse.proximity} /></section> : null}
    {pulse?.provisional?.length ? <section className="pulse-universe-block"><p className="kicker">THIS WEEK · PRIVATE PROJECTION</p><PulseCards cards={pulse.provisional} /></section> : null}
    {pulse ? <UniverseEventCards events={pulse.fieldMoved} heading="AROUND BOARDSIGNAL" account={account} socialPlayers={socialPlayers} onSocialAction={onSocialAction} /> : null}
    {pulse ? <UniverseEventCards events={pulse.whatsHot} heading="WHAT'S HOT" account={account} socialPlayers={socialPlayers} onSocialAction={onSocialAction} /> : null}
    <section className="pulse-universe-block"><div className="pulse-block-heading"><p className="kicker">OFFICIAL STANDINGS</p>{pulse?.fieldLabels?.length ? <span>{pulse.fieldLabels.map(boardSignalPresentationLabel).join(" · ")}</span> : null}</div>{standings.length ? <div className="universe-standing-grid">{standings.slice(0, 8).map((standing) => <article key={`${standing.categoryId}:${standing.scopeLabel ?? "all"}`}><span>{standing.categoryTitle}{standing.scopeLabel ? ` · ${standing.scopeLabel}` : ""}</span><strong>#{standing.rank} of {standing.denominator}</strong><p>{standing.label ?? standing.valueLabel}</p></article>)}</div> : <div className="inbox-empty"><Inbox size={20} /><div><strong>No active recognition yet.</strong><p>Your completed review has not yet met a current comparison category's minimum evidence.</p></div></div>}</section>
    {learning.length ? <section className="pulse-universe-block"><p className="kicker">TOP PERFORMANCES TO LEARN FROM</p><div className="universe-learning-grid">{learning.map(({ group, board, entry }) => { const social = socialPlayers[entry.player.toLowerCase()]; const canConnect = entry.participantId.startsWith("live:"); return <article key={`${board.key}:${entry.player}`}><Link href={entry.coverageHref ?? `/player/${encodeURIComponent(entry.player)}`}><span>#1 {group.title}{board.scopeLabel ? ` · ${board.scopeLabel}` : ""}</span><h3>{entry.player}</h3><strong>{entry.valueLabel}</strong><p>{entry.coverageHeadline ?? entry.evidence}</p><small>Open highlight</small></Link>{canConnect ? <button type="button" className="text-link social-text-button" onClick={() => void onSocialAction(entry.player)}>{social?.relationshipStatus === "friends" ? "Compare" : social ? "Open Friends" : "Add Friend"}</button> : null}</article>; })}</div></section> : null}
    <Link href="/feed" className="text-link">Explore Around BoardSignal</Link>
  </section>;
}
function RoomLoading() {
  return <div id="main" className="desk-processing-page"><section className="container desk-processing-card"><div className="processing-orb"><LoaderCircle /></div><p className="kicker">MY BOARDSIGNAL</p><h1>Loading your private BoardSignal state</h1></section></div>;
}

function RoomError({ error }: { error: string }) {
  return <div id="main" className="desk-processing-page"><section className="container desk-processing-card error-card"><ShieldCheck /><p className="kicker">MY BOARDSIGNAL HELD SAFELY</p><h1>Your private BoardSignal could not be loaded</h1><p>{error}</p></section></div>;
}
