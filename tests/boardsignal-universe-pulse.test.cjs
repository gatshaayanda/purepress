const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pulse = require("../.test-dist-universe-pulse/src/lib/boardsignal/pulse.js");
const universe = require("../.test-dist-universe-pulse/src/lib/boardsignal/universe.js");
const memory = require("../.test-dist-universe-pulse/src/lib/boardsignal/memory.js");
const communications = require("../.test-dist-universe-pulse/src/lib/boardsignal/communications.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function participant(player, source = "live", extra = {}) {
  return {
    id: `${source}:${player.toLowerCase()}`,
    player,
    source,
    verified: true,
    periodLabel: "1–7 Aug 2026",
    periodEnd: "2026-08-07",
    games: 10,
    score: 60,
    winningRun: 3,
    pools: [],
    ...extra,
  };
}

function episode(extra = {}) {
  return {
    status: "forming",
    periodStart: "2026-08-08",
    periodEnd: "2026-08-14",
    periodLabel: "8–14 Aug 2026",
    checkedAt: "2026-08-12T05:00:00.000Z",
    daysComplete: 5,
    daysRemaining: 2,
    games: 4,
    wins: 3,
    draws: 0,
    losses: 1,
    currentWinRun: 2,
    currentLossRun: 0,
    sessions: 1,
    pools: [{ pool: "Rapid", games: 4, wins: 3, draws: 0, losses: 1, ratingStart: 800, ratingEnd: 812, ratingDelta: 12 }],
    nextDeskDueAt: "2026-08-15",
    ...extra,
  };
}

function liveDesk(extra = {}) {
  return {
    source: "live",
    provenance: { verified: true, sourceLabel: "LIVE" },
    player: { requestedUsername: "PulsePlayer", username: "PulsePlayer", playerId: 4242 },
    period: { start: "2026-08-01", end: "2026-08-07", label: "1–7 Aug 2026", isLastActive: false, latestCompletedLabel: "1–7 Aug 2026" },
    games: 12,
    wins: 8,
    draws: 1,
    losses: 3,
    score: 70.8,
    headline: "A supported week",
    summary: "Supported public summary.",
    longestWinStreak: 5,
    longestLossStreak: 2,
    sessions: 3,
    checkmateWins: 3,
    timeoutLosses: 0,
    resignationLosses: 0,
    primaryPool: "Rapid",
    days: [
      { date: "2026-08-06", label: "Thu", wins: 2, draws: 0, losses: 1, games: 3 },
      { date: "2026-08-07", label: "Fri", wins: 4, draws: 0, losses: 1, games: 5 },
    ],
    pools: [{ pool: "Rapid", games: 12, record: "8-1-3", wins: 8, draws: 1, losses: 3, firstRecordedRating: 800, lastRecordedRating: 847, change: 47, peak: 850, low: 795 }],
    openings: [],
    candidates: [],
    signals: {
      green: { label: "GREEN", title: "Private green", copy: "private green" },
      amber: { label: "AMBER", title: "SECRET AMBER", copy: "private amber" },
      red: { label: "RED", title: "SECRET RED", copy: "private red" },
      blue: { label: "BLUE", title: "SECRET BLUE", copy: "private blue" },
    },
    ...extra,
  };
}

function event(id, playerId, publishedAt, extra = {}) {
  return {
    eventId: id,
    eventType: "entered_top3",
    playerId,
    canonicalUsername: `P${playerId}`,
    occurredAt: publishedAt,
    publishedAt,
    headline: "Entered the Top 3",
    supportingFact: "Supported public fact.",
    dataMode: "live",
    finality: "official",
    safePublic: true,
    rankAfter: 3,
    ...extra,
  };
}

