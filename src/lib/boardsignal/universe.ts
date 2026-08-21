import type {
  BoardSignalDesk,
  DeskReturnLoop,
  DeskUniverseStanding,
} from "./types";

export type UniverseCategoryId =
  | "rating-climb"
  | "winning-run"
  | "rating-recovery"
  | "strong-finish"
  | "rapid-rating-leader"
  | "best-upset"
  | "breakthrough-desk"
  | "moment-of-the-week";

export type UniverseRatingPool = "rapid" | "blitz" | "bullet";

export type UniversePoolFact = {
  pool: UniverseRatingPool;
  games: number;
  start?: number;
  end?: number;
  peak?: number;
  low?: number;
  change?: number;
};

export type UniverseFinishFact = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
};

export type UniverseUpsetFact = {
  pool: UniverseRatingPool;
  ratingGap: number;
  opponentLabel?: string;
};

export type UniverseMomentFact = {
  value: number;
  valueLabel: string;
  evidence: string;
};

export type UniverseParticipant = {
  id: string;
  stablePlayerId?: string;
  aliases?: string[];
  player: string;
  source: "seed" | "live";
  verified: boolean;
  periodLabel: string;
  periodEnd: string;
  games: number;
  score: number;
  winningRun?: number;
  checkmateWins?: number;
  pools: UniversePoolFact[];
  strongFinish?: UniverseFinishFact;
  bestUpset?: UniverseUpsetFact;
  moment?: UniverseMomentFact;
  coverage?: {
    href: string;
    headline: string;
  };
};

export type UniverseEntry = {
  participantId: string;
  stablePlayerId?: string;
  player: string;
  rank: number;
  value: number;
  valueLabel: string;
  evidence: string;
  coverageHref?: string;
  coverageHeadline?: string;
};

export type UniverseBoard = {
  key: string;
  categoryId: UniverseCategoryId;
  title: string;
  description: string;
  scopeLabel?: string;
  minimumLabel: string;
  entries: UniverseEntry[];
};

export type UniverseCategoryGroup = {
  id: UniverseCategoryId;
  title: string;
  description: string;
  boards: UniverseBoard[];
  emptyMessage: string;
};

export type UniverseLearningLeader = {
  categoryId: UniverseCategoryId;
  categoryTitle: string;
  scopeLabel?: string;
  player: string;
  valueLabel: string;
  coverageHref: string;
  coverageHeadline: string;
};

export type PlayerUniverseView = {
  fieldLabel: "FOUNDING BETA FIELD";
  fieldDescription: string;
  participantId: string;
  groups: UniverseCategoryGroup[];
  standings: DeskUniverseStanding[];
  learningLeaders: UniverseLearningLeader[];
};

type CategoryDefinition = {
  id: UniverseCategoryId;
  title: string;
  description: string;
  emptyMessage: string;
};

type MetricCandidate = Omit<UniverseEntry, "rank"> & { secondary: number };

export const UNIVERSE_CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = [
  {
    id: "rating-climb",
    title: "Biggest Rating Climb",
    description: "Positive recorded rating movement, ranked separately inside each Chess.com pool.",
    emptyMessage: "No pool has enough approved positive rating-boundary evidence yet.",
  },
  {
    id: "winning-run",
    title: "Winning Run",
    description: "The longest verified consecutive winning sequence in a completed Review.",
    emptyMessage: "No approved Review currently supplies a qualifying winning run.",
  },
  {
    id: "rating-recovery",
    title: "Rating Recovery",
    description: "The finish above the recorded weekly low, kept inside the same rating pool.",
    emptyMessage: "The approved field does not yet contain enough exact low-to-finish rating boundaries.",
  },
  {
    id: "strong-finish",
    title: "Strong Finish",
    description: "A positive final active day with at least three games in the closing sample.",
    emptyMessage: "No approved final-day sample currently clears the minimum evidence rule.",
  },
  {
    id: "rapid-rating-leader",
    title: "Rapid Rating Leader",
    description: "The latest recorded Rapid boundary after at least three Rapid games. Rapid only.",
    emptyMessage: "Fewer than one approved Review has a usable Rapid finishing boundary.",
  },
  {
    id: "best-upset",
    title: "Best Upset",
    description: "The largest verified win by rating gap, compared only inside the same pool.",
    emptyMessage: "No approved Review currently carries exact winner-and-opponent rating-gap evidence.",
  },
  {
    id: "breakthrough-desk",
    title: "Breakthrough Review",
    description: "A positive-score Review with at least five pool games and a gain of 25 or more rating points.",
    emptyMessage: "No approved pool currently clears the breakthrough evidence rule.",
  },
  {
    id: "moment-of-the-week",
    title: "Moment of the Week",
    description: "One deterministic positive event selected from the Review's approved public facts.",
    emptyMessage: "No approved positive event currently clears the Moment rule.",
  },
] as const;

