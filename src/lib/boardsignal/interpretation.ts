import { Chess } from "chess.js";
import type {
  BoardSignalDesk,
  DeskCandidate,
  DeskEngineResult,
  DeskReplay,
  DeskSignal,
  DeskWeekShape,
} from "./types";

const RULES_VERSION = "boardsignal-rules-1.1.0";
const MIN_REPEATED_EVIDENCE = 2;

function score(cp?: number, mate?: number) {
  if (mate !== undefined) return mate > 0 ? 100_000 - mate : -100_000 - mate;
  return cp;
}

export function moveToSan(fen: string | undefined, uci: string | undefined) {
  if (!fen || !uci || uci.length < 4) return undefined;
  try {
    const chess = new Chess(fen);
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })?.san;
  } catch {
    return undefined;
  }
}

export function finalizeEngineResult(
  candidate: DeskCandidate,
  result: DeskEngineResult,
): DeskEngineResult {
  if (result.status === "failed") return { ...result, classification: undefined };
  const before = score(result.beforeCp, result.beforeMate);
  const after = score(result.afterCp, result.afterMate);
  const evaluationLossCp = before !== undefined && after !== undefined
    ? Math.max(0, Math.min(20_000, before - after))
    : undefined;

  let classification: DeskEngineResult["classification"] = "supported";
  if (candidate.kind === "resignation" && before !== undefined) {
    classification = before >= -180 ? "playable-resignation" : "sound-resignation";
  } else if (candidate.kind === "timeout" && before !== undefined) {
    classification = before >= -100 ? "clock-opportunity" : "clock-lost";
  } else if (evaluationLossCp !== undefined && evaluationLossCp >= 250) {
    classification = "major-miss";
  } else if (evaluationLossCp !== undefined && evaluationLossCp >= 100) {
    classification = "mistake";
  }

  return {
    ...result,
    status: "complete",
    bestMoveSan: result.bestMoveSan ?? moveToSan(candidate.fenBefore ?? candidate.fen, result.bestMove),
    evaluationLossCp,
    classification,
  };
}

function recordSignal(
  label: string,
  title: string,
  copy: string,
  status: DeskSignal["status"] = "supported",
  evidenceIds: string[] = [],
): DeskSignal {
  return { label, title, copy, status, evidenceIds };
}

