import AdminNav from "@/components/AdminNav";
import FounderAccountDeletionAdmin from "@/components/FounderAccountDeletionAdmin";
import FoundingBetaPlayersAdmin from "@/components/FoundingBetaPlayersAdmin";
import OriginalBetaHistoryAdmin from "@/components/OriginalBetaHistoryAdmin";

export default function PlayersAdminPage() {
  return <div id="main" className="container admin-shell founder-players-v2"><header className="admin-heading"><div><p className="kicker">Identity and membership</p><h1>Players</h1></div></header><AdminNav /><FoundingBetaPlayersAdmin />
    <details className="founder-management-disclosure founder-history-disclosure"><summary><span><strong>HISTORICAL / ORIGINAL BETA</strong><small>Original cohort provenance and reconciliation</small></span><span>OPEN</span></summary><div className="founder-secondary-body"><OriginalBetaHistoryAdmin /></div></details>
    <details className="founder-management-disclosure founder-danger-disclosure"><summary><span><strong>DANGER ZONE</strong><small>Permanent account deletion</small></span><span>OPEN</span></summary><div className="founder-secondary-body"><FounderAccountDeletionAdmin /></div></details>
  </div>;
}
