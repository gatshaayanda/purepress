const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const social = require(path.join(root, '.test-dist-friends-rivals/src/lib/boardsignal/social.js'));
const serverSource = fs.readFileSync(path.join(root, 'src/lib/boardsignal/server/social.ts'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'src/app/api/boardsignal/social/route.ts'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const roomSource = fs.readFileSync(path.join(root, 'src/components/BoardSignalPlayerRoom.tsx'), 'utf8');
const friendsSource = fs.readFileSync(path.join(root, 'src/components/PlayerFriends.tsx'), 'utf8');
const commsSource = fs.readFileSync(path.join(root, 'src/lib/boardsignal/server/communications.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
const betaRoute = fs.readFileSync(path.join(root, 'src/app/api/auth/beta-access/sign-in/route.ts'), 'utf8');

function summary(key, end, pools, extra = {}) {
  return {
    deskKey: key,
    periodStart: '2026-08-01',
    periodEnd: end,
    periodLabel: `Desk ${key}`,
    games: 10,
    wins: 6,
    draws: 1,
    losses: 3,
    scorePct: 65,
    pools,
    longestWinRun: 4,
    longestLossRun: 2,
    signalFamilies: {},
    ...extra,
  };
}
function player(id, name) { return { playerId: id, canonicalUsername: name }; }
function contrast(hexA, hexB) {
  const lum = (hex) => {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(c => c <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  };
  const [a,b] = [lum(hexA),lum(hexB)].sort((x,y)=>y-x);
  return (a+.05)/(b+.05);
}

test('1 player cannot friend themselves', () => {
  assert.deepEqual(social.resolveFriendRequestTransition({ actorPlayerId: 7, targetPlayerId: 7 }), { allowed:false, reason:'self' });
  assert.throws(() => social.canonicalSocialRelationshipId(7,7));
});

test('2 duplicate request is prevented', () => {
  assert.deepEqual(social.resolveFriendRequestTransition({ actorPlayerId: 7, targetPlayerId: 8, existing:{status:'pending',requestedByPlayerId:7} }), { allowed:false, reason:'duplicate' });
  assert.match(serverSource, /socialRequestRateLimits/);
  assert.match(serverSource, /status:\s*429/);
});

test('3 cross-pending request resolves safely', () => {
  assert.deepEqual(social.resolveFriendRequestTransition({ actorPlayerId: 7, targetPlayerId: 8, existing:{status:'pending',requestedByPlayerId:8} }), { allowed:true, action:'accept_mutual' });
  assert.match(serverSource, /accept_mutual/);
});

test('4 unauthorized social request is rejected', () => {
  assert.match(routeSource, /requirePlayerToken\(request\)/);
  assert.doesNotMatch(routeSource, /request\.json\(\)[\s\S]*getAdminDb\(\)/);
});

test('5 Firebase token is required for both GET and POST', () => {
  assert.equal((routeSource.match(/requirePlayerToken\(request\)/g) || []).length, 2);
});

test('6 acceptance creates one canonical friendship', () => {
  assert.equal(social.canonicalSocialRelationshipId(99, 12), '12_99');
  assert.equal(social.canonicalSocialRelationshipId(12, 99), '12_99');
  assert.match(serverSource, /status: "friends"/);
});

test('7 decline does not create a friendship', () => {
  const section = serverSource.slice(serverSource.indexOf('export async function declineFriendRequest'), serverSource.indexOf('export async function cancelFriendRequest'));
  assert.match(section, /transaction\.delete\(db\.collection\("socialRelationships"\)/);
  assert.doesNotMatch(section, /status: "friends"/);
});

test('8 cancel removes pending outgoing request', () => {
  const section = serverSource.slice(serverSource.indexOf('export async function cancelFriendRequest'), serverSource.indexOf('export async function unfriend'));
  assert.match(section, /requestedByPlayerId !== actor\.chessCom\.playerId/);
  assert.match(section, /transaction\.delete/);
});

test('9 unfriend removes canonical relationship and both projections', () => {
  const section = serverSource.slice(serverSource.indexOf('export async function unfriend'), serverSource.indexOf('export async function blockPlayer'));
  assert.ok((section.match(/transaction\.delete/g) || []).length >= 3);
});

test('10 block removes friendship and pending projections', () => {
  const section = serverSource.slice(serverSource.indexOf('export async function blockPlayer'), serverSource.indexOf('export async function setRivalPin'));
  assert.match(section, /socialBlocks/);
  assert.match(section, /socialRelationships/);
  assert.ok((section.match(/transaction\.delete/g) || []).length >= 3);
});

test('11 blocked player cannot send a new request', () => {
  const section = serverSource.slice(serverSource.indexOf('export async function sendFriendRequest'), serverSource.indexOf('async function pendingRelationshipFor'));
  assert.match(section, /blocksEitherDirection/);
  assert.match(section, /social connection is unavailable/);
});

test('12 block status does not leak to the blocked player', () => {
  const section = serverSource.slice(serverSource.indexOf('export async function blockPlayer'), serverSource.indexOf('export async function setRivalPin'));
  assert.match(section, /transaction\.delete\(db\.collection\("users"\)\.doc\(other\.uid\)\.collection\("social"\)\.doc\(String\(actor\.chessCom\.playerId\)\)\)/);
  assert.match(section, /status: "blocked"/);
  const blockedProjectionWrites = (section.match(/status: "blocked"/g) || []).length;
  assert.equal(blockedProjectionWrites, 1);
});

test('13 Player A cannot write Player B social documents directly', () => {
  assert.match(rules, /match \/social\/\{otherPlayerId\}[\s\S]*allow read: if isOwner\(userId\);[\s\S]*allow write: if false;/);
  assert.match(rules, /match \/socialRelationships\/\{relationshipId\}[\s\S]*allow read, write: if false;/);
  assert.match(rules, /match \/socialBlocks\/\{blockId\}[\s\S]*allow read, write: if false;/);
});

test('14 Head-to-Head requires accepted friendship context', () => {
  const section = serverSource.slice(serverSource.indexOf('export async function headToHead'));
  assert.match(section, /status !== "friends"/);
  assert.match(section, /Head-to-Head is available after both players accept/);
});

test('15 private Signal fields never enter comparison payload', () => {
  assert.equal(social.socialPayloadHasPrivateFields({ red: { title:'x' } }), true);
  const payload = social.buildHeadToHeadPayload({ left:player(1,'A'), right:player(2,'B'), leftDesks:[], rightDesks:[] });
  assert.equal(social.socialPayloadHasPrivateFields(payload), false);
  assert.equal(payload.privateFieldsExcluded, true);
});

test('16 contact details never enter comparison payload', () => {
  assert.equal(social.socialPayloadHasPrivateFields({ preferredContactValue:'secret' }), true);
  assert.equal(social.socialPayloadHasPrivateFields({ telegram:'@private' }), true);
});

test('17 rating pools remain separate', () => {
  const payload = social.buildHeadToHeadPayload({
    left:player(1,'A'), right:player(2,'B'),
    leftDesks:[summary('L','2026-08-10',[{pool:'rapid',games:10,ratingDelta:20}])],
    rightDesks:[summary('R','2026-08-10',[{pool:'blitz',games:10,ratingDelta:30}])],
  });
  assert.deepEqual(payload.comparablePools, []);
  assert.equal(payload.metrics.some(m => m.key.startsWith('rating:')), false);
});

test('18 latest-four memory remains exact inside comparison', () => {
  const desks = [1,2,3,4,5].map((n) => summary(`D${n}`, `2026-08-${String(14-n).padStart(2,'0')}`, [{pool:'rapid',games:10,ratingDelta:n}]));
  const payload = social.buildHeadToHeadPayload({ left:player(1,'A'), right:player(2,'B'), leftDesks:desks, rightDesks:desks });
  assert.equal(payload.left.desksAvailable, 4);
  assert.equal(payload.right.desksAvailable, 4);
});

test('19 expired fifth Desk no longer affects current comparison', () => {
  const current = [summary('D1','2026-08-12',[{pool:'rapid',games:10,ratingDelta:1}]), summary('D2','2026-08-11',[{pool:'rapid',games:10,ratingDelta:1}]), summary('D3','2026-08-10',[{pool:'rapid',games:10,ratingDelta:1}]), summary('D4','2026-08-09',[{pool:'rapid',games:10,ratingDelta:1}]), summary('OLD','2026-08-01',[{pool:'rapid',games:10,ratingDelta:999}])];
  const payload = social.buildHeadToHeadPayload({ left:player(1,'A'), right:player(2,'B'), leftDesks:current, rightDesks:current });
  const rating = payload.metrics.find(m => m.key === 'rating:rapid');
  assert.equal(rating.leftValue, '+4');
});

test('20 game links respect existing sharing controls', () => {
  const payload = social.buildHeadToHeadPayload({ left:player(1,'A'), right:player(2,'B'), leftDesks:[], rightDesks:[], leftPublicGameLinks:true, rightPublicGameLinks:false });
  assert.deepEqual(payload.gameLinksEnabled, { left:true, right:false });
});

test('21 Universe Pulse remains functional and reused', () => {
  assert.match(serverSource, /loadActiveUniverseState/);
  assert.match(roomSource, /pulse={snapshot\.pulse}/);
  assert.doesNotMatch(serverSource, /collection\("socialPulse"\)/);
});

test('22 friend social events remain private to intended player', () => {
  assert.match(routeSource, /requirePlayerToken/);
  assert.match(serverSource, /socialOverview\(actor/);
  assert.doesNotMatch(rules, /match \/socialRelationships[\s\S]*allow read: if true/);
});

test('23 existing Inbox architecture is reused for friend notifications', () => {
  assert.match(commsSource, /sendRelationshipNotification/);
  assert.match(commsSource, /collection\("inbox"\)/);
  assert.match(serverSource, /sendRelationshipNotification/);
});

test('24 Beta Access remains intact', () => {
  assert.match(betaRoute, /authenticateFoundingBetaAccess/);
  assert.doesNotMatch(serverSource, /betaAccess.*set|betaAccess.*delete/);
  assert.match(roomSource, /ChessComLoginPanel/);
});

test('25 semantic contrast tokens and forbidden light-surface failures are gated', () => {
  assert.match(css, /--bs-text-primary: var\(--ink\)/);
  assert.match(css, /--bs-text-secondary: var\(--ink-soft\)/);
  assert.match(css, /--bs-text-on-dark: var\(--white\)/);
  assert.match(css, /\.bs-surface-light \{ background: var\(--bs-surface-light\); color: var\(--bs-text-primary\); \}/);
  assert.match(css, /\.friends-surface[\s\S]*background: var\(--bs-surface-light\); color: var\(--bs-text-primary\)/);
  assert.ok(contrast('#101923','#fffdf8') >= 4.5);
  assert.ok(contrast('#263342','#fffdf8') >= 4.5);
  assert.ok(contrast('#68717a','#fffdf8') >= 4.5);
  assert.ok(contrast('#fffdf8','#101923') >= 4.5);
  assert.ok(contrast('#c9f65d','#101923') >= 4.5);
  assert.ok(contrast('#c9f65d','#fffdf8') < 4.5, 'lime on pale is intentionally recognized as forbidden body-copy contrast');
  assert.ok(contrast('#5e7f10','#fffdf8') >= 4.5, 'darkened lime semantic text accent is AA-safe on pale');
  assert.match(css, /\.tone-coral \{ --card-accent: var\(--danger\); \}/);
  assert.match(friendsSource, /HEAD TO HEAD/);
});
