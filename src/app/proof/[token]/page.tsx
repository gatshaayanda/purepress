import type { Metadata } from "next";
import PurePressProofApproval from "@/components/purepress/PurePressProofApproval";
export const metadata: Metadata = { title: "Artwork proof | PurePress", robots: { index: false, follow: false, noarchive: true } };
export default async function PurePressProofPage({ params }: { params: Promise<{ token: string }> }) { const {token}=await params; return <PurePressProofApproval token={token} />; }
