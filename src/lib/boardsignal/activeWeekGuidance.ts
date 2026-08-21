// Patch B.1 baseline: 0acc31a171f655c15f0cb99137d2c514e4253d76 (Add full BoardSignal account deletion)
// Patch F.4 immutable baseline: 69d7928bd0e5302595e0fcb44279cdf5f8f185eb (Fix regenerated magic access state)
// Evidence-family thresholds/ranking are intentionally preserved from B.1.
import type { CurrentEpisodeSummary } from "./memory";

export type ActiveWeekGuidanceFamily =
  | "clock_conversion"
  | "queen_safety"
  | "king_safety"
  | "forcing_reply"
  | "material_conversion"
  | "loss_run";

export type ActiveWeekGuidanceSource =
  | "current_week"
  | "previous_review"
  | "current_week_reinforces_previous_review"
  | "insufficient_current_evidence";

export type ActiveWeekGuidanceStatus =
  | "available"
  | "fallback_previous_review"
  | "insufficient_evidence";

export type ActiveWeekLatestGame = {
  gameId: string;
  gameUrl: string;
  occurredAt: number;
  opponent: string;
  opponentRating?: number;
  result: "win" | "draw" | "loss";
  pool: string;
  supportsSelectedGuidance: boolean;
  supportingSummary?: string;
};

export type ActiveWeekSupportingFact = {
  id: string;
  gameId?: string;
  gameUrl?: string;
  occurredAt?: number;
  opponent?: string;
  opponentRating?: number;
  pool?: string;
  moveNumber?: number;
  movePlayed?: string;
  opponentReply?: string;
  summary: string;
};

export type ActiveWeekEvidenceFact = ActiveWeekSupportingFact & {
  gameId: string;
  family: ActiveWeekGuidanceFamily;
  occurredAt: number;
  severity: number;
};

export type PreviousReviewGuidance = {
  title: string;
  copy: string;
  family?: string;
  sourcePeriod?: string;
};

export type ActiveWeekNextGameGuidance = {
  status: ActiveWeekGuidanceStatus;
  source: ActiveWeekGuidanceSource;
  family?: ActiveWeekGuidanceFamily;
  title?: string;
  copy?: string;
  primaryAction?: string;
  cornerFraming?: string;
  latestGameNote?: string;
  gamesConsidered: number;
  evidenceCount?: number;
  supportingFacts: ActiveWeekSupportingFact[];
  previousReviewPeriod?: string;
  reinforcement?: {
    label: "THIS IS STILL SHOWING UP";
    previousTitle: string;
    previousSourcePeriod?: string;
    copy: string;
  };
  reason?: "no_games" | "no_supported_fact" | "derivation_unavailable";
};

export type CurrentEpisodeWithNextGameGuidance = CurrentEpisodeSummary & {
  nextGameGuidance: ActiveWeekNextGameGuidance;
  latestGame?: ActiveWeekLatestGame;
};

export type ActiveWeekGuidanceInput = {
  gamesConsidered: number;
  currentLossRun: number;
  latestGameAt?: number;
  evidence: ActiveWeekEvidenceFact[];
  playerKey?: string;
  periodStart?: string;
  periodEnd?: string;
  latestGame?: Omit<ActiveWeekLatestGame, "supportsSelectedGuidance" | "supportingSummary">;
  currentLossRunFacts?: ActiveWeekSupportingFact[];
};

type RankedCandidate = {
  family: ActiveWeekGuidanceFamily;
  evidenceCount: number;
  evidenceStrength: number;
  latestOccurredAt: number;
  actionability: number;
  severity: number;
  supportingFacts: ActiveWeekSupportingFact[];
};

// LOCKED B.1 thresholds. F.4 changes language/metadata/presentation only.
const MIN_DISTINCT_GAMES: Record<ActiveWeekGuidanceFamily, number> = {
  clock_conversion: 1,
  queen_safety: 1,
  king_safety: 1,
  forcing_reply: 2,
  material_conversion: 2,
  loss_run: 2,
};

const MIN_WEEK_GAMES: Record<ActiveWeekGuidanceFamily, number> = {
  clock_conversion: 1,
  queen_safety: 1,
  king_safety: 1,
  forcing_reply: 3,
  material_conversion: 3,
  loss_run: 2,
};

