import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { coverageStories, leadStory } from "@/data/boardsignal";
import { founderCoverageStory, foundingUniverseGroups } from "@/data/universeField";
import { UniverseCategoryCards } from "@/components/UniverseRecognition";
import { loadActiveUniverseState } from "@/lib/boardsignal/server/universePulse";
import { boardSignalPresentationLabel } from "@/lib/boardsignal/presentationLanguage";

export const metadata = { title: "Around BoardSignal" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CoverageFeedPage() {
  const stories = [leadStory, founderCoverageStory, ...coverageStories];
  let groups = foundingUniverseGroups;
  let whatsHot: Awaited<ReturnType<typeof loadActiveUniverseState>>["whatsHot"] = [];
  let recentEvents: Awaited<ReturnType<typeof loadActiveUniverseState>>["recentEvents"] = [];
  try {
    const state = await loadActiveUniverseState();
    if (state.groups.some((group) => group.boards.length)) groups = state.groups;
    whatsHot = state.whatsHot;
    recentEvents = state.recentEvents.slice(0, 10);
  } catch {
    // The approved founding field remains available if live persistence is temporarily unavailable.
  }
  const nowEvents = (whatsHot.length ? whatsHot : recentEvents).slice(0, 8);
  return (
    <div id="main" className="interior-page">
      <header className="interior-hero feed-hero">
        <div className="container">
          <p className="kicker"><Radio size={15} /> Around BoardSignal</p>
          <h1>Interesting weeks, through the players having them.</h1>
          <p className="standfirst">Positive moments and this week&apos;s standouts from completed reviews. Private improvement guidance and reviewed positions stay private.</p>
        </div>
      </header>

      {nowEvents.length ? <section className="container section-pad universe-now-section">
        <div className="universe-intro"><p className="kicker">AROUND BOARDSIGNAL · NOW</p><h2>What changed recently.</h2><p>Recent public-safe moments from players whose completed reviews support them.</p></div>
        <div className="universe-now-grid">{nowEvents.map((event) => <article key={event.eventId}><div className="pulse-event-meta"><span>{boardSignalPresentationLabel(event.eventType)}</span><b>OFFICIAL</b></div><h3>{event.headline}</h3><p>{event.supportingFact}</p><small>{event.canonicalUsername} · {new Date(event.publishedAt).toLocaleDateString()}</small></article>)}</div>
      </section> : null}

      <section className="container section-pad">
        <div className="universe-intro">
          <p className="kicker">THIS WEEK&apos;S STANDOUTS</p>
          <h2>Strong weeks, compared with like-for-like players.</h2>
          <p>Rapid, Blitz and Bullet stay separate. Standings appear only where enough comparable completed reviews exist.</p>
        </div>
        <UniverseCategoryCards groups={groups} />
      </section>
      <section className="container section-pad universe-coverage-section">
        <div className="universe-intro"><p className="kicker">HIGHLIGHTS</p><h2>The positive stories behind the numbers.</h2><p>Comebacks, rating climbs, winning runs, strong finishes and memorable moments—without exposing anyone&apos;s private weaknesses.</p></div>
        <div className="coverage-grid">
          {stories.map((story, index) => (
            <article className={`coverage-card tone-${story.tone} ${story.feature || index === 0 ? "coverage-wide" : ""}`} id={`coverage-${story.id}`} key={story.id}>
              <div className="coverage-card-top"><p className="story-kicker">{story.eyebrow}</p><span>{story.period}</span></div>
              <h3>{story.headline}</h3><p>{story.summary}</p><div className="coverage-stat"><strong>{story.stat}</strong><span>{story.detail}</span></div><ArrowRight className="coverage-arrow" size={19} aria-hidden="true" />
            </article>
          ))}
        </div>
        <div className="interior-actions"><Link href="/#get-my-boardsignal" className="button button-lime">Show me my review <ArrowRight size={17} /></Link></div>
      </section>
    </div>
  );
}
