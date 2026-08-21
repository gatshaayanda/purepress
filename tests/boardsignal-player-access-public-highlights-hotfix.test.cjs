const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const manifest = read("PATCH-MANIFEST.txt");
const account = read("src", "lib", "boardsignal", "account.ts");
const betaAccess = read("src", "lib", "boardsignal", "server", "betaAccess.ts");
const repair = read("src", "lib", "boardsignal", "server", "publicCoverageRepair.ts");
const requests = read("src", "lib", "boardsignal", "server", "betaRequests.ts");
const route = read("src", "app", "api", "admin", "boardsignal", "beta-access", "route.ts");
const founder = read("src", "components", "FoundingBetaPlayersAdmin.tsx");
const publicPage = read("src", "app", "player", "[handle]", "page.tsx");

function section(name, next) {
  return manifest.split(name)[1]?.split(next)[0] ?? "";
}
const changed = section("CHANGED FILES", "ADDED FILES");
const added = section("ADDED FILES", "DELETED FILES");
const touched = `${changed}\n${added}`;

test("1. E.2.1 begins only from the exact immutable E.2 baseline", () => {
  assert.match(manifest, /fc29ad931651c6b2201b154c0a384ae6250e694d/);
  assert.match(manifest, /Add BoardSignal chat attachments and friend messaging/);
});

test("2. accountStatus and betaAccessStatus remain separate concepts", () => {
  assert.match(account, /betaAccessStatus: "active" \| "revoked" \| "not_created"/);
  assert.match(account, /accountStatus: BoardSignalAccessStatus/);
  assert.match(betaAccess, /betaAccessStatus,/);
  assert.match(betaAccess, /accountStatus: account\.accessStatus/);
});

test("3. Founder UI no longer presents Access not created as whole-account state", () => {
  assert.doesNotMatch(founder, /Access not created/);
  assert.match(founder, /Not configured/);
});

test("4. private access state is visible", () => {
  assert.match(founder, /<dt>PRIVATE ACCESS<\/dt>/);
  assert.match(founder, /privateAccessLabel\(player\.accountStatus\)/);
});

test("5. identity state is visible", () => {
  assert.match(founder, /<dt>IDENTITY<\/dt>/);
  assert.match(founder, /Pending Founder review/);
  assert.match(founder, /Founder reviewed/);
  assert.match(founder, /OAuth verified/);
});

test("6. public-highlight state is visible", () => {
  assert.match(founder, /<dt>PUBLIC HIGHLIGHTS<\/dt>/);
  assert.match(founder, /publicHighlightsLabel\(player\.publicHighlights\.status\)/);
});

test("7. fallback access state is visible", () => {
  assert.match(founder, /<dt>FALLBACK ACCESS<\/dt>/);
  assert.match(founder, /fallbackAccessLabel\(player\.betaAccessStatus\)/);
});

test("8. active account plus no fallback reports private Active plus fallback Not configured", () => {
  assert.match(founder, /status === "active" \? "Active"/);
  assert.match(founder, /status === "revoked" \? "Revoked" : "Not configured"/);
});

test("9. provisional plus stored Review derives Waiting for identity review", () => {
  assert.match(repair, /identityStatus === "provisional" && account\.accessStatus === "active"/);
  assert.match(repair, /return "waiting_identity_review"/);
  assert.match(founder, /Waiting for identity review/);
});

test("10. provisional repair cannot create publicCoverage", () => {
  assert.match(repair, /account\.identityStatus !== "provisional" && account\.identityStatus !== "revoked"/);
  const eligibility = repair.indexOf('const eligible = account.accessStatus === "active"');
  const blockedReturn = repair.indexOf("if (!eligible)");
  const publicWrite = repair.indexOf("await item.ref.set(clean(item.coverage))");
  assert.ok(eligibility > -1 && blockedReturn > eligibility && publicWrite > blockedReturn);
});

test("11. founder_reviewed plus no stored Review reports No completed Review yet", () => {
  assert.match(repair, /if \(!retained\.length\)/);
  assert.match(repair, /status: "no_completed_review"/);
  assert.match(founder, /No completed Review yet/);
});

test("12. founder_reviewed plus stored Review plus coverage present reports Live", () => {
  assert.match(repair, /alreadyPresent === expected\.length/);
  assert.match(repair, /\? "live"\s*:\s*"repair_needed"/s);
});

