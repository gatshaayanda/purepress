import Link from "next/link";
import { BookOpenCheck, RefreshCw, WifiOff } from "lucide-react";

export const metadata = { title: "BoardSignal Offline" };

export default function OfflinePage() {
  return <div id="main" className="container section-pad offline-newsroom-page">
    <section className="offline-newsroom-card bs-surface-paper">
      <div className="offline-newsroom-mark"><WifiOff size={22} /></div>
      <p className="kicker">BOARDSIGNAL OFFLINE</p>
      <h1>The newsroom lost its signal.</h1>
      <p className="standfirst">Your saved Reviews can still be here. New Chess.com games, Pulse movement, messages and account changes need a connection.</p>
      <div className="offline-newsroom-facts">
        <div><BookOpenCheck size={18}/><p><strong>Saved Player Room</strong><span>Review, Progress, last Pulse, safe Universe snapshot and viewed comparisons can remain readable on this device.</span></p></div>
        <div><WifiOff size={18}/><p><strong>No fake live data</strong><span>BoardSignal will always tell you when coverage is saved rather than current.</span></p></div>
      </div>
      <div className="interior-actions">
        <Link href="/offline/player-room" className="button button-lime">Open saved Player Room</Link>
        <Link href="/boardsignal?source=offline-retry" className="button button-outline"><RefreshCw size={16}/> Try again</Link>
      </div>
      <p className="offline-newsroom-note">If no Player Room has been saved for the signed-in account on this device yet, BoardSignal will say so there.</p>
    </section>
  </div>;
}
