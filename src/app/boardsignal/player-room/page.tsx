import type { Metadata } from "next";
import BoardSignalPlayerRoom from "@/components/BoardSignalPlayerRoom";

export const metadata: Metadata = { title: "My Player Room", robots: { index: false, follow: false } };

export default function PlayerRoomPage() {
  return <BoardSignalPlayerRoom />;
}
