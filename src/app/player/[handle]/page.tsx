import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { betaDesks, privateWeek } from "@/data/boardsignal";
import { founderCoverageStory, foundingUniverseGroups } from "@/data/universeField";
import { resolveChessComPlayer } from "@/lib/boardsignal/processor";
import { loadSafePublicPlayerProfile } from "@/lib/boardsignal/server/publicProfile";

export const metadata: Metadata = { title: "Player highlights" };
export const dynamic = "force-dynamic";

export default async function PublicPlayerPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const requested = decodeURIComponent(handle).replace(/^@/, "");
  const beta = betaDesks.find((desk) => desk.handle.toLowerCase() === requested.toLowerCase());
  const isFounder = privateWeek.player.toLowerCase() === requested.toLowerCase();
  let username = beta?.handle ?? (isFounder ? privateWeek.player : requested);
  let avatar: string | undefined;
  const safeProfile = await loadSafePublicPlayerProfile(requested).catch(() => undefined);
  if (safeProfile) {
    username = safeProfile.username;
    avatar = safeProfile.avatar;
  }
  try {
    const profile = await resolveChessComPlayer(requested);
    username = profile.username;
    avatar = profile.avatar;
  } catch {
    // Public coverage can still render an approved identity when Chess.com is temporarily unavailable.
  }
  const story = beta?.publicStory ?? (isFounder ? founderCoverageStory : undefined);
  const liveCoverage = safeProfile?.coverage;
  const appearances = foundingUniverseGroups.flatMap((group) => group.boards.flatMap((board) => {
    const entry = board.entries.find((item) => item.player.toLowerCase() === username.toLowerCase());
    return entry && entry.rank <= 3 ? [{ title: group.title, scope: board.scopeLabel, ...entry }] : [];
  }));

  return (
    <div id="main" className="container public-player-page">
      <header className="public-player-identity">
        {avatar ? <Image src={avatar} alt="" width={68} height={68} unoptimized /> : <div className="universal-avatar">{username.slice(0, 2).toUpperCase()}</div>}
        <div><span>BOARD SIGNAL HIGHLIGHTS</span><h1>{username}</h1><p>Positive public highlights</p></div>
        <div className="public-safety"><ShieldCheck size={16} /> Public highlights. Private improvement guidance.</div>
      </header>

      {story ? <section className={`public-coverage-lead tone-${story.tone}`} id={`coverage-${story.id}`}>
        <div><p className="kicker">HIGHLIGHTS · {story.eyebrow}</p><h2>{story.headline}</h2><p>{story.summary}</p></div>
        <div><strong>{story.stat}</strong><span>{story.detail}</span><small>{story.period}</small></div>
      </section> : liveCoverage ? <section className="public-coverage-lead tone-blue">
        <div><p className="kicker">APPROVED PLAYER HIGHLIGHTS</p><h2>{liveCoverage.headline}</h2><p>{liveCoverage.positiveFacts.games} games recorded · {liveCoverage.positiveFacts.wins} wins{liveCoverage.positiveFacts.scorePct !== undefined ? ` · ${liveCoverage.positiveFacts.scorePct}% score` : ""}.</p></div>
        <div><strong>{liveCoverage.positiveFacts.longestWinRun ?? liveCoverage.positiveFacts.checkmateWins ?? liveCoverage.positiveFacts.positiveRatingMovements[0]?.delta ?? liveCoverage.positiveFacts.wins}</strong><span>{liveCoverage.positiveFacts.longestWinRun ? "straight wins" : liveCoverage.positiveFacts.checkmateWins ? "checkmate wins" : liveCoverage.positiveFacts.positiveRatingMovements[0] ? `${liveCoverage.positiveFacts.positiveRatingMovements[0].pool} rating gain` : "completed wins"}</span><small>{liveCoverage.periodLabel}</small></div>
      </section> : <section className="public-coverage-empty"><Sparkles /><p className="kicker">HIGHLIGHTS COMING</p><h2>No public highlights are available here yet.</h2><p>Private BoardSignal access is separate from this public highlights page. Private improvement guidance and reviewed positions never appear here.</p></section>}

      {appearances.length ? <section className="public-podium-section"><p className="kicker">THIS WEEK'S STANDOUTS</p><h2>Positive Top-3 appearances from eligible completed reviews.</h2><div>{appearances.map((item) => <article key={`${item.title}:${item.scope ?? "all"}`}><TrendingUp /><span>#{item.rank} {item.title}{item.scope ? ` · ${item.scope}` : ""}</span><strong>{item.valueLabel}</strong><p>{item.evidence}</p></article>)}</div></section> : null}

      <section className="public-private-boundary"><ShieldCheck /><div><strong>What stays private</strong><p>Private improvement guidance, reviewed positions and personal progress never appear on this public page.</p></div></section>
      <Link href="/feed" className="button button-outline">Explore Around BoardSignal <ArrowRight size={16} /></Link>
    </div>
  );
}
