"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import type { SafeShareMoment } from "@/lib/boardsignal/pulse";

async function track(momentId: string, eventType: "share_tapped") {
  try {
    await fetch(`/api/boardsignal/share/${encodeURIComponent(momentId)}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ eventType, source: "boardSignalShare" }),
    });
  } catch {
    // Sharing itself must not depend on analytics.
  }
}

export default function ShareMomentActions({ moment }: { moment: SafeShareMoment }) {
  const [copied, setCopied] = useState(false);
  const path = useMemo(() => `/share/${encodeURIComponent(moment.id)}`, [moment.id]);

  async function share() {
    const url = `${window.location.origin}${path}`;
    await track(moment.id, "share_tapped");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: moment.headline, text: moment.supportingFact, url });
        return;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copy() {
    const url = `${window.location.origin}${path}`;
    await track(moment.id, "share_tapped");
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="share-moment-actions">
      <button type="button" className="button button-lime" onClick={share}><Share2 size={16} /> Share this moment</button>
      <button type="button" className="button button-outline" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Link copied" : "Copy share link"}</button>
    </div>
  );
}
