import type { Metadata } from "next";
import PurePressQuoteApproval from "@/components/purepress/PurePressQuoteApproval";

export const metadata: Metadata = {
  title: "PurePress Quotation",
  description: "Review a PurePress quotation",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function QuoteApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PurePressQuoteApproval token={token} />;
}
