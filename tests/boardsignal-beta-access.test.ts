import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { firebaseUidForChessPlayer } from "../src/lib/boardsignal/account";
import {
  BETA_ACCESS_MAX_FAILED_ATTEMPTS,
  createBetaAccessCredential,
  evaluateBetaAccessAttempt,
  verifyBetaAccessCode,
  type BetaAccessRecord,
} from "../src/lib/boardsignal/auth/betaAccess";

const playerA = { playerId: 12345, canonicalUsername: "PlayerOne" };
const playerB = { playerId: 67890, canonicalUsername: "PlayerTwo" };
const credentialA = createBetaAccessCredential(playerA, new Date("2026-08-11T12:00:00.000Z"));
const credentialB = createBetaAccessCredential(playerB, new Date("2026-08-11T12:00:00.000Z"));

function applyPatch(record: BetaAccessRecord, patch: Record<string, unknown> | undefined) {
  const next = { ...record, ...(patch ?? {}) } as BetaAccessRecord & { lockedUntil?: string | null };
  if (next.lockedUntil === null) delete next.lockedUntil;
  return next as BetaAccessRecord;
}

test("valid Founding Beta Access verifies only the approved stable Chess.com player", () => {
  assert.equal(verifyBetaAccessCode(credentialA.accessCode, credentialA.record), true);
  assert.equal(credentialA.record.playerId, playerA.playerId);
  assert.equal(credentialA.record.canonicalUsername, playerA.canonicalUsername);
});

test("Founding Beta Access and future Chess.com OAuth share the exact stable Firebase uid", () => {
  assert.equal(firebaseUidForChessPlayer(credentialA.record.playerId), "chesscom_12345");
  const route = readFileSync("src/app/api/auth/beta-access/sign-in/route.ts", "utf8");
  const oauthCallback = readFileSync("src/app/api/auth/chesscom/callback/route.ts", "utf8");
  assert.match(route, /authenticateFoundingBetaAccess/);
  assert.match(route, /createCustomToken\(account\.uid/);
  assert.match(oauthCallback, /ensureStablePlayerAccount\(identity\)/);
});

test("wrong Founding Beta code is rejected", () => {
  const attempt = evaluateBetaAccessAttempt(credentialA.record, credentialB.accessCode, new Date("2026-08-11T12:01:00.000Z"));
  assert.equal(attempt.ok, false);
  assert.equal(attempt.code, "BETA_ACCESS_INVALID");
});

test("revoked Founding Beta code is rejected even when its hash is correct", () => {
  const attempt = evaluateBetaAccessAttempt({ ...credentialA.record, status: "revoked" }, credentialA.accessCode);
  assert.equal(attempt.ok, false);
  assert.equal(attempt.code, "BETA_ACCESS_REVOKED");
});

test("repeated failures produce a temporary lockout that rejects the correct code", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");
  let record = { ...credentialA.record };
  let final = evaluateBetaAccessAttempt(record, credentialB.accessCode, now);
  for (let attempt = 1; attempt < BETA_ACCESS_MAX_FAILED_ATTEMPTS; attempt += 1) {
    record = applyPatch(record, final.patch);
    final = evaluateBetaAccessAttempt(record, credentialB.accessCode, now);
  }
  assert.equal(final.ok, false);
  assert.equal(final.code, "BETA_ACCESS_LOCKED");
  record = applyPatch(record, final.patch);
  const correctDuringLock = evaluateBetaAccessAttempt(record, credentialA.accessCode, new Date("2026-08-11T12:05:00.000Z"));
  assert.equal(correctDuringLock.code, "BETA_ACCESS_LOCKED");
});

