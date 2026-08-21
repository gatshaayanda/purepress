import { ayandaPositionMoments, betaDesks, privateWeek } from "./boardsignal";
import type { BoardSignalDesk } from "@/lib/boardsignal/types";

export function findSeedCadence(requestedUsername: string) {
  const normalized = requestedUsername.toLowerCase();
  if (normalized === privateWeek.player.toLowerCase()) return "2026-07-01";
  if (normalized === "alexcet8") return "2026-07-05";
  return betaDesks.find((desk) => desk.handle.toLowerCase() === normalized)?.periodStart;
}

export function findSeededDesk(requestedUsername: string): BoardSignalDesk | undefined {
  const normalized = requestedUsername.toLowerCase();

  if (normalized === privateWeek.player.toLowerCase()) {
    return {
      source: "seed",
      provenance: { verified: true, sourceLabel: "Approved Founder Lab report", reportId: "BS-CASE-001-W1" },
      player: { requestedUsername, username: privateWeek.player, profileUrl: "https://www.chess.com/member/ayandakopano" },
      period: {
        start: "2026-07-01",
        end: "2026-07-07",
        label: privateWeek.period,
        isLastActive: false,
        latestCompletedLabel: privateWeek.period,
      },
      episodeKey: `ayandakopano:2026-07-01:2026-07-07`,
      cadence: { anchorStart: "2026-07-01", nextStart: "2026-07-08", nextEnd: "2026-07-14", nextAvailableOn: "2026-07-15" },
      games: privateWeek.games,
      wins: privateWeek.wins,
      losses: privateWeek.losses,
      draws: privateWeek.draws,
      score: 46.4,
      headline: privateWeek.headline,
      summary: privateWeek.standfirst,
      longestWinStreak: 8,
      longestLossStreak: 4,
      sessions: null,
      checkmateWins: null,
      timeoutLosses: null,
      resignationLosses: 3,
      primaryPool: "rapid",
      days: [
        { date: "2026-07-01", label: "Wed 1", wins: 5, losses: 5, draws: 0 },
        { date: "2026-07-02", label: "Thu 2", wins: 5, losses: 4, draws: 0 },
        { date: "2026-07-03", label: "Fri 3", wins: 4, losses: 3, draws: 1 },
        { date: "2026-07-04", label: "Sat 4", wins: 1, losses: 3, draws: 0 },
        { date: "2026-07-05", label: "Sun 5", wins: 3, losses: 5, draws: 0 },
        { date: "2026-07-06", label: "Mon 6", wins: 4, losses: 6, draws: 0 },
        { date: "2026-07-07", label: "Tue 7", wins: 3, losses: 3, draws: 0 },
      ],
      pools: [{ pool: "rapid", games: 55, record: "25W · 1D · 29L", firstRecordedRating: 844, lastRecordedRating: 809, peak: 878, low: 796 }],
      openings: [],
      signals: {
        green: { label: "Green · Preserve", title: privateWeek.greenSignal, copy: "G07–G14 supplied sustained evidence across eight consecutive games." },
        amber: { label: "Amber · Monitor", title: privateWeek.amberSignal, copy: "The sequence is factual; it does not prove motivation, confidence or tilt." },
        red: { label: "Red · Fix first", title: privateWeek.redSignal, copy: "G30, G42 and G43 were approximately −0.85, −1.06 and −0.99 when the games ended." },
        blue: { label: "Blue · Carry with you", title: privateWeek.action, copy: privateWeek.blueSignal },
      },
      candidates: ayandaPositionMoments.map((moment) => ({
        id: moment.game,
        gameUrl: moment.link,
        opponent: moment.opponent,
        playerColor: moment.color.toLowerCase() as "white" | "black",
        result: "loss",
        reason: `Playable resignation · ${moment.evaluation}`,
        reconstruction: "legal",
      })),
      caveats: [
        "This Review is based on Ayandakopano's completed seven-day period and reviewed game evidence.",
        "The Blue Signal is advice from this episode, not a cross-week mission BoardSignal grades later.",
      ],
    };
  }

  if (normalized === "alexcet8") {
    return {
      source: "seed",
      provenance: { verified: true, sourceLabel: "Approved Founder Lab report", reportId: "BS-BETA-001-ALEX-W2" },
      player: { requestedUsername, username: "Alexcet8", profileUrl: "https://www.chess.com/member/Alexcet8" },
      period: { start: "2026-07-05", end: "2026-07-11", label: "5–11 July 2026", isLastActive: false, latestCompletedLabel: "5–11 July 2026" },
      episodeKey: "alexcet8:2026-07-05:2026-07-11",
      cadence: { anchorStart: "2026-07-05", nextStart: "2026-07-12", nextEnd: "2026-07-18", nextAvailableOn: "2026-07-19" },
      games: 8,
      wins: 2,
      losses: 6,
      draws: 0,
      score: 25,
      headline: "A difficult score hid a useful signal.",
      summary: "Two real winning positions sat inside a 2–6 week. Two unsafe queen moves and two playable resignations made the finish more one-sided than the boards had been.",
      longestWinStreak: 2,
      longestLossStreak: 4,
      sessions: null,
      checkmateWins: null,
      timeoutLosses: null,
      resignationLosses: 2,
      primaryPool: "30+0",
      days: [
        { date: "2026-07-05", label: "Sun 5", wins: 0, losses: 0, draws: 0 },
        { date: "2026-07-06", label: "Mon 6", wins: 2, losses: 4, draws: 0 },
        { date: "2026-07-07", label: "Tue 7", wins: 0, losses: 0, draws: 0 },
        { date: "2026-07-08", label: "Wed 8", wins: 0, losses: 0, draws: 0 },
        { date: "2026-07-09", label: "Thu 9", wins: 0, losses: 0, draws: 0 },
        { date: "2026-07-10", label: "Fri 10", wins: 0, losses: 1, draws: 0 },
        { date: "2026-07-11", label: "Sat 11", wins: 0, losses: 1, draws: 0 },
      ],
      pools: [{ pool: "30+0", games: 8, record: "2W · 0D · 6L", firstRecordedRating: 610, lastRecordedRating: 581, peak: 610, low: 581 }],
      openings: [],
      turningPoint: { title: "The two wins came together before four closing losses.", copy: "Games 3 and 4 restored 17 rating points; the queen-safety errors then supplied the clearest repeated correction." },
      pocketCard: "Queen landing there—who takes her?",
      signals: {
        green: { label: "Green · Preserve", title: "Your wins contained real chess, not lucky endings.", copy: "Both victories reached engine-supported winning positions through concrete captures and tactical replies." },
        amber: { label: "Amber · Monitor", title: "Two games ended while legal resistance remained.", copy: "Not checkmated? Find one normal move and make the opponent finish the job." },
        red: { label: "Red · Fix first", title: "Two active queen moves left the queen capturable.", copy: "9...Qxe4+ allowed 10.Nxe4; 8.Qh6 could be met by an immediate bishop or knight capture." },
        blue: { label: "Blue · Carry with you", title: "Queen landing there—who takes her?", copy: "Before every queen move, name the landing square and every enemy piece that attacks it." },
      },
      candidates: [
        { id: "G05", gameUrl: "https://www.chess.com/game/live/171197977726", opponent: "", playerColor: "black", result: "loss", role: "correction", reason: "9...Qxe4+ allowed 10.Nxe4; the evaluation moved from −1.27 to −6.99.", motif: "queen-safety", reconstruction: "legal" },
        { id: "G07", gameUrl: "https://www.chess.com/game/live/171379643158", opponent: "", playerColor: "white", result: "loss", role: "correction", reason: "8.Qh6 allowed the queen to be captured; the evaluation moved from +4.83 to −6.39.", motif: "queen-safety", reconstruction: "legal" },
        { id: "G06", gameUrl: "https://www.chess.com/game/live/171198034308", opponent: "", playerColor: "black", result: "loss", role: "correction", reason: "The position was about −0.21 at resignation; ...Qd6 or ...h6 kept a normal game going.", motif: "resignation", reconstruction: "legal" },
        { id: "G08", gameUrl: "https://www.chess.com/game/live/171431239184", opponent: "", playerColor: "white", result: "loss", role: "correction", reason: "The position was worse but had no forced mate; legal resistance remained.", motif: "resignation", reconstruction: "legal" },
      ],
      caveats: ["The exact pre-period rating is not invented; 610 and 581 are the recorded game boundaries in the reviewed report."],
      validation: { gamesReceived: 8, gamesReconstructed: 8, candidatePositions: 4, rulesVersion: "reviewed-report-2026-08-05" },
    };
  }

  return undefined;
}