const ACTIONABILITY: Record<ActiveWeekGuidanceFamily, number> = {
  clock_conversion: 100,
  queen_safety: 96,
  king_safety: 94,
  forcing_reply: 90,
  material_conversion: 84,
  loss_run: 68,
};

export const ACTIVE_WEEK_GUIDANCE_CONSTANTS = {
  MIN_DISTINCT_GAMES,
  MIN_WEEK_GAMES,
  ACTIONABILITY,
} as const;

const PRIMARY_ACTION: Record<ActiveWeekGuidanceFamily, string> = {
  clock_conversion: "Include the clock in the decision and preserve enough time to make the move.",
  queen_safety: "Before committing the queen, scan the opponent's immediate checks and captures.",
  king_safety: "Before committing, scan forcing replies around your king, especially checks.",
  forcing_reply: "Before calculating your follow-up, scan the opponent's forcing checks and captures first.",
  material_conversion: "Before committing a piece, check whether the opponent has an immediate capture.",
  loss_run: "Reset the next game from the current board instead of carrying the previous result forward.",
};

const LANGUAGE_BANK: Record<ActiveWeekGuidanceFamily, { titles: readonly string[]; bodies: readonly string[] }> = {
  clock_conversion: {
    titles: [
      "Keep the clock in the decision.",
      "Check the clock before the calculation gets long.",
      "Make the clock part of the move.",
      "Leave enough clock to finish the decision.",
      "Clock first, then calculate.",
      "Before you go deep, look at the clock.",
    ],
    bodies: [
      "Before starting a long calculation, check the clock first and leave enough time to make the move.",
      "Put the clock into the decision before you spend time on a deeper line.",
      "When a position asks for a long think, check how much move-making time you are protecting first.",
      "Before the calculation expands, make sure the clock still leaves you enough time to choose and play.",
      "Treat the remaining time as part of the position: check it before committing to a long calculation.",
      "Give the clock one look before you go deep, then preserve enough time to actually make the move.",
    ],
  },
  queen_safety: {
    titles: [
      "Before the queen moves, scan the reply.",
      "Give their checks and captures one look before the queen goes.",
      "Make the immediate reply part of the queen move.",
      "One beat before the queen moves: what can they force?",
      "Check what comes back before you commit the queen.",
      "See their immediate forcing reply before the queen leaves.",
    ],
    bodies: [
      "Before committing the queen, check the opponent's immediate checks and captures first.",
      "When the queen move looks right, scan their checks and captures once before you let it go.",
      "Make the opponent's immediate forcing reply part of every queen move you commit.",
      "Before the queen is committed, look first for the checks and captures available in reply.",
      "Give the opponent's immediate checks and captures one clean scan before finalizing the queen move.",
      "Once you have chosen a queen move, verify what they can check or capture immediately.",
    ],
  },
  king_safety: {
    titles: [
      "Check every forcing reply around your king.",
      "See the check before you commit.",
      "Make their forcing king-side reply part of the move.",
      "Before the move goes, scan what reaches your king.",
      "Give their checks first priority.",
      "One clean scan around the king before you move.",
    ],
    bodies: [
      "Before committing the move, scan forcing replies around your king, especially checks.",
      "Before the move is final, look first for any check or forcing reply that reaches your king.",
      "Make the opponent's checks around your king the first reply you verify before committing.",
      "When you have a move in mind, scan the king area for forcing replies before calculating your follow-up.",
      "Give checks against your king one clean look before the move leaves your hand.",
      "Before you commit, verify the opponent's forcing options around your king, with checks first.",
    ],
  },
  forcing_reply: {
    titles: [
      "Check the forcing reply first.",
      "See their forcing move before your follow-up.",
      "Before your plan continues, check what they can force.",
      "Make their check or capture part of your move.",
      "Their forcing reply comes first.",
      "One beat before you commit: what can they force?",
    ],
    bodies: [
      "Before committing, scan the opponent's checks and captures before calculating your own follow-up.",
      "When you choose a move, check their forcing reply first, then calculate what you want to do next.",
      "Put the opponent's checks and captures ahead of your own continuation in the calculation order.",
      "Before your follow-up matters, verify whether the opponent has a forcing check or capture in reply.",
      "Make their immediate forcing move part of the move you are choosing before you calculate beyond it.",
      "Once you have a candidate move, scan their checks and captures first and only then continue your line.",
    ],
  },
  material_conversion: {
    titles: [
      "Count what comes back.",
      "Give their capture one look before you commit.",
      "Before the piece goes, check what they can take.",
      "Make their reply part of the move.",
      "One beat before you move: what can they capture?",
      "See the immediate take before you let the move go.",
    ],
    bodies: [
      "Before committing a piece, check whether the opponent has an immediate capture.",
      "Before the move is final, scan the opponent's immediate takes.",
      "When you have chosen the move, count the captures they get in reply.",
      "Make the opponent's immediate capture part of the move you are choosing.",
      "Before you commit the piece, give every immediate capture in reply one clean look.",
      "Once the move looks right, check what the opponent can take immediately before you let it go.",
    ],
  },
  loss_run: {
    titles: [
      "Reset before the next one.",
      "Start the next board from zero.",
      "Leave the last result in the last game.",
      "Give the next game a clean start.",
      "The next board gets its own decision.",
      "Reset to the position in front of you.",
    ],
    bodies: [
      "Give the next game a clean start and make the next decision from the board in front of you, not the previous result.",
      "Start the next game from the current position and keep the previous result out of the next decision.",
      "Let the previous result end with the previous game; make the next choice from the board you actually have.",
      "Reset at move one and judge the next position on its own facts rather than the last score.",
      "Carry no result forward: begin the next game with the position in front of you and make that board's decision.",
      "Treat the next game as a fresh board and make each decision from what is there, not from the previous result.",
    ],
  },
};

