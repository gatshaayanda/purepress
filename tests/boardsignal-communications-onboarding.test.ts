import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultNotificationPreferences } from "../src/lib/boardsignal/account";
import { automatedEventKey, evaluateAutomationPolicy, messageForAutomatedEvent } from "../src/lib/boardsignal/communications";
import { retainLatestFour } from "../src/lib/boardsignal/memory";

const read = (path: string) => readFileSync(path, "utf8");

test("1. new beta request keeps contact data out of public documents", () => {
  const source = read("src/lib/boardsignal/server/betaRequests.ts");
  const publicWrite = source.slice(source.indexOf('collection("publicPlayers")'), source.indexOf('await ref.set({ status: "approved"'));
  assert.match(source, /collection\("betaRequests"\)/);
  assert.match(source, /preferredContactValue/);
  assert.doesNotMatch(publicWrite, /preferredContactMethod|preferredContactValue|betaContactConsent/);
});

test("2. founder can approve and reject pending requests", () => {
  const route = read("src/app/api/admin/boardsignal/beta-access/route.ts");
  assert.match(route, /approveRequest/);
  assert.match(route, /rejectRequest/);
  assert.match(route, /approveFoundingBetaRequest/);
  assert.match(route, /rejectFoundingBetaRequest/);
});

test("3. approval reuses stable identity instead of creating a duplicate player", () => {
  const source = read("src/lib/boardsignal/server/betaRequests.ts");
  assert.match(source, /createFoundingBetaAccess\(request\.canonicalUsername\)/);
  assert.match(source, /BETA_ACCESS_EXISTS/);
  assert.match(source, /loadExistingFoundingBetaAccess\(request\.chessPlayerId\)/);
  assert.doesNotMatch(source, /resetFoundingBetaAccess\(request\.chessPlayerId\)/);
  assert.match(source, /publicPlayers"\)\.doc\(String\(request\.chessPlayerId\)\)/);
});

test("4. first member Desk is published into the persistent owner account", () => {
  const room = read("src/components/BoardSignalPlayerRoom.tsx");
  const persistence = read("src/lib/boardsignal/server/persistence.ts");
  assert.match(room, /REVIEW 1/);
  assert.match(room, /ownerToken=/);
  assert.match(room, /onDeskPublished=/);
  assert.match(persistence, /collection\("users"\)\.doc\(account\.uid\)\.collection\("desks"\)/);
});

test("5. required Universe participation is disclosed and cannot be falsely toggled off", () => {
  const form = read("src/components/UsernameDeskForm.tsx");
  const gate = read("src/components/BetaAgreementGate.tsx");
  const profile = read("src/components/PlayerProfileNotifications.tsx");
  assert.match(form, /Included with Founding Beta/);
  assert.match(gate, /Included with Founding Access/);
  assert.match(profile, /Founding Access Universe participation = Included/);
  assert.doesNotMatch(profile, /Allow safe positive Universe coverage/);
});

test("6. private Signals never enter public coverage", () => {
  const memory = read("src/lib/boardsignal/memory.ts");
  const publicBlock = memory.slice(memory.indexOf("export function buildSafePublicCoverage"));
  assert.doesNotMatch(publicBlock, /signals\.red|signals\.amber|signals\.blue|engineResult|recurrence/);
  const privacy = read("src/app/boardsignal/privacy/page.tsx");
  assert.match(privacy, /Red, private Amber, Blue/);
});

test("7. BoardSignal event categories default ON", () => {
  const preferences = defaultNotificationPreferences();
  assert.equal(preferences.deskReady, true);
  assert.equal(preferences.episodeProgress, true);
  assert.equal(preferences.blueReminder, true);
  assert.equal(preferences.universeAchievement, true);
  assert.equal(preferences.founderUpdates, true);
});

test("8. browser push permission is requested only from the explicit enable action", () => {
  const push = read("src/components/BrowserPushControl.tsx");
  const requestAt = push.indexOf("const nextPermission = await Notification.requestPermission()");
  const clickAt = push.indexOf("async function enable");
  assert.ok(requestAt > clickAt && clickAt >= 0);
  assert.match(push, /Enable browser alerts/);
  assert.equal((push.match(/await Notification\.requestPermission\(\)/g) ?? []).length, 1);
});

test("9. in-app single-player delivery writes only to that user inbox", () => {
  const server = read("src/lib/boardsignal/server/communications.ts");
  assert.match(server, /audienceKind === "one"/);
  assert.match(server, /collection\("users"\)\.doc\(account\.uid\)\.collection\("inbox"\)/);
});

test("10. selected-player delivery resolves only selected stable user ids", () => {
  const server = read("src/lib/boardsignal/server/communications.ts");
  assert.match(server, /audienceKind === "one" \|\| draft\.audienceKind === "selected"/);
  assert.match(server, /wanted\.has\(account\.uid\)/);
});

test("11. all-active-beta delivery is restricted to active Founding Beta player accounts", () => {
  const server = read("src/lib/boardsignal/server/communications.ts");
  assert.match(server, /account\.role === "player"/);
  assert.match(server, /account\.accessTier === "founding_beta"/);
  assert.match(server, /account\.accessStatus === "active"/);
});

test("12. Player A cannot read Player B inbox or messages", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/inbox\/\{messageId\}[\s\S]*allow read: if isOwner\(userId\)/);
  assert.match(rules, /match \/conversations\/\{threadId\}[\s\S]*allow read: if isOwner\(userId\)/);
  assert.match(rules, /match \/messages\/\{messageId\}[\s\S]*allow read: if isOwner\(userId\)/);
});

