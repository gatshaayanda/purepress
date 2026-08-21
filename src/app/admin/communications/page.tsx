import AdminNav from "@/components/AdminNav";
import FounderCommunications from "@/components/FounderCommunications";

export default function CommunicationsAdminPage() {
  return <div id="main" className="container admin-shell"><header className="admin-heading"><div><p className="kicker">Founder ↔ player</p><h1>Communications</h1></div></header><AdminNav /><FounderCommunications /></div>;
}
