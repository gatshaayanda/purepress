import { redirect } from "next/navigation";

export default function LegacyArchiveRedirect() {
  redirect("/boardsignal/player-room");
}
