import type { Metadata } from "next";
import UniversalPlayerDesk from "@/components/UniversalPlayerDesk";

export const metadata: Metadata = { title: "Build My Review", robots: { index: false, follow: false } };

export default async function BuildDeskPage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { handle } = await params;
  const { mode } = await searchParams;
  return <UniversalPlayerDesk requestedUsername={decodeURIComponent(handle).replace(/^@/, "")} mode={mode === "seed" ? "seed" : "live"} />;
}