const RATING_POOLS: UniverseRatingPool[] = ["rapid", "blitz", "bullet"];
const MIN_RATING_GAMES = 5;
const MIN_RATING_LEADER_GAMES = 3;
const MIN_STRONG_FINISH_GAMES = 3;
const FIELD_SIGNIFICANCE_MINIMUM = 3;

function normalizePool(pool: string): UniverseRatingPool | undefined {
  const normalized = pool.trim().toLowerCase();
  if (normalized.includes("bullet")) return "bullet";
  if (normalized.includes("blitz")) return "blitz";
  if (normalized.includes("rapid") || /^\d+\+\d+$/.test(normalized)) return "rapid";
  return undefined;
}

function recordedChange(pool: UniversePoolFact) {
  if (pool.change !== undefined) return pool.change;
  if (pool.start !== undefined && pool.end !== undefined) return pool.end - pool.start;
  return undefined;
}

function record(finish: UniverseFinishFact) {
  return `${finish.wins}W · ${finish.draws}D · ${finish.losses}L`;
}

function scorePercent(finish: UniverseFinishFact) {
  return finish.games ? ((finish.wins + finish.draws / 2) / finish.games) * 100 : 0;
}

function titleCasePool(pool: UniverseRatingPool) {
  return pool[0].toUpperCase() + pool.slice(1);
}

function ranked(entries: MetricCandidate[]): UniverseEntry[] {
  const sorted = [...entries].sort((a, b) =>
    b.value - a.value || b.secondary - a.secondary || a.player.localeCompare(b.player),
  );
  return sorted.map((item, index) => ({
    participantId: item.participantId,
    player: item.player,
    rank: index + 1,
    value: item.value,
    valueLabel: item.valueLabel,
    evidence: item.evidence,
    coverageHref: item.coverageHref,
    coverageHeadline: item.coverageHeadline,
  }));
}

function entry(
  participant: UniverseParticipant,
  value: number,
  secondary: number,
  valueLabel: string,
  evidence: string,
): MetricCandidate {
  return {
    participantId: participant.id,
    stablePlayerId: participant.stablePlayerId,
    player: participant.player,
    value,
    secondary,
    valueLabel,
    evidence,
    coverageHref: participant.coverage?.href,
    coverageHeadline: participant.coverage?.headline,
  };
}

function validParticipants(participants: UniverseParticipant[]) {
  return participants.filter((participant) => participant.verified);
}

function poolBoards(
  definition: CategoryDefinition,
  participants: UniverseParticipant[],
  metric: (participant: UniverseParticipant, pool: UniversePoolFact) => MetricCandidate | undefined,
  minimumLabel: string,
) {
  return RATING_POOLS.flatMap((poolName) => {
    const candidates = participants.flatMap((participant) => {
      const pool = participant.pools.find((item) => item.pool === poolName);
      if (!pool) return [];
      const candidate = metric(participant, pool);
      return candidate ? [candidate] : [];
    });
    if (!candidates.length) return [];
    return [{
      key: `${definition.id}:${poolName}`,
      categoryId: definition.id,
      title: definition.title,
      description: definition.description,
      scopeLabel: titleCasePool(poolName),
      minimumLabel,
      entries: ranked(candidates),
    } satisfies UniverseBoard];
  });
}

