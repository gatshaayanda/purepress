import type { PlayerRoomQuickRead as QuickRead } from "@/lib/boardsignal/playerRoomPresentation";

export default function PlayerRoomQuickRead({ quickRead, stateLabel }: { quickRead: QuickRead; stateLabel?: string }) {
  const { happened, recurring, working, costing, beforeNextGame } = quickRead;
  return (
    <section className="g3-quick-read" aria-labelledby="g3-quick-read-title">
      <header className="g3-quick-read-heading">
        <div>
          <p className="kicker">COMPLETED REVIEW{stateLabel ? ` · ${stateLabel}` : ""} · {happened.periodLabel}</p>
          <h2 id="g3-quick-read-title">YOUR WEEK IN 20 SECONDS</h2>
        </div>
        <p>Five things to know before you open the deeper Review.</p>
      </header>
      <div className="g3-quick-read-grid">
        <article className="g3-quick-item g3-quick-happened">
          <span>WHAT HAPPENED</span>
          <h3>{happened.headline}</h3>
          <p>{happened.copy}</p>
          <div className="g3-record-line"><strong>{happened.wins}W · {happened.draws}D · {happened.losses}L</strong><b>{happened.score.toFixed(1)}% score</b></div>
        </article>
        <article className="g3-quick-item">
          <span>KEEPS HAPPENING</span>
          <h3>{recurring.title}</h3>
          <p>{recurring.copy}</p>
          {!recurring.confirmed ? <small>NOT YET CONFIRMED</small> : null}
        </article>
        <article className="g3-quick-item g3-quick-working">
          <span>WORKING</span>
          <h3>{working.title}</h3>
          <p>{working.copy}</p>
          {!working.confirmed ? <small>NOT ENOUGH EVIDENCE YET</small> : null}
        </article>
        <article className="g3-quick-item g3-quick-costing">
          <span>COSTING YOU</span>
          <h3>{costing.title}</h3>
          <p>{costing.copy}</p>
          {!costing.confirmed ? <small>NOT ENOUGH EVIDENCE YET</small> : null}
        </article>
        <article className="g3-quick-item g3-quick-before">
          <span>BEFORE NEXT GAME</span>
          <h3>{beforeNextGame.title}</h3>
          <p>{beforeNextGame.copy}</p>
          {beforeNextGame.sourceLabel ? <small>{beforeNextGame.sourceLabel}</small> : <small>NO SPECIFIC GUIDANCE YET</small>}
        </article>
      </div>
    </section>
  );
}
