import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import ShareAttributionClient from "@/components/ShareAttributionClient";
import { loadPublicShareMoment } from "@/lib/boardsignal/server/universePulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ momentId: string }> }): Promise<Metadata> {
  const { momentId } = await params;
  const moment = await loadPublicShareMoment(momentId);
  if (!moment) return { title: "BoardSignal Share Moment" };
  const title = `${moment.canonicalUsername} — ${moment.headline}`;
  const description = `${moment.supportingFact} BoardSignal covers what happened in your last 7 days.`;
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.adminhub-global.com";
  const imageUrl = `${origin.replace(/\/$/, "")}/share/${encodeURIComponent(momentId)}/opengraph-image`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${moment.canonicalUsername} BoardSignal moment` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ShareMomentPage({ params }: { params: Promise<{ momentId: string }> }) {
  const { momentId } = await params;
  const moment = await loadPublicShareMoment(momentId);
  if (!moment) notFound();
  return (
    <main id="main" className="share-moment-page">
      <section className="container share-moment-public-card">
        <div className="share-moment-brand"><span>BOARD SIGNAL</span><strong>REVIEW MOMENT</strong></div>
        <p className="kicker">{moment.canonicalUsername}</p>
        <h1>{moment.headline}</h1>
        <div className="share-moment-stat"><strong>{moment.statValue}</strong><span>{moment.statLabel}</span></div>
        <p className="share-moment-support">{moment.supportingFact}</p>
        <p className="share-moment-period">{moment.periodLabel}{moment.pool ? ` · ${moment.pool}` : ""}</p>
        <div className="share-moment-private-note"><ShieldCheck size={16} /><span>Public sports moment only. Private BoardSignal weaknesses and Signals are not included.</span></div>
        <div className="share-moment-cta"><div><span>YOUR LAST 7 DAYS HAVE A STORY.</span><p>See what happened in your chess week.</p></div><ShareAttributionClient momentId={moment.id} /></div>
      </section>
    </main>
  );
}
