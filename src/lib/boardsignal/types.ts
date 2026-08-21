export type DeskSignal = {
  label: string;
  title: string;
  copy: string;
  status?: "supported" | "withheld";
  evidenceIds?: string[];
};

export type DeskCandidate = {
  id: string;
  gameId?: string;
  gameUrl: string;
  opponent: string;
  playerColor: "white" | "black";
  result: "win" | "loss" | "draw";
  reason: string;
  role?: "strength" | "correction";
  kind?: "player-move" | "resignation" | "timeout" | "final-position";
  motif?: "forcing-reply" | "queen-safety" | "king-safety" | "material" | "clock" | "resignation" | "general";
  moveNumber?: number;
  movePlayed?: string;
  movePlayedUci?: string;
  opponentReply?: string;
  fenBefore?: string;
  fenAfter?: string;
  fen?: string;
  heuristicScore?: number;
  reconstruction: "legal" | "unavailable";
};

export type EngineDiagnosticCode =
  | "ENGINE_UNSUPPORTED"
  | "ENGINE_ASSET_404"
  | "ENGINE_WORKER_START_FAILED"
  | "ENGINE_WASM_LOAD_FAILED"
  | "ENGINE_UCI_TIMEOUT"
  | "ENGINE_POSITION_TIMEOUT"
  | "ENGINE_RUNTIME_ERROR";

export type EngineDiagnostic = {
  code: EngineDiagnosticCode;
  stage: "capability" | "asset" | "worker" | "uci" | "ready" | "position" | "runtime";
  consumerMessage: string;
  detail?: string;
  assetUrl?: string;
  eventMessage?: string;
  filename?: string;
  lineno?: number;
  workerSupported: boolean;
  webAssemblySupported: boolean;
  crossOriginIsolated: boolean;
  userAgentCategory: "android" | "ios" | "mobile" | "desktop" | "unknown";
  attempt: number;
  timestamp: string;
};

export type DeskEngineResult = {
  id: string;
  depth: number;
  status?: "complete" | "failed";
  failureReason?: string;
  failureCode?: EngineDiagnosticCode;
  diagnostic?: EngineDiagnostic;
  beforeCp?: number;
  beforeMate?: number;
  afterCp?: number;
  afterMate?: number;
  bestMove?: string;
  bestMoveSan?: string;
  evaluationLossCp?: number;
  classification?: "major-miss" | "mistake" | "playable-resignation" | "sound-resignation" | "clock-opportunity" | "clock-lost" | "supported";
};

export type DeskDay = {
  date: string;
  label: string;
  wins: number;
  losses: number;
  draws: number;
  games?: number;
  primaryPool?: string;
  firstRecordedRating?: number;
  lastRecordedRating?: number;
  ratingChange?: number;
};

export type DeskPool = {
  pool: string;
  games: number;
  record: string;
  wins?: number;
  draws?: number;
  losses?: number;
  firstRecordedRating?: number;
  lastRecordedRating?: number;
  change?: number;
  peak?: number;
  low?: number;
};

export type DeskSession = {
  id: string;
  startTime: string;
  endTime: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
};

export type DeskWeekShape =
  | "STRONG_UPWARD_WEEK"
  | "EARLY_SURGE_LATE_SLIDE"
  | "RECOVERY_WEEK"
  | "VOLATILE_WEEK"
  | "CONTROLLED_PROGRESS"
  | "ROUGH_WEEK_STRONG_FINISH"
  | "STRONG_START_COLLAPSE"
  | "FLAT_MIXED_WEEK";

export type DeskReplay = {
  shape: DeskWeekShape;
  title: string;
  narrative: string;
  start: string;
  turningPoint?: string;
  finish: string;
};

export type DeskSource = "seed" | "fixture" | "live";

export type DeskCarrySignal = {
  title: string;
  copy: string;
  sourcePeriod: string;
};

export type DeskUniverseStanding = {
  categoryId: string;
  categoryTitle: string;
  scopeLabel?: string;
  rank: number;
  denominator: number;
  percentile?: number;
  label?: "PODIUM" | "TOP 10" | "TOP 25%" | "IN THE HUNT";
  valueLabel: string;
  nearestAbove?: {
    player: string;
    valueLabel: string;
  };
};

export type DeskReturnLoop = {
  previousBlue?: DeskCarrySignal;
  amberWatch?: DeskCarrySignal;
  nextDeskDueAt?: string;
  universeStanding?: DeskUniverseStanding[];
};

export type ResolvedPlayer = {
  requestedUsername: string;
  username: string;
  playerId?: number;
  avatar?: string;
  profileUrl?: string;
};

export type BoardSignalDesk = {
  source: DeskSource;
  provenance: {
    verified: boolean;
    sourceLabel: string;
    reportId?: string;
    fixtureId?: string;
  };
  player: {
    requestedUsername: string;
    username: string;
    playerId?: number;
    avatar?: string;
    profileUrl?: string;
  };
  period: {
    start: string;
    end: string;
    label: string;
    isLastActive: boolean;
    latestCompletedLabel: string;
  };
  episodeKey?: string;
  cadence?: {
    anchorStart: string;
    nextStart: string;
    nextEnd: string;
    nextAvailableOn: string;
  };
  games: number;
  wins: number;
  losses: number;
  draws: number;
  score: number;
  headline: string;
  summary: string;
  replay?: DeskReplay;
  longestWinStreak: number;
  longestLossStreak: number;
  sessions: number | null;
  sessionDetails?: DeskSession[];
  checkmateWins: number | null;
  timeoutLosses: number | null;
  resignationLosses: number | null;
  primaryPool: string;
  days: DeskDay[];
  pools: DeskPool[];
  openings: Array<{ name: string; games: number }>;
  colorRecords?: {
    white: { games: number; wins: number; draws: number; losses: number; record: string };
    black: { games: number; wins: number; draws: number; losses: number; record: string };
  };
  gameLength?: {
    averageMoves: number;
    medianMoves: number;
    shortestMoves: number;
    longestMoves: number;
  };
  terminations?: Array<{ type: string; games: number }>;
  clockEvidence?: { gamesWithClockData: number; totalGames: number };
  strengths?: {
    forcingAdvancedPawnGames: number;
    promotionGames: number;
    passedPawnConversionGames?: number;
  };
  opponentBands?: Array<{
    pool: string;
    label: string;
    games: number;
    wins: number;
    draws: number;
    losses: number;
    score: number;
  }>;
  turningPoint?: {
    title: string;
    copy: string;
  };
  pocketCard?: string;
  validation?: {
    gamesRetrieved?: number;
    gamesIncluded?: number;
    gamesExcluded?: number;
    duplicateGames?: number;
    malformedGames?: number;
    gamesReceived: number;
    gamesReconstructed: number;
    candidatePositions: number;
    engineSucceeded?: number;
    engineFailed?: number;
    rulesVersion: string;
  };
  signals: {
    green: DeskSignal;
    amber: DeskSignal;
    red: DeskSignal;
    blue: DeskSignal;
  };
  candidates: DeskCandidate[];
  caveats: string[];
  returnLoop?: DeskReturnLoop;
};

export type DeskApiResponse =
  | { ok: true; desk: BoardSignalDesk }
  | { ok: false; error: string; code: string };