test("1. latest login snapshot produces the correct factual delta", () => {
  const before = episode({ games: 2, wins: 1, losses: 1, currentWinRun: 1, sessions: 1, pools: [{ pool: "Rapid", games: 2, wins: 1, draws: 0, losses: 1, ratingStart: 800, ratingEnd: 794, ratingDelta: -6 }] });
  const after = episode({ games: 6, wins: 5, losses: 1, currentWinRun: 4, sessions: 2, pools: [{ pool: "Rapid", games: 6, wins: 5, draws: 0, losses: 1, ratingStart: 800, ratingEnd: 818, ratingDelta: 18 }] });
  const card = pulse.deriveCurrentEpisodeDelta(before, after);
  assert.ok(card);
  assert.match(card.facts.join(" "), /4 games entered/);
  assert.match(card.facts.join(" "), /Rapid moved \+24/);
  assert.match(card.facts.join(" "), /winning run reached 4/);
});

test("2. no change produces no fake Pulse event", () => {
  const same = episode();
  assert.equal(pulse.deriveCurrentEpisodeDelta(same, { ...same, checkedAt: "2026-08-12T06:00:00.000Z" }), undefined);
});

test("3. completed Desk remains immutable while Pulse/share facts are derived", () => {
  const desk = liveDesk();
  const before = JSON.stringify(desk);
  pulse.nominateShareMoments(desk, []);
  assert.equal(JSON.stringify(desk), before);
});

test("4. forming episode never becomes an official completed-Desk rank", () => {
  const provisional = pulse.currentEpisodeToProvisionalParticipant("PulsePlayer", "4242", episode());
  assert.match(provisional.id, /^provisional:/);
  const boards = pulse.buildActiveUniverseBoards([provisional], []);
  const cards = pulse.deriveProvisionalCards(boards, provisional.id);
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => card.finality === "provisional"));
});

test("5. provisional language is explicitly labelled", () => {
  const provisional = pulse.currentEpisodeToProvisionalParticipant("PulsePlayer", "4242", episode({ currentWinRun: 4 }));
  const cards = pulse.deriveProvisionalCards(pulse.buildActiveUniverseBoards([provisional], []), provisional.id);
  assert.ok(cards.some((card) => /PROVISIONAL/.test(card.body)));
  assert.ok(cards.every((card) => /official/i.test(card.body)));
});

test("6. new-player introduction requires accepted agreement and Universe participation", () => {
  const source = read("src/lib/boardsignal/server/universePulse.ts");
  assert.match(source, /if \(!account\.betaAgreementAcceptedAt \|\| !account\.universeParticipationDisclosedAt\) return undefined/);
});

test("7. new-player introduction source leaks no contact/private identifiers", () => {
  const source = read("src/lib/boardsignal/server/universePulse.ts");
  const start = source.indexOf("export async function recordNewPlayerUniverseIntro");
  const end = source.indexOf("function boardEntry", start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /preferredContact|accessCode|firebaseUid|uid:/);
});

