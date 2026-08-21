"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

type AttributionEvent = "share_viewed" | "cta_clicked";

async function track(momentId: string, eventType: AttributionEvent) {
  try {
    await fetch(`/api/boardsignal/share/${encodeURIComponent(momentId)}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ eventType, source: "boardSignalShare" }),
    });
  } catch {
    // Public share pages remain useful if attribution storage is unavailable.
  }
}

export default function ShareAttributionClient({ momentId }: { momentId: string }) {
  useEffect(() => { void track(momentId, "share_viewed"); }, [momentId]);
  const href = `/?source=boardSignalShare&shareMomentId=${encodeURIComponent(momentId)}#get-my-boardsignal`;
  return <Link href={href} className="button button-lime" onClick={() => void track(momentId, "cta_clicked")}>Get My BoardSignal <ArrowRight size={17} /></Link>;
}