export function deriveMomentFact(participant: Omit<UniverseParticipant, "moment">): UniverseMomentFact | undefined {
  const candidates: UniverseMomentFact[] = [];
  if ((participant.winningRun ?? 0) >= 3) {
    const run = participant.winningRun!;
    candidates.push({ value: 100 + run, valueLabel: `${run} straight`, evidence: `${run} consecutive wins in the completed Review.` });
  }
  for (const pool of participant.pools) {
    const change = recordedChange(pool);
    if (pool.games >= MIN_RATING_GAMES && change !== undefined && change >= 25) {
      candidates.push({
        value: 90 + Math.min(change, 99) / 100,
        valueLabel: `+${change} ${titleCasePool(pool.pool)}`,
        evidence: `${change} points gained across ${pool.games} ${titleCasePool(pool.pool)} games.`,
      });
    }
  }
  if (participant.strongFinish && participant.strongFinish.games >= MIN_STRONG_FINISH_GAMES) {
    const finishScore = scorePercent(participant.strongFinish);
    if (finishScore > 50) {
      candidates.push({
        value: 80 + finishScore / 100 + participant.strongFinish.games / 1000,
        valueLabel: `${finishScore.toFixed(0)}% finish`,
        evidence: `The final active day finished ${record(participant.strongFinish)} across ${participant.strongFinish.games} games.`,
      });
    }
  }
  if ((participant.checkmateWins ?? 0) >= 3) {
    const mates = participant.checkmateWins!;
    candidates.push({ value: 70 + Math.min(mates, 29) / 100, valueLabel: `${mates} mates`, evidence: `${mates} wins ended by checkmate.` });
  }
  return candidates.sort((a, b) => b.value - a.value)[0];
}

export function deskToUniverseParticipant(desk: BoardSignalDesk): UniverseParticipant | undefined {
  if (desk.source === "fixture" || !desk.provenance.verified) return undefined;
  const pools = desk.pools.flatMap((pool) => {
    const normalized = normalizePool(pool.pool);
    if (!normalized) return [];
    return [{
      pool: normalized,
      games: pool.games,
      start: pool.firstRecordedRating,
      end: pool.lastRecordedRating,
      peak: pool.peak,
      low: pool.low,
      change: pool.change,
    } satisfies UniversePoolFact];
  });
  const activeDays = desk.days.filter((day) => (day.games ?? day.wins + day.draws + day.losses) > 0);
  const finalDay = activeDays.at(-1);
  const strongFinish = finalDay ? {
    games: finalDay.games ?? finalDay.wins + finalDay.draws + finalDay.losses,
    wins: finalDay.wins,
    draws: finalDay.draws,
    losses: finalDay.losses,
  } : undefined;
  const base: UniverseParticipant = {
    id: `${desk.source}:${desk.player.username.toLowerCase()}`,
    stablePlayerId: desk.player.playerId ? String(desk.player.playerId) : undefined,
    aliases: [desk.player.requestedUsername],
    player: desk.player.username,
    source: desk.source,
    verified: desk.provenance.verified,
    periodLabel: desk.period.label,
    periodEnd: desk.period.end,
    games: desk.games,
    score: desk.score,
    winningRun: desk.longestWinStreak,
    checkmateWins: desk.checkmateWins ?? undefined,
    pools,
    strongFinish,
  };
  return { ...base, moment: deriveMomentFact(base) };
}

