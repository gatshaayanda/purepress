import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import FounderNewsroomSummary from "@/components/FounderNewsroomSummary";
import FounderOperationsConsole from "@/components/FounderOperationsConsole";
import FounderTrafficAnalytics from "@/components/FounderTrafficAnalytics";

export default function FounderNewsroomPage() {
  return (
    <div id="main" className="container admin-shell founder-newsroom-v2">
      <header className="admin-heading"><div><p className="kicker">Founder access · Operational and editorial control</p><h1>Founder Newsroom</h1></div><Link href="/admin/communications" className="button button-lime">Open Communications</Link></header>
      <AdminNav />
      <FounderOperationsConsole />
      <FounderTrafficAnalytics />
      <FounderNewsroomSummary />
    </div>
  );
}
