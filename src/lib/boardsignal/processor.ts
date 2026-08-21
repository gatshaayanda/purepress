import { Chess } from "chess.js";
import type { BoardSignalDesk, DeskCandidate, DeskDay, DeskPool, ResolvedPlayer } from "./types";
import {
  deriveActiveWeekNextGameGuidance,
  unavailableActiveWeekGuidance,
  type ActiveWeekEvidenceFact,
  type ActiveWeekGuidanceFamily,
  type ActiveWeekLatestGame,
  type ActiveWeekSupportingFact,
  type CurrentEpisodeWithNextGameGuidance,
} from "./activeWeekGuidance";

type ChessComPlayer = {
  player_id?: number;
  username: string;
  avatar?: string;
  url?: string;
};

type ChessComSide = {
  username: string;
  rating?: number;
  result: string;
};

type ChessComGame = {
  url: string;
  pgn: string;
  end_time: number;
  time_class?: string;
  rules?: string;
  white: ChessComSide;
  black: ChessComSide;
};

export type BuildLiveDeskOptions = {
  anchorStart?: string;
  referenceDate?: Date;
};

export type BuildCurrentEpisodeOptions = {
  anchorStart?: string;
  referenceDate?: Date;
  playerKey?: string;
};

const CHESS_COM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "BoardSignal/0.1 (adminhub-global.com/boardsignal)",
};

const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

const DAY_MS = 86_400_000;

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function atUtcMidnight(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function latestCompletedWeek(reference = new Date()) {
  const today = atUtcMidnight(reference);
  const day = today.getUTCDay();
  const daysBackToSunday = day === 0 ? 7 : day;
  const end = new Date(today.getTime() - daysBackToSunday * DAY_MS);
  const start = new Date(end.getTime() - 6 * DAY_MS);
  return { start, end };
}

function parseIsoDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid cadence anchor.");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function latestCompletedAlignedWeek(anchorStart: string, reference = new Date()) {
  const anchor = parseIsoDay(anchorStart);
  const today = atUtcMidnight(reference);
  const completedBlocks = Math.floor((today.getTime() - anchor.getTime()) / (7 * DAY_MS));
  if (completedBlocks < 1) {
    const end = new Date(anchor.getTime() + 6 * DAY_MS);
    throw new Error(`The first episode closes after ${isoDay(end)}.`);
  }
  const start = new Date(anchor.getTime() + (completedBlocks - 1) * 7 * DAY_MS);
  return { start, end: new Date(start.getTime() + 6 * DAY_MS) };
}

function mondayFor(timestampSeconds: number) {
  const date = atUtcMidnight(new Date(timestampSeconds * 1000));
  const day = date.getUTCDay();
  const distance = day === 0 ? 6 : day - 1;
  return new Date(date.getTime() - distance * DAY_MS);
}

function formatPeriod(start: Date, end: Date) {
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startPart = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" as const }),
    timeZone: "UTC",
  }).format(start);
  const endPart = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(end);
  return `${startPart}–${endPart}`;
}

async function chessComJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: CHESS_COM_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const error = new Error(response.status === 404 ? "Chess.com player not found." : `Chess.com returned ${response.status}.`);
    Object.assign(error, { status: response.status });
    throw error;
  }

  return response.json() as Promise<T>;
}

