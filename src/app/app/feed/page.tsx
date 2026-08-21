import { redirect } from "next/navigation";

export default function LegacyFeedRedirect() {
  redirect("/boardsignal/player-room");
}
