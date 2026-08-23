import PurePressJobWorkspace from "@/components/purepress/PurePressJobWorkspace";

export default async function PurePressJobPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <main id="main" className="pp-admin-page">
      <div className="pp-admin-container">
        <PurePressJobWorkspace projectId={projectId} />
      </div>
    </main>
  );
}