test("8. official completed-Desk field movement can produce an official Board Moved card", () => {
  const cards = pulse.deriveBoardMovement([
    { key: "winning-run:all", categoryId: "winning-run", categoryTitle: "Winning Run", rank: 5, denominator: 8, value: 3, valueLabel: "3 straight" },
  ], [
    { key: "winning-run:all", categoryId: "winning-run", categoryTitle: "Winning Run", rank: 3, denominator: 8, value: 5, valueLabel: "5 straight" },
  ]);
  assert.equal(cards[0].finality, "official");
  assert.match(cards[0].body, /#5 → #3/);
});

test("9. What's Hot ranking is deterministic", () => {
  const now = new Date("2026-08-12T06:00:00.000Z");
  const events = [event("b", "2", "2026-08-12T05:00:00.000Z"), event("a", "1", "2026-08-12T05:00:00.000Z")];
  assert.deepEqual(pulse.rankWhatsHot(events, now).map((item) => item.eventId), pulse.rankWhatsHot([...events].reverse(), now).map((item) => item.eventId));
});

test("10. ordinary hot events decay after roughly one episode", () => {
  const now = new Date("2026-08-12T06:00:00.000Z");
  const old = event("old", "1", "2026-08-04T05:00:00.000Z");
  assert.equal(pulse.rankWhatsHot([old], now).length, 0);
});

test("11. one player cannot monopolize What's Hot when the field is not tiny", () => {
  const now = new Date("2026-08-12T06:00:00.000Z");
  const events = [
    event("a1", "1", "2026-08-12T05:50:00.000Z", { eventType: "new_leader", rankAfter: 1 }),
    event("a2", "1", "2026-08-12T05:40:00.000Z"),
    event("a3", "1", "2026-08-12T05:30:00.000Z"),
    event("b1", "2", "2026-08-12T05:20:00.000Z"),
    event("c1", "3", "2026-08-12T05:10:00.000Z"),
  ];
  const hot = pulse.rankWhatsHot(events, now, 8);
  assert.ok(hot.filter((item) => item.playerId === "1").length <= 2);
});

test("12. rating pools remain separate", () => {
  const boards = pulse.buildActiveUniverseBoards([
    participant("RapidOne", "live", { pools: [{ pool: "rapid", games: 6, start: 800, end: 830, change: 30 }] }),
    participant("BlitzOne", "live", { pools: [{ pool: "blitz", games: 6, start: 900, end: 940, change: 40 }] }),
  ], []);
  assert.ok(boards.some((board) => board.key === "rating-climb:rapid" && board.entries.every((entry) => entry.player === "RapidOne")));
  assert.ok(boards.some((board) => board.key === "rating-climb:blitz" && board.entries.every((entry) => entry.player === "BlitzOne")));
});

test("13. LIVE identity is preferred over duplicate SEED identity", () => {
  const live = participant("SamePlayer", "live", { winningRun: 2 });
  const seed = participant("SamePlayer", "seed", { winningRun: 9 });
  const board = pulse.buildActiveUniverseBoards([live], [seed]).find((item) => item.key === "winning-run:all");
  assert.equal(board.entries.filter((entry) => entry.player === "SamePlayer").length, 1);
  assert.equal(board.entries.find((entry) => entry.player === "SamePlayer").value, 2);
});

test("14. SEED drops from a category after 6 comparable active LIVE players", () => {
  const live = Array.from({ length: 6 }, (_, i) => participant(`Live${i}`, "live", { winningRun: 3 + i }));
  const seed = [participant("SeedStar", "seed", { winningRun: 20 })];
  const board = pulse.buildActiveUniverseBoards(live, seed).find((item) => item.key === "winning-run:all");
  assert.equal(board.fieldLabel, "BOARDSIGNAL FIELD");
  assert.equal(board.entries.some((entry) => entry.player === "SeedStar"), false);
});

test("15. FIXTURE Desk never enters Universe ranking", () => {
  assert.equal(universe.deskToUniverseParticipant({ source: "fixture", provenance: { verified: true } }), undefined);
});

test("16. latest-four moving consciousness remains exact", () => {
  const result = memory.retainLatestFour([1,2,3,4,5].map((n) => ({ deskKey: `d${n}`, periodEnd: `2026-0${n}-07` })));
  assert.deepEqual(result.retained.map((item) => item.deskKey), ["d5", "d4", "d3", "d2"]);
  assert.deepEqual(result.removed.map((item) => item.deskKey), ["d1"]);
});

test("17. an expired Desk no longer affects the active ranking adapter", () => {
  const desks = [1,2,3,4,5].map((n) => ({ deskKey: `d${n}`, periodEnd: `2026-0${n}-07`, participant: participant(`P${n}`, "live", { winningRun: n + 1 }) }));
  const retained = memory.retainLatestFour(desks).retained;
  const board = pulse.buildActiveUniverseBoards(retained.map((item) => item.participant), []).find((item) => item.key === "winning-run:all");
  assert.equal(board.entries.some((entry) => entry.player === "P1"), false);
});

test("18. safe Share Moments are generated deterministically", () => {
  const moments = pulse.nominateShareMoments(liveDesk(), []);
  assert.ok(moments.length > 0 && moments.length <= 3);
  assert.ok(moments.every((moment) => moment.safePublic === true && moment.dataMode === "live"));
  assert.ok(moments.some((moment) => moment.headline === "5 straight wins"));
});

test("19. private Signals cannot create or leak into share cards", () => {
  const moments = pulse.nominateShareMoments(liveDesk(), []);
  const serialized = JSON.stringify(moments);
  assert.doesNotMatch(serialized, /SECRET RED|SECRET AMBER|SECRET BLUE|private red|private blue/);
  assert.equal(pulse.publicArtifactHasPrivateFields(moments), false);
});

test("20. native-share fallback has a deterministic copyable public link", () => {
  assert.equal(pulse.shareMomentUrl("https://boardsignal.example/", "abc_123"), "https://boardsignal.example/share/abc_123");
  assert.match(read("src/components/ShareMomentActions.tsx"), /navigator\.share[\s\S]*navigator\.clipboard\.writeText/);
});

test("21. public share route reads only the safe Share Moment artifact", () => {
  const page = read("src/app/share/[momentId]/page.tsx");
  assert.match(page, /loadPublicShareMoment/);
  assert.doesNotMatch(page, /loadPublishedDesks|engineResults|signals\.red|signals\.blue/);
});

test("22. lightweight shared artifact does not preserve a private full Desk", () => {
  const moment = pulse.nominateShareMoments(liveDesk(), [])[0];
  assert.equal("desk" in moment, false);
  assert.equal("signals" in moment, false);
  assert.equal("candidates" in moment, false);
  assert.equal("engineResults" in moment, false);
});

test("23. share acquisition attribution covers view, tap, CTA, beta start and submit", () => {
  const tracker = read("src/app/api/boardsignal/share/[momentId]/track/route.ts");
  const form = read("src/components/UsernameDeskForm.tsx");
  assert.match(tracker, /share_viewed[\s\S]*share_tapped[\s\S]*cta_clicked[\s\S]*beta_request_started[\s\S]*beta_request_submitted/);
  assert.match(form, /source: shareMomentId \? "boardSignalShare"/);
  assert.match(form, /beta_request_started/);
  assert.match(form, /beta_request_submitted/);
});

test("24. public Universe event validator rejects private fields", () => {
  const safe = event("safe", "1", "2026-08-12T05:00:00.000Z");
  assert.equal(pulse.publicArtifactHasPrivateFields(safe), false);
  assert.equal(pulse.publicArtifactHasPrivateFields({ ...safe, blue: "private" }), true);
  assert.equal(pulse.publicArtifactHasPrivateFields({ ...safe, preferredContactValue: "secret" }), true);
});

test("25. Communications integration still preserves dedupe and episode/push caps", () => {
  const now = new Date("2026-08-12T06:00:00.000Z");
  const duplicate = communications.evaluateAutomationPolicy({ eventType: "universe_top3", eventKey: "u:1", episodeKey: "e1", now, previous: [{ eventKey: "u:1", eventType: "universe_top3", episodeKey: "e1", createdAt: now.toISOString() }] });
  assert.equal(duplicate.allowed, false);
  const capped = communications.evaluateAutomationPolicy({ eventType: "universe_top3", eventKey: "u:4", episodeKey: "e1", now, previous: [1,2,3].map((n) => ({ eventKey: `u:${n}`, eventType: "episode_progress", episodeKey: "e1", createdAt: now.toISOString() })) });
  assert.equal(capped.reason, "episode_cap");
});

test("26. existing Beta Access architecture remains intact", () => {
  assert.equal(fs.existsSync(path.join(root, "src/app/api/auth/beta-access/sign-in/route.ts")), true);
  assert.match(read("src/lib/boardsignal/server/betaAccess.ts"), /ensureStablePlayerAccount/);
  assert.match(read("src/app/api/auth/beta-access/sign-in/route.ts"), /createCustomToken\(account\.uid/);
});

test("27. existing Inbox architecture remains intact", () => {
  assert.equal(fs.existsSync(path.join(root, "src/app/api/boardsignal/inbox/route.ts")), true);
  assert.match(read("firestore.rules"), /match \/inbox\/\{messageId\}[\s\S]*allow read: if isOwner\(userId\)[\s\S]*allow write: if false/);
});

test("28. existing deterministic Universe ranking ordering remains intact", () => {
  const boards = universe.buildUniverseBoards([participant("Three", "live", { winningRun: 3 }), participant("Five", "live", { winningRun: 5 })]);
  const win = boards.find((board) => board.key === "winning-run:all");
  assert.deepEqual(win.entries.map((entry) => [entry.player, entry.rank]), [["Five", 1], ["Three", 2]]);
});
