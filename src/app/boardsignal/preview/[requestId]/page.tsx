import type { Metadata } from "next";
import BetaPreviewRoom from "@/components/BetaPreviewRoom";

export const metadata: Metadata = { title: "BoardSignal Preview", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function BetaPreviewPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <BetaPreviewRoom requestId={requestId} />;
}
