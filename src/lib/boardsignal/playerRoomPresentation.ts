import type { CurrentEpisodeWithNextGameGuidance } from "./activeWeekGuidance";
import type { RecurringPattern } from "./memory";
import type { BoardSignalDesk, DeskCandidate, DeskSignal } from "./types";

export type QuickReadSource = "current_week" | "previous_review" | "latest_review" | "none";

export type PlayerRoomQuickRead = {
  happened: {
    headline: string;
    copy: string;
    periodLabel: string;
    wins: number;
    draws: number;
    losses: number;
    score: number;
  };
  recurring: { title: string; copy: string; confirmed: boolean };
  working: { title: string; copy: string; confirmed: boolean };
  costing: { title: string; copy: string; confirmed: boolean; signal: "red" | "amber" | "none" };
  beforeNextGame: {
    title: string;
    copy: string;
    source: QuickReadSource;
    sourceLabel?: string;
  };
};

export type EvidenceSignalKey = "green" | "amber" | "red" | "blue";
export type EvidenceSupport = {
  signal: EvidenceSignalKey;
  label: "WHAT'S WORKING" | "KEEP AN EYE ON" | "COSTING YOU" | "FOCUS NEXT";
  title: string;
  copy: string;
};

export type GroupedReviewEvidence = {
  linked: Array<{ candidate: DeskCandidate; supports: EvidenceSupport[] }>;
  otherReviewed: DeskCandidate[];
  signals: Array<EvidenceSupport & { evidenceIds: string[] }>;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isSupportedReviewSignal(signal: DeskSignal | undefined): signal is DeskSignal {
  return Boolean(signal && signal.status !== "withheld" && text(signal.title));
}

function previousReviewLabel(period?: string) {
  return `FROM YOUR LAST REVIEW${text(period) ? ` · ${text(period)}` : ""}`;
}

export function buildPlayerRoomQuickRead(input: {
  latest: BoardSignalDesk;
  recurringPatterns?: RecurringPattern[];
  currentEpisode?: CurrentEpisodeWithNextGameGuidance;
}): PlayerRoomQuickRead {
  const { latest, recurringPatterns = [], currentEpisode } = input;
  const recurring = recurringPatterns.find((pattern) => pattern.status === "repeated" && text(pattern.message));
  const green = latest.signals.green;
  const red = latest.signals.red;
  const amber = latest.signals.amber;
  const blue = latest.signals.blue;
  const guidance = currentEpisode?.nextGameGuidance;

  let beforeNextGame: PlayerRoomQuickRead["beforeNextGame"];
  const guidanceUsable = Boolean(guidance && text(guidance.title) && text(guidance.copy));
  if (guidance && guidanceUsable && guidance.status === "available") {
    beforeNextGame = {
      title: text(guidance.title),
      copy: text(guidance.copy),
      source: "current_week",
      sourceLabel: "THIS WEEK · PROVISIONAL",
    };
  } else if (guidance && guidanceUsable && guidance.status === "fallback_previous_review") {
    beforeNextGame = {
      title: text(guidance.title),
      copy: text(guidance.copy),
      source: "previous_review",
      sourceLabel: previousReviewLabel(guidance.previousReviewPeriod),
    };
  } else if (isSupportedReviewSignal(blue)) {
    beforeNextGame = {
      title: blue.title,
      copy: blue.copy,
      source: "latest_review",
      sourceLabel: previousReviewLabel(latest.period.label),
    };
  } else if (text(latest.pocketCard)) {
    beforeNextGame = {
      title: "Take this into your next game.",
      copy: text(latest.pocketCard),
      source: "latest_review",
      sourceLabel: previousReviewLabel(latest.period.label),
    };
  } else {
    beforeNextGame = {
      title: "Nothing specific yet.",
      copy: "BoardSignal does not have enough existing evidence for a specific next-game cue.",
      source: "none",
    };
  }

  return {
    happened: {
      headline: latest.headline,
      copy: latest.summary,
      periodLabel: latest.period.label,
      wins: latest.wins,
      draws: latest.draws,
      losses: latest.losses,
      score: latest.score,
    },
    recurring: recurring
      ? { title: "A repeating pattern is confirmed.", copy: recurring.message, confirmed: true }
      : {
          title: "No repeating pattern is confirmed yet.",
          copy: "BoardSignal needs compatible completed Reviews before it calls something recurring.",
          confirmed: false,
        },
    working: isSupportedReviewSignal(green)
      ? { title: green.title, copy: green.copy, confirmed: true }
      : {
          title: "No confirmed strength from this Review yet.",
          copy: "BoardSignal will not label a withheld signal as a confirmed strength.",
          confirmed: false,
        },
    costing: isSupportedReviewSignal(red)
      ? { title: red.title, copy: red.copy, confirmed: true, signal: "red" }
      : isSupportedReviewSignal(amber)
        ? { title: amber.title, copy: amber.copy, confirmed: true, signal: "amber" }
        : {
            title: "No confirmed cost signal from this Review yet.",
            copy: "BoardSignal will not invent a problem simply to fill this slot.",
            confirmed: false,
            signal: "none",
          },
    beforeNextGame,
  };
}

const SUPPORT_PRESENTATION: Record<EvidenceSignalKey, EvidenceSupport["label"]> = {
  green: "WHAT'S WORKING",
  amber: "KEEP AN EYE ON",
  red: "COSTING YOU",
  blue: "FOCUS NEXT",
};

export function signalEvidenceMap(desk: BoardSignalDesk) {
  const map = new Map<string, EvidenceSupport[]>();
  const signals = (Object.keys(SUPPORT_PRESENTATION) as EvidenceSignalKey[])
    .map((key) => ({ key, signal: desk.signals[key] }))
    .filter(({ signal }) => isSupportedReviewSignal(signal));

  for (const { key, signal } of signals) {
    const support: EvidenceSupport = {
      signal: key,
      label: SUPPORT_PRESENTATION[key],
      title: signal.title,
      copy: signal.copy,
    };
    for (const id of signal.evidenceIds ?? []) {
      const current = map.get(id) ?? [];
      if (!current.some((item) => item.signal === key)) current.push(support);
      map.set(id, current);
    }
  }
  return map;
}

export function evidenceSupportLabels(desk: BoardSignalDesk, candidateId: string) {
  return signalEvidenceMap(desk).get(candidateId) ?? [];
}

export function groupReviewEvidence(desk: BoardSignalDesk): GroupedReviewEvidence {
  const supportMap = signalEvidenceMap(desk);
  const linked: GroupedReviewEvidence["linked"] = [];
  const otherReviewed: DeskCandidate[] = [];

  for (const candidate of desk.candidates) {
    const supports = supportMap.get(candidate.id) ?? [];
    if (supports.length) linked.push({ candidate, supports });
    else otherReviewed.push(candidate);
  }

  const signals = (Object.keys(SUPPORT_PRESENTATION) as EvidenceSignalKey[])
    .map((key) => ({ key, signal: desk.signals[key] }))
    .filter(({ signal }) => isSupportedReviewSignal(signal))
    .map(({ key, signal }) => ({
      signal: key,
      label: SUPPORT_PRESENTATION[key],
      title: signal.title,
      copy: signal.copy,
      evidenceIds: (signal.evidenceIds ?? []).filter((id) => desk.candidates.some((candidate) => candidate.id === id)),
    }));

  return { linked, otherReviewed, signals };
}
