import AdminNav from "@/components/AdminNav";

export default function ExceptionsPage() {
  return <div id="main" className="container admin-shell"><header className="admin-heading"><div><p className="kicker">Problems worth human attention</p><h1>Exceptions</h1></div></header><AdminNav /><section className="desk-section"><p className="kicker">One open item</p><h2>No games in the latest completed period.</h2><p>The inactive-player rule searches backward through non-overlapping complete seven-day blocks, selects the most recent block containing games and clearly labels it as historical. Current form is never inferred from an older week.</p><div className="archive-list"><div className="archive-row"><strong>Kylian_Mbappe_LottinREAL</strong><span>Latest period: 0 games</span><span>Historical search</span><span className="state-pill exception">Review</span></div></div></section></div>;
}

