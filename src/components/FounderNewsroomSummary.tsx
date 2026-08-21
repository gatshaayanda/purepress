"use client";

import { useCallback, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { boardSignalPresentationLabel } from "@/lib/boardsignal/presentationLanguage";

type EventItem = { eventId?: string; canonicalUsername?: string; headline?: string; supportingFact?: string; publishedAt?: string; eventType?: string };
type Summary = {
  deliveryStatus: { inApp: true; browserPushConfigured: boolean; emailConfigured: boolean; emailProvider: "resend" | "none"; registeredDevices: number };
  latestUniverseAchievements: Array<{ id: string; username?: string; headline?: string; periodLabel?: string }>;
  latestCompletedDesks: Array<{ username: string; deskKey?: string; periodLabel?: string; periodEnd?: string; publishedAt?: string }>;
  recentExceptions: Array<{ id: string; title?: string; message?: string; createdAt?: string }>;
  newPlayers: EventItem[];
  newTop3: EventItem[];
  whatsHot: EventItem[];
  recentShareMoments: Array<{ id: string; canonicalUsername?: string; headline?: string; statValue?: string; statLabel?: string; periodLabel?: string }>;
  recentUniverseMovement: EventItem[];
  askBoardSignal: {
    usage: number;
    topQuestionCategories: Array<{ category: string; count: number }>;
    unresolvedSupportHandoffs: number;
    recentFeedbackCount: number;
    relationshipPulse: Array<{ username?: string; expressedSentiment?: string; engagement?: string; oftenAsksAbout?: string[]; preferredCommunication?: string; openSupportIssue?: string; lastAskBoardSignalInteraction?: string; recommendedFounderContext?: string }>;
  };
};

function BriefList({ title, items, empty }: { title: string; items: Array<{ id: string; name: string; headline: string; meta?: string }>; empty: string }) {
  return <section className="founder-secondary-card"><p className="kicker">{title}</p>{items.length ? <div className="newsroom-brief-list">{items.map((item) => <article key={item.id}><strong>{item.name}</strong><p>{item.headline}</p><span>{item.meta ?? "Recent"}</span></article>)}</div> : <div className="universe-empty"><p>{empty}</p></div>}</section>;
}

export default function FounderNewsroomSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (summary || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/newsroom", { cache: "no-store" });
      const body = await response.json() as { ok: boolean; summary?: Summary; error?: string };
      if (!response.ok || !body.ok || !body.summary) throw new Error(body.error ?? "Newsroom summary unavailable.");
      setSummary(body.summary);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Newsroom summary unavailable."); }
    finally { setLoading(false); }
  }, [loading, summary]);
  function openSecondary(event: React.SyntheticEvent<HTMLDetailsElement>) { if (event.currentTarget.open && !summary && !loading) void load(); }
  const waiting = <div className="founder-directory-loading"><LoaderCircle className="button-spinner" /> Loading secondary Founder context</div>;
  const failure = error ? <p className="form-error" role="alert">{error}</p> : null;

  return <div className="founder-secondary-stack">
    <details className="founder-secondary-group" onToggle={openSecondary}><summary><span><strong>SYSTEM & DELIVERY</strong><small>Delivery readiness and recent system exceptions</small></span><span>{summary?.recentExceptions.length ? `${summary.recentExceptions.length} recent` : "OPEN"}</span></summary><div className="founder-secondary-body">
      {failure}{!summary ? waiting : <><section className="founder-secondary-card founder-delivery-status"><p className="kicker">DELIVERY STATUS</p><h2>How BoardSignal can reach players.</h2><div className="delivery-status-grid"><article><span>In-app Inbox</span><strong>READY</strong><p>Core private delivery stays available without external providers.</p></article><article><span>Browser Push</span><strong>{summary.deliveryStatus.browserPushConfigured ? "READY" : "CONFIGURATION REQUIRED"}</strong><p>{summary.deliveryStatus.registeredDevices} registered device{summary.deliveryStatus.registeredDevices === 1 ? "" : "s"}</p></article><article><span>Email</span><strong>{summary.deliveryStatus.emailConfigured ? "READY" : "CONFIGURATION REQUIRED"}</strong><p>{summary.deliveryStatus.emailConfigured ? "Resend configured" : "Optional provider is not active"}</p></article></div></section>
      <BriefList title="RECENT EXCEPTIONS" empty="No recent exceptions recorded." items={summary.recentExceptions.map((item) => ({ id: item.id, name: item.title ?? "BoardSignal exception", headline: item.message ?? "Review in Exceptions.", meta: item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recent" }))}/></>}
    </div></details>

    <details className="founder-secondary-group" onToggle={openSecondary}><summary><span><strong>ASK BOARDSIGNAL</strong><small>Player questions, feedback and support context</small></span><span>{summary ? `${summary.askBoardSignal.usage} interactions` : "OPEN"}</span></summary><div className="founder-secondary-body">{failure}{!summary ? waiting : <section className="founder-secondary-card founder-guide-section"><div className="founder-guide-grid"><article className="founder-guide-card"><h3>Usage & confusion</h3><p>{summary.askBoardSignal.usage} recent guide interactions · {summary.askBoardSignal.unresolvedSupportHandoffs} unresolved support handoffs · {summary.askBoardSignal.recentFeedbackCount} feedback responses.</p><div className="guide-category-list">{summary.askBoardSignal.topQuestionCategories.length ? summary.askBoardSignal.topQuestionCategories.map((item) => <article key={item.category}><span>{boardSignalPresentationLabel(item.category)}</span><strong>{item.count}</strong></article>) : <p>No guide question categories recorded yet.</p>}</div></article><article className="founder-guide-card"><h3>Player Relationship Pulse</h3><p>Descriptive support context only. No psychological profiling or vulnerability scoring.</p><div className="relationship-pulse-list">{summary.askBoardSignal.relationshipPulse.length ? summary.askBoardSignal.relationshipPulse.slice(0,5).map((item) => <article key={item.username}><strong>{item.username}</strong><span>{item.engagement} · expressed {item.expressedSentiment}</span><p>Often asks about: {(item.oftenAsksAbout ?? []).map((value) => value.replaceAll("_", " ")).join(", ") || "No pattern yet"}</p><p>Preferred: {item.preferredCommunication}</p><p>Support: {item.openSupportIssue}</p><p>{item.recommendedFounderContext}</p></article>) : <p>No relationship Pulse summaries yet.</p>}</div></article></div></section>}</div></details>

    <details className="founder-secondary-group" onToggle={openSecondary}><summary><span><strong>EDITORIAL / UNIVERSE ACTIVITY</strong><small>Recent public-safe movement and coverage context</small></span><span>OPEN</span></summary><div className="founder-secondary-body">{failure}{!summary ? waiting : <div className="newsroom-brief-grid newsroom-pulse-grid">
      <BriefList title="LATEST COMPLETED REVIEWS" empty="No completed live Reviews yet." items={summary.latestCompletedDesks.map((item, i) => ({ id: item.deskKey ?? `review-${i}`, name: item.username, headline: item.periodLabel ?? "Completed seven-day Review", meta: item.publishedAt ? new Date(item.publishedAt).toLocaleString() : item.periodEnd }))}/>
      <BriefList title="NEW PLAYERS" empty="No new Universe entrants yet." items={summary.newPlayers.map((item, i) => ({ id: item.eventId ?? `new-${i}`, name: item.canonicalUsername ?? "Player", headline: item.headline ?? "Entered the BoardSignal Universe", meta: item.publishedAt ? new Date(item.publishedAt).toLocaleString() : undefined }))}/>
      <BriefList title="NEW TOP 3" empty="No new Top 3 movement yet." items={summary.newTop3.map((item, i) => ({ id: item.eventId ?? `top-${i}`, name: item.canonicalUsername ?? "Player", headline: item.headline ?? "Top 3 movement", meta: item.supportingFact }))}/>
      <BriefList title="WHAT'S HOT" empty="No current hot events yet." items={summary.whatsHot.map((item, i) => ({ id: item.eventId ?? `hot-${i}`, name: item.canonicalUsername ?? "Player", headline: item.headline ?? "Universe movement", meta: item.supportingFact }))}/>
      <BriefList title="RECENT SHARE MOMENTS" empty="No Share Moments generated yet." items={summary.recentShareMoments.map((item) => ({ id: item.id, name: item.canonicalUsername ?? "Player", headline: item.headline ?? "Share Moment", meta: `${item.statValue ?? ""} ${item.statLabel ?? item.periodLabel ?? ""}`.trim() }))}/>
      <BriefList title="RECENT UNIVERSE MOVEMENT" empty="No recent Universe movement yet." items={summary.recentUniverseMovement.map((item, i) => ({ id: item.eventId ?? `move-${i}`, name: item.canonicalUsername ?? "Player", headline: item.headline ?? "Universe movement", meta: item.supportingFact }))}/>
      <BriefList title="LATEST UNIVERSE ACHIEVEMENTS" empty="No recent Universe coverage." items={summary.latestUniverseAchievements.map((item) => ({ id: item.id, name: item.username ?? "Player", headline: item.headline ?? "Safe Universe coverage", meta: item.periodLabel ?? "Latest completed Review" }))}/>
    </div>}</div></details>
  </div>;
}
