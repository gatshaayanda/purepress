"use client";

import { useCallback, useState } from "react";
import { LoaderCircle, RefreshCcw } from "lucide-react";
import type { TrafficBreakdownRow, VercelTrafficCoreResult, VercelTrafficRange } from "@/lib/boardsignal/vercelTrafficLogic";

function Breakdown({ title, rows }: { title: string; rows?: TrafficBreakdownRow[] }) {
  const max = Math.max(1, ...(rows ?? []).map((row) => row.pageviews));
  return <section className="founder-traffic-breakdown"><h3>{title}</h3>{rows?.length ? <ol>{rows.map((row) => <li key={row.label}><div><strong>{row.label}</strong><span>{row.visitors} visitors · {row.pageviews} views</span></div><i aria-hidden="true"><b style={{ width: `${Math.max(4, (row.pageviews / max) * 100)}%` }} /></i></li>)}</ol> : <p>No data returned for this breakdown.</p>}</section>;
}

export default function FounderTrafficAnalytics() {
  const [opened, setOpened] = useState(false);
  const [range, setRange] = useState<VercelTrafficRange>(7);
  const [traffic, setTraffic] = useState<VercelTrafficCoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (nextRange: VercelTrafficRange, refresh = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/boardsignal/traffic?range=${nextRange}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; traffic?: VercelTrafficCoreResult };
      setTraffic(body.traffic ?? { connection: "unavailable", message: "Traffic analytics temporarily unavailable.", range: nextRange, since: "", until: "", partial: false });
    } catch {
      setTraffic({ connection: "unavailable", message: "Traffic analytics temporarily unavailable.", range: nextRange, since: "", until: "", partial: false });
    } finally { setLoading(false); }
  }, []);

  function toggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    const isOpen = event.currentTarget.open;
    setOpened(isOpen);
    if (isOpen && !opened && !traffic) void load(range);
  }

  function chooseRange(next: VercelTrafficRange) { setRange(next); if (opened) void load(next); }

  const maxDaily = Math.max(1, ...(traffic?.daily ?? []).map((item) => item.pageviews));
  return <details className="founder-secondary-group founder-traffic-panel" onToggle={toggle}>
    <summary><span><strong>TRAFFIC</strong><small>Anonymous Vercel site activity · separate from known BoardSignal player lifecycle data</small></span><span>{traffic?.connection === "connected" ? "CONNECTED" : "OPEN"}</span></summary>
    <div className="founder-secondary-body">
      <div className="founder-ops-heading"><div><p className="kicker">VERCEL WEB ANALYTICS</p><h2>Site traffic.</h2><p>Traffic is anonymous aggregated site activity. It is never joined to Chess.com username, BoardSignal account, email or contact information.</p></div><button className="button button-quiet" type="button" onClick={() => void load(range, true)} disabled={loading}>{loading ? <LoaderCircle className="button-spinner" size={15}/> : <RefreshCcw size={15}/>} Refresh</button></div>
      <div className="founder-traffic-controls" role="group" aria-label="Traffic date range"><button type="button" className={range === 7 ? "active" : ""} aria-pressed={range === 7} onClick={() => chooseRange(7)}>LAST 7 DAYS</button><button type="button" className={range === 30 ? "active" : ""} aria-pressed={range === 30} onClick={() => chooseRange(30)}>LAST 30 DAYS</button></div>
      {loading && !traffic ? <div className="founder-directory-loading"><LoaderCircle className="button-spinner" /> Loading traffic</div> : null}
      {traffic?.connection === "not_connected" ? <div className="founder-traffic-state"><strong>TRAFFIC ANALYTICS NOT CONNECTED</strong><p>{traffic.message}</p></div> : null}
      {traffic && ["unavailable", "credentials", "rate_limited"].includes(traffic.connection) ? <div className="founder-traffic-state"><strong>{traffic.message}</strong><p>Founder operations and product lifecycle data remain available.</p></div> : null}
      {traffic?.connection === "connected" ? <>
        {traffic.partial ? <p className="founder-traffic-partial" role="status">{traffic.message}</p> : null}
        <div className="founder-traffic-metrics"><article><span>SITE VISITORS</span><strong>{traffic.totals?.visitors ?? "—"}</strong></article><article><span>SITE PAGE VIEWS</span><strong>{traffic.totals?.pageviews ?? "—"}</strong></article></div>
        <section className="founder-traffic-trend"><h3>Daily visitors / page views</h3>{traffic.daily?.length ? <div>{traffic.daily.map((item) => <article key={item.date}><span>{new Date(`${item.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</span><i aria-hidden="true"><b style={{ height: `${Math.max(4, (item.pageviews / maxDaily) * 100)}%` }}/></i><strong>{item.visitors} / {item.pageviews}</strong></article>)}</div> : <p>No daily trend returned for this range.</p>}</section>
        <div className="founder-traffic-breakdowns"><Breakdown title="TOP ROUTES" rows={traffic.routes}/><Breakdown title="TOP REFERRERS" rows={traffic.referrers}/><Breakdown title="DEVICES" rows={traffic.devices}/></div>
        <p className="founder-data-completeness">Site visitor totals are Vercel Web Analytics totals. Internal/admin/portfolio/static paths are excluded from the route breakdown where practical; these traffic numbers are not BoardSignal player counts.</p>
      </> : null}
    </div>
  </details>;
}