const CORNER_FRAMING: Record<ActiveWeekLatestGame["result"], readonly string[]> = {
  win: [
    "Good. Keep what worked. One thing still worth carrying into the next one:",
    "That result is in the book. Keep the useful part and take one cue forward:",
    "Keep the result. Take one clean decision rule into the next game:",
    "Bank the win. One thing is still worth carrying forward:",
    "That game is done. Keep what held up and take one cue into the next board:",
    "Result secured. One decision rule is still worth keeping in front of you:",
  ],
  loss: [
    "Leave that result there. One thing for the next game:",
    "That one is finished. Take one useful adjustment into the next board:",
    "The result is done. Carry one clean decision rule into the next game:",
    "Close that game there. One thing is worth taking forward:",
    "New board next. Keep one useful adjustment in front of you:",
    "That score stays with that game. One cue goes with you to the next one:",
  ],
  draw: [
    "Reset from here. One clear cue for the next one:",
    "That game is done. Carry one clean decision rule into the next one:",
    "Leave the result on that board. One useful cue goes forward:",
    "Reset for the next game with one thing in front of you:",
    "That one is in the book. Take one clear rule into the next board:",
    "New game, clean board. Keep one useful cue with you:",
  ],
};

const LATEST_SUPPORTED = [
  "That game added another example of the same cue.",
  "Your last game added fresh support for the cue below.",
  "That game reinforced the same current-week cue.",
  "The latest game added one more supported example.",
] as const;

const LATEST_NOT_SUPPORTED = [
  "That game didn't add another example of this cue. The strongest repeated evidence still comes from earlier this week.",
  "The latest game did not add fresh support for this cue. It remains the strongest repeated evidence from earlier in the week.",
  "That game added no new example of this cue. The note below still comes from the strongest repeated evidence already in the week.",
  "BoardSignal saw the latest game, but it did not add another example here. The current cue is still supported by earlier games this week.",
] as const;

const LATEST_LOSS_RUN = [
  "That result extends the current run. Leave it there and reset from the next board.",
  "The latest result is part of the current run. Start the next game from the position in front of you.",
  "That game added to the current result run. The next board still gets a clean start.",
  "The current run now includes that result. Reset the next decision from the new board.",
] as const;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicPick<T>(values: readonly T[], seed: string, salt: string): T {
  return values[stableHash(`${seed}|${salt}`) % values.length];
}

function wordingSeed(input: ActiveWeekGuidanceInput, family: ActiveWeekGuidanceFamily, newestSupportingFactId = "") {
  return [
    input.playerKey ?? "unknown-player",
    input.periodStart ?? "unknown-period-start",
    input.periodEnd ?? "unknown-period-end",
    family,
    input.latestGame?.gameId ?? "",
    newestSupportingFactId,
  ].join("|");
}