export function buildUniverseBoards(participants: UniverseParticipant[]): UniverseBoard[] {
  const field = validParticipants(participants);
  const definitions = new Map(UNIVERSE_CATEGORY_DEFINITIONS.map((definition) => [definition.id, definition]));
  const ratingClimb = definitions.get("rating-climb")!;
  const ratingRecovery = definitions.get("rating-recovery")!;
  const bestUpset = definitions.get("best-upset")!;
  const breakthrough = definitions.get("breakthrough-desk")!;

  const boards: UniverseBoard[] = [
    ...poolBoards(ratingClimb, field, (participant, pool) => {
      const change = recordedChange(pool);
      return pool.games >= MIN_RATING_GAMES && change !== undefined && change > 0
        ? entry(participant, change, participant.score, `+${change}`, `${pool.games} ${titleCasePool(pool.pool)} games; recorded movement +${change}.`)
        : undefined;
    }, `At least ${MIN_RATING_GAMES} games; positive recorded boundary movement.`),
    {
      key: "winning-run:all",
      categoryId: "winning-run",
      title: definitions.get("winning-run")!.title,
      description: definitions.get("winning-run")!.description,
      minimumLabel: "At least three games; two or more consecutive wins.",
      entries: ranked(field.flatMap((participant) => participant.games >= 3 && (participant.winningRun ?? 0) >= 2
        ? [entry(participant, participant.winningRun!, participant.score, `${participant.winningRun} straight`, `${participant.winningRun} verified consecutive wins.`)]
        : [])),
    },
    ...poolBoards(ratingRecovery, field, (participant, pool) => {
      const recovery = pool.end !== undefined && pool.low !== undefined ? pool.end - pool.low : undefined;
      return pool.games >= MIN_RATING_GAMES && recovery !== undefined && recovery > 0
        ? entry(participant, recovery, participant.score, `+${recovery} from low`, `Finished ${recovery} points above the recorded ${titleCasePool(pool.pool)} low.`)
        : undefined;
    }, `At least ${MIN_RATING_GAMES} games with exact low and finishing boundaries.`),
    {
      key: "strong-finish:all",
      categoryId: "strong-finish",
      title: definitions.get("strong-finish")!.title,
      description: definitions.get("strong-finish")!.description,
      minimumLabel: `Final active day: at least ${MIN_STRONG_FINISH_GAMES} games and a score above 50%.`,
      entries: ranked(field.flatMap((participant) => {
        if (!participant.strongFinish || participant.strongFinish.games < MIN_STRONG_FINISH_GAMES) return [];
        const finishScore = scorePercent(participant.strongFinish);
        return finishScore > 50
          ? [entry(participant, finishScore, participant.strongFinish.games, `${finishScore.toFixed(0)}% · ${record(participant.strongFinish)}`, `Final active day across ${participant.strongFinish.games} games.`)]
          : [];
      })),
    },
    {
      key: "rapid-rating-leader:rapid",
      categoryId: "rapid-rating-leader",
      title: definitions.get("rapid-rating-leader")!.title,
      description: definitions.get("rapid-rating-leader")!.description,
      scopeLabel: "Rapid",
      minimumLabel: `At least ${MIN_RATING_LEADER_GAMES} Rapid games and an exact finishing boundary.`,
      entries: ranked(field.flatMap((participant) => {
        const pool = participant.pools.find((item) => item.pool === "rapid");
        return pool && pool.games >= MIN_RATING_LEADER_GAMES && pool.end !== undefined
          ? [entry(participant, pool.end, pool.games, `${pool.end}`, `Recorded Rapid finish after ${pool.games} games.`)]
          : [];
      })),
    },
    ...poolBoards(bestUpset, field, (participant, pool) => {
      const upset = participant.bestUpset;
      return upset?.pool === pool.pool && upset.ratingGap > 0
        ? entry(participant, upset.ratingGap, participant.score, `+${upset.ratingGap} gap`, `Verified ${titleCasePool(upset.pool)} win${upset.opponentLabel ? ` over ${upset.opponentLabel}` : ""}.`)
        : undefined;
    }, "Exact player and opponent pre-game ratings required."),
    ...poolBoards(breakthrough, field, (participant, pool) => {
      const change = recordedChange(pool);
      return pool.games >= MIN_RATING_GAMES && participant.score >= 50 && change !== undefined && change >= 25
        ? entry(participant, change, participant.score, `+${change} · ${participant.score.toFixed(1)}%`, `${pool.games} ${titleCasePool(pool.pool)} games with a positive score and +${change} recorded movement.`)
        : undefined;
    }, `At least ${MIN_RATING_GAMES} pool games, 50% score or better, and +25 rating.`),
    {
      key: "moment-of-the-week:all",
      categoryId: "moment-of-the-week",
      title: definitions.get("moment-of-the-week")!.title,
      description: definitions.get("moment-of-the-week")!.description,
      minimumLabel: "One qualifying positive streak, climb, finish or checkmate fact.",
      entries: ranked(field.flatMap((participant) => participant.moment
        ? [entry(participant, participant.moment.value, participant.score, participant.moment.valueLabel, participant.moment.evidence)]
        : [])),
    },
  ];
  return boards.filter((board) => board.entries.length > 0);
}

export function buildUniverseCategoryGroups(participants: UniverseParticipant[]): UniverseCategoryGroup[] {
  const boards = buildUniverseBoards(participants);
  return UNIVERSE_CATEGORY_DEFINITIONS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    description: definition.description,
    boards: boards.filter((board) => board.categoryId === definition.id),
    emptyMessage: definition.emptyMessage,
  }));
}

function standingLabel(rank: number, denominator: number): DeskUniverseStanding["label"] | undefined {
  if (denominator < FIELD_SIGNIFICANCE_MINIMUM) return undefined;
  if (rank <= 3) return "PODIUM";
  if (denominator >= 10 && rank <= 10) return "TOP 10";
  if (denominator >= 4 && rank / denominator <= 0.25) return "TOP 25%";
  return "IN THE HUNT";
}

