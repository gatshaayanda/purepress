import { NextResponse } from "next/server";
import { hasAcceptedCurrentBetaAgreement } from "@/lib/boardsignal/account";
import { withPreviousReviewGuidance } from "@/lib/boardsignal/activeWeekGuidance";
import { buildCurrentEpisodeSummary } from "@/lib/boardsignal/processor";
import type { CurrentEpisodeSummary } from "@/lib/boardsignal/memory";
import {
  acceptFoundingBetaAgreement,
  accountForToken,
  buildPlayerRoomSnapshot,
  publishPrivateDesk,
  savePendingFactualReview,
  requirePlayerToken,
  updatePlayerPreferences,
} from "@/lib/boardsignal/server/persistence";
import type { BoardSignalDesk, DeskEngineResult } from "@/lib/boardsignal/types";
import { recordGuidePlayerRoomSnapshot } from "@/lib/boardsignal/server/guide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
}

function factualEpisodeCheckpoint(episode: Awaited<ReturnType<typeof buildCurrentEpisodeSummary>>): CurrentEpisodeSummary {
  const { nextGameGuidance, latestGame, ...factualEpisode } = episode;
  void nextGameGuidance;
  void latestGame;
  return factualEpisode;
}

export async function GET(request: Request) {
  try {
    const token = await requirePlayerToken(request);
    const account = await accountForToken(token);
    if (!hasAcceptedCurrentBetaAgreement(account)) {
      return response({
        ok: true,
        snapshot: {
          account,
          desks: [],
          reviewHistory: [],
          originalBetaReturn: Boolean((account as typeof account & { originalBetaPlayer?: boolean }).originalBetaPlayer),
          progress: [],
          recurringPatterns: [],
          personalRecords: {
            desksCompleted: 0,
            personalBestWinRun: 0,
            largestPoolSpecificRatingClimb: {},
          },
          generationRequired: false,
        },
      });
    }
    let currentEpisode: Awaited<ReturnType<typeof buildCurrentEpisodeSummary>> | undefined;
    let progressUnavailable;
    try {
      currentEpisode = await buildCurrentEpisodeSummary(account.chessCom.canonicalUsername, {
        anchorStart: account.cadenceAnchor,
        playerKey: account.uid,
      });
    } catch (error) {
      progressUnavailable = error instanceof Error ? error.message : "Current episode progress is temporarily unavailable.";
    }
    // Keep B.1/F.4 temporary coaching enrichment out of the durable user-root
    // episode checkpoint. Guidance/latest-game context are recomputed from the
    // same live current-week game set and attached only to this private response.
    const factualCurrentEpisode = currentEpisode ? factualEpisodeCheckpoint(currentEpisode) : undefined;
    const snapshot = await buildPlayerRoomSnapshot(token, factualCurrentEpisode, progressUnavailable);
    if (snapshot.currentEpisode && currentEpisode) {
      const previous = snapshot.reviewHistory[0];
      currentEpisode = {
        ...currentEpisode,
        nextGameGuidance: withPreviousReviewGuidance(currentEpisode.nextGameGuidance, previous?.blue ? {
          title: previous.blue.title,
          copy: previous.blue.copy,
          family: previous.signalFamilies.blueFamily,
          sourcePeriod: previous.periodLabel,
        } : undefined),
      };
      // B.1 continuity is a response-time enrichment. The existing persistence
      // layer stays untouched and the current-week game set remains authoritative.
      snapshot.currentEpisode = currentEpisode;
    }
    await recordGuidePlayerRoomSnapshot(account, {
      currentEpisode,
      latestDesk: snapshot.desks[0]?.desk,
      recentDeskLabels: snapshot.reviewHistory.map((item) => item.periodLabel),
      pulse: snapshot.pulse,
      shareMoments: snapshot.shareMoments,
    }).catch(() => undefined);
    return response({ ok: true, snapshot });
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : "Player Room could not be loaded." }, Number((error as { status?: number }).status ?? 500));
  }
}

export async function POST(request: Request) {
  try {
    const token = await requirePlayerToken(request);
    const body = await request.json() as {
      action?: "acceptAgreement" | "saveFactualReview" | "publishDesk" | "updatePreferences";
      desk?: BoardSignalDesk;
      engineResults?: Record<string, DeskEngineResult>;
      privacy?: import("@/lib/boardsignal/account").BoardSignalPrivacySettings;
      notificationPreferences?: import("@/lib/boardsignal/account").BoardSignalNotificationPreferences;
      contact?: {
        preferredContactMethod: import("@/lib/boardsignal/account").BoardSignalContactMethod;
        preferredContactValue: string;
        betaContactConsent: boolean;
      };
    };
    if (body.action === "acceptAgreement") {
      return response({ ok: true, account: await acceptFoundingBetaAgreement(token) });
    }
    if (body.action === "saveFactualReview" && body.desk) {
      return response({ ok: true, factualReview: await savePendingFactualReview(token, body.desk) });
    }
    if (body.action === "publishDesk" && body.desk && body.engineResults) {
      return response({ ok: true, publication: await publishPrivateDesk(token, body.desk, body.engineResults) });
    }
    if (body.action === "updatePreferences" && body.privacy && body.notificationPreferences) {
      return response({ ok: true, preferences: await updatePlayerPreferences(token, body.privacy, body.notificationPreferences, body.contact) });
    }
    return response({ ok: false, error: "Unknown Player Room action." }, 400);
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : "Player Room update failed." }, Number((error as { status?: number }).status ?? 500));
  }
}
