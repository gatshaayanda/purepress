import { redirect } from "next/navigation";

export default function LegacyDeskRedirect() {
  redirect("/boardsignal/player-room");
}
