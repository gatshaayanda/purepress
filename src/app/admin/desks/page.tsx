import AdminNav from "@/components/AdminNav";
import { pipeline } from "@/data/boardsignal";

export default function DeskPipelinePage() {
  return <div id="main" className="container admin-shell"><header className="admin-heading"><div><p className="kicker">Production control</p><h1>Review pipeline</h1></div></header><AdminNav /><section className="desk-section"><p className="kicker">Fixed seven-day episodes</p><h2>Every Review has a visible state.</h2><p>Processing, editorial review, ready, delivered and exception are distinct so failed retrieval or ambiguous identity never disappears inside a generic queue.</p><div className="pipeline-list">{pipeline.map((item) => <div className="pipeline-row" key={item.player}><strong>{item.player}</strong><span>{item.period}</span><span>{item.games} games</span><span className={`state-pill ${item.state.toLowerCase().replace(" ", "-")}`}>{item.state}</span></div>)}</div></section></div>;
}