function standingsFor(boards: UniverseBoard[], participantId: string): DeskUniverseStanding[] {
  return boards.flatMap((board) => {
    const index = board.entries.findIndex((entry) => entry.participantId === participantId);
    if (index < 0) return [];
    const item = board.entries[index];
    const denominator = board.entries.length;
    return [{
      categoryId: board.categoryId,
      categoryTitle: board.title,
      scopeLabel: board.scopeLabel,
      rank: item.rank,
      denominator,
      percentile: denominator >= 4 ? Math.round(((denominator - item.rank + 1) / denominator) * 100) : undefined,
      label: standingLabel(item.rank, denominator),
      valueLabel: item.valueLabel,
      nearestAbove: index > 0 ? {
        player: board.entries[index - 1].player,
        valueLabel: board.entries[index - 1].valueLabel,
      } : undefined,
    } satisfies DeskUniverseStanding];
  });
}

function learningLeaders(
  boards: UniverseBoard[],
  participant: UniverseParticipant,
): UniverseLearningLeader[] {
  const relevantPools = new Set(participant.pools.map((pool) => titleCasePool(pool.pool)));
  const direct = boards.filter((board) => board.entries.some((item) => item.participantId === participant.id));
  const adjacent = boards.filter((board) => !direct.includes(board) && (!board.scopeLabel || relevantPools.has(board.scopeLabel)));
  const seenCategories = new Set<UniverseCategoryId>();
  const seenPlayers = new Set<string>();
  const leaders: UniverseLearningLeader[] = [];
  for (const board of [...direct, ...adjacent]) {
    if (seenCategories.has(board.categoryId)) continue;
    const leader = board.entries.find((item) => item.participantId !== participant.id && item.coverageHref && item.coverageHeadline);
    if (!leader || seenPlayers.has(leader.player.toLowerCase())) continue;
    seenCategories.add(board.categoryId);
    seenPlayers.add(leader.player.toLowerCase());
    leaders.push({
      categoryId: board.categoryId,
      categoryTitle: board.title,
      scopeLabel: board.scopeLabel,
      player: leader.player,
      valueLabel: leader.valueLabel,
      coverageHref: leader.coverageHref!,
      coverageHeadline: leader.coverageHeadline!,
    });
    if (leaders.length === 3) break;
  }
  return leaders;
}

export function buildPlayerUniverseView(
  foundingParticipants: UniverseParticipant[],
  desk: BoardSignalDesk,
): PlayerUniverseView | undefined {
  const current = deskToUniverseParticipant(desk);
  if (!current || current.source !== "live") return undefined;
  const field = [
    ...foundingParticipants.filter((participant) => participant.player.toLowerCase() !== current.player.toLowerCase()),
    current,
  ];
  const boards = buildUniverseBoards(field);
  return {
    fieldLabel: "FOUNDING BETA FIELD",
    fieldDescription: "Based on the approved BoardSignal Reviews currently represented.",
    participantId: current.id,
    groups: buildUniverseCategoryGroups(field),
    standings: standingsFor(boards, current.id),
    learningLeaders: learningLeaders(boards, current),
  };
}

function signalCanCarry(signal: BoardSignalDesk["signals"]["blue"]) {
  return signal.status !== "withheld" && Boolean(signal.title.trim()) && !/reviewing|preparing|withheld/i.test(`${signal.label} ${signal.title}`);
}

export function buildDeskReturnLoop(
  previousDesk: BoardSignalDesk,
  universeStanding: DeskUniverseStanding[] = [],
): DeskReturnLoop {
  return {
    previousBlue: signalCanCarry(previousDesk.signals.blue) ? {
      title: previousDesk.signals.blue.title,
      copy: previousDesk.signals.blue.copy,
      sourcePeriod: previousDesk.period.label,
    } : undefined,
    amberWatch: signalCanCarry(previousDesk.signals.amber) ? {
      title: previousDesk.signals.amber.title,
      copy: previousDesk.signals.amber.copy,
      sourcePeriod: previousDesk.period.label,
    } : undefined,
    nextDeskDueAt: previousDesk.cadence?.nextAvailableOn,
    universeStanding,
  };
}

export function publicTopThree(board: UniverseBoard) {
  return board.entries.slice(0, 3);
}