test("raw Founding Beta code is never part of the persisted credential record", () => {
  const persisted = JSON.stringify(credentialA.record);
  assert.ok(!persisted.includes(credentialA.accessCode));
  assert.deepEqual(Object.keys(credentialA.record).sort(), [
    "canonicalUsername", "createdAt", "failedAttempts", "passHash", "passSalt", "playerId", "status",
  ]);
  assert.match(credentialA.record.passHash, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(credentialA.record.passHash, credentialA.accessCode);
});

test("player A access cannot authenticate against player B record", () => {
  assert.equal(verifyBetaAccessCode(credentialA.accessCode, credentialB.record), false);
  const server = readFileSync("src/lib/boardsignal/server/betaAccess.ts", "utf8");
  assert.match(server, /collection\("betaAccess"\)\.doc\(String\(identity\.playerId\)\)/);
  assert.match(server, /record\.playerId !== identity\.playerId/);
});

test("returning Firebase sessions bypass the access form and open My Player Room", () => {
  const room = readFileSync("src/components/BoardSignalPlayerRoom.tsx", "utf8");
  const form = readFileSync("src/components/FoundingBetaAccessPanel.tsx", "utf8");
  assert.match(room, /onAuthStateChanged\(auth/);
  assert.match(room, /if \(!user\)/);
  assert.match(form, /browserLocalPersistence/);
  assert.match(room, /Sign out/);
});

test("public username to LIVE Desk remains available without authentication", () => {
  const buildPage = readFileSync("src/app/boardsignal/build/[handle]/page.tsx", "utf8");
  const usernameForm = readFileSync("src/components/UsernameDeskForm.tsx", "utf8");
  const liveRoute = readFileSync("src/app/api/boardsignal/[username]/route.ts", "utf8");
  assert.match(buildPage, /UniversalPlayerDesk/);
  assert.match(usernameForm, /SHOW ME MY REVIEW/);
  assert.match(usernameForm, /Chess\.com username/);
  assert.doesNotMatch(usernameForm, /Build My Desk/);
  assert.match(liveRoute, /buildLiveDesk/);
  assert.doesNotMatch(liveRoute, /requirePlayerToken/);
});

test("private Player Room remains owner-only and Beta Access records remain server-only", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /function isOwner\(userId\)[\s\S]*request\.auth\.uid == userId/);
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow read, create, update, delete: if isOwner\(userId\)/);
  assert.match(rules, /match \/betaAccess\/\{playerId\}[\s\S]*allow read, write: if false/);
});

test("Founder Beta Access management API relies on session-aware Founder middleware without double-auth", () => {
  const middleware = readFileSync("middleware.ts", "utf8");
  const api = readFileSync("src/app/api/admin/boardsignal/beta-access/route.ts", "utf8");
  assert.match(middleware, /startsWith\(["']\/api\/admin\/boardsignal\/["']\)/);
  assert.match(middleware, /["']\/api\/admin\/boardsignal\/:path\*["']/);
  assert.match(middleware, /FOUNDER_SESSION_COOKIE/);
  assert.match(middleware, /verifyFounderAuthorization/);
  assert.match(middleware, /req\.cookies\.get\(FOUNDER_SESSION_COOKIE\)/);
  assert.doesNotMatch(api, /requireFounderBasicAuth/);
  assert.match(api, /listFounderPlayerIdentities\(\)/);
  assert.match(api, /createFoundingBetaAccess\(body\.username\)/);
  assert.match(api, /resetFoundingBetaAccess\(body\.playerId\)/);
  assert.match(api, /revokeFoundingBetaAccess\(body\.playerId\)/);
  assert.match(api, /accessCode: result\.accessCode/);
  assert.match(api, /errorStatus\(error\)/);
});

test("Founder authorization rejects invalid auth and permits valid Basic or signed-session credentials", async () => {
  const secret = "focused-founder-test-secret";
  const middleware = readFileSync("middleware.ts", "utf8");
  assert.match(middleware, /await verifyFounderAuthorization/);
  assert.match(middleware, /sessionValue: req\.cookies\.get\(FOUNDER_SESSION_COOKIE\)\?\.value/);
  assert.match(middleware, /authorization: req\.headers\.get\(["']authorization["']\)/);
  assert.match(middleware, /status:\s*401/);
  assert.match(middleware, /Cache-Control["']:\s*["']no-store, private/);

  const nativeImport = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<typeof import("../src/lib/boardsignal/founderSession.mjs")>;
  const founderSessionUrl = pathToFileURL(resolve("src/lib/boardsignal/founderSession.mjs")).href;
  const { createFounderSession, verifyFounderAuthorization } = await nativeImport(founderSessionUrl);

  const rejected = await verifyFounderAuthorization({
    authorization: `Basic ${Buffer.from("founder:wrong-secret").toString("base64")}`,
    adminPassword: secret,
  });
  assert.equal(rejected.authorized, false);

  const basic = await verifyFounderAuthorization({
    authorization: `Basic ${Buffer.from(`founder:${secret}`).toString("base64")}`,
    adminPassword: secret,
  });
  assert.deepEqual(basic, { authorized: true, method: "basic" });

  const session = await createFounderSession(secret, { nonce: "focused-founder-test-nonce" });
  const signedSession = await verifyFounderAuthorization({
    sessionValue: session.value,
    adminPassword: secret,
  });
  assert.deepEqual(signedSession, { authorized: true, method: "session" });
});

test("Beta Access adds no Google, email-password, magic-link, URL-code, or credential logging flow", () => {
  const client = readFileSync("src/components/FoundingBetaAccessPanel.tsx", "utf8");
  const route = readFileSync("src/app/api/auth/beta-access/sign-in/route.ts", "utf8");
  const combined = `${client}\n${route}`;
  assert.doesNotMatch(combined, /GoogleAuthProvider|signInWithEmailAndPassword|sendSignInLinkToEmail|magic.?link/i);
  assert.doesNotMatch(route, /console\.|searchParams|URLSearchParams/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /signInWithCustomToken/);
});
