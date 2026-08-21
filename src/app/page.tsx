import Link from "next/link";
import { LockKeyhole, ShieldCheck, Target } from "lucide-react";
import ChessComLoginPanel from "@/components/ChessComLoginPanel";
import UsernameDeskForm from "@/components/UsernameDeskForm";
import { betaProof, coverageStories } from "@/data/boardsignal";

const secondaryStories = coverageStories.slice(0, 3);

export default function HomePage() {
  return (
    <div id="main" className="personal-home">
      <section className="personal-hero">
        <div className="container personal-hero-grid">
          <div className="personal-hero-copy motion-enter">
            <p className="kicker">Personal chess performance review</p>
            <h1>See what your games are actually telling you.</h1>
            <p className="hero-deck">BoardSignal reviews your recent Chess.com games together to show what changed, what&apos;s costing you games, and what to focus on next.</p>
            <div id="get-my-boardsignal" className="hero-username-card">
              <UsernameDeskForm />
            </div>
            <div className="first-value-preview">
              <p className="kicker">WHAT BOARDSIGNAL GIVES YOU</p>
              <div>
                <span><ShieldCheck size={16} /> Know what happened.</span>
                <span><Target size={16} /> See what keeps repeating.</span>
                <span><Target size={16} /> Know what to work on next.</span>
              </div>
              <p>The simple answer comes first. The games, positions and evidence are there when you want to see why.</p>
            </div>
          </div>

          <aside className="player-preview pipeline-preview motion-enter motion-delay-1" aria-label="Example BoardSignal review">
            <div className="pipeline-preview-top"><span>Example review</span><strong>34 games · 23W · 10L · 1D</strong></div>
            <div className="coverage-stat"><strong>+92</strong><span>rating</span></div>
            <p><strong>WHAT STOOD OUT</strong><br />Seven straight wins changed the week.</p>
            <p><strong>BIGGEST OPPORTUNITY</strong><br />Several losses came after good positions had already been reached.</p>
            <p><strong>FOCUS NEXT</strong><br />When you&apos;re ahead, check your opponent&apos;s forcing reply before committing.</p>
          </aside>
        </div>
      </section>

      <section className="container home-player-room-entry">
        <ChessComLoginPanel compact />
      </section>

      <section className="container secondary-coverage">
        <div className="secondary-heading">
          <div>
            <p className="kicker">Around BoardSignal</p>
            <h2>Interesting weeks, through the players having them.</h2>
          </div>
          <p>{betaProof.desks} player weeks. {betaProof.games} games reviewed.</p>
        </div>
        <div className="secondary-story-grid">
          {secondaryStories.map((story) => (
            <article className={`secondary-story tone-${story.tone}`} key={story.id}>
              <p className="story-kicker">{story.eyebrow}</p>
              <h3>{story.headline}</h3>
              <div><strong>{story.stat}</strong><span>{story.detail}</span></div>
            </article>
          ))}
        </div>
        <div className="secondary-footer">
          <p><LockKeyhole size={15} /> Public highlights. Private improvement guidance.</p>
          <Link href="/feed" className="text-link">See what&apos;s happening around BoardSignal</Link>
        </div>
      </section>
    </div>
  );
}
