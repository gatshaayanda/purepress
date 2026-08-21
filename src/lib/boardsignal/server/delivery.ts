import "server-only";

import type { BoardSignalAccount } from "../account";
import type { BoardSignalMessageType } from "../communications";
import { accountCanReceiveBoardSignalEmail, type BoardSignalDeliveryStatus } from "../delivery";
import { getAdminDb } from "../../../utils/firebaseAdmin";

export function getBoardSignalDeliveryStatus(): BoardSignalDeliveryStatus {
  const browserPushConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim());
  const resendKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const emailFrom = Boolean(process.env.BOARDSIGNAL_EMAIL_FROM?.trim());
  return {
    inApp: true,
    browserPushConfigured,
    emailConfigured: resendKey && emailFrom,
    emailProvider: resendKey || emailFrom ? "resend" : "none",
  };
}

export async function getFounderDeliveryStatus() {
  const status = getBoardSignalDeliveryStatus();
  const users = await getAdminDb().collection("users").get();
  const accounts = users.docs
    .map((document) => document.data() as BoardSignalAccount)
    .filter((account) => account.role === "player" && account.accessTier === "founding_beta" && account.accessStatus === "active");
  const tokenCounts = await Promise.all(accounts.map(async (account) => {
    const tokens = await getAdminDb().collection("users").doc(account.uid).collection("pushTokens").get().catch(() => undefined);
    return tokens?.size ?? 0;
  }));
  return {
    ...status,
    registeredDevices: tokenCounts.reduce((sum, value) => sum + value, 0),
  };
}

export function accountEmailEligibleWithConfiguration(account: BoardSignalAccount, type: BoardSignalMessageType) {
  return getBoardSignalDeliveryStatus().emailConfigured && accountCanReceiveBoardSignalEmail(account, type);
}
