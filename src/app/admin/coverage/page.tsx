import AdminNav from "@/components/AdminNav";
import FounderCoverageEditor from "@/components/FounderCoverageEditor";

export default function CoverageEditorPage() {
  return <div id="main" className="container admin-shell"><header className="admin-heading"><div><p className="kicker">Public front page</p><h1>Coverage editor</h1></div></header><AdminNav /><FounderCoverageEditor /></div>;
}
