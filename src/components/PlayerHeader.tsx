import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { privateWeek } from "@/data/boardsignal";

export default function PlayerHeader() {
  return (
    <div className="player-topbar">
      <div className="player-ident"><div className="avatar">AG</div><div><strong>{privateWeek.player}</strong><span>Chess.com confirmed · Africa/Gaborone</span></div></div>
      <Link href="/player/Ayandakopano" className="button button-quiet"><ArrowLeft size={15} /> Player page</Link>
    </div>
  );
}

