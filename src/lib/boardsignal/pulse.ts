import type { CurrentEpisodeSummary } from "./memory";
import type { BoardSignalDesk, DeskUniverseStanding } from "./types";
import {
  UNIVERSE_CATEGORY_DEFINITIONS,
  buildUniverseBoards,
  deskToUniverseParticipant,
  type UniverseBoard,
  type UniverseCategoryId,
  type UniverseCategoryGroup,
  type UniverseEntry,
  type UniverseParticipant,
  type UniverseRatingPool,
} from "./universe";

export const LIVE_FIELD_THRESHOLD = 6;
export const HOT_EVENT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const PULSE_EVENT_RETENTION_MS = 28 * 24 * 60 * 60 * 1000;

export type UniverseFieldLabel = "FOUNDING BETA FIELD" | "BOARDSIGNAL FIELD";

export type PulseUniverseBoard = UniverseBoard & {
  fieldLabel: UniverseFieldLabel;
  comparableLivePlayers: number;
};

export type PulseUniverseGroup = Omit<UniverseCategoryGroup, "boards"> & {
  boards: PulseUniverseBoard[];
};

export type UniverseEventType =
  | "new_player"
  | "first_desk"
  | "desk_completed"
  | "new_leader"
  | "entered_top3"
  | "podium_move"
  | "rank_move"
  | "rating_climb"
  | "rating_recovery"
  | "winning_run"
  | "strong_finish"
  | "breakthrough"
  | "best_upset"
  | "moment_of_the_week"
  | "player_to_watch";

export type PublicUniverseEvent = {
  eventId: string;
  eventType: UniverseEventType;
  playerId: string;
  canonicalUsername: string;
  avatar?: string;
  deskKey?: string;
  episodeKey?: string;
  pool?: UniverseRatingPool;
  categoryId?: UniverseCategoryId;
  occurredAt: string;
  publishedAt: string;
  previousValue?: number;
  currentValue?: number;
  rankBefore?: number;
  rankAfter?: number;
  headline: string;
  supportingFact: string;
  dataMode: "live";
  finality: "official" | "provisional";
  safePublic: true;
  featured?: boolean;
  homepageLead?: boolean;
  hidden?: boolean;
};

export type SafeShareMoment = {
  id: string;
  playerId: string;
  canonicalUsername: string;
  avatar?: string;
  deskKey: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  pool?: UniverseRatingPool;
  headline: string;
  supportingFact: string;
  statLabel: string;
  statValue: string;
  categoryId: UniverseCategoryId | "checkmate-finish";
  createdAt: string;
  dataMode: "live";
  safePublic: true;
};

export type PulseStandingSnapshot = {
  key: string;
  categoryId: string;
  categoryTitle: string;
  scopeLabel?: string;
  rank: number;
  denominator: number;
  value: number;
  valueLabel: string;
};

export type PlayerPulseSnapshot = {
  viewedAt: string;
  currentEpisode?: CurrentEpisodeSummary;
  standings: PulseStandingSnapshot[];
};

export type PlayerPulseCard = {
  id: string;
  kind: "since-away" | "board-moved" | "in-reach" | "on-radar" | "field-moved" | "provisional";
  eyebrow: string;
  title: string;
  body: string;
  facts?: string[];
  categoryId?: string;
  pool?: string;
  finality: "official" | "provisional";
};

