import Link from "next/link";
import { boardSignalPresentationLabel } from "@/lib/boardsignal/presentationLanguage";
import { ArrowRight, Radio, Target, TrendingUp } from "lucide-react";
import {
  publicTopThree,
  type PlayerUniverseView,
  type UniverseCategoryGroup,
} from "@/lib/boardsignal/universe";

export function UniverseCategoryCards({ groups }: { groups: UniverseCategoryGroup[] }) {
  return (
    <div className="universe-category-grid">
      {groups.map((group) => (
        <article className="universe-category-card" id={`universe-${group.id}`} key={group.id}>
          <div className="universe-category-heading">
            <span>THIS WEEK&apos;S LEADERS</span>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
          </div>
          {group.boards.length ? group.boards.map((board) => (
            <div className="universe-board" key={board.key}>
              <div className="universe-board-scope-row">{board.scopeLabel ? <p className="universe-scope">{board.scopeLabel}</p> : <span />}{"fieldLabel" in board ? <small className="universe-field-label">{boardSignalPresentationLabel(String((board as typeof board & { fieldLabel?: string }).fieldLabel ?? ""))}</small> : null}</div>
              <ol>
                {publicTopThree(board).map((item) => (
                  <li key={item.participantId}>
                    <span>{item.rank}</span>
                    <div><strong>{item.player}</strong><small>{item.evidence}</small></div>
                    <b>{item.valueLabel}</b>
                    {item.coverageHref ? <Link href={item.coverageHref} aria-label={`Open positive highlight for ${item.player}`}><ArrowRight size={16} /></Link> : null}
                  </li>
                ))}
              </ol>
              {board.entries.length < 3 ? <p className="universe-field-note">More players are joining · {board.entries.length} comparable completed review{board.entries.length === 1 ? "" : "s"}.</p> : null}
            </div>
          )) : <div className="universe-empty"><Radio size={18} /><p>{group.emptyMessage}</p></div>}
        </article>
      ))}
    </div>
  );
}

export function PrivateUniverseSections({ view }: { view: PlayerUniverseView }) {
  return (
    <>
      <section className="universal-section private-universe-section" id="standing">
        <div className="universal-section-heading"><span>U</span><div><p className="kicker">AROUND BOARDSIGNAL</p><h2>Where your completed week stands.</h2></div></div>
        <div className="founding-field-note"><TrendingUp size={18} /><div><strong>{boardSignalPresentationLabel(view.fieldLabel)}</strong><p>{view.fieldDescription}</p></div></div>
        {view.standings.length ? (
          <div className="private-standing-list">
            {view.standings.map((standing) => (
              <article key={`${standing.categoryId}:${standing.scopeLabel ?? "all"}`}>
                <div>
                  <span>{standing.categoryTitle}{standing.scopeLabel ? ` · ${standing.scopeLabel}` : ""}</span>
                  <strong>{standing.denominator >= 3 ? `#${standing.rank} of ${standing.denominator}` : "Comparison field forming"}</strong>
                  <p>{standing.valueLabel}{standing.percentile !== undefined ? ` · ${standing.percentile}th percentile` : ""}</p>
                </div>
                {standing.label ? <b>{standing.label}</b> : <b>{standing.denominator} comparable</b>}
                {standing.nearestAbove ? <small>In reach: {standing.nearestAbove.player} · {standing.nearestAbove.valueLabel}</small> : <small>{standing.rank === 1 && standing.denominator >= 3 ? "Leading this approved field." : "More completed reviews will make this comparison stronger."}</small>}
              </article>
            ))}
          </div>
        ) : <div className="universe-empty"><p>This review is valid, but its available facts do not yet meet a comparison category&apos;s minimum sample. No standing has been invented.</p></div>}
      </section>

      <section className="universal-section universe-learning-section">
        <div className="universal-section-heading"><span><Target size={16} /></span><div><p className="kicker">THIS WEEK&apos;S STANDOUTS</p><h2>Top performances to learn from.</h2></div></div>
        {view.learningLeaders.length ? <div className="universe-learning-grid">
          {view.learningLeaders.map((leader) => (
            <Link href={leader.coverageHref} key={`${leader.categoryId}:${leader.player}`}>
              <span>#1 {leader.categoryTitle}{leader.scopeLabel ? ` · ${leader.scopeLabel}` : ""}</span>
              <h3>{leader.player}</h3>
              <strong>{leader.valueLabel}</strong>
              <p>{leader.coverageHeadline}</p>
              <small>Open highlight <ArrowRight size={14} /></small>
            </Link>
          ))}
        </div> : <div className="universe-empty"><p>The relevant approved comparison field is still forming.</p></div>}
        <Link href="/feed" className="universe-explore-link">Explore Around BoardSignal <ArrowRight size={16} /></Link>
      </section>
    </>
  );
}
