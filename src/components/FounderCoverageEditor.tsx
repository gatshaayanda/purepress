"use client";
import { boardSignalPresentationLabel } from "@/lib/boardsignal/presentationLanguage";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, ExternalLink, LoaderCircle, Star, Trash2 } from "lucide-react";

type CoverageItem = {
  id: string;
  username?: string;
  headline?: string;
  periodLabel?: string;
  periodEnd?: string;
  positiveFacts?: Record<string, unknown>;
  editorialTitle?: string;
  editorialContext?: string;
  featured?: boolean;
  featuredOrder?: number;
  homepageLead?: boolean;
};

type UniverseEventItem = {
  id: string;
  eventId?: string;
  eventType?: string;
  canonicalUsername?: string;
  headline?: string;
  supportingFact?: string;
  publishedAt?: string;
  rankBefore?: number;
  rankAfter?: number;
  featured?: boolean;
  homepageLead?: boolean;
  hidden?: boolean;
  finality?: string;
};

type ShareMomentItem = {
  id: string;
  canonicalUsername?: string;
  headline?: string;
  supportingFact?: string;
  statValue?: string;
  statLabel?: string;
  periodLabel?: string;
};

export default function FounderCoverageEditor() {
  const [items, setItems] = useState<CoverageItem[]>([]);
  const [events, setEvents] = useState<UniverseEventItem[]>([]);
  const [shareMoments, setShareMoments] = useState<ShareMomentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/coverage", { cache: "no-store" });
      const body = await response.json() as { ok: boolean; coverage?: CoverageItem[]; universeEvents?: UniverseEventItem[]; shareMoments?: ShareMomentItem[]; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Coverage could not be loaded.");
      setItems(body.coverage ?? []);
      setEvents(body.universeEvents ?? []);
      setShareMoments(body.shareMoments ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Coverage could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function actCoverage(item: CoverageItem, action: "feature" | "updateEditorial" | "remove" | "setLead") {
    if (action === "remove" && !window.confirm("Remove this safe public coverage item? This does not delete the player's private Review.")) return;
    setBusy(`coverage:${item.id}`); setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "coverage", action, id: item.id, featured: !item.featured, featuredOrder: item.featuredOrder ?? 0, editorialTitle: item.editorialTitle ?? "", editorialContext: item.editorialContext ?? "" }),
      });
      const body = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Coverage could not be updated.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Coverage could not be updated."); }
    finally { setBusy(""); }
  }

  async function actEvent(item: UniverseEventItem, action: "hide" | "restore" | "feature" | "setLead") {
    setBusy(`event:${item.id}`); setError("");
    try {
      const response = await fetch("/api/admin/boardsignal/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "event", action, id: item.id }),
      });
      const body = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Universe event could not be updated.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Universe event could not be updated."); }
    finally { setBusy(""); }
  }

  if (loading) return <div className="founder-directory-loading"><LoaderCircle className="button-spinner" /> Loading safe public coverage</div>;

  return <div className="coverage-editor-stack">
    {error ? <p className="form-error">{error}</p> : null}

    <section className="desk-section"><div className="room-section-heading"><div><p className="kicker">SAFE UNIVERSE EVENTS</p><h2>Dynamic sports coverage</h2><p>Inspect, feature or hide automatically generated public-safe events. Deterministic chess facts are read-only here.</p></div></div>
      {events.length ? <div className="coverage-editor-list">{events.map((item) => <article key={item.id} className={`${item.homepageLead ? "is-lead" : ""} ${item.hidden ? "is-hidden-editorial" : ""}`}><header><div><span>{item.canonicalUsername ?? "Player"} · {boardSignalPresentationLabel(item.eventType ?? "event")}</span><h3>{item.headline ?? "Universe event"}</h3></div><div className="coverage-editor-badges">{item.finality ? <strong>{item.finality}</strong> : null}{item.homepageLead ? <strong>Homepage lead</strong> : null}{item.hidden ? <strong>Hidden</strong> : null}</div></header><p>{item.supportingFact}</p>{item.rankAfter ? <small>Rank {item.rankBefore ? `#${item.rankBefore} → ` : ""}#{item.rankAfter}</small> : null}<div className="founder-player-actions"><button className="button button-outline" type="button" disabled={busy === `event:${item.id}`} onClick={() => actEvent(item, "feature")}><Star size={14} /> {item.featured ? "Unfeature" : "Feature"}</button><button className="button button-lime" type="button" disabled={busy === `event:${item.id}`} onClick={() => actEvent(item, "setLead")}>Choose homepage lead</button><button className="button button-quiet" type="button" disabled={busy === `event:${item.id}`} onClick={() => actEvent(item, item.hidden ? "restore" : "hide")}>{item.hidden ? <Eye size={14} /> : <EyeOff size={14} />} {item.hidden ? "Restore" : "Hide"}</button></div></article>)}</div> : <div className="universe-empty"><p>No LIVE Universe events have been generated yet.</p></div>}
    </section>

    <section className="desk-section"><div className="room-section-heading"><div><p className="kicker">RECENT SHARE MOMENTS</p><h2>Public acquisition artifacts</h2><p>These lightweight permalinks keep only public-safe supported facts; they do not preserve full private Reviews.</p></div></div>{shareMoments.length ? <div className="coverage-editor-list share-editor-list">{shareMoments.slice(0, 24).map((item) => <article key={item.id}><header><div><span>{item.canonicalUsername ?? "Player"} · {item.periodLabel ?? "Completed Review"}</span><h3>{item.headline ?? "Share Moment"}</h3></div><strong>{item.statValue} {item.statLabel}</strong></header><p>{item.supportingFact}</p><div className="founder-player-actions"><Link href={`/share/${encodeURIComponent(item.id)}`} target="_blank" className="button button-outline">Preview share card <ExternalLink size={14} /></Link></div></article>)}</div> : <div className="universe-empty"><p>No Share Moments have been generated yet.</p></div>}</section>

    <section className="desk-section"><div className="room-section-heading"><div><p className="kicker">SAFE AUTO-SELECTED COVERAGE</p><h2>Existing coverage controls</h2><p>The deterministic Review remains source of truth. Editorial titles/context may only use facts already present in each safe public item.</p></div></div>{items.length ? <div className="coverage-editor-list">{items.map((item) => <article key={item.id} className={item.homepageLead ? "is-lead" : ""}><header><div><span>{item.username ?? "Player"} · {item.periodLabel ?? item.periodEnd}</span><h3>{item.headline ?? "Safe coverage"}</h3></div>{item.homepageLead ? <strong>Homepage lead</strong> : null}</header><details><summary>Supported public facts</summary><pre>{JSON.stringify(item.positiveFacts ?? {}, null, 2)}</pre></details><label>Editorial title<input value={item.editorialTitle ?? ""} onChange={(event) => setItems((values) => values.map((value) => value.id === item.id ? { ...value, editorialTitle: event.target.value } : value))} maxLength={140} /></label><label>Editorial context<textarea value={item.editorialContext ?? ""} onChange={(event) => setItems((values) => values.map((value) => value.id === item.id ? { ...value, editorialContext: event.target.value } : value))} rows={3} maxLength={500} /></label><label>Featured order<input type="number" value={item.featuredOrder ?? 0} onChange={(event) => setItems((values) => values.map((value) => value.id === item.id ? { ...value, featuredOrder: Number(event.target.value) } : value))} /></label><div className="founder-player-actions"><button className="button button-outline" type="button" disabled={busy === `coverage:${item.id}`} onClick={() => actCoverage(item, "updateEditorial")}>Save editorial text</button><button className="button button-outline" type="button" disabled={busy === `coverage:${item.id}`} onClick={() => actCoverage(item, "feature")}><Star size={14} /> {item.featured ? "Unfeature" : "Feature"}</button><button className="button button-lime" type="button" disabled={busy === `coverage:${item.id}`} onClick={() => actCoverage(item, "setLead")}>Set homepage lead</button><button className="button button-quiet" type="button" disabled={busy === `coverage:${item.id}`} onClick={() => actCoverage(item, "remove")}><Trash2 size={14} /> Remove public item</button></div></article>)}</div> : <div className="universe-empty"><p>No auto-selected public coverage exists yet.</p></div>}</section>
  </div>;
}
