import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, CircleCheckBig, ScanSearch, Target } from "lucide-react";

export const metadata = { title: "How It Works" };

const stages = [
  { icon: ScanSearch, title: "Find your games", copy: "Enter your Chess.com username. BoardSignal brings your recent public games together—no password and no uploads." },
  { icon: ChartNoAxesCombined, title: "Know what happened", copy: "See the record, rating movement, runs and shape of the week without piecing it together game by game." },
  { icon: CircleCheckBig, title: "See what keeps repeating", copy: "BoardSignal looks across the games for supported patterns and says less when the evidence is not strong enough." },
  { icon: Target, title: "Know what to work on next", copy: "Your completed review ends with one clear focus to carry into the next games, with the evidence available when you want it." },
];

export default function HowItWorksPage() {
  return (
    <div id="main" className="interior-page">
      <header className="interior-hero">
        <div className="container">
          <p className="kicker">ONE USERNAME · ONE CLEAR REVIEW</p>
          <h1>BoardSignal turns a pile of games into something you can use.</h1>
          <p className="standfirst">The answer comes first: what happened, what mattered, and what to focus on next. The deeper game and position evidence is there when you want to see why.</p>
        </div>
      </header>
      <section className="container section-pad">
        <div className="content-grid">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <article className="info-card" key={stage.title}>
                <div className="info-card-icon"><Icon size={20} /></div>
                <p className="kicker">{String(index + 1).padStart(2, "0")}</p>
                <h3>{stage.title}</h3>
                <p>{stage.copy}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="paper-band">
        <div className="container section-pad privacy-callout">
          <div><p className="kicker">WHAT THE PLAYER SEES</p><h2>Your review is ready.</h2></div>
          <div><p><strong>3–9 August · 36 games · 20W 14L 2D · +47</strong></p><p>What happened. What mattered. Focus next.</p><p><small>Behind the scenes, BoardSignal keeps fixed review periods and evidence checks so the guidance stays grounded.</small></p></div>
        </div>
      </section>
      <section className="container section-pad">
        <Link href="/#get-my-boardsignal" className="button button-lime">Show me my review <ArrowRight size={17} /></Link>
      </section>
    </div>
  );
}
