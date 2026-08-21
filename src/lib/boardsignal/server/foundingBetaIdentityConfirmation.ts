import "server-only";

import { getAdminDb, getAdminMessaging } from "../../../utils/firebaseAdmin";
import { getBoardSignalDeliveryStatus } from "./delivery";
import { sendBoardSignalEmail } from "./email";
import {
  executeFoundingBetaIdentityConfirmationDelivery,
  IDENTITY_CONFIRMATION_STATUS,
  planFoundingBetaIdentityConfirmation,
  priorSuccessfulIdentityConfirmation,
} from "../foundingBetaIdentityConfirmation.mjs";

type DeliveryRecord = {
  channel: "device" | "email" | "none";
  status: "attempting" | "delivered" | "failed" | "not_eligible" | "not_configured";
  attemptedAt?: string;
  deliveredAt?: string;
  playerAlreadyInside?: boolean;
  reason?: string;
};

type DeliveryRequest = {
  id: string;
  canonicalUsername: string;
  activationReturnMethod?: "device" | "email" | "discord" | "telegram" | "return_here";
  activationDevice?: { token?: string } | null;
  approvalAlertDevice?: { token?: string } | null;
  approvalAlertEmail?: string;
  approvalAlertEmailConsent?: true;
  activationDeviceDelivery?: "delivered" | "failed" | "not_eligible";
  preferredContactMethod?: "email" | "discord" | "telegram";
  preferredContactValue?: string;
  betaContactConsent?: true;
  accessEmailDelivery?: "delivered" | "failed" | "not_eligible" | "not_configured";
  identityConfirmationDelivery?: DeliveryRecord;
  decidedAt?: string;
};

function clean<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export async function deliverFoundingBetaIdentityConfirmation(input: {
  requestId: string;
  playerAlreadyInside: boolean;
  magicLink?: string;
}) {
  const db = getAdminDb();
  const ref = db.collection("betaRequests").doc(input.requestId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.adminhub-global.com";

  const claim = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { kind: "missing" as const };
    const request = snapshot.data() as DeliveryRequest;
    const previous = priorSuccessfulIdentityConfirmation(request);
    if (previous) return { kind: "done" as const, request, delivery: previous as DeliveryRecord };
    if (request.identityConfirmationDelivery?.status === IDENTITY_CONFIRMATION_STATUS.ATTEMPTING) {
      return { kind: "in_flight" as const, request, delivery: request.identityConfirmationDelivery };
    }
    const plan = planFoundingBetaIdentityConfirmation({ request, playerAlreadyInside: input.playerAlreadyInside, siteUrl, magicLink: input.magicLink });
    const attempting: DeliveryRecord = {
      channel: plan.channel,
      status: IDENTITY_CONFIRMATION_STATUS.ATTEMPTING,
      attemptedAt: new Date().toISOString(),
      playerAlreadyInside: input.playerAlreadyInside,
      ...(plan.reason ? { reason: plan.reason } : {}),
    };
    transaction.set(ref, clean({ identityConfirmationDelivery: attempting }), { merge: true });
    return { kind: "claimed" as const, request: { ...request, identityConfirmationDelivery: undefined }, attempting };
  });

  if (claim.kind === "missing") return { channel: "none" as const, status: "not_eligible" as const, reason: "request_missing" };
  if (claim.kind === "done" || claim.kind === "in_flight") return claim.delivery;

  const delivery = await executeFoundingBetaIdentityConfirmationDelivery({
    request: claim.request,
    playerAlreadyInside: input.playerAlreadyInside,
    siteUrl,
    magicLink: input.magicLink,
    emailConfigured: getBoardSignalDeliveryStatus().emailConfigured,
    sendDevice: async (plan: { fcmToken: string; title: string; body: string; link: string; requestId: string }) => {
      await getAdminMessaging().send({
        token: plan.fcmToken,
        notification: { title: plan.title, body: plan.body },
        webpush: { fcmOptions: { link: plan.link } },
        data: { type: "founder_identity_confirmed", link: plan.link, requestId: plan.requestId },
      });
      return true;
    },
    sendEmail: async (plan: { email: string; subject: string; text: string }) => {
      const result = await sendBoardSignalEmail({ to: plan.email, subject: plan.subject, text: plan.text });
      return result.delivered === true;
    },
  }) as DeliveryRecord;

  const compatibility = delivery.channel === "device"
    ? { activationDeviceDelivery: delivery.status === "not_configured" ? "not_eligible" : delivery.status }
    : delivery.channel === "email"
      ? { accessEmailDelivery: delivery.status }
      : {};
  await ref.set(clean({ identityConfirmationDelivery: delivery, ...compatibility }), { merge: true }).catch(() => undefined);
  return delivery;
}