export type PlayerPulse = {
  checkedAt: string;
  sinceAway?: PlayerPulseCard;
  boardMoved: PlayerPulseCard[];
  proximity: PlayerPulseCard[];
  provisional: PlayerPulseCard[];
  fieldMoved: PublicUniverseEvent[];
  whatsHot: PublicUniverseEvent[];
  groups: PulseUniverseGroup[];
  standings: DeskUniverseStanding[];
  fieldLabels: UniverseFieldLabel[];
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function dedupeBoardEntries(board: UniverseBoard): UniverseBoard {
  const seen = new Set<string>();
  const entries = board.entries.filter((entry) => {
    const key = entry.stablePlayerId ? `player:${entry.stablePlayerId}` : normalizeUsername(entry.player);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((entry, index) => ({ ...entry, rank: index + 1 }));
  return { ...board, entries };
}

function boardMap(participants: UniverseParticipant[]) {
  return new Map(buildUniverseBoards(participants).map((board) => [board.key, dedupeBoardEntries(board)]));
}

/**
 * Adapter around the locked deterministic Universe ranking. It does not change
 * category metrics or ordering. It only controls which comparison population
 * is eligible for each category/pool and prevents one player's four active
 * Desks from taking multiple positions on the same board.
 */
export function buildActiveUniverseBoards(
  liveParticipants: UniverseParticipant[],
  seedParticipants: UniverseParticipant[],
  transitionLiveParticipants: UniverseParticipant[] = liveParticipants,
): PulseUniverseBoard[] {
  const live = liveParticipants.filter((participant) => participant.source === "live" && participant.verified);
  const transitionLive = transitionLiveParticipants.filter((participant) => participant.source === "live" && participant.verified);
  const liveNames = new Set(live.flatMap((participant) => [participant.player, ...(participant.aliases ?? [])]).map(normalizeUsername));
  const seeds = seedParticipants.filter((participant) => (
    participant.source === "seed"
    && participant.verified
    && !liveNames.has(normalizeUsername(participant.player))
  ));

  const liveByBoard = boardMap(live);
  const transitionByBoard = boardMap(transitionLive);
  const combinedByBoard = boardMap([...live, ...seeds]);
  const keys = new Set([...combinedByBoard.keys(), ...liveByBoard.keys()]);

  return [...keys].sort().flatMap((key) => {
    const liveBoard = liveByBoard.get(key);
    const combinedBoard = combinedByBoard.get(key);
    const comparableLivePlayers = transitionByBoard.get(key)?.entries.length ?? 0;
    const transitioned = comparableLivePlayers >= LIVE_FIELD_THRESHOLD;
    const selected = transitioned ? liveBoard : combinedBoard;
    if (!selected?.entries.length) return [];
    return [{
      ...selected,
      fieldLabel: transitioned ? "BOARDSIGNAL FIELD" : "FOUNDING BETA FIELD",
      comparableLivePlayers,
    } satisfies PulseUniverseBoard];
  });
}

export function buildPulseUniverseGroups(boards: PulseUniverseBoard[]): PulseUniverseGroup[] {
  return UNIVERSE_CATEGORY_DEFINITIONS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    description: definition.description,
    boards: boards.filter((board) => board.categoryId === definition.id),
    emptyMessage: definition.emptyMessage,
  }));
}

function standingLabel(rank: number, denominator: number): DeskUniverseStanding["label"] | undefined {
  if (denominator < 3) return undefined;
  if (rank <= 3) return "PODIUM";
  if (denominator >= 10 && rank <= 10) return "TOP 10";
  if (denominator >= 4 && rank / denominator <= 0.25) return "TOP 25%";
  return "IN THE HUNT";
}

