import "server-only";

import { getAdminDb, isFirebaseAdminConfigured } from "../../../utils/firebaseAdmin";
import type { SafePublicCoverage } from "../memory";

export type SafePublicPlayerProfile = {
  chessPlayerId: string;
  username: string;
  avatar?: string;
  profileUrl?: string;
  coverage?: SafePublicCoverage;
};

/** Reads only the physically separate, opt-in public projection. */
export async function loadSafePublicPlayerProfile(handle: string): Promise<SafePublicPlayerProfile | undefined> {
  if (!isFirebaseAdminConfigured()) return undefined;
  const usernameKey = handle.trim().replace(/^@/, "").toLowerCase();
  if (!usernameKey) return undefined;
  const db = getAdminDb();
  const players = await db.collection("publicPlayers").where("usernameKey", "==", usernameKey).limit(1).get();
  const playerDocument = players.docs[0];
  if (!playerDocument) return undefined;
  const player = playerDocument.data() as {
    chessPlayerId?: string;
    username?: string;
    avatar?: string;
    profileUrl?: string;
    pageEnabled?: boolean;
  };
  if (player.pageEnabled !== true || !player.chessPlayerId || !player.username) return undefined;
  const coverageSnapshot = await db.collection("publicCoverage")
    .where("chessPlayerId", "==", player.chessPlayerId)
    .get();
  const coverage = coverageSnapshot.docs
    .map((document) => document.data() as SafePublicCoverage)
    .filter((item) => item.visibility?.publicPlayerPage === true)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
  return {
    chessPlayerId: player.chessPlayerId,
    username: player.username,
    avatar: player.avatar,
    profileUrl: player.profileUrl,
    coverage,
  };
}