function archiveKey(url: string) {
  const match = url.match(/\/(\d{4})\/(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchGames(url: string): Promise<ChessComGame[]> {
  const payload = await chessComJson<{ games?: ChessComGame[] }>(url);
  return payload.games ?? [];
}

function resultFor(game: ChessComGame, username: string) {
  const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
  const player = isWhite ? game.white : game.black;
  const opponent = isWhite ? game.black : game.white;
  const result: "win" | "draw" | "loss" = player.result === "win" ? "win" : DRAW_RESULTS.has(player.result) ? "draw" : "loss";
  return { player, opponent, result, color: isWhite ? "white" as const : "black" as const };
}

function recordLabel(wins: number, losses: number, draws: number) {
  return `${wins}W · ${draws}D · ${losses}L`;
}

function streaks(games: ChessComGame[], username: string) {
  let win = 0;
  let loss = 0;
  let bestWin = 0;
  let bestLoss = 0;

  for (const game of games) {
    const result = resultFor(game, username).result;
    win = result === "win" ? win + 1 : 0;
    loss = result === "loss" ? loss + 1 : 0;
    bestWin = Math.max(bestWin, win);
    bestLoss = Math.max(bestLoss, loss);
  }

  return { bestWin, bestLoss };
}

function parseOpening(pgn: string) {
  const match = pgn.match(/^\[ECOUrl "[^"]*\/openings\/([^"]+)"\]$/m);
  if (!match) return "Unclassified";
  return match[1].replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function finalFen(pgn: string) {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    return chess.fen();
  } catch {
    return undefined;
  }
}

function moveCount(pgn: string) {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    return Math.ceil(chess.history().length / 2);
  } catch {
    return undefined;
  }
}

function hasClockData(pgn: string) {
  return /\[%clk\s+[^\]]+\]/.test(pgn);
}

function isPassedPawn(fen: string, square: string, color: "white" | "black") {
  try {
    const chess = new Chess(fen);
    const pawn = chess.get(square as Parameters<Chess["get"]>[0]);
    const colorCode = color === "white" ? "w" : "b";
    if (!pawn || pawn.type !== "p" || pawn.color !== colorCode) return false;
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]);

    for (const row of chess.board()) {
      for (const piece of row) {
        if (!piece || piece.type !== "p" || piece.color === colorCode) continue;
        const enemyFile = piece.square.charCodeAt(0) - 97;
        const enemyRank = Number(piece.square[1]);
        const blocksFile = Math.abs(enemyFile - file) <= 1;
        const isAhead = color === "white" ? enemyRank > rank : enemyRank < rank;
        if (blocksFile && isAhead) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function uci(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function gameId(game: ChessComGame) {
  return game.url.split("/").filter(Boolean).at(-1) ?? String(game.end_time);
}

function candidatePositions(game: ChessComGame, username: string): DeskCandidate[] {
  const result = resultFor(game, username);
  try {
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });
    const playerColorCode = result.color === "white" ? "w" : "b";
    const candidates: DeskCandidate[] = [];

    history.forEach((move, index) => {
      if (move.color !== playerColorCode) return;
      const reply = history[index + 1];
      if (result.result === "win") {
        const rank = Number(move.to[1]);
        const reachesSeventh = result.color === "white" ? rank === 7 : rank === 2;
        const passedBefore = move.piece === "p" && isPassedPawn(move.before, move.from, result.color);
        const passedAfter = move.piece === "p" && !move.promotion && isPassedPawn(move.after, move.to, result.color);
        const passedPawnMove = passedBefore || passedAfter;
        const captureValue = move.captured ? PIECE_VALUE[move.captured] ?? 0 : 0;
        const positiveScore = move.san.includes("#")
          ? 100
          : move.promotion
            ? 92
            : reachesSeventh && /[+#]/.test(move.san)
              ? 76
              : captureValue >= 5
                ? 58
                : 0;
        if (positiveScore) {
          candidates.push({
            id: `${gameId(game)}-${index + 1}`,
            gameId: gameId(game),
            gameUrl: game.url,
            opponent: result.opponent.username,
            playerColor: result.color,
            result: result.result,
            role: "strength",
            reason: move.san.includes("#")
              ? `${move.san} completed the attack.`
              : move.promotion && passedPawnMove
                ? `${move.san} promoted a verified passed pawn.`
                : move.promotion
                  ? `${move.san} completed a promotion.`
                  : passedPawnMove && reachesSeventh
                    ? `${move.san} advanced a verified passed pawn to the seventh rank.`
                    : `${move.san} created a forcing gain.`,
            kind: "player-move",
            motif: move.promotion || reachesSeventh ? "material" : move.san.includes("#") ? "king-safety" : "general",
            moveNumber: Math.floor(index / 2) + 1,
            movePlayed: move.san,
            movePlayedUci: uci(move),
            fenBefore: move.before,
            fenAfter: move.after,
            fen: move.before,
            heuristicScore: positiveScore,
            reconstruction: "legal",
          });
        }
        return;
      }
      let heuristicScore = result.result === "loss" ? Math.max(0, 10 - Math.floor((history.length - index) / 4)) : 0;
      let motif: NonNullable<DeskCandidate["motif"]> = "general";

      if (reply) {
        const capturedValue = reply.captured ? PIECE_VALUE[reply.captured] ?? 0 : 0;
        if (reply.san.includes("#")) {
          heuristicScore += 95;
          motif = "king-safety";
        } else if (reply.san.includes("+")) {
          heuristicScore += 28;
          motif = "forcing-reply";
        }
        if (capturedValue) {
          heuristicScore += capturedValue * 11;
          motif = move.piece === "q" || reply.captured === "q" ? "queen-safety" : "material";
        }
      }

      if (move.san.includes("?")) heuristicScore += 12;
      if (heuristicScore < 18) return;
      candidates.push({
        id: `${gameId(game)}-${index + 1}`,
        gameId: gameId(game),
        gameUrl: game.url,
        opponent: result.opponent.username,
        playerColor: result.color,
        result: result.result,
        reason: reply ? `${move.san} was followed by ${reply.san}.` : `Review ${move.san}.`,
        role: "correction",
        kind: "player-move",
        motif,
        moveNumber: Math.floor(index / 2) + 1,
        movePlayed: move.san,
        movePlayedUci: uci(move),
        opponentReply: reply?.san,
        fenBefore: move.before,
        fenAfter: move.after,
        fen: move.before,
        heuristicScore,
        reconstruction: "legal",
      });
    });

    const finalPosition = chess.fen();
    const finalKind = result.player.result === "resigned" ? "resignation" : result.player.result === "timeout" ? "timeout" : undefined;
    if (result.result === "loss" && finalKind && !chess.isGameOver()) {
      candidates.push({
        id: `${gameId(game)}-final`,
        gameId: gameId(game),
        gameUrl: game.url,
        opponent: result.opponent.username,
        playerColor: result.color,
        result: result.result,
        reason: finalKind === "resignation" ? "Final position before resignation." : "Final position before timeout.",
        role: "correction",
        kind: finalKind,
        motif: finalKind === "resignation" ? "resignation" : "clock",
        fenBefore: finalPosition,
        fen: finalPosition,
        heuristicScore: finalKind === "resignation" ? 72 : 66,
        reconstruction: "legal",
      });
    }

    return candidates;
  } catch {
    return [];
  }
}

function activeWeekFamilyForCandidate(candidate: DeskCandidate): ActiveWeekGuidanceFamily | undefined {
  if (candidate.kind === "timeout") return "clock_conversion";
  if (candidate.motif === "queen-safety") return "queen_safety";
  if (candidate.motif === "king-safety") return "king_safety";
  if (candidate.motif === "forcing-reply") return "forcing_reply";
  if (candidate.motif === "material") return "material_conversion";
  return undefined;
}

function activeWeekEvidenceForGame(game: ChessComGame, username: string): ActiveWeekEvidenceFact[] {
  const result = resultFor(game, username);
  if (result.result !== "loss") return [];
  const id = gameId(game);
  const shared = {
    gameId: id,
    gameUrl: game.url,
    occurredAt: game.end_time,
    opponent: result.opponent.username,
    opponentRating: result.opponent.rating,
    pool: game.time_class ?? "other",
  };
  const byFamily = new Map<ActiveWeekGuidanceFamily, ActiveWeekEvidenceFact>();
  const add = (fact: ActiveWeekEvidenceFact) => {
    const existing = byFamily.get(fact.family);
    if (!existing || fact.severity > existing.severity || (fact.severity === existing.severity && fact.id < existing.id)) byFamily.set(fact.family, fact);
  };

  if (result.player.result === "timeout") {
    add({
      ...shared,
      id: `${id}:timeout`,
      family: "clock_conversion",
      summary: "A current-week game ended on time.",
      severity: 100,
    });
  }

  for (const candidate of candidatePositions(game, username)) {
    if (candidate.role !== "correction") continue;
    const family = activeWeekFamilyForCandidate(candidate);
    if (!family || family === "clock_conversion") continue;
    add({
      ...shared,
      id: `${id}:${family}:${candidate.id}`,
      family,
      moveNumber: candidate.moveNumber,
      movePlayed: candidate.movePlayed,
      opponentReply: candidate.opponentReply,
      summary: candidate.reason,
      severity: Math.max(0, Math.min(100, candidate.heuristicScore ?? 0)),
    });
  }
  return [...byFamily.values()];
}

function selectCandidates(games: ChessComGame[], username: string, limit = 8) {
  const corrections = games
    .filter((game) => resultFor(game, username).result === "loss")
    .map((game) => candidatePositions(game, username).sort((a, b) => (b.heuristicScore ?? 0) - (a.heuristicScore ?? 0))[0])
    .filter((candidate): candidate is DeskCandidate => Boolean(candidate));
  const strengths = games
    .filter((game) => resultFor(game, username).result === "win")
    .map((game) => candidatePositions(game, username).sort((a, b) => (b.heuristicScore ?? 0) - (a.heuristicScore ?? 0))[0])
    .filter((candidate): candidate is DeskCandidate => Boolean(candidate));
  const selected = [
    ...corrections.sort((a, b) => (b.heuristicScore ?? 0) - (a.heuristicScore ?? 0)).slice(0, Math.min(6, limit)),
    ...strengths.sort((a, b) => (b.heuristicScore ?? 0) - (a.heuristicScore ?? 0)).slice(0, Math.max(0, limit - Math.min(6, corrections.length))),
  ].slice(0, limit);
  return selected
    .sort((a, b) => (b.heuristicScore ?? 0) - (a.heuristicScore ?? 0))
    .map((candidate, index) => ({ ...candidate, id: `P${String(index + 1).padStart(2, "0")}` }));
}

function pawnStrength(pgn: string, playerColor: "white" | "black", won: boolean) {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const color = playerColor === "white" ? "w" : "b";
    const moves = chess.history({ verbose: true }).filter((move) => move.color === color && move.piece === "p");
    const promotion = won && moves.some((move) => Boolean(move.promotion));
    const forcingAdvanced = moves.some((move) => {
      const rank = Number(move.to[1]);
      const reachesSeventh = playerColor === "white" ? rank === 7 : rank === 2;
      const passedBefore = isPassedPawn(move.before, move.from, playerColor);
      const passedAfter = !move.promotion && isPassedPawn(move.after, move.to, playerColor);
      return won && (passedBefore || passedAfter) && (Boolean(move.promotion) || (reachesSeventh && /[x+#]/.test(move.san)));
    });
    return { promotion, forcingAdvanced, passedPawnConversion: forcingAdvanced };
  } catch {
    return { promotion: false, forcingAdvanced: false, passedPawnConversion: false };
  }
}

function buildHeadline(args: {
  games: number;
  score: number;
  winStreak: number;
  timeoutLosses: number;
  losses: number;
  checkmateWins: number;
}) {
  if (args.winStreak >= 5) return `${args.winStreak} straight wins gave the week its defining run.`;
  if (args.checkmateWins >= 3) return `${args.checkmateWins} checkmate finishes became the week's positive signature.`;
  if (args.score >= 60) return `A positive ${args.games}-game week built a ${args.score.toFixed(1)}% score.`;
  if (args.score < 40) return `A difficult score still left a specific place to begin.`;
  return `${args.games} games produced a week with more than one story.`;
}

export async function resolveChessComPlayer(requestedUsername: string): Promise<ResolvedPlayer> {
  const safeUsername = requestedUsername.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_-]{2,50}$/.test(safeUsername)) throw new Error("Enter a valid Chess.com username.");
  const profile = await chessComJson<ChessComPlayer>(`https://api.chess.com/pub/player/${encodeURIComponent(safeUsername)}`);
  return {
    requestedUsername,
    username: profile.username,
    playerId: profile.player_id,
    avatar: profile.avatar,
    profileUrl: profile.url,
  };
}

export async function buildLiveDesk(requestedUsername: string, options: BuildLiveDeskOptions = {}): Promise<BoardSignalDesk> {
  const resolved = await resolveChessComPlayer(requestedUsername);
  const profile: ChessComPlayer = {
    player_id: resolved.playerId,
    username: resolved.username,
    avatar: resolved.avatar,
    url: resolved.profileUrl,
  };
  const canonical = profile.username;
  const archivesPayload = await chessComJson<{ archives?: string[] }>(`https://api.chess.com/pub/player/${encodeURIComponent(canonical)}/games/archives`);
  const archives = archivesPayload.archives ?? [];
  const archiveCache = new Map<string, Promise<ChessComGame[]>>();
  const getArchiveGames = (url: string) => {
    const existing = archiveCache.get(url);
    if (existing) return existing;
    const request = fetchGames(url);
    archiveCache.set(url, request);
    return request;
  };

  if (!archives.length) throw new Error("This Chess.com account has no public game archives yet.");

  const referenceDate = options.referenceDate ?? new Date();
  const latest = options.anchorStart
    ? latestCompletedAlignedWeek(options.anchorStart, referenceDate)
    : latestCompletedWeek(referenceDate);
  const latestCompletedLabel = formatPeriod(latest.start, latest.end);
  const latestEndSeconds = Math.floor((latest.end.getTime() + DAY_MS - 1) / 1000);
  let mostRecentCompletedGame: ChessComGame | undefined;

  for (const archive of [...archives].reverse().slice(0, 24)) {
    const games = await getArchiveGames(archive);
    mostRecentCompletedGame = games
      .filter((game) => game.end_time <= latestEndSeconds && (!game.rules || game.rules === "chess"))
      .sort((a, b) => b.end_time - a.end_time)[0];
    if (mostRecentCompletedGame) break;
  }

  if (!mostRecentCompletedGame && !options.anchorStart) throw new Error("No completed standard game was found before the latest closed week.");

  const selectedStart = options.anchorStart
    ? latest.start
    : mostRecentCompletedGame!.end_time * 1000 >= latest.start.getTime()
      ? latest.start
      : mondayFor(mostRecentCompletedGame!.end_time);
  const selectedEnd = new Date(selectedStart.getTime() + 6 * DAY_MS);
  const keys = new Set([monthKey(selectedStart), monthKey(selectedEnd)]);
  const archiveMap = new Map(archives.map((url) => [archiveKey(url), url]));
  const selectedArchives = [...keys].map((key) => archiveMap.get(key)).filter((url): url is string => Boolean(url));
  const retrievedGames = (await Promise.all(selectedArchives.map(getArchiveGames))).flat();
  const inPeriodGames = retrievedGames.filter((game) => {
      const time = game.end_time * 1000;
      return time >= selectedStart.getTime()
        && time < selectedEnd.getTime() + DAY_MS
        && (!game.rules || game.rules === "chess");
    });
  const seenGames = new Set<string>();
  const selectedGames: ChessComGame[] = [];
  let duplicateGames = 0;
  let malformedGames = 0;

  for (const game of inPeriodGames) {
    const key = game.url || `${game.end_time}:${game.white.username}:${game.black.username}`;
    if (seenGames.has(key)) {
      duplicateGames += 1;
      continue;
    }
    seenGames.add(key);
    const belongsToPlayer = game.white.username.toLowerCase() === canonical.toLowerCase()
      || game.black.username.toLowerCase() === canonical.toLowerCase();
    if (!belongsToPlayer || !game.pgn || !game.url || !finalFen(game.pgn)) {
      malformedGames += 1;
      continue;
    }
    selectedGames.push(game);
  }
  selectedGames.sort((a, b) => a.end_time - b.end_time);

  if (!selectedGames.length) {
    const error = new Error(`No games were played in the completed episode ${formatPeriod(selectedStart, selectedEnd)}.`);
    Object.assign(error, { code: "NO_ACTIVITY" });
    throw error;
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let timeoutLosses = 0;
  let resignationLosses = 0;
  let checkmateWins = 0;
  const poolMap = new Map<string, { games: ChessComGame[]; wins: number; losses: number; draws: number; ratings: number[] }>();
  const dayMap = new Map<string, DeskDay>();
  const openingMap = new Map<string, number>();
  const opponentBandMap = new Map<string, { pool: string; label: string; games: number; wins: number; draws: number; losses: number }>();
  const terminationMap = new Map<string, number>();
  const colorMap = {
    white: { games: 0, wins: 0, draws: 0, losses: 0 },
    black: { games: 0, wins: 0, draws: 0, losses: 0 },
  };
  const gameLengths: number[] = [];
  let gamesWithClockData = 0;
  let forcingAdvancedPawnGames = 0;
  let promotionGames = 0;
  let passedPawnConversionGames = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(selectedStart.getTime() + offset * DAY_MS);
    const key = isoDay(date);
    dayMap.set(key, {
      date: key,
      label: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(date),
      wins: 0,
      losses: 0,
      draws: 0,
    });
  }

  for (const game of selectedGames) {
    const result = resultFor(game, canonical);
    if (result.result === "win") wins += 1;
    if (result.result === "loss") losses += 1;
    if (result.result === "draw") draws += 1;
    if (result.result === "loss" && result.player.result === "timeout") timeoutLosses += 1;
    if (result.result === "loss" && result.player.result === "resigned") resignationLosses += 1;
    if (result.result === "win" && result.opponent.result === "checkmated") checkmateWins += 1;
    colorMap[result.color].games += 1;
    colorMap[result.color].wins += result.result === "win" ? 1 : 0;
    colorMap[result.color].draws += result.result === "draw" ? 1 : 0;
    colorMap[result.color].losses += result.result === "loss" ? 1 : 0;
    const termination = result.result === "draw"
      ? "draw"
      : result.result === "win"
        ? result.opponent.result === "checkmated" ? "checkmate" : result.opponent.result === "timeout" ? "opponent timeout" : result.opponent.result === "resigned" ? "opponent resignation" : "win"
        : result.player.result === "checkmated" ? "checkmate loss" : result.player.result === "timeout" ? "timeout" : result.player.result === "resigned" ? "resignation" : "loss";
    terminationMap.set(termination, (terminationMap.get(termination) ?? 0) + 1);
    const length = moveCount(game.pgn);
    if (length !== undefined) gameLengths.push(length);
    if (hasClockData(game.pgn)) gamesWithClockData += 1;

    const pool = game.time_class ?? "other";
    const poolItem = poolMap.get(pool) ?? { games: [], wins: 0, losses: 0, draws: 0, ratings: [] };
    poolItem.games.push(game);
    poolItem.wins += result.result === "win" ? 1 : 0;
    poolItem.losses += result.result === "loss" ? 1 : 0;
    poolItem.draws += result.result === "draw" ? 1 : 0;
    if (typeof result.player.rating === "number") poolItem.ratings.push(result.player.rating);
    poolMap.set(pool, poolItem);

    const date = isoDay(new Date(game.end_time * 1000));
    const day = dayMap.get(date) ?? {
      date,
      label: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(game.end_time * 1000)),
      wins: 0,
      losses: 0,
      draws: 0,
    };
    day.wins += result.result === "win" ? 1 : 0;
    day.losses += result.result === "loss" ? 1 : 0;
    day.draws += result.result === "draw" ? 1 : 0;
    dayMap.set(date, day);

    const opening = parseOpening(game.pgn);
    openingMap.set(opening, (openingMap.get(opening) ?? 0) + 1);

    const pawn = pawnStrength(game.pgn, result.color, result.result === "win");
    if (pawn.forcingAdvanced) forcingAdvancedPawnGames += 1;
    if (pawn.promotion) promotionGames += 1;
    if (pawn.passedPawnConversion) passedPawnConversionGames += 1;

    if (typeof result.opponent.rating === "number") {
      const lower = Math.floor(result.opponent.rating / 100) * 100;
      const label = `${lower}–${lower + 99}`;
      const key = `${pool}:${label}`;
      const band = opponentBandMap.get(key) ?? { pool, label, games: 0, wins: 0, draws: 0, losses: 0 };
      band.games += 1;
      band.wins += result.result === "win" ? 1 : 0;
      band.draws += result.result === "draw" ? 1 : 0;
      band.losses += result.result === "loss" ? 1 : 0;
      opponentBandMap.set(key, band);
    }
  }

  const pools: DeskPool[] = [...poolMap.entries()]
    .map(([pool, item]) => ({
      pool,
      games: item.games.length,
      record: recordLabel(item.wins, item.losses, item.draws),
      wins: item.wins,
      draws: item.draws,
      losses: item.losses,
      firstRecordedRating: item.ratings[0],
      lastRecordedRating: item.ratings.at(-1),
      change: item.ratings.length ? item.ratings.at(-1)! - item.ratings[0] : undefined,
      peak: item.ratings.length ? Math.max(...item.ratings) : undefined,
      low: item.ratings.length ? Math.min(...item.ratings) : undefined,
    }))
    .sort((a, b) => b.games - a.games);
  const primaryPool = pools[0]?.pool ?? "chess";
  const { bestWin, bestLoss } = streaks(selectedGames, canonical);
  const score = ((wins + draws / 2) / selectedGames.length) * 100;

  for (const day of dayMap.values()) {
    const dayGames = selectedGames.filter((game) => isoDay(new Date(game.end_time * 1000)) === day.date && (game.time_class ?? "other") === primaryPool);
    const ratings = dayGames
      .map((game) => resultFor(game, canonical).player.rating)
      .filter((rating): rating is number => typeof rating === "number");
    day.games = day.wins + day.draws + day.losses;
    day.primaryPool = primaryPool;
    day.firstRecordedRating = ratings[0];
    day.lastRecordedRating = ratings.at(-1);
    day.ratingChange = ratings.length ? ratings.at(-1)! - ratings[0] : undefined;
  }

  const sessionGroups: ChessComGame[][] = [];
  for (const game of selectedGames) {
    const current = sessionGroups.at(-1);
    if (!current || game.end_time - current.at(-1)!.end_time >= 30 * 60) sessionGroups.push([game]);
    else current.push(game);
  }
  const sessionDetails = sessionGroups.map((games, index) => {
    const records = games.map((game) => resultFor(game, canonical).result);
    return {
      id: `S${String(index + 1).padStart(2, "0")}`,
      startTime: new Date(games[0].end_time * 1000).toISOString(),
      endTime: new Date(games.at(-1)!.end_time * 1000).toISOString(),
      games: games.length,
      wins: records.filter((result) => result === "win").length,
      draws: records.filter((result) => result === "draw").length,
      losses: records.filter((result) => result === "loss").length,
    };
  });
  const sessions = sessionDetails.length;

  const candidates = selectCandidates(selectedGames, canonical, 8);
  const reconstructedGames = selectedGames.filter((game) => Boolean(finalFen(game.pgn))).length;

  const headline = buildHeadline({ games: selectedGames.length, score, winStreak: bestWin, timeoutLosses, losses, checkmateWins });
  const isLastActive = selectedStart.getTime() !== latest.start.getTime();

  return {
    source: "live",
    provenance: {
      verified: true,
      sourceLabel: "Live Chess.com archive processing",
    },
    player: {
      requestedUsername,
      username: canonical,
      playerId: profile.player_id,
      avatar: profile.avatar,
      profileUrl: profile.url,
    },
    period: {
      start: isoDay(selectedStart),
      end: isoDay(selectedEnd),
      label: formatPeriod(selectedStart, selectedEnd),
      isLastActive,
      latestCompletedLabel,
    },
    games: selectedGames.length,
    wins,
    losses,
    draws,
    score: Number(score.toFixed(1)),
    headline,
    episodeKey: `${profile.player_id ?? canonical.toLowerCase()}:${isoDay(selectedStart)}:${isoDay(selectedEnd)}`,
    cadence: {
      anchorStart: options.anchorStart ?? isoDay(selectedStart),
      nextStart: isoDay(new Date(selectedStart.getTime() + 7 * DAY_MS)),
      nextEnd: isoDay(new Date(selectedStart.getTime() + 13 * DAY_MS)),
      nextAvailableOn: isoDay(new Date(selectedStart.getTime() + 14 * DAY_MS)),
    },
    summary: isLastActive
      ? `The latest completed week had no games, so BoardSignal found ${canonical}'s most recent active Monday–Sunday chapter. It does not treat older games as current form.`
      : `${canonical}'s latest completed week is ready. Start with the Replay, then carry the clearest signal into the next game.`,
    longestWinStreak: bestWin,
    longestLossStreak: bestLoss,
    sessions,
    checkmateWins,
    timeoutLosses,
    resignationLosses,
    primaryPool,
    days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    pools,
    openings: [...openingMap.entries()].map(([name, games]) => ({ name, games })).sort((a, b) => b.games - a.games).slice(0, 5),
    colorRecords: {
      white: { ...colorMap.white, record: recordLabel(colorMap.white.wins, colorMap.white.losses, colorMap.white.draws) },
      black: { ...colorMap.black, record: recordLabel(colorMap.black.wins, colorMap.black.losses, colorMap.black.draws) },
    },
    gameLength: gameLengths.length ? {
      averageMoves: Number((gameLengths.reduce((sum, moves) => sum + moves, 0) / gameLengths.length).toFixed(1)),
      medianMoves: [...gameLengths].sort((a, b) => a - b)[Math.floor(gameLengths.length / 2)],
      shortestMoves: Math.min(...gameLengths),
      longestMoves: Math.max(...gameLengths),
    } : undefined,
    terminations: [...terminationMap.entries()].map(([type, games]) => ({ type, games })).sort((a, b) => b.games - a.games),
    clockEvidence: { gamesWithClockData, totalGames: selectedGames.length },
    sessionDetails,
    strengths: { forcingAdvancedPawnGames, promotionGames, passedPawnConversionGames },
    opponentBands: [...opponentBandMap.values()]
      .map((band) => ({ ...band, score: Number((((band.wins + band.draws / 2) / band.games) * 100).toFixed(1)) }))
      .sort((a, b) => b.games - a.games),
    signals: {
      green: {
        label: "Green · Preserve",
        title: bestWin >= 2 ? `${bestWin} straight wins formed the strongest positive run.` : checkmateWins ? `${checkmateWins} win${checkmateWins === 1 ? "" : "s"} ended in checkmate.` : "Every completed win is evidence worth locating.",
        copy: "The completed results support this as the week's clearest positive pattern.",
      },
      amber: {
        label: "Amber · Monitor",
        title: bestLoss >= 2 ? `The longest losing sequence reached ${bestLoss} games.` : "No multi-game losing sequence appeared.",
        copy: bestLoss >= 3 ? "After two consecutive losses, pause before starting the next game and reset the clock routine." : "Keep the result sequence visible without enlarging it into a diagnosis.",
      },
      red: {
        label: "Red · Reviewing",
        title: "The selected positions are being compared before a weakness is named.",
        copy: "BoardSignal will only choose Red after the chess evidence clears its threshold.",
      },
      blue: {
        label: "Blue · Preparing",
        title: "Your pocket cue follows the reviewed positions.",
        copy: "The action is selected from the same evidence as Red.",
      },
    },
    candidates,
    validation: {
      gamesRetrieved: retrievedGames.length,
      gamesIncluded: selectedGames.length,
      gamesExcluded: Math.max(0, retrievedGames.length - selectedGames.length),
      duplicateGames,
      malformedGames,
      gamesReceived: selectedGames.length,
      gamesReconstructed: reconstructedGames,
      candidatePositions: candidates.length,
      rulesVersion: "boardsignal-rules-1.1.0",
    },
    caveats: [
      "Ratings are separated by Chess.com time class; first and last values are recorded game boundaries, not an invented pre-game rating.",
      "Position claims are shown only where the available game evidence supports them.",
      ...(isLastActive ? ["This is an older last-active period. Current form cannot be inferred from it."] : []),
    ],
  };
}

export function currentAlignedPeriod(anchorStart: string | undefined, reference = new Date()) {
  const today = atUtcMidnight(reference);
  let start: Date;
  if (anchorStart) {
    const anchor = parseIsoDay(anchorStart);
    const blockIndex = Math.max(0, Math.floor((today.getTime() - anchor.getTime()) / (7 * DAY_MS)));
    start = new Date(anchor.getTime() + blockIndex * 7 * DAY_MS);
  } else {
    const day = today.getUTCDay();
    const distance = day === 0 ? 6 : day - 1;
    start = new Date(today.getTime() - distance * DAY_MS);
  }
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return { start, end };
}

/**
 * Reads factual public-game progress for the open anchored episode and derives
 * one private, non-engine next-game action from the SAME retrieved game set.
 * It never starts Stockfish or mutates a closed Desk.
 */
export async function buildCurrentEpisodeSummary(
  requestedUsername: string,
  options: BuildCurrentEpisodeOptions = {},
): Promise<CurrentEpisodeWithNextGameGuidance> {
  const resolved = await resolveChessComPlayer(requestedUsername);
  const referenceDate = options.referenceDate ?? new Date();
  const { start, end } = currentAlignedPeriod(options.anchorStart, referenceDate);
  const archivesPayload = await chessComJson<{ archives?: string[] }>(
    `https://api.chess.com/pub/player/${encodeURIComponent(resolved.username)}/games/archives`,
  );
  const archiveMap = new Map((archivesPayload.archives ?? []).map((url) => [archiveKey(url), url]));
  const keys = new Set([monthKey(start), monthKey(end)]);
  const urls = [...keys].map((key) => archiveMap.get(key)).filter((url): url is string => Boolean(url));
  const retrieved = (await Promise.all(urls.map(fetchGames))).flat();
  const seen = new Set<string>();
  const games = retrieved
    .filter((game) => {
      const time = game.end_time * 1000;
      const key = game.url || `${game.end_time}:${game.white.username}:${game.black.username}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const belongs = game.white.username.toLowerCase() === resolved.username.toLowerCase()
        || game.black.username.toLowerCase() === resolved.username.toLowerCase();
      return belongs
        && Boolean(game.pgn && game.url)
        && (!game.rules || game.rules === "chess")
        && time >= start.getTime()
        && time <= referenceDate.getTime()
        && time < end.getTime() + DAY_MS;
    })
    .sort((a, b) => a.end_time - b.end_time);

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let currentWinRun = 0;
  let currentLossRun = 0;
  let currentLossRunFacts: ActiveWeekSupportingFact[] = [];
  const guidanceEvidence: ActiveWeekEvidenceFact[] = [];
  const poolMap = new Map<string, {
    games: number;
    wins: number;
    draws: number;
    losses: number;
    ratings: number[];
  }>();

  for (const game of games) {
    const result = resultFor(game, resolved.username);
    wins += result.result === "win" ? 1 : 0;
    draws += result.result === "draw" ? 1 : 0;
    losses += result.result === "loss" ? 1 : 0;
    currentWinRun = result.result === "win" ? currentWinRun + 1 : 0;
    currentLossRun = result.result === "loss" ? currentLossRun + 1 : 0;
    currentLossRunFacts = result.result === "loss"
      ? [...currentLossRunFacts, {
        id: `${gameId(game)}:loss-run`,
        gameId: gameId(game),
        gameUrl: game.url,
        occurredAt: game.end_time,
        opponent: result.opponent.username,
        opponentRating: result.opponent.rating,
        pool: game.time_class ?? "other",
        summary: "This game is part of the current result run.",
      }]
      : [];
    guidanceEvidence.push(...activeWeekEvidenceForGame(game, resolved.username));
    const poolName = game.time_class ?? "other";
    const pool = poolMap.get(poolName) ?? { games: 0, wins: 0, draws: 0, losses: 0, ratings: [] };
    pool.games += 1;
    pool.wins += result.result === "win" ? 1 : 0;
    pool.draws += result.result === "draw" ? 1 : 0;
    pool.losses += result.result === "loss" ? 1 : 0;
    if (typeof result.player.rating === "number") pool.ratings.push(result.player.rating);
    poolMap.set(poolName, pool);
  }

  let sessions = 0;
  let previousEnd: number | undefined;
  for (const game of games) {
    if (previousEnd === undefined || game.end_time - previousEnd >= 30 * 60) sessions += 1;
    previousEnd = game.end_time;
  }

  const latestGameSource = games.at(-1);
  const latestResult = latestGameSource ? resultFor(latestGameSource, resolved.username) : undefined;
  const latestGameInput = latestGameSource && latestResult ? {
    gameId: gameId(latestGameSource),
    gameUrl: latestGameSource.url,
    occurredAt: latestGameSource.end_time,
    opponent: latestResult.opponent.username,
    opponentRating: latestResult.opponent.rating,
    result: latestResult.result,
    pool: latestGameSource.time_class ?? "other",
  } : undefined;

  let nextGameGuidance;
  try {
    nextGameGuidance = deriveActiveWeekNextGameGuidance({
      gamesConsidered: games.length,
      currentLossRun,
      latestGameAt: latestGameSource?.end_time,
      evidence: guidanceEvidence,
      playerKey: options.playerKey ?? resolved.username.toLowerCase(),
      periodStart: isoDay(start),
      periodEnd: isoDay(end),
      latestGame: latestGameInput,
      currentLossRunFacts,
    });
  } catch {
    // Guidance is enrichment. The factual forming-week state must still render.
    nextGameGuidance = unavailableActiveWeekGuidance(games.length);
  }

  let latestGame: ActiveWeekLatestGame | undefined;
  if (latestGameInput) {
    const selectedSupport = nextGameGuidance.source === "current_week"
      ? nextGameGuidance.supportingFacts.find((fact) => fact.gameId === latestGameInput.gameId)
      : undefined;
    latestGame = {
      ...latestGameInput,
      supportsSelectedGuidance: Boolean(selectedSupport),
      supportingSummary: selectedSupport?.summary,
    };
  }

  const today = atUtcMidnight(referenceDate);
  const daysComplete = Math.max(0, Math.min(7, Math.floor((today.getTime() - start.getTime()) / DAY_MS) + 1));
  return {
    status: "forming",
    periodStart: isoDay(start),
    periodEnd: isoDay(end),
    periodLabel: formatPeriod(start, end),
    checkedAt: referenceDate.toISOString(),
    daysComplete,
    daysRemaining: Math.max(0, 7 - daysComplete),
    games: games.length,
    wins,
    draws,
    losses,
    currentWinRun,
    currentLossRun,
    sessions,
    pools: [...poolMap.entries()].map(([pool, item]) => ({
      pool,
      games: item.games,
      wins: item.wins,
      draws: item.draws,
      losses: item.losses,
      ratingStart: item.ratings[0],
      ratingEnd: item.ratings.at(-1),
      ratingDelta: item.ratings.length ? item.ratings.at(-1)! - item.ratings[0] : undefined,
    })).sort((a, b) => b.games - a.games),
    nextDeskDueAt: isoDay(new Date(end.getTime() + DAY_MS)),
    nextGameGuidance,
    latestGame,
  };
}
