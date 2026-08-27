import PurePressJobWorkspace from "@/components/purepress/PurePressJobWorkspace";
import PurePressQuotationPanel from "@/components/purepress/PurePressQuotationPanel";
import PurePressArtworkProofPanel from "@/components/purepress/PurePressArtworkProofPanel";
import PurePressProductionPanel from "@/components/purepress/PurePressProductionPanel";
export default async function PurePressJobPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <main id="main" className="pp-admin-page"><div className="pp-admin-container"><PurePressJobWorkspace projectId={projectId} /><PurePressQuotationPanel projectId={projectId} /><PurePressArtworkProofPanel projectId={projectId} />
        <PurePressProductionPanel projectId={projectId} /></div></main>;
}