function boundedSeverity(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function groupedEvidence(evidence: ActiveWeekEvidenceFact[]) {
  const groups = new Map<ActiveWeekGuidanceFamily, Map<string, ActiveWeekEvidenceFact>>();
  for (const fact of evidence) {
    const byGame = groups.get(fact.family) ?? new Map<string, ActiveWeekEvidenceFact>();
    const existing = byGame.get(fact.gameId);
    if (!existing
      || boundedSeverity(fact.severity) > boundedSeverity(existing.severity)
      || (boundedSeverity(fact.severity) === boundedSeverity(existing.severity) && fact.occurredAt > existing.occurredAt)
      || (boundedSeverity(fact.severity) === boundedSeverity(existing.severity) && fact.occurredAt === existing.occurredAt && fact.id < existing.id)) {
      byGame.set(fact.gameId, fact);
    }
    groups.set(fact.family, byGame);
  }
  return groups;
}

function toSupportingFact(fact: ActiveWeekEvidenceFact): ActiveWeekSupportingFact {
  const { family: _family, severity: _severity, ...supporting } = fact;
  void _family;
  void _severity;
  return supporting;
}

function rankCandidates(input: ActiveWeekGuidanceInput): RankedCandidate[] {
  const groups = groupedEvidence(input.evidence);
  const ranked: RankedCandidate[] = [];

  for (const family of ["clock_conversion", "queen_safety", "king_safety", "forcing_reply", "material_conversion"] as const) {
    const facts = [...(groups.get(family)?.values() ?? [])]
      .sort((a, b) => b.occurredAt - a.occurredAt || boundedSeverity(b.severity) - boundedSeverity(a.severity) || a.id.localeCompare(b.id));
    const evidenceCount = facts.length;
    if (input.gamesConsidered < MIN_WEEK_GAMES[family] || evidenceCount < MIN_DISTINCT_GAMES[family]) continue;
    const severity = Math.max(0, ...facts.map((fact) => boundedSeverity(fact.severity)));
    const directConcreteBonus = family === "clock_conversion" || family === "queen_safety" || family === "king_safety" ? 1 : 0;
    ranked.push({
      family,
      evidenceCount,
      evidenceStrength: Math.min(4, evidenceCount + directConcreteBonus),
      latestOccurredAt: facts[0]?.occurredAt ?? 0,
      actionability: ACTIONABILITY[family],
      severity,
      supportingFacts: facts.slice(0, 3).map(toSupportingFact),
    });
  }

  // LOCKED B.1 fallback semantics: result-run reset only competes when no
  // concrete legal-move/termination family is safely eligible.
  if (!ranked.length && input.gamesConsidered >= MIN_WEEK_GAMES.loss_run && input.currentLossRun >= MIN_DISTINCT_GAMES.loss_run) {
    const runFacts = [...(input.currentLossRunFacts ?? [])]
      .sort((a, b) => (b.occurredAt ?? 0) - (a.occurredAt ?? 0) || a.id.localeCompare(b.id))
      .slice(0, 3);
    ranked.push({
      family: "loss_run",
      evidenceCount: input.currentLossRun,
      evidenceStrength: Math.min(4, input.currentLossRun),
      latestOccurredAt: input.latestGameAt ?? 0,
      actionability: ACTIONABILITY.loss_run,
      severity: 45,
      supportingFacts: runFacts.length ? runFacts : [{
        id: `current-loss-run-${input.currentLossRun}`,
        summary: `${input.currentLossRun} consecutive losses make up the current result run.`,
      }],
    });
  }

  return ranked.sort((a, b) =>
    b.evidenceStrength - a.evidenceStrength
    || b.latestOccurredAt - a.latestOccurredAt
    || b.evidenceCount - a.evidenceCount
    || b.actionability - a.actionability
    || b.severity - a.severity
    || a.family.localeCompare(b.family),
  );
}

function cornerFor(input: ActiveWeekGuidanceInput, family: ActiveWeekGuidanceFamily, newestSupportingFactId = "") {
  if (!input.latestGame) return undefined;
  const seed = wordingSeed(input, family, newestSupportingFactId);
  return deterministicPick(CORNER_FRAMING[input.latestGame.result], seed, "corner");
}

function latestGameNoteFor(input: ActiveWeekGuidanceInput, selected: RankedCandidate) {
  if (!input.latestGame) return undefined;
  const supporting = selected.supportingFacts.find((fact) => fact.gameId === input.latestGame?.gameId);
  const seed = wordingSeed(input, selected.family, selected.supportingFacts[0]?.id ?? "");
  if (selected.family === "loss_run") return deterministicPick(LATEST_LOSS_RUN, seed, "latest-loss-run");
  return deterministicPick(supporting ? LATEST_SUPPORTED : LATEST_NOT_SUPPORTED, seed, supporting ? "latest-supported" : "latest-not-supported");
}

export function deriveActiveWeekNextGameGuidance(input: ActiveWeekGuidanceInput): ActiveWeekNextGameGuidance {
  const gamesConsidered = Math.max(0, Math.floor(input.gamesConsidered));
  if (gamesConsidered === 0) {
    return {
      status: "insufficient_evidence",
      source: "insufficient_current_evidence",
      gamesConsidered: 0,
      supportingFacts: [],
      reason: "no_games",
    };
  }

  const selected = rankCandidates(input)[0];
  if (!selected) {
    const fallbackFamily: ActiveWeekGuidanceFamily = "forcing_reply";
    return {
      status: "insufficient_evidence",
      source: "insufficient_current_evidence",
      gamesConsidered,
      supportingFacts: [],
      cornerFraming: input.latestGame ? cornerFor(input, fallbackFamily) : undefined,
      latestGameNote: input.latestGame
        ? "BoardSignal saw this game. Nothing in the current week has crossed the evidence threshold for a specific next-game cue yet."
        : undefined,
      reason: "no_supported_fact",
    };
  }

  const newestSupportingFactId = selected.supportingFacts[0]?.id ?? "";
  const seed = wordingSeed(input, selected.family, newestSupportingFactId);
  const bank = LANGUAGE_BANK[selected.family];

  return {
    status: "available",
    source: "current_week",
    family: selected.family,
    title: deterministicPick(bank.titles, seed, "title"),
    copy: deterministicPick(bank.bodies, seed, "body"),
    primaryAction: PRIMARY_ACTION[selected.family],
    cornerFraming: cornerFor(input, selected.family, newestSupportingFactId),
    latestGameNote: latestGameNoteFor(input, selected),
    gamesConsidered,
    evidenceCount: selected.evidenceCount,
    supportingFacts: selected.supportingFacts,
  };
}

export function unavailableActiveWeekGuidance(gamesConsidered: number): ActiveWeekNextGameGuidance {
  return {
    status: "insufficient_evidence",
    source: "insufficient_current_evidence",
    gamesConsidered: Math.max(0, Math.floor(gamesConsidered)),
    supportingFacts: [],
    reason: "derivation_unavailable",
  };
}

export function withPreviousReviewGuidance(
  current: ActiveWeekNextGameGuidance,
  previous?: PreviousReviewGuidance,
): ActiveWeekNextGameGuidance {
  const validPrevious = previous && previous.title.trim() && previous.copy.trim() ? previous : undefined;
  if (current.status === "available") {
    if (validPrevious?.family && current.family === validPrevious.family) {
      const count = current.evidenceCount ?? 0;
      return {
        ...current,
        source: "current_week_reinforces_previous_review",
        reinforcement: {
          label: "THIS IS STILL SHOWING UP",
          previousTitle: validPrevious.title,
          previousSourcePeriod: validPrevious.sourcePeriod,
          copy: `Your last Review carried the same theme. This week has independently added ${count} supporting game${count === 1 ? "" : "s"} so far.`,
        },
      };
    }
    return current;
  }

  if (!validPrevious) return current;
  return {
    status: "fallback_previous_review",
    source: "previous_review",
    family: undefined,
    title: validPrevious.title,
    copy: validPrevious.copy,
    primaryAction: undefined,
    cornerFraming: current.cornerFraming,
    latestGameNote: current.gamesConsidered
      ? "The current week has not established a stronger cue yet. The note below is still coming from your last Review."
      : undefined,
    gamesConsidered: current.gamesConsidered,
    evidenceCount: 0,
    supportingFacts: [],
    previousReviewPeriod: validPrevious.sourcePeriod,
    reason: current.reason,
  };
}