test("13. founder_reviewed plus stored Review plus missing coverage reports Repair needed", () => {
  assert.match(repair, /missingOrIncomplete/);
  assert.match(repair, /"repair_needed"/);
  assert.match(founder, /Repair needed/);
});

test("14. manual repair uses stable server-resolved player identity", () => {
  assert.match(route, /repairSafePublicCoverageForPlayer\(body\.playerId\)/);
  assert.match(repair, /collection\("chessPlayerAccounts"\)\.doc\(String\(playerId\)\)/);
  assert.match(repair, /account\.chessCom\?\.playerId !== playerId/);
});

test("15. browser cannot provide arbitrary coverage uid isFounder or Desk authority", () => {
  const repairCall = route.match(/if \(body\.action === "repairPublicHighlights"\)[\s\S]*?\n    }/)[0];
  assert.doesNotMatch(repairCall, /body\.uid|body\.identityStatus|body\.isFounder|body\.coverage|body\.desk/i);
  assert.match(founder, /JSON\.stringify\(\{ action: "repairPublicHighlights", playerId: player\.playerId \}\)/);
});

test("16. repair uses buildSafePublicCoverage", () => {
  assert.match(repair, /import \{ buildSafePublicCoverage/);
  assert.match(repair, /buildSafePublicCoverage\(/);
});

test("17. repair reads only currently retained private Reviews", () => {
  assert.match(repair, /collection\("desks"\)[\s\S]*orderBy\("periodEnd", "desc"\)[\s\S]*limit\(4\)/);
});

test("18. fifth expired Review is not resurrected", () => {
  assert.match(repair, /limit\(4\)/);
  assert.doesNotMatch(repair, /limit\(5\)|slice\(0,\s*5\)|retainLatestFive/i);
});

test("19. deterministic publicCoverage document identity is reused", () => {
  assert.match(repair, /safeDocumentId\(`\$\{playerId\}:\$\{deskKey\}`\)/);
  assert.match(repair, /collection\("publicCoverage"\)\.doc\(publicCoverageDocumentId/);
});

test("20. repeated repair is idempotent", () => {
  assert.match(repair, /sameSafeCoverage/);
  assert.match(repair, /missingOrIncomplete = inspected\.filter\(\(item\) => !item\.matches\)/);
  assert.match(repair, /if \(writeRepair && missingOrIncomplete\.length\)/);
});

test("21. Review created while provisional is backfilled after Founder confirmation", () => {
  const confirm = requests.slice(requests.indexOf("export async function confirmFoundingBetaIdentity"), requests.indexOf("export async function revokeProvisionalFoundingBetaIdentity"));
  assert.match(confirm, /const confirmedAccount: BoardSignalAccount/);
  assert.match(confirm, /identityStatus: "founder_reviewed"/);
  assert.match(confirm, /reconcileConfirmedPublicHighlights\(confirmedAccount\)/);
});

test("22. already-confirmed affected player can be repaired", () => {
  assert.match(route, /body\.action === "repairPublicHighlights"/);
  assert.match(founder, /Repair public highlights/);
  assert.match(founder, /player\.publicHighlights\.repairAvailable/);
});

test("23. repair failure does not revoke private account session or delete private Review", () => {
  assert.match(requests, /catch \(error\)[\s\S]*status: "repair_needed"/);
  assert.doesNotMatch(repair, /revokeRefreshTokens|deleteDeskTree|accessStatus:\s*"paused"|delete\(\)/);
});

test("24. public empty state no longer falsely guarantees identity-not-reviewed as the reason", () => {
  assert.doesNotMatch(publicPage, /once your Founding Beta identity is reviewed/);
  assert.match(publicPage, /No public highlights are available here yet/);
  assert.match(publicPage, /Private BoardSignal access is separate from this public highlights page/);
});

test("25. private diagnostics never enter the new repair path", () => {
  assert.doesNotMatch(repair, /signals\.red|signals\.amber|signals\.blue|candidate|engineResult|Stockfish|\bFEN\b|recurringPatterns|Ask BoardSignal|Progress details/i);
});

test("26. no Friend or chat content enters public coverage", () => {
  assert.doesNotMatch(repair, /friendConversations|friendChat|chatAttachment|messageBody|communications/i);
});

test("27. no contact information enters public coverage", () => {
  assert.doesNotMatch(repair, /preferredContact|contactValue|email|discord|telegram/i);
});

test("28. no duplicate Universe history or event replay is added", () => {
  assert.doesNotMatch(repair, /writePublicUniverseEvent|recordCompletedDeskUniverseArtifacts|recordNewPlayerUniverseIntro|ensureShareMomentsForActiveDesks|podium|standings|push|campaign/i);
  assert.match(manifest, /does not add a history replay/i);
});

test("29. E.2 attachment architecture is untouched", () => {
  assert.doesNotMatch(touched, /chatAttachments|chat-attachments|BoardSignalChatAttachment|uploadthing\/core/);
  assert.match(manifest, /Patch E\.2 attachment and Friend messaging files are not changed/);
});

test("30. E.2 Friend messaging is untouched", () => {
  assert.doesNotMatch(touched, /friendChat|friend-chat|FriendConversation|PlayerFriends/);
});

test("31. A.2 account deletion remains untouched and E.3 owns deletion hardening", () => {
  assert.doesNotMatch(touched, /accountDeletion/);
  assert.match(manifest, /E\.3 remains the Account Deletion Social-Cleanup Hotfix/);
  assert.match(manifest, /Account deletion code is unchanged/);
});

test("32. Firestore rules are unchanged", () => {
  assert.doesNotMatch(touched, /firestore\.rules/);
  assert.match(manifest, /firestore\.rules is unchanged/);
});

test("33. package.json is unchanged", () => {
  assert.doesNotMatch(touched, /package\.json/);
  assert.match(manifest, /package\.json is unchanged/);
});

test("34. package-lock.json is unchanged", () => {
  assert.doesNotMatch(touched, /package-lock\.json/);
  assert.match(manifest, /package-lock\.json is unchanged/);
});

test("35. light and dark semantic contrast remains intact", () => {
  assert.doesNotMatch(touched, /\.css|\.module\.css/);
  assert.doesNotMatch(founder, /style=\{|#[0-9a-f]{3,8}/i);
  assert.match(manifest, /no CSS file is changed, preserving the existing light\/dark semantic contrast/i);
});

test("36. no horizontal overflow is introduced on Founder player cards", () => {
  assert.match(founder, /founder-player-card/);
  assert.match(founder, /founder-player-actions/);
  assert.doesNotMatch(founder, /whiteSpace:\s*["']nowrap|minWidth:\s*["']?\d{3,}/i);
  assert.doesNotMatch(touched, /\.css|\.module\.css/);
});

test("37. fallback reset and revoke warnings truthfully disclose session sign-out", () => {
  assert.match(founder, /Reset this player's fallback code and sign out existing sessions\?/);
  assert.match(founder, /Revoke this player's fallback access and sign out existing sessions\?/);
  assert.match(betaAccess, /revokeRefreshTokens/);
});

test("38. approval path also reconciles safe coverage using confirmed state", () => {
  const approve = requests.slice(requests.indexOf("export async function approveFoundingBetaRequest"), requests.indexOf("export async function confirmFoundingBetaIdentity"));
  assert.match(approve, /const confirmedAccount: BoardSignalAccount/);
  assert.match(approve, /identityStatus: "founder_reviewed"/);
  assert.match(approve, /reconcileConfirmedPublicHighlights\(confirmedAccount\)/);
});

test("39. no stored Review is valid rather than a repair failure", () => {
  assert.match(repair, /if \(!retained\.length\)[\s\S]*status: "no_completed_review"/);
  assert.match(repair, /repairAvailable: false/);
});

test("40. missing identityStatus is represented as legacy rather than provisional", () => {
  assert.match(founder, /Legacy \/ status not recorded/);
  assert.doesNotMatch(betaAccess, /identityStatus:\s*account\.identityStatus\s*\?\?\s*"provisional"/);
});

test("41. safe coverage uses the same visibility semantics as normal publication", () => {
  assert.match(repair, /\{ publicPlayerPage: true, universeCoverage: true \}/);
});

test("42. no new Firestore collection is introduced", () => {
  const collections = [...repair.matchAll(/collection\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(collections)].sort(), ["chessPlayerAccounts", "desks", "publicCoverage", "users"]);
  assert.match(manifest, /No new collection/);
});
