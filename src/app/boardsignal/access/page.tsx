import type { Metadata } from "next";
import MagicBetaAccess from "@/components/MagicBetaAccess";

export const metadata: Metadata = { title: "Open My Player Room", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default function BoardSignalMagicAccessPage() { return <MagicBetaAccess />; }
