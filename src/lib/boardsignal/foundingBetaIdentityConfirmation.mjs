export const IDENTITY_CONFIRMATION_CHANNEL = Object.freeze({
  DEVICE: "device",
  EMAIL: "email",
  NONE: "none",
});

export const IDENTITY_CONFIRMATION_STATUS = Object.freeze({
  ATTEMPTING: "attempting",
  DELIVERED: "delivered",
  FAILED: "failed",
  NOT_ELIGIBLE: "not_eligible",
  NOT_CONFIGURED: "not_configured",
});

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function planFoundingBetaIdentityConfirmation({ request, playerAlreadyInside, siteUrl, magicLink }) {
  const requestId = String(request?.id ?? "");
  const canonicalUsername = String(request?.canonicalUsername ?? "Player");
  const method = String(request?.activationReturnMethod ?? "");
  const site = String(siteUrl ?? "https://www.adminhub-global.com").replace(/\/$/, "");
  const playerRoomPath = "/boardsignal/player-room?tab=desk";
  const playerRoomUrl = `${site}${playerRoomPath}`;
  const previewPath = `/boardsignal/preview/${encodeURIComponent(requestId)}`;
  const previewUrl = `${site}${previewPath}`;

  if (method === "device") {
    const token = String(request?.approvalAlertDevice?.token ?? request?.activationDevice?.token ?? "").trim();
    if (token.length < 20) return { channel: IDENTITY_CONFIRMATION_CHANNEL.NONE, status: IDENTITY_CONFIRMATION_STATUS.NOT_ELIGIBLE, reason: "device_missing" };
    return {
      channel: IDENTITY_CONFIRMATION_CHANNEL.DEVICE,
      fcmToken: token,
      title: "BoardSignal identity confirmed",
      body: playerAlreadyInside
        ? "Your Founder review is complete. Open My BoardSignal."
        : "Your Founder review is complete. Open BoardSignal to continue.",
      link: playerAlreadyInside ? playerRoomPath : previewPath,
      requestId,
      canonicalUsername,
    };
  }

  if (method === "email") {
    const f2Email = String(request?.approvalAlertEmail ?? "").trim();
    const legacyEmail = String(request?.preferredContactValue ?? "").trim();
    const email = f2Email || legacyEmail;
    const eligible = f2Email
      ? request?.approvalAlertEmailConsent === true && validEmail(f2Email)
      : request?.betaContactConsent === true && request?.preferredContactMethod === "email" && validEmail(legacyEmail);
    if (!eligible) {
      return { channel: IDENTITY_CONFIRMATION_CHANNEL.NONE, status: IDENTITY_CONFIRMATION_STATUS.NOT_ELIGIBLE, reason: "email_ineligible" };
    }
    const destination = playerAlreadyInside ? playerRoomUrl : String(magicLink || `${site}/boardsignal/player-room`);
    return {
      channel: IDENTITY_CONFIRMATION_CHANNEL.EMAIL,
      email,
      subject: "Your BoardSignal identity is confirmed",
      text: `Your Founder review is complete. Your private BoardSignal was available immediately; this confirms your identity for BoardSignal's wider public-safe participation.\n\nOpen BoardSignal: ${destination}`,
      link: destination,
      requestId,
      canonicalUsername,
    };
  }

  return {
    channel: IDENTITY_CONFIRMATION_CHANNEL.NONE,
    status: IDENTITY_CONFIRMATION_STATUS.NOT_ELIGIBLE,
    reason: method === "return_here" || !method ? "no_alert" : "unsupported_legacy_channel",
  };
}

export function priorSuccessfulIdentityConfirmation(request) {
  const delivery = request?.identityConfirmationDelivery;
  if (delivery?.status === IDENTITY_CONFIRMATION_STATUS.DELIVERED) return delivery;
  if (request?.activationReturnMethod === "device" && request?.activationDeviceDelivery === "delivered") {
    return { channel: IDENTITY_CONFIRMATION_CHANNEL.DEVICE, status: IDENTITY_CONFIRMATION_STATUS.DELIVERED, attemptedAt: request?.decidedAt };
  }
  if (request?.activationReturnMethod === "email" && request?.accessEmailDelivery === "delivered") {
    return { channel: IDENTITY_CONFIRMATION_CHANNEL.EMAIL, status: IDENTITY_CONFIRMATION_STATUS.DELIVERED, attemptedAt: request?.decidedAt };
  }
  return undefined;
}

export async function executeFoundingBetaIdentityConfirmationDelivery({
  request,
  playerAlreadyInside,
  siteUrl,
  magicLink,
  emailConfigured,
  sendDevice,
  sendEmail,
}) {
  const previous = priorSuccessfulIdentityConfirmation(request);
  if (previous) return { ...previous, skippedDuplicate: true };
  const plan = planFoundingBetaIdentityConfirmation({ request, playerAlreadyInside, siteUrl, magicLink });
  const attemptedAt = new Date().toISOString();

  if (plan.channel === IDENTITY_CONFIRMATION_CHANNEL.NONE) {
    return { channel: plan.channel, status: plan.status, attemptedAt, reason: plan.reason, playerAlreadyInside };
  }
  if (plan.channel === IDENTITY_CONFIRMATION_CHANNEL.EMAIL && !emailConfigured) {
    return { channel: plan.channel, status: IDENTITY_CONFIRMATION_STATUS.NOT_CONFIGURED, attemptedAt, playerAlreadyInside };
  }

  try {
    const delivered = plan.channel === IDENTITY_CONFIRMATION_CHANNEL.DEVICE
      ? await sendDevice(plan)
      : await sendEmail(plan);
    return {
      channel: plan.channel,
      status: delivered ? IDENTITY_CONFIRMATION_STATUS.DELIVERED : IDENTITY_CONFIRMATION_STATUS.FAILED,
      attemptedAt,
      ...(delivered ? { deliveredAt: new Date().toISOString() } : {}),
      playerAlreadyInside,
    };
  } catch {
    return { channel: plan.channel, status: IDENTITY_CONFIRMATION_STATUS.FAILED, attemptedAt, playerAlreadyInside };
  }
}