test("13. player replies are authenticated server writes performed as themselves", () => {
  const route = read("src/app/api/boardsignal/inbox/route.ts");
  const server = read("src/lib/boardsignal/server/communications.ts");
  assert.match(route, /requirePlayerToken/);
  assert.match(route, /replyToFounder/);
  assert.match(server, /senderType: "player"/);
  assert.match(server, /userId: account\.uid/);
});

test("14. founder reads and replies to the correct private player thread", () => {
  const server = read("src/lib/boardsignal/server/communications.ts");
  assert.match(server, /founderConversation\(uidInput/);
  assert.match(server, /collection\("users"\)\.doc\(uid\)\.collection\("conversations"\)\.doc\(threadId\)/);
  assert.match(server, /founderReply\(uidInput/);
});

test("15. push-disabled configuration keeps the in-app product usable", () => {
  const push = read("src/components/BrowserPushControl.tsx");
  const server = read("src/lib/boardsignal/server/communications.ts");
  assert.match(push, /unavailable until BoardSignal push configuration is completed/i);
  assert.match(server, /if \(!process\.env\.NEXT_PUBLIC_FIREBASE_VAPID_KEY/);
  assert.match(server, /return \{ eligible: false, delivered: 0, failed: 0 \}/);
});

test("16. duplicate automated events are suppressed", () => {
  const key = automatedEventKey("episode_progress", { episodeKey: "p:2026-08-10", discriminator: "day3" });
  const decision = evaluateAutomationPolicy({ eventType: "episode_progress", eventKey: key, episodeKey: "p:2026-08-10", now: new Date("2026-08-12T06:00:00Z"), previous: [{ eventKey: key, eventType: "episode_progress", episodeKey: "p:2026-08-10", createdAt: "2026-08-11T06:00:00Z" }] });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "duplicate");
});

test("17. ordinary episode engagement is capped and push respects 24 hours", () => {
  const previous = [0,1,2].map((n) => ({ eventKey: `old-${n}`, eventType: "episode_progress" as const, episodeKey: "episode", createdAt: `2026-08-${9+n}T06:00:00Z`, ...(n === 2 ? { pushSentAt: "2026-08-12T00:00:00Z" } : {}) }));
  const capped = evaluateAutomationPolicy({ eventType: "blue_reminder_available", eventKey: "new-blue", episodeKey: "episode", now: new Date("2026-08-12T06:00:00Z"), previous });
  assert.equal(capped.allowed, false);
  assert.equal(capped.reason, "episode_cap");
});

test("18. Desk Ready is deduped per Desk and can bypass the ordinary episode cap once", () => {
  const deskKey = automatedEventKey("desk_ready", { deskKey: "desk-5" });
  const prior = [0,1,2].map((n) => ({ eventKey: `ordinary-${n}`, eventType: "episode_progress" as const, episodeKey: "episode", createdAt: "2026-08-11T00:00:00Z" }));
  const first = evaluateAutomationPolicy({ eventType: "desk_ready", eventKey: deskKey, episodeKey: "episode", now: new Date("2026-08-12T06:00:00Z"), previous: prior });
  assert.equal(first.allowed, true);
  const duplicate = evaluateAutomationPolicy({ eventType: "desk_ready", eventKey: deskKey, episodeKey: "episode", now: new Date("2026-08-12T07:00:00Z"), previous: [...prior, { eventKey: deskKey, eventType: "desk_ready", episodeKey: "episode", createdAt: "2026-08-12T06:00:00Z" }] });
  assert.equal(duplicate.allowed, false);
});

test("19. forming-episode communications stay factual and do not mutate a completed Desk", () => {
  const loop = read("src/lib/boardsignal/server/returnLoop.ts");
  assert.match(loop, /buildCurrentEpisodeSummary/);
  assert.doesNotMatch(loop, /publishPrivateDesk|applyEngineInterpretation|signals\.red|signals\.amber/);
  const message = messageForAutomatedEvent({ eventType: "episode_progress", currentEpisode: { status: "forming", periodStart: "2026-08-10", periodEnd: "2026-08-16", periodLabel: "10–16 August 2026", checkedAt: "2026-08-12T06:00:00Z", daysComplete: 3, daysRemaining: 4, games: 8, wins: 4, draws: 1, losses: 3, currentWinRun: 1, currentLossRun: 0, sessions: 2, pools: [], nextDeskDueAt: "2026-08-17" } });
  assert.match(message?.body ?? "", /8 games are already in|8 games are already in\.|8 games are already in/i);
});

test("20. public search remains sports-safe and does not expose private diagnostics", () => {
  const publicPlayer = read("src/app/player/[handle]/page.tsx");
  const memory = read("src/lib/boardsignal/memory.ts");
  assert.match(publicPlayer, /loadSafePublicPlayerProfile|liveCoverage/);
  assert.doesNotMatch(publicPlayer, /previousBlue|previousAmber|engineResult|signals\./);
  assert.match(memory, /buildSafePublicCoverage/);
});

test("21. returning Firebase session bypasses the Beta Access form", () => {
  const room = read("src/components/BoardSignalPlayerRoom.tsx");
  assert.match(room, /onAuthStateChanged\(auth/);
  assert.match(room, /if \(!user\)/);
  assert.match(room, /snapshot/);
});

test("22. exact latest-four Desk retention remains unchanged", () => {
  const result = retainLatestFour([1,2,3,4,5].map((n) => ({ deskKey: `desk-${n}`, periodEnd: `2026-08-${String(n).padStart(2,"0")}`, documentId: `d${n}` })));
  assert.deepEqual(result.retained.map((item) => item.deskKey), ["desk-5", "desk-4", "desk-3", "desk-2"]);
  assert.deepEqual(result.removed.map((item) => item.deskKey), ["desk-1"]);
});

test("23. deterministic Universe recognition remains the existing implementation", () => {
  const pulse = read("src/lib/boardsignal/pulse.ts");
  const universe = read("src/lib/boardsignal/universe.ts");
  assert.match(pulse, /buildUniverseBoards/);
  assert.match(universe, /buildPlayerUniverseView/);
  assert.doesNotMatch(universe, /Math\.random|Date\.now/);
});

test("24. Stockfish 18 assets and depth-11 smoke target remain unchanged", () => {
  const smoke = read("scripts/stockfish-smoke.mjs");
  const worker = read("public/stockfish/stockfish-18-lite-single.js");
  assert.match(smoke, /depth 11/);
  assert.match(worker, /Stockfish\.js 18/);
});

test("25. requested screens retain readable contrast, visible focus and non-duplicated owner CTA", () => {
  const css = read("src/app/globals.css");
  const header = read("src/components/Header.tsx");
  const screens = ["src/app/page.tsx", "src/app/feed/page.tsx", "src/components/UsernameDeskForm.tsx", "src/components/BoardSignalPlayerRoom.tsx", "src/components/PlayerInbox.tsx", "src/components/PlayerProfileNotifications.tsx", "src/app/admin/page.tsx", "src/components/FoundingBetaPlayersAdmin.tsx", "src/components/FounderCommunications.tsx", "src/components/FounderCoverageEditor.tsx"].map(read).join("\n");
  assert.match(css, /focus-visible/);
  assert.match(css, /\.beta-value-card[\s\S]*color: var\(--ink\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.equal((header.match(/Get My BoardSignal/g) ?? []).length, 2);
  assert.match(screens, /Get My BoardSignal|Player Room|COMMUNICATIONS|COVERAGE/);
});