function poolMovement(desk: BoardSignalDesk) {
  return desk.pools
    .filter((pool) => pool.firstRecordedRating !== undefined && pool.lastRecordedRating !== undefined)
    .map((pool) => ({ ...pool, change: pool.lastRecordedRating! - pool.firstRecordedRating! }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

function greenSignal(
  desk: BoardSignalDesk,
  reviewed: Array<{ candidate: DeskCandidate; result: DeskEngineResult }>,
) {
  const movements = poolMovement(desk);
  const bestPool = [...movements].sort((a, b) => b.change - a.change)[0];
  const checkmateWins = desk.checkmateWins ?? 0;
  const mateShare = desk.wins ? checkmateWins / desk.wins : 0;
  const passedPawnEvidence = reviewed.filter(({ candidate, result }) => (
    candidate.role === "strength"
    && result.status !== "failed"
    && /verified passed pawn/i.test(candidate.reason)
  ));
  const passedPawnGames = new Set(passedPawnEvidence.map(({ candidate }) => candidate.gameId ?? candidate.gameUrl));

  if ((desk.strengths?.passedPawnConversionGames ?? 0) >= 2 && passedPawnGames.size >= 2) {
    const evidenceIds = passedPawnEvidence.map(({ candidate }) => candidate.id);
    return recordSignal(
      "Green · Preserve",
      `Verified passed pawns became forcing weapons in ${passedPawnGames.size} reviewed wins.`,
      "Those positions establish both the passed-pawn condition and a concrete contribution to the win.",
      "supported",
      evidenceIds,
    );
  }
  if (desk.longestWinStreak >= 4) {
    return recordSignal(
      "Green · Preserve",
      `${desk.longestWinStreak} consecutive wins formed the week's clearest positive run.`,
      "Review the games in that run and preserve the choices that repeated; the result sequence itself is the evidence.",
    );
  }
  if (checkmateWins >= 3 && mateShare >= 0.3) {
    return recordSignal(
      "Green · Preserve",
      `${checkmateWins} of ${desk.wins} wins ended in checkmate.`,
      "Direct finishes were a repeated factual strength in this episode.",
    );
  }
  if (bestPool && bestPool.change >= 20) {
    return recordSignal(
      "Green · Preserve",
      `${bestPool.pool} rose ${bestPool.change} recorded rating points across ${bestPool.games} games.`,
      "That pool supplied the strongest sustained result evidence in the episode.",
    );
  }
  return recordSignal(
    "Green · Preserve",
    `${desk.wins} wins supplied the week's positive evidence.`,
    "No narrower repeated chess theme cleared the evidence threshold, so Green stays with the verified result record.",
  );
}

function amberSignal(desk: BoardSignalDesk) {
  const movements = poolMovement(desk);
  const best = [...movements].sort((a, b) => b.change - a.change)[0];
  const worst = [...movements].sort((a, b) => a.change - b.change)[0];
  const difficultBand = [...(desk.opponentBands ?? [])]
    .filter((band) => band.games >= Math.max(8, Math.ceil(desk.games * 0.08)) && band.score <= 35)
    .sort((a, b) => a.score - b.score || b.games - a.games)[0];

  if (difficultBand) {
    return recordSignal(
      "Amber · Monitor",
      `${difficultBand.label} ${difficultBand.pool} opponents: ${difficultBand.wins}W · ${difficultBand.draws}D · ${difficultBand.losses}L (${difficultBand.score.toFixed(1)}%).`,
      "The split is measurable and worth watching; it does not by itself establish why those games were harder.",
    );
  }
  if (best && worst && best.pool !== worst.pool && best.change > 0 && worst.change < 0) {
    return recordSignal(
      "Amber · Monitor",
      `${best.pool} moved +${best.change}; ${worst.pool} moved ${worst.change}.`,
      "Treat the pools as separate performances rather than combining their ratings.",
    );
  }
  if (desk.games < 8) {
    return recordSignal(
      "Amber · Monitor",
      `${desk.games} games make this a narrow episode.`,
      "Use the concrete positions, but wait for more evidence before treating any pattern as repeated.",
    );
  }
  if (desk.longestLossStreak >= 4) {
    return recordSignal(
      "Amber · Monitor",
      `${desk.longestLossStreak} consecutive losses formed the week's longest negative run.`,
      "The sequence is factual; its cause still has to come from reviewed positions rather than the result count.",
    );
  }
  return recordSignal(
    "Amber · Monitor",
    "No single measurable watch pattern dominated the whole week.",
    "Keep pool, day and position evidence separate until a clearer pattern appears.",
  );
}

function supportedEvidence(candidate: DeskCandidate, result?: DeskEngineResult) {
  if (candidate.role === "strength" || !result || result.status === "failed") return false;
  return result.classification === "major-miss"
    || result.classification === "mistake"
    || result.classification === "playable-resignation"
    || result.classification === "clock-opportunity";
}

function evidenceReason(candidate: DeskCandidate, result: DeskEngineResult) {
  if (candidate.role === "strength") return candidate.reason;
  if (result.classification === "playable-resignation") {
    return "The game ended by resignation while the reviewed position was still playable.";
  }
  if (result.classification === "clock-opportunity") {
    return "Time expired while the reviewed board still offered practical chances.";
  }
  if ((result.classification === "major-miss" || result.classification === "mistake") && candidate.movePlayed) {
    const alternative = result.bestMoveSan ? ` ${result.bestMoveSan} was the stronger first move.` : " A stronger first move was available.";
    return `${candidate.movePlayed} allowed ${candidate.opponentReply ?? "a forcing reply"}.${alternative}`;
  }
  return candidate.reason;
}

function redAndBlue(
  reviewed: Array<{ candidate: DeskCandidate; result: DeskEngineResult }>,
) {
  const supported = reviewed.filter(({ candidate, result }) => supportedEvidence(candidate, result));
  const groups = new Map<string, Array<{ candidate: DeskCandidate; result: DeskEngineResult }>>();
  for (const item of supported) {
    const key = item.result.classification === "playable-resignation"
      ? "resignation"
      : item.result.classification === "clock-opportunity"
        ? "clock"
        : item.candidate.motif ?? "general";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const repeated = [...groups.entries()]
    .map(([key, items]) => ({ key, items, games: new Set(items.map((item) => item.candidate.gameId ?? item.candidate.gameUrl)).size }))
    .filter((group) => group.games >= MIN_REPEATED_EVIDENCE)
    .sort((a, b) => {
      const severity = (items: typeof supported) => items.reduce((sum, item) => sum + (item.result.evaluationLossCp ?? 150), 0);
      return b.games - a.games || severity(b.items) - severity(a.items);
    });
  const selected = repeated[0];
  if (!selected) {
    return {
      red: recordSignal(
        "Red · Not published",
        "No repeated engine-supported correction cleared the evidence threshold.",
        "Isolated reviewed moments remain in the evidence section, but BoardSignal will not turn one position into a behavioural diagnosis.",
        "withheld",
      ),
      blue: recordSignal(
        "Blue · Not assigned",
        "No corrective pocket action was assigned from insufficient evidence.",
        "Blue is derived from a supported Red family; without that evidence, the app does not invent guidance.",
        "withheld",
      ),
    };
  }

  const { key, items, games: count } = selected;
  const first = items[0];
  const evidenceIds = items.map(({ candidate }) => candidate.id);
  if (key === "resignation") {
    return {
      red: recordSignal("Red · Fix first", `${count} reviewed resignations ended while the position remained playable.`, "The engine evidence—not the termination count—supports one more scan before leaving the board.", "supported", evidenceIds),
      blue: recordSignal("Blue · Carry with you", "Before resigning: checks, captures, threats, then one legal defence.", "If one reply keeps the game playable, make the opponent prove the finish.", "supported", evidenceIds),
    };
  }
  if (key === "clock") {
    return {
      red: recordSignal("Red · Fix first", `${count} reviewed timeouts occurred with practical chances still on the board.`, "These were clock losses with playable positions, not simply lost boards that reached zero.", "supported", evidenceIds),
      blue: recordSignal("Blue · Carry with you", "Under one minute: check, force, simplify, move.", "Use the shorter decision routine before the clock becomes the position.", "supported", evidenceIds),
    };
  }
  if (key === "queen-safety") {
    return {
      red: recordSignal("Red · Fix first", `${count} reviewed decisions left the queen vulnerable to a forcing reply.`, evidenceReason(first.candidate, first.result), "supported", evidenceIds),
      blue: recordSignal("Blue · Carry with you", "Queen landing there—what takes her?", "Name every enemy check and capture before committing the queen.", "supported", evidenceIds),
    };
  }
  if (key === "king-safety") {
    return {
      red: recordSignal("Red · Fix first", `${count} reviewed decisions allowed a forcing attack on the king.`, evidenceReason(first.candidate, first.result), "supported", evidenceIds),
      blue: recordSignal("Blue · Carry with you", "Their checks, mate threats, captures—then my move.", "Run the opponent's forcing line before returning to your own plan.", "supported", evidenceIds),
    };
  }
  if (key === "forcing-reply" || key === "material") {
    return {
      red: recordSignal("Red · Fix first", `${count} reviewed decisions missed the opponent's forcing reply.`, evidenceReason(first.candidate, first.result), "supported", evidenceIds),
      blue: recordSignal("Blue · Carry with you", "Move chosen? Check their check, capture and direct threat.", "Do the reply scan before releasing the move.", "supported", evidenceIds),
    };
  }
  return {
    red: recordSignal("Red · Fix first", `${count} reviewed decisions repeated the same general correction.`, evidenceReason(first.candidate, first.result), "supported", evidenceIds),
    blue: recordSignal("Blue · Carry with you", "Move chosen? Test their most forcing reply.", "Use the repeated reviewed positions as the model for the next game.", "supported", evidenceIds),
  };
}

function activeDays(desk: BoardSignalDesk) {
  return desk.days.filter((day) => day.wins + day.draws + day.losses > 0);
}

function dayBalance(day: BoardSignalDesk["days"][number]) {
  return day.wins - day.losses;
}

function classifyWeek(desk: BoardSignalDesk): DeskWeekShape {
  const pool = desk.pools.find((item) => item.pool === desk.primaryPool) ?? desk.pools[0];
  const first = pool?.firstRecordedRating;
  const last = pool?.lastRecordedRating;
  const peak = pool?.peak;
  const low = pool?.low;
  const change = first !== undefined && last !== undefined ? last - first : 0;
  const days = activeDays(desk);
  const split = Math.max(1, Math.ceil(days.length / 2));
  const early = days.slice(0, split).reduce((sum, day) => sum + dayBalance(day), 0);
  const late = days.slice(split).reduce((sum, day) => sum + dayBalance(day), 0);
  const range = peak !== undefined && low !== undefined ? peak - low : 0;

  if (low !== undefined && last !== undefined && first !== undefined && low <= first - 15 && last >= low + 20) return "RECOVERY_WEEK";
  if (early >= 2 && late <= -2) return "STRONG_START_COLLAPSE";
  if (early <= -2 && late >= 2) return "ROUGH_WEEK_STRONG_FINISH";
  if (peak !== undefined && last !== undefined && first !== undefined && peak >= first + 15 && last <= peak - 20) return "EARLY_SURGE_LATE_SLIDE";
  if (change >= 20 && desk.score >= 55) return "STRONG_UPWARD_WEEK";
  if (range >= 40 && Math.abs(change) < 20) return "VOLATILE_WEEK";
  if (change > 0 && desk.score >= 50) return "CONTROLLED_PROGRESS";
  return "FLAT_MIXED_WEEK";
}

const SHAPE_TITLES: Record<DeskWeekShape, string> = {
  STRONG_UPWARD_WEEK: "A strong upward week.",
  EARLY_SURGE_LATE_SLIDE: "An early surge gave way to a late slide.",
  RECOVERY_WEEK: "The week recovered from its low.",
  VOLATILE_WEEK: "A volatile week moved in both directions.",
  CONTROLLED_PROGRESS: "Controlled progress held across the week.",
  ROUGH_WEEK_STRONG_FINISH: "A rough start met a stronger finish.",
  STRONG_START_COLLAPSE: "A strong start weakened sharply late.",
  FLAT_MIXED_WEEK: "A mixed week carried more than one story.",
};

function buildReplay(desk: BoardSignalDesk): DeskReplay {
  const shape = classifyWeek(desk);
  const days = activeDays(desk);
  const firstDay = days[0];
  const lastDay = days.at(-1);
  const bestDay = [...days].sort((a, b) => dayBalance(b) - dayBalance(a) || b.wins - a.wins)[0];
  const worstDay = [...days].sort((a, b) => dayBalance(a) - dayBalance(b) || b.losses - a.losses)[0];
  const pool = desk.pools.find((item) => item.pool === desk.primaryPool) ?? desk.pools[0];
  const movement = pool?.firstRecordedRating !== undefined && pool.lastRecordedRating !== undefined
    ? `${pool.pool} moved ${pool.firstRecordedRating} → ${pool.lastRecordedRating} (${pool.lastRecordedRating - pool.firstRecordedRating >= 0 ? "+" : ""}${pool.lastRecordedRating - pool.firstRecordedRating})`
    : undefined;
  const start = firstDay
    ? `${firstDay.label} opened the active sequence at ${firstDay.wins}W · ${firstDay.draws}D · ${firstDay.losses}L.`
    : "No active day was available.";
  const turningPoint = bestDay && worstDay && bestDay.date !== worstDay.date
    ? `${worstDay.label} was the hardest daily result (${worstDay.wins}W · ${worstDay.draws}D · ${worstDay.losses}L); ${bestDay.label} was the strongest (${bestDay.wins}W · ${bestDay.draws}D · ${bestDay.losses}L).`
    : undefined;
  const finish = lastDay
    ? `${lastDay.label} closed the active sequence at ${lastDay.wins}W · ${lastDay.draws}D · ${lastDay.losses}L.`
    : "The period closed without another game.";
  const facts = [
    `${desk.games} games finished ${desk.wins}W · ${desk.draws}D · ${desk.losses}L for a ${desk.score.toFixed(1)}% score.`,
    movement ? `${movement}; the recorded high was ${pool?.peak} and the low was ${pool?.low}.` : undefined,
    desk.longestWinStreak >= 3 ? `The longest positive run reached ${desk.longestWinStreak} consecutive wins.` : undefined,
    desk.longestLossStreak >= 3 ? `The longest negative run reached ${desk.longestLossStreak} consecutive losses.` : undefined,
    turningPoint,
    finish,
  ].filter((part): part is string => Boolean(part));
  return { shape, title: SHAPE_TITLES[shape], narrative: facts.join(" "), start, turningPoint, finish };
}

function buildHeadline(desk: BoardSignalDesk, replay: DeskReplay) {
  const pool = desk.pools.find((item) => item.pool === desk.primaryPool) ?? desk.pools[0];
  const change = pool?.firstRecordedRating !== undefined && pool.lastRecordedRating !== undefined
    ? pool.lastRecordedRating - pool.firstRecordedRating
    : undefined;
  if (desk.longestWinStreak >= 5) return `${desk.longestWinStreak} straight wins gave the week its defining run.`;
  if (replay.shape === "RECOVERY_WEEK" && pool?.low !== undefined && pool.lastRecordedRating !== undefined) return `A recovery from ${pool.low} reshaped the ${pool.pool} week.`;
  if (change !== undefined && change >= 20) return `${pool.pool} finished ${change} recorded rating points higher.`;
  if (replay.shape === "ROUGH_WEEK_STRONG_FINISH") return "A stronger finish changed the last word of the week.";
  if (replay.shape === "STRONG_START_COLLAPSE") return "The week opened strongly before the late results turned.";
  if ((desk.checkmateWins ?? 0) >= 3) return `${desk.checkmateWins} checkmate finishes became the week's positive signature.`;
  return replay.title;
}

export function applyEngineInterpretation(
  desk: BoardSignalDesk,
  results: Record<string, DeskEngineResult>,
) {
  const attempted = desk.candidates
    .map((candidate) => ({ candidate, result: results[candidate.id] }))
    .filter((item): item is { candidate: DeskCandidate; result: DeskEngineResult } => Boolean(item.result));
  const finished = attempted.length === desk.candidates.length;
  const reviewed = attempted.filter(({ result }) => result.status !== "failed");
  if (!finished) return { desk, complete: false, reviewed: attempted.length, total: desk.candidates.length };

  const { red, blue } = redAndBlue(reviewed);
  const replay = buildReplay(desk);
  const candidates = desk.candidates
    .map((candidate) => {
      const result = results[candidate.id];
      return result && result.status !== "failed"
        ? { ...candidate, reason: evidenceReason(candidate, result) }
        : candidate;
    })
    .sort((a, b) => Number(b.role === "strength") - Number(a.role === "strength") || (results[b.id]?.evaluationLossCp ?? 0) - (results[a.id]?.evaluationLossCp ?? 0))
    .slice(0, 8);
  const failed = attempted.length - reviewed.length;

  return {
    complete: true,
    reviewed: attempted.length,
    total: desk.candidates.length,
    desk: {
      ...desk,
      headline: buildHeadline(desk, replay),
      summary: replay.narrative,
      replay,
      turningPoint: replay.turningPoint ? { title: replay.title, copy: replay.turningPoint } : undefined,
      pocketCard: blue.status === "supported" ? blue.title : undefined,
      signals: {
        green: greenSignal(desk, reviewed),
        amber: amberSignal(desk),
        red,
        blue,
      },
      candidates,
      caveats: [
        ...desk.caveats,
        ...(failed ? [`Stockfish completed ${reviewed.length} of ${attempted.length} selected position reviews; ${failed} remained visible but were excluded from every diagnosis.`] : []),
      ],
      validation: {
        ...(desk.validation ?? { gamesReceived: desk.games, gamesReconstructed: desk.games, candidatePositions: desk.candidates.length, rulesVersion: RULES_VERSION }),
        candidatePositions: desk.candidates.length,
        engineSucceeded: reviewed.length,
        engineFailed: failed,
        rulesVersion: RULES_VERSION,
      },
    },
  };
}
