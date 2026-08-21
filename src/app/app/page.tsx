import { redirect } from "next/navigation";

export default function LegacyPlayerRoomRedirect() {
  redirect("/boardsignal/player-room");
}