export function standingsFromActiveBoards(boards: PulseUniverseBoard[], participantId: string): DeskUniverseStanding[] {
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

export function standingSnapshots(boards: PulseUniverseBoard[], participantId: string): PulseStandingSnapshot[] {
  return boards.flatMap((board) => {
    const item = board.entries.find((entry) => entry.participantId === participantId);
    if (!item) return [];
    return [{
      key: board.key,
      categoryId: board.categoryId,
      categoryTitle: board.title,
      scopeLabel: board.scopeLabel,
      rank: item.rank,
      denominator: board.entries.length,
      value: item.value,
      valueLabel: item.valueLabel,
    } satisfies PulseStandingSnapshot];
  });
}

export function deriveCurrentEpisodeDelta(
  previous: CurrentEpisodeSummary | undefined,
  current: CurrentEpisodeSummary | undefined,
): PlayerPulseCard | undefined {
  if (!previous || !current) return undefined;
  if (previous.periodStart !== current.periodStart || previous.periodEnd !== current.periodEnd) return undefined;

  const newGames = current.games - previous.games;
  const winDelta = current.wins - previous.wins;
  const drawDelta = current.draws - previous.draws;
  const lossDelta = current.losses - previous.losses;
  const sessionDelta = current.sessions - previous.sessions;
  const facts: string[] = [];

  if (newGames > 0) facts.push(`${newGames} game${newGames === 1 ? "" : "s"} entered this episode.`);
  if (newGames > 0 && (winDelta || drawDelta || lossDelta)) facts.push(`${winDelta}W · ${drawDelta}D · ${lossDelta}L since your last visit.`);
  if (sessionDelta > 0) facts.push(`${sessionDelta} new session${sessionDelta === 1 ? "" : "s"} recorded.`);
  if (current.daysComplete !== previous.daysComplete) facts.push(`Episode day ${current.daysComplete} of 7.`);
  if (current.currentWinRun > previous.currentWinRun && current.currentWinRun >= 2) facts.push(`Your current winning run reached ${current.currentWinRun}.`);
  if (current.currentLossRun > previous.currentLossRun && current.currentLossRun >= 2) facts.push(`Your current losing run reached ${current.currentLossRun}.`);

  const previousPools = new Map(previous.pools.map((pool) => [pool.pool.toLowerCase(), pool]));
  for (const pool of current.pools) {
    const before = previousPools.get(pool.pool.toLowerCase());
    if (!before) continue;
    const ratingMovement = pool.ratingEnd !== undefined && before.ratingEnd !== undefined
      ? pool.ratingEnd - before.ratingEnd
      : pool.ratingDelta !== undefined && before.ratingDelta !== undefined
        ? pool.ratingDelta - before.ratingDelta
        : undefined;
    if (ratingMovement) facts.push(`${pool.pool} moved ${ratingMovement > 0 ? "+" : ""}${ratingMovement}.`);
  }

  if (!facts.length) return undefined;
  return {
    id: `since-away:${current.periodStart}:${current.checkedAt}`,
    kind: "since-away",
    eyebrow: "SINCE YOU WERE AWAY",
    title: newGames > 0 ? `${newGames} new game${newGames === 1 ? "" : "s"} changed the forming episode.` : "Your forming episode moved.",
    body: "Latest available Chess.com data since your previous Player Room visit.",
    facts,
    finality: "provisional",
  };
}

export function deriveBoardMovement(
  previous: PulseStandingSnapshot[],
  current: PulseStandingSnapshot[],
): PlayerPulseCard[] {
  const before = new Map(previous.map((standing) => [standing.key, standing]));
  return current.flatMap((standing) => {
    const old = before.get(standing.key);
    if (!old || old.rank === standing.rank) return [];
    const improved = standing.rank < old.rank;
    const podium = standing.rank <= 3 && old.rank > 3;
    return [{
      id: `board-moved:${standing.key}:${old.rank}:${standing.rank}`,
      kind: "board-moved",
      eyebrow: "YOUR BOARD MOVED",
      title: `${standing.categoryTitle}${standing.scopeLabel ? ` · ${standing.scopeLabel}` : ""}`,
      body: podium
        ? `#${old.rank} → #${standing.rank}. You entered the podium.`
        : `#${old.rank} → #${standing.rank}. ${improved ? "You moved up the official field." : "A newer completed Review changed the official field around you."}`,
      categoryId: standing.categoryId,
      pool: standing.scopeLabel,
      finality: "official",
    } satisfies PlayerPulseCard];
  });
}

function reachableGap(board: PulseUniverseBoard, current: UniverseEntry, target: UniverseEntry) {
  const gap = Math.max(0, target.value - current.value);
  if (gap <= 0) return undefined;
  if (board.categoryId === "winning-run") return gap <= 2 ? `${gap === 1 ? "One more win" : `${Math.ceil(gap)} more wins`} would match ${target.player}.` : undefined;
  if (["rating-climb", "rating-recovery", "breakthrough-desk"].includes(board.categoryId)) return gap <= 25 ? `${Math.ceil(gap)} more points would match ${target.player}.` : undefined;
  if (board.categoryId === "rapid-rating-leader") return gap <= 75 ? `${Math.ceil(gap)} Rapid points separate you from ${target.player}.` : undefined;
  if (board.categoryId === "strong-finish") return gap <= 15 ? `${gap.toFixed(1)} percentage points separate the finishing samples.` : undefined;
  if (board.categoryId === "best-upset") return gap <= 75 ? `${Math.ceil(gap)} rating-gap points separate the upset marks.` : undefined;
  return undefined;
}

export function deriveProximityCards(boards: PulseUniverseBoard[], participantId: string): PlayerPulseCard[] {
  const cards: PlayerPulseCard[] = [];
  for (const board of boards) {
    const index = board.entries.findIndex((entry) => entry.participantId === participantId);
    if (index < 0) continue;
    const current = board.entries[index];
    const above = index > 0 ? board.entries[index - 1] : undefined;
    if (above) {
      const gap = reachableGap(board, current, above);
      if (gap) cards.push({
        id: `in-reach:${board.key}:${above.participantId}`,
        kind: "in-reach",
        eyebrow: "IN REACH",
        title: `${board.title}${board.scopeLabel ? ` · ${board.scopeLabel}` : ""}`,
        body: `${gap} Current official positions: you #${current.rank}, ${above.player} #${above.rank}.`,
        categoryId: board.categoryId,
        pool: board.scopeLabel,
        finality: "official",
      });
    }
    const below = board.entries[index + 1];
    if (below) {
      const gap = reachableGap(board, below, current);
      if (gap) cards.push({
        id: `on-radar:${board.key}:${below.participantId}`,
        kind: "on-radar",
        eyebrow: "ON YOUR RADAR",
        title: `${below.player} is close in ${board.title}${board.scopeLabel ? ` · ${board.scopeLabel}` : ""}.`,
        body: `You are #${current.rank}; ${below.player} is #${below.rank}. ${gap}`,
        categoryId: board.categoryId,
        pool: board.scopeLabel,
        finality: "official",
      });
    }
  }
  return cards.slice(0, 4);
}

function normalizePool(pool: string): UniverseRatingPool | undefined {
  const normalized = pool.trim().toLowerCase();
  if (normalized.includes("bullet")) return "bullet";
  if (normalized.includes("blitz")) return "blitz";
  if (normalized.includes("rapid") || /^\d+\+\d+$/.test(normalized)) return "rapid";
  return undefined;
}

export function currentEpisodeToProvisionalParticipant(
  username: string,
  playerId: string,
  current: CurrentEpisodeSummary,
): UniverseParticipant {
  return {
    id: `provisional:${playerId}`,
    stablePlayerId: playerId,
    player: username,
    source: "live",
    verified: true,
    periodLabel: current.periodLabel,
    periodEnd: current.periodEnd,
    games: current.games,
    score: current.games ? ((current.wins + current.draws / 2) / current.games) * 100 : 0,
    winningRun: current.currentWinRun,
    pools: current.pools.flatMap((pool) => {
      const normalized = normalizePool(pool.pool);
      if (!normalized) return [];
      return [{
        pool: normalized,
        games: pool.games,
        start: pool.ratingStart,
        end: pool.ratingEnd,
        change: pool.ratingDelta,
      }];
    }),
  };
}

export function deriveProvisionalCards(
  boards: PulseUniverseBoard[],
  provisionalParticipantId: string,
): PlayerPulseCard[] {
  return boards.flatMap((board) => {
    const item = board.entries.find((entry) => entry.participantId === provisionalParticipantId);
    if (!item || item.rank > 5) return [];
    return [{
      id: `provisional:${board.key}:${item.rank}`,
      kind: "provisional",
      eyebrow: item.rank <= 3 ? "IF THE FIELD HELD" : "ON CURRENT PACE",
      title: `${board.title}${board.scopeLabel ? ` · ${board.scopeLabel}` : ""}`,
      body: `PROVISIONAL · Your forming episode would place #${item.rank} of ${board.entries.length} on the current field if it closed with these supported facts. Official standing changes only after the completed Review publishes.`,
      categoryId: board.categoryId,
      pool: board.scopeLabel,
      finality: "provisional",
    } satisfies PlayerPulseCard];
  }).slice(0, 3);
}

function eventAgeMs(event: PublicUniverseEvent, now: Date) {
  return Math.max(0, now.getTime() - Date.parse(event.publishedAt || event.occurredAt));
}

export function universeHotnessScore(event: PublicUniverseEvent, now = new Date()) {
  const age = eventAgeMs(event, now);
  if (!Number.isFinite(age) || age > HOT_EVENT_LIFETIME_MS) return -Infinity;
  const recency = Math.max(0, 100 - (age / HOT_EVENT_LIFETIME_MS) * 100);
  const magnitude = Math.min(60, Math.abs((event.currentValue ?? 0) - (event.previousValue ?? 0)));
  const rankImpact = event.rankAfter
    ? event.rankAfter === 1 ? 45 : event.rankAfter <= 3 ? 32 : event.rankBefore && event.rankAfter < event.rankBefore ? 20 : 8
    : 0;
  const novelty: Record<UniverseEventType, number> = {
    new_player: 20,
    first_desk: 34,
    desk_completed: 8,
    new_leader: 50,
    entered_top3: 42,
    podium_move: 34,
    rank_move: 20,
    rating_climb: 24,
    rating_recovery: 24,
    winning_run: 26,
    strong_finish: 24,
    breakthrough: 30,
    best_upset: 28,
    moment_of_the_week: 30,
    player_to_watch: 24,
  };
  return recency + magnitude + rankImpact + novelty[event.eventType];
}

export function rankWhatsHot(events: PublicUniverseEvent[], now = new Date(), limit = 8) {
  const eligible = events
    .filter((event) => event.safePublic === true && event.hidden !== true && event.finality === "official")
    .map((event) => ({ event, score: universeHotnessScore(event, now) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score
      || b.event.publishedAt.localeCompare(a.event.publishedAt)
      || a.event.eventId.localeCompare(b.event.eventId));

  const result: PublicUniverseEvent[] = [];
  const counts = new Map<string, number>();
  for (const { event } of eligible) {
    const key = event.playerId;
    if ((counts.get(key) ?? 0) >= 2) continue;
    result.push(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (result.length >= limit) return result;
  }

  // If the field is genuinely tiny, fill remaining slots deterministically.
  if (counts.size <= 2 && result.length < limit) {
    for (const { event } of eligible) {
      if (result.some((item) => item.eventId === event.eventId)) continue;
      result.push(event);
      if (result.length >= limit) break;
    }
  }
  return result;
}

function shareMomentId(desk: BoardSignalDesk, suffix: string) {
  return `${desk.player.playerId ?? desk.player.username.toLowerCase()}_${desk.period.end}_${suffix}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 180);
}

export function nominateShareMoments(
  desk: BoardSignalDesk,
  standings: DeskUniverseStanding[] = [],
  now = new Date(),
): SafeShareMoment[] {
  if (desk.source !== "live" || !desk.provenance.verified || !desk.player.playerId) return [];
  const candidates: Array<SafeShareMoment & { score: number }> = [];
  const base = {
    playerId: String(desk.player.playerId),
    canonicalUsername: desk.player.username,
    avatar: desk.player.avatar,
    deskKey: `${desk.player.playerId}:${desk.period.start}:${desk.period.end}`,
    periodStart: desk.period.start,
    periodEnd: desk.period.end,
    periodLabel: desk.period.label,
    createdAt: now.toISOString(),
    dataMode: "live" as const,
    safePublic: true as const,
  };

  for (const pool of desk.pools) {
    const normalized = normalizePool(pool.pool);
    const delta = pool.change ?? (pool.firstRecordedRating !== undefined && pool.lastRecordedRating !== undefined
      ? pool.lastRecordedRating - pool.firstRecordedRating
      : undefined);
    if (!normalized || pool.games < 3 || delta === undefined || delta <= 0) continue;
    candidates.push({
      ...base,
      id: shareMomentId(desk, `rating_${normalized}`),
      pool: normalized,
      headline: `${delta > 0 ? "+" : ""}${delta} ${normalized[0].toUpperCase() + normalized.slice(1)}`,
      supportingFact: `${pool.games} ${normalized} games in the completed seven-day Review produced a recorded ${delta > 0 ? "+" : ""}${delta} rating movement.`,
      statLabel: "Rating movement",
      statValue: `+${delta}`,
      categoryId: "rating-climb",
      score: 80 + Math.min(delta, 100),
    });
  }

  if (desk.longestWinStreak >= 3) {
    candidates.push({
      ...base,
      id: shareMomentId(desk, "winning_run"),
      headline: `${desk.longestWinStreak} straight wins`,
      supportingFact: `${desk.longestWinStreak} consecutive wins were recorded inside the completed seven-day Review.`,
      statLabel: "Winning run",
      statValue: `${desk.longestWinStreak} straight`,
      categoryId: "winning-run",
      score: 120 + desk.longestWinStreak,
    });
  }

  const activeDays = desk.days.filter((day) => (day.games ?? day.wins + day.draws + day.losses) > 0);
  const finalDay = activeDays.at(-1);
  if (finalDay) {
    const games = finalDay.games ?? finalDay.wins + finalDay.draws + finalDay.losses;
    const score = games ? ((finalDay.wins + finalDay.draws / 2) / games) * 100 : 0;
    if (games >= 3 && score > 50) {
      candidates.push({
        ...base,
        id: shareMomentId(desk, "strong_finish"),
        headline: `${finalDay.wins} wins from the final ${games} games`,
        supportingFact: `The final active day closed ${finalDay.wins}W · ${finalDay.draws}D · ${finalDay.losses}L.`,
        statLabel: "Strong finish",
        statValue: `${score.toFixed(0)}% score`,
        categoryId: "strong-finish",
        score: 95 + score,
      });
    }
  }

  if ((desk.checkmateWins ?? 0) >= 3) {
    candidates.push({
      ...base,
      id: shareMomentId(desk, "checkmate_finish"),
      headline: `${desk.checkmateWins} checkmate wins`,
      supportingFact: `${desk.checkmateWins} wins in the completed Review ended by checkmate.`,
      statLabel: "Checkmate finishes",
      statValue: String(desk.checkmateWins),
      categoryId: "checkmate-finish",
      score: 70 + Number(desk.checkmateWins),
    });
  }

  for (const standing of standings.filter((item) => item.rank <= 3)) {
    candidates.push({
      ...base,
      id: shareMomentId(desk, `top3_${standing.categoryId}_${standing.scopeLabel ?? "all"}`),
      headline: `#${standing.rank} ${standing.categoryTitle}${standing.scopeLabel ? ` · ${standing.scopeLabel}` : ""}`,
      supportingFact: `${standing.valueLabel} placed this completed Review #${standing.rank} of ${standing.denominator} in the current official comparison field.`,
      statLabel: standing.categoryTitle,
      statValue: `#${standing.rank}`,
      categoryId: standing.categoryId as UniverseCategoryId,
      score: 150 - standing.rank,
    });
  }

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .filter((item) => {
      const key = `${item.categoryId}:${item.pool ?? "all"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map(({ score: _score, ...moment }) => moment);
}

export function shareMomentUrl(origin: string, momentId: string) {
  return `${origin.replace(/\/$/, "")}/share/${encodeURIComponent(momentId)}`;
}

const PRIVATE_PUBLIC_KEYS = new Set([
  "uid",
  "firebaseUid",
  "preferredContactMethod",
  "preferredContactValue",
  "email",
  "discord",
  "telegram",
  "accessCode",
  "betaAccessCode",
  "red",
  "amber",
  "blue",
  "evidence",
  "engineResults",
  "recurrence",
  "privateProgress",
  "privateNotes",
]);

export function publicArtifactHasPrivateFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_PUBLIC_KEYS.has(key)) return true;
    if (publicArtifactHasPrivateFields(nested)) return true;
  }
  return false;
}

export function deskParticipantId(desk: BoardSignalDesk) {
  return deskToUniverseParticipant(desk)?.id;
}
