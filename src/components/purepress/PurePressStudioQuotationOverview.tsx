"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import styles from "./PurePressStudioQuotationOverview.module.css";

interface QuoteStateRow {
  projectId: string;
  jobReference: string;
  itemSummary: string;
  jobStatus: string;
  quotation: string;
  updatedAt: string;
}

async function ownerFetch(url: string) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
}

export default function PurePressStudioQuotationOverview() {
  const [rows, setRows] = useState<QuoteStateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void ownerFetch("/api/admin/purepress/quotation-states")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load quotation state.");
        if (active) setRows(data.states ?? []);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Could not load quotation state."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return <section className={styles.section} aria-labelledby="quotation-desk-heading">
    <div className={styles.heading}><div><p className="pp-kicker">QUOTATION STATUS</p><h2 id="quotation-desk-heading">Commercial state at a glance</h2></div><p>Quote facts sit beside the order desk without replacing the job lifecycle.</p></div>
    {loading && <p className={styles.state} role="status">Loading quotation facts…</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !error && rows.length === 0 && <p className={styles.state}>No operational jobs are available yet.</p>}
    {!loading && !error && rows.length > 0 && <div className={styles.rows}>{rows.map((row) => <article key={row.projectId}><div><strong>{row.jobReference}</strong><span>{row.itemSummary}</span></div><div><small>JOB</small><span>{row.jobStatus.replaceAll("_", " ")}</span></div><div><small>QUOTE</small><strong>{row.quotation}</strong></div><Link href={`/admin/purepress/jobs/${encodeURIComponent(row.projectId)}`}>OPEN JOB</Link></article>)}</div>}
  </section>;
}
