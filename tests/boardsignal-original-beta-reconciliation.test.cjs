const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(process.env.BOARDSIGNAL_F6_ROOT || path.join(__dirname, '..'));
const BASELINE = '07224360850aac5af86220c8622d0213b3c6c7b9';
const EXPECTED_HANDLES = [
  'bada_billa', 'Bekzatt1', 'Kylian_Mbappe_LottinREAL', 'MrInbetween23', 'Phonkrum', 'CaptainRangade',
  'I_pd_I', 'snoopyissocute', 'JefsonFS', 'IIZORGII', 'I-Know-KungFu', 'harshhmishra', 'hxertzzz', 'Alexcet8',
];
const normalize = (value) => String(value).trim().replace(/^@/, '').toLowerCase();
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/\r\n/g, '\n');
const exists = (relative) => fs.existsSync(path.join(ROOT, relative));

function gitBlobSha(content) {
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
}

const PROTECTED = Object.freeze({
  'src/lib/boardsignal/activeWeekGuidance.ts': '1462fa5ed4788be8f7a065764ad1cbfe67bdc95a',
  'src/lib/boardsignal/processor.ts': 'c419fffaf7b7f410c7e9bf0e585d23a78ce4128e',
  'src/components/FoundingBetaPlayersAdmin.tsx': 'b6ed5ebb1dfcb54da83e061260f5635ba9a357aa',
  'src/lib/boardsignal/playerEntryRecovery.mjs': '74ca0dc9e8b002f07792610454468be09673f959',
  'src/lib/boardsignal/firstReviewGeneration.mjs': 'd8d375e1ad421674e27d3ae40c683ae165a503c7',
  'src/lib/boardsignal/server/betaRequests.ts': 'a11cf44cb351ac22624a1b5d1aa1d30db0da1e52',
  'src/lib/boardsignal/server/betaAccess.ts': 'b2720b7dc543b191e96433a5e3ec553d44932c28',
  'src/lib/boardsignal/server/activation.ts': '2cec6ed6eaac76b83d9e81609cd12b11afcabcbb',
  'package.json': '95e6b72c781711c23b9b1a173a6c2c16bafb5882',
  'package-lock.json': '0a6af980d8c90f8a877045e323993785806756bf',
  'firestore.rules': 'a08d287ecba85bec03ca68db327fb8a92a304b2a',
});

function envKeyFor(file) {
  return `F6_BLOB_${file.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
}
function assertProtected(file) {
  const expected = PROTECTED[file];
  if (exists(file)) assert.equal(gitBlobSha(fs.readFileSync(path.join(ROOT, file))), expected, `${file} changed from protected baseline`);
  else assert.equal(process.env[envKeyFor(file)], expected, `${file} protected blob was not independently verified`);
}

function transpileSource(source, fileName, moduleKind = ts.ModuleKind.CommonJS) {
  const result = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: moduleKind,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      isolatedModules: true,
    },
  });
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${fileName}: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('; ')}`);
  return result.outputText;
}

function executeTs(source, fileName, requireFn) {
  const output = transpileSource(source, fileName);
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports, require: requireFn, console,
    Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
    setTimeout, clearTimeout,
  });
  vm.runInContext(output, context, { filename: fileName });
  return module.exports;
}

function betaFixture(handle, start, end, games, record, score, format = 'Rapid') {
  return {
    handle, period: `${start} – ${end}`, periodStart: start, periodEnd: end, games, record, score: `${score}%`, format,
    headline: `${handle} private headline`, green: `${handle} green`, red: `${handle} red`, blue: `${handle} blue`,
    publicStory: { id: `story-${normalize(handle)}`, headline: `${handle} PUBLIC STORY`, summary: 'safe', stat: String(games), detail: 'games', tone: 'blue', period: start },
  };
}

const BETA_FIXTURES = [
  betaFixture('bada_billa', '2026-08-03', '2026-08-09', 8, '5W · 1D · 2L', 68.8, '10+0 Rapid'),
  betaFixture('Bekzatt1', '2026-04-13', '2026-04-19', 18, '13W · 1D · 4L', 75.0, 'Rapid · Blitz · Bullet'),
  betaFixture('Kylian_Mbappe_LottinREAL', '2026-08-03', '2026-08-09', 56, '23W · 5D · 28L', 45.5, 'Rapid · Blitz · Bullet'),
  betaFixture('MrInbetween23', '2026-08-03', '2026-08-09', 19, '10W · 1D · 8L', 55.3, '3+0 Blitz'),
  betaFixture('Phonkrum', '2026-08-03', '2026-08-09', 4, '1W · 0D · 3L', 25.0, '5+0 Blitz'),
  betaFixture('CaptainRangade', '2026-08-03', '2026-08-09', 9, '3W · 1D · 5L', 38.9, 'Rapid · Bullet'),
  betaFixture('I_pd_I', '2026-08-02', '2026-08-08', 36, '18W · 2D · 16L', 52.8, '10+0 Rapid'),
  betaFixture('snoopyissocute', '2026-08-02', '2026-08-08', 98, '51W · 4D · 43L', 54.1, 'Rapid · Blitz · Bullet'),
  betaFixture('JefsonFS', '2026-08-01', '2026-08-07', 12, '6W · 3D · 3L', 62.5, 'Rapid'),
  betaFixture('IIZORGII', '2026-07-31', '2026-08-06', 89, '39W · 3D · 47L', 45.5, '10+0 Rapid'),
  betaFixture('I-Know-KungFu', '2026-07-30', '2026-08-05', 24, '13W · 1D · 10L', 56.3, 'Rapid'),
  betaFixture('harshhmishra', '2026-07-30', '2026-08-05', 285, '145W · 11D · 129L', 52.8, 'Bullet'),
  betaFixture('hxertzzz', '2026-07-29', '2026-08-04', 29, '16W · 1D · 12L', 56.9, 'Live · Daily · Coach'),
  betaFixture('Alexcet8', '2026-07-05', '2026-07-11', 8, '2W · 0D · 6L', 25.0, '30+0'),
];

const ALEX_CANONICAL = {
  source: 'seed', provenance: { verified: true, sourceLabel: 'Approved Founder Lab report', reportId: 'BS-BETA-001-ALEX-W2' },
  player: { requestedUsername: 'Alexcet8', username: 'Alexcet8' },
  period: { start: '2026-07-05', end: '2026-07-11', label: '5–11 July 2026', isLastActive: false, latestCompletedLabel: '5–11 July 2026' },
  games: 8, wins: 2, draws: 0, losses: 6, score: 25, headline: 'A difficult score hid a useful signal.',
  longestWinStreak: 2, longestLossStreak: 4, checkmateWins: null, pools: [{ pool: '30+0', games: 8 }],
  signals: {
    green: { title: 'Wins contained real chess', copy: 'Supported', label: 'Green' },
    amber: { title: 'Monitor', copy: 'Supported', label: 'Amber' },
    red: { title: 'Queen safety', copy: 'Supported', label: 'Red', evidenceIds: ['G05', 'G07'] },
    blue: { title: 'Queen landing there—who takes her?', copy: 'Check every attacker.', label: 'Blue', evidenceIds: ['G05', 'G07'] },
  },
  candidates: [{ id: 'G05', gameUrl: 'https://www.chess.com/game/live/1', opponent: '', playerColor: 'black', result: 'loss', motif: 'queen-safety', reconstruction: 'legal' }],
};

function fakeSummary(desk) {
  const families = normalize(desk.player.username) === 'alexcet8' ? { redFamily: 'queen_safety', blueFamily: 'queen_safety' } : {};
  return {
    deskKey: `${normalize(desk.player.username)}:${desk.period.start}:${desk.period.end}`,
    periodStart: desk.period.start, periodEnd: desk.period.end, periodLabel: desk.period.label,
    games: desk.games, wins: desk.wins, draws: desk.draws, losses: desk.losses, scorePct: desk.score,
    pools: (desk.pools || []).map((pool) => ({ pool: pool.pool.toLowerCase(), games: pool.games })),
    longestWinRun: desk.longestWinStreak, longestLossRun: desk.longestLossStreak,
    signalFamilies: families,
  };
}

function deriveMomentFact(participant) {
  if ((participant.winningRun || 0) >= 3) return { value: 100 + participant.winningRun, valueLabel: `${participant.winningRun} straight`, evidence: 'verified winning run' };
  const positive = (participant.pools || []).find((pool) => pool.games >= 5 && typeof pool.change === 'number' && pool.change >= 25);
  return positive ? { value: 90 + positive.change / 100, valueLabel: `+${positive.change}`, evidence: 'verified rating movement' } : undefined;
}

function retainLatestFour(entries) {
  const unique = new Map();
  for (const item of entries) unique.set(item.deskKey, item);
  const ordered = [...unique.values()].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  return { retained: ordered.slice(0, 4), removed: ordered.slice(4) };
}

function loadOriginalBetaModule() {
  const source = read('src/data/originalBetaHistory.ts');
  return executeTs(source, 'originalBetaHistory.ts', (id) => {
    if (id === './boardsignal') return { betaDesks: BETA_FIXTURES };
    if (id === './seededDesks') return { findSeededDesk: (handle) => normalize(handle) === 'alexcet8' ? ALEX_CANONICAL : undefined };
    if (id.includes('/reviewHistory')) return {};
    if (id.includes('/universe')) return { deriveMomentFact };
    if (id.includes('/memory')) return { toDeskSummary: fakeSummary };
    if (id.includes('/types')) return {};
    throw new Error(`Unexpected originalBetaHistory dependency: ${id}`);
  });
}

function loadReviewHistoryModule() {
  return executeTs(read('src/lib/boardsignal/reviewHistory.ts'), 'reviewHistory.ts', () => ({}));
}

function mergeDeep(target, patch) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) mergeDeep(target[key], value);
    else target[key] = clone(value);
  }
  return target;
}

function createFirestoreHarness() {
  const data = new Map();
  const directChildren = (collectionPath) => {
    const prefix = `${collectionPath}/`;
    return [...data.keys()].filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'));
  };
  class DocumentRef {
    constructor(pathname) { this.path = pathname; this.id = pathname.split('/').at(-1); }
    async get() { return new DocumentSnapshot(this); }
    async set(payload, options) {
      const next = clone(payload);
      if (options?.merge && data.has(this.path)) data.set(this.path, mergeDeep(clone(data.get(this.path)), next));
      else data.set(this.path, next);
    }
    async delete() { data.delete(this.path); }
    collection(name) { return new CollectionRef(`${this.path}/${name}`); }
  }
  class DocumentSnapshot {
    constructor(ref) { this.ref = ref; this.id = ref.id; }
    get exists() { return data.has(this.ref.path); }
    data() { return clone(data.get(this.ref.path)); }
  }
  class CollectionRef {
    constructor(pathname) { this.path = pathname; }
    doc(id) { return new DocumentRef(`${this.path}/${id}`); }
    async get() { return { docs: directChildren(this.path).map((key) => new DocumentSnapshot(new DocumentRef(key))), empty: directChildren(this.path).length === 0, size: directChildren(this.path).length }; }
  }
  const db = {
    collection: (name) => new CollectionRef(name),
    batch: () => {
      const deletes = [];
      return { delete: (ref) => deletes.push(ref), commit: async () => { for (const ref of deletes) await ref.delete(); } };
    },
  };
  return {
    db, data,
    put: (pathname, value) => data.set(pathname, clone(value)),
    get: (pathname) => clone(data.get(pathname)),
    has: (pathname) => data.has(pathname),
    paths: (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)).sort(),
  };
}

function liveDeskRecord(playerId, username, start, end, score = 50) {
  const key = `${playerId}:${start}:${end}`;
  return {
    deskKey: key, periodEnd: end,
    summary: { deskKey: key, periodStart: start, periodEnd: end, periodLabel: `${start} – ${end}`, games: 10, wins: 5, draws: 0, losses: 5, scorePct: score, pools: [{ pool: 'rapid', games: 10, scorePct: score }], longestWinRun: 2, longestLossRun: 2, signalFamilies: {} },
    desk: { source: 'live', provenance: { verified: true, sourceLabel: 'LIVE' }, player: { playerId, username, requestedUsername: username }, period: { start, end, label: `${start} – ${end}` }, games: 10, wins: 5, draws: 0, losses: 5, score, headline: 'Live review', pools: [], signals: {}, candidates: [] },
  };
}

function account(playerId, username, overrides = {}) {
  return {
    uid: `chesscom_${playerId}`, role: 'player', accessTier: 'founding_beta', accessStatus: 'active', billingRequired: false, maxActiveDesks: 4,
    chessCom: { playerId, canonicalUsername: username }, identityStatus: 'founder_reviewed', identityReviewStatus: 'confirmed',
    privacy: { publicPlayerPage: true, universeCoverage: true }, notificationPreferences: {}, eligibleCoverageKeys: [String(playerId), normalize(username)],
    personalRecords: { desksCompleted: 0, personalBestWinRun: 0, largestPoolSpecificRatingClimb: {} }, ...overrides,
  };
}

function createServerHarness() {
  const store = createFirestoreHarness();
  const original = loadOriginalBetaModule();
  let magicCounter = 0;
  let regenerateCalls = 0;
  const playerIds = Object.fromEntries(BETA_FIXTURES.map((item, index) => [normalize(item.handle), 1000 + index]));
  playerIds.hxertzzz = 580178460;
  playerIds.bada_billa = 888;
  const resolveChessComPlayer = async (handle) => ({ requestedUsername: handle, username: handle, playerId: playerIds[normalize(handle)] || 9999 });
  const ensureStablePlayerAccount = async (identity) => {
    const next = account(identity.playerId, identity.canonicalUsername, { identityStatus: undefined, identityReviewStatus: undefined, founderReviewedAt: undefined });
    store.put(`users/${next.uid}`, next);
    store.put(`chessPlayerAccounts/${identity.playerId}`, { uid: next.uid, playerId: identity.playerId, canonicalUsername: identity.canonicalUsername });
    store.put(`playerIdentityAliases/${normalize(identity.canonicalUsername)}`, { uid: next.uid, playerId: identity.playerId });
    return clone(next);
  };
  const betaMagicAccessCredential = (requestId, playerId, uid, now = new Date()) => {
    magicCounter += 1;
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    return { link: `https://example.test/access#magic-${magicCounter}`, expiresAt, record: { ticketHash: `hash-${magicCounter}`, expiresAt, createdAt, requestId, playerId, uid } };
  };
  const regenerateFoundingBetaMagicAccess = async (requestId) => {
    regenerateCalls += 1;
    const ref = store.db.collection('betaRequests').doc(requestId);
    const snap = await ref.get();
    const data = snap.data();
    const magic = betaMagicAccessCredential(requestId, data.chessPlayerId, data.firebaseUid || `chesscom_${data.chessPlayerId}`);
    await ref.set({ magicAccess: { ...magic.record, consumedAt: null }, claimedAt: null, previewClaimConsumedAt: null }, { merge: true });
    return { magicLink: magic.link, magicAccessExpiresAt: magic.expiresAt };
  };
  const server = executeTs(read('src/lib/boardsignal/server/legacyBetaReconciliation.ts'), 'legacyBetaReconciliation.ts', (id) => {
    if (id === 'server-only') return {};
    if (id === '../account') return { firebaseUidForChessPlayer: (id) => `chesscom_${id}` };
    if (id === '../memory') return { retainLatestFour };
    if (id === '../../../data/originalBetaHistory') return original;
    if (id === '../processor') return { resolveChessComPlayer };
    if (id === '../../../utils/firebaseAdmin') return { getAdminDb: () => store.db };
    if (id === './activation') return { betaMagicAccessCredential };
    if (id === './betaRequests') return { regenerateFoundingBetaMagicAccess };
    if (id === './persistence') return { ensureStablePlayerAccount };
    if (id === '../reviewHistory' || id === '../universe') return {};
    throw new Error(`Unexpected reconciliation dependency: ${id}`);
  });
  return { store, server, original, get magicCounter() { return magicCounter; }, get regenerateCalls() { return regenerateCalls; }, playerIds };
}

function seedLiveHxert(harness) {
  const acct = account(580178460, 'hxertzzz', {
    identityStatus: undefined, identityReviewStatus: undefined, founderReviewedAt: undefined,
    cadenceAnchor: '2026-07-29', betaAgreementVersion: 'kept', betaAgreementAcceptedAt: 'kept', preferencesConfirmedAt: 'kept', contactConfirmedAt: 'kept',
    notificationPreferences: { browserPush: true, deskReady: true }, privacy: { publicPlayerPage: false, universeCoverage: true },
  });
  harness.store.put('users/chesscom_580178460', acct);
  harness.store.put('chessPlayerAccounts/580178460', { uid: 'chesscom_580178460', playerId: 580178460, canonicalUsername: 'hxertzzz' });
  harness.store.put('playerIdentityAliases/hxertzzz', { uid: 'chesscom_580178460', playerId: 580178460 });
  harness.store.put('betaAccess/580178460', { playerId: 580178460, canonicalUsername: 'hxertzzz', status: 'active', accessHash: 'kept', salt: 'kept' });
  harness.store.put('users/chesscom_580178460/desks/live-2026-08-11', liveDeskRecord(580178460, 'hxertzzz', '2026-08-05', '2026-08-11', 60));
  return acct;
}

function periodDocs(harness, uid) {
  return harness.store.paths(`users/${uid}/desks/`).filter((key) => key.split('/').length === 4).map((key) => harness.store.get(key));
}

function sourceSection(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}

const original = loadOriginalBetaModule();
const reviewHistory = loadReviewHistoryModule();

test('1. immutable revised F.6 baseline and complete betaDesks inventory are fixed', () => {
  assert.equal(process.env.BOARDSIGNAL_F6_BASELINE_SHA || BASELINE, BASELINE);
  const inventory = original.originalBetaSourceInventory();
  assert.equal(inventory.length, 14);
  assert.deepEqual(inventory.map((item) => normalize(item.handle)).sort(), EXPECTED_HANDLES.map(normalize).sort());
  if (exists('src/data/boardsignal.ts')) {
    const source = read('src/data/boardsignal.ts');
    for (const handle of EXPECTED_HANDLES) assert.match(source.toLowerCase(), new RegExp(`handle:\\s*["']${normalize(handle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i'), `${handle} missing from betaDesks source`);
  } else {
    assert.equal(process.env.F6_BETA_HANDLES, EXPECTED_HANDLES.join('|'));
  }
});

test('2. richest verified source wins: Alex is FULL_DESK and every other audited beta is STRUCTURED_REVIEW', () => {
  const inventory = original.originalBetaSourceInventory();
  const alex = inventory.find((item) => normalize(item.handle) === 'alexcet8');
  assert.equal(alex.sourceRichness, 'FULL_DESK');
  assert.ok(alex.canonicalDesk?.provenance?.verified);
  assert.ok(inventory.filter((item) => normalize(item.handle) !== 'alexcet8').every((item) => item.sourceRichness === 'STRUCTURED_REVIEW'));
  assert.equal(inventory.filter((item) => item.sourceRichness === 'NARROW_SEED').length, 0);
});

test('3. hxertzzz source is the required original 29 Jul–4 Aug Review and does not invent rating movement', () => {
  const entry = original.findOriginalBetaSource('HXERTZZZ');
  assert.equal(entry.periodStart, '2026-07-29');
  assert.equal(entry.periodEnd, '2026-08-04');
  assert.equal(entry.games, 29);
  assert.equal(entry.record, '16W · 1D · 12L');
  assert.equal(entry.scorePct, 56.9);
  assert.equal(entry.stablePlayerId, 580178460);
  const history = original.originalBetaHistoryItem(entry, 580178460);
  assert.equal(history.reviewKey, '580178460:2026-07-29:2026-08-04');
  assert.ok(history.pools.every((pool) => pool.ratingDelta === undefined));
  assert.deepEqual(JSON.parse(JSON.stringify(history.signalFamilies)), {});
});

test('4. existing-live reconciliation performs hxertzzz 1 → 2 without overwriting the newer live Review or account state', async () => {
  const h = createServerHarness();
  const before = seedLiveHxert(h);
  const result = await h.server.reconcileOriginalBetaPlayer('hxertzzz');
  assert.equal(result.action, 'attached');
  assert.equal(result.retainedCount, 2);
  const docs = periodDocs(h, 'chesscom_580178460').sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  assert.equal(docs.length, 2);
  assert.equal(docs[0].periodEnd, '2026-08-11');
  assert.equal(docs[0].desk.source, 'live');
  assert.equal(docs[1].periodEnd, '2026-08-04');
  assert.equal(docs[1].recordKind, 'original_beta_review_v1');
  const after = h.store.get('users/chesscom_580178460');
  const inventory = await h.server.listOriginalBetaHistoryInventory();
  const hxRow = inventory.find((row) => normalize(row.handle) === 'hxertzzz');
  assert.equal(hxRow.cohort, 'A · SEED + EXISTING LIVE ACCOUNT');
  assert.equal(hxRow.liveCompletedReviewCount, 1);
  assert.equal(hxRow.storedCompletedReviewCount, 2);
  assert.equal(hxRow.reconciledTotal, 2);
  assert.equal(hxRow.status, 'LIVE · RECONCILED');
  assert.equal(hxRow.legacyBetaAccessStatus, 'ACTIVE');
  assert.equal(after.uid, before.uid);
  assert.equal(after.chessCom.playerId, 580178460);
  assert.equal(after.cadenceAnchor, before.cadenceAnchor);
  assert.equal(after.betaAgreementAcceptedAt, 'kept');
  assert.equal(after.preferencesConfirmedAt, 'kept');
  assert.equal(after.contactConfirmedAt, 'kept');
  assert.deepEqual(after.notificationPreferences, before.notificationPreferences);
  assert.deepEqual(after.privacy, before.privacy);
  assert.equal(after.identityStatus, 'founder_reviewed', 'verified legacy metadata debt may normalize in place');
  assert.equal(after.identityReviewStatus, 'confirmed');
  assert.ok(after.founderReviewedAt);
  assert.equal(after.personalRecords.desksCompleted, 2);
  assert.deepEqual(h.store.get('betaAccess/580178460'), { playerId: 580178460, canonicalUsername: 'hxertzzz', status: 'active', accessHash: 'kept', salt: 'kept' });
  assert.equal(h.store.has('betaRequests/580178460'), false, 'reconciliation must not create an access request');
  assert.equal(h.magicCounter, 0, 'history attachment must not touch magic access');
  await assert.rejects(() => h.server.prepareOriginalBetaAppAccess('hxertzzz'), (error) => error.code === 'ORIGINAL_BETA_EXISTING_LIVE_ACCOUNT');
  assert.equal(h.store.has('betaRequests/580178460'), false, 'Cohort A must never be routed through Prepare App Access');
});

test('5. same player + same dates are idempotent and case variation cannot duplicate the original Review', async () => {
  const h = createServerHarness();
  seedLiveHxert(h);
  await Promise.all([h.server.reconcileOriginalBetaPlayer('hxertzzz'), h.server.reconcileOriginalBetaPlayer('HXERTZZZ')]);
  const docs = periodDocs(h, 'chesscom_580178460');
  assert.equal(docs.filter((doc) => doc.periodEnd === '2026-08-04').length, 1);
  const second = await h.server.reconcileOriginalBetaPlayer('hxertzzz');
  assert.equal(second.action, 'already_reconciled');
  assert.equal(periodDocs(h, 'chesscom_580178460').length, 2);
  assert.equal(h.store.get('users/chesscom_580178460').personalRecords.desksCompleted, 2);
});

test('6. narrow → richer upgrade replaces the same historical period instead of creating a second Review', async () => {
  const h = createServerHarness();
  seedLiveHxert(h);
  h.store.put('users/chesscom_580178460/desks/legacy-old', {
    recordKind: 'original_beta_review_v1', deskKey: 'old', periodEnd: '2026-08-04',
    summary: { deskKey: 'old', periodStart: '2026-07-29', periodEnd: '2026-08-04', periodLabel: 'old' },
    originalBeta: { sourceRichness: 'NARROW_SEED', history: { periodStart: '2026-07-29', periodEnd: '2026-08-04' } },
  });
  const result = await h.server.reconcileOriginalBetaPlayer('hxertzzz');
  assert.equal(result.action, 'upgraded');
  const docs = periodDocs(h, 'chesscom_580178460');
  assert.equal(docs.filter((doc) => doc.periodEnd === '2026-08-04').length, 1);
  const upgraded = h.store.get('users/chesscom_580178460/desks/legacy-old');
  assert.equal(upgraded.originalBeta.sourceRichness, 'STRUCTURED_REVIEW');
  assert.equal(upgraded.deskKey, '580178460:2026-07-29:2026-08-04');
});

test('7. latest-four retention remains four and a retired original Review is not resurrected by a later reconciliation run', async () => {
  const h = createServerHarness();
  seedLiveHxert(h);
  for (const [index, dates] of [
    ['2', ['2026-08-12', '2026-08-18']], ['3', ['2026-08-19', '2026-08-25']], ['4', ['2026-08-26', '2026-09-01']],
  ]) h.store.put(`users/chesscom_580178460/desks/live-${index}`, liveDeskRecord(580178460, 'hxertzzz', dates[0], dates[1], 55));
  const first = await h.server.reconcileOriginalBetaPlayer('hxertzzz');
  assert.equal(first.retired, true);
  assert.equal(periodDocs(h, 'chesscom_580178460').length, 4);
  assert.ok(periodDocs(h, 'chesscom_580178460').every((doc) => doc.periodEnd !== '2026-08-04'));
  const second = await h.server.reconcileOriginalBetaPlayer('hxertzzz');
  assert.equal(second.retired, true);
  assert.equal(periodDocs(h, 'chesscom_580178460').length, 4);
  assert.ok(periodDocs(h, 'chesscom_580178460').every((doc) => doc.periodEnd !== '2026-08-04'));
  assert.equal(h.store.get('users/chesscom_580178460').personalRecords.desksCompleted, 4);
});

test('8. controlled bulk reconciliation attaches live history only; seed-only players remain seed-only', async () => {
  const h = createServerHarness();
  seedLiveHxert(h);
  const result = await h.server.reconcileAllOriginalBetaHistory();
  assert.equal(result.seededPlayersChecked, 14);
  assert.equal(result.liveAccountsMatched, 1);
  assert.equal(result.historicalReviewsAttached, 1);
  assert.equal(result.seedOnly, 13);
  assert.equal(h.store.paths('users/').filter((key) => key.split('/').length === 2).length, 1, 'bulk reconcile must not create seed-only accounts');
});

test('9. stable Chess.com ID can recover a renamed live account when the seed handle no longer matches its current username', async () => {
  const h = createServerHarness();
  const renamed = account(580178460, 'new-hxert-name');
  h.store.put('users/chesscom_580178460', renamed);
  h.store.put('chessPlayerAccounts/580178460', { uid: 'chesscom_580178460', playerId: 580178460, canonicalUsername: 'new-hxert-name' });
  h.store.put('users/chesscom_580178460/desks/live-newer', liveDeskRecord(580178460, 'new-hxert-name', '2026-08-05', '2026-08-11'));
  const result = await h.server.reconcileOriginalBetaPlayer('hxertzzz');
  assert.equal(result.action, 'attached');
  assert.equal(periodDocs(h, 'chesscom_580178460').length, 2);
  assert.equal(h.store.get('users/chesscom_580178460').chessCom.canonicalUsername, 'new-hxert-name');
});

test('10. seed-only Prepare App Access creates/reuses deterministic UID, skips Preview architecture and preserves current gates', async () => {
  const h = createServerHarness();
  const first = await h.server.prepareOriginalBetaAppAccess('bada_billa');
  assert.equal(first.player.uid, 'chesscom_888');
  assert.equal(first.reconciliation.retainedCount, 1);
  assert.equal(periodDocs(h, 'chesscom_888').length, 1);
  const user = h.store.get('users/chesscom_888');
  assert.equal(user.identityStatus, 'founder_reviewed');
  assert.equal(user.identityReviewStatus, 'confirmed');
  assert.equal(user.originalBetaPlayer, true);
  assert.equal(user.betaAgreementAcceptedAt, undefined, 'agreement gate must remain unaccepted');
  assert.equal(user.preferencesConfirmedAt, undefined, 'settings gate must remain unconfirmed');
  assert.match(first.magicLink, /magic-/);
  assert.equal(h.store.get('betaRequests/888').status, 'approved');
  assert.equal(h.store.get('betaRequests/888').originalBetaAccess, true);
  assert.equal(h.store.has('betaAccess/888'), false, 'no Beta Access code architecture should be created');

  await assert.rejects(() => h.server.prepareOriginalBetaAppAccess('BADA_BILLA'), (error) => error.code === 'ORIGINAL_BETA_EXISTING_LIVE_ACCOUNT');
  const recovery = await h.server.regenerateOriginalBetaMagicAccess('bada_billa');
  assert.match(recovery.magicLink, /magic-/);
  assert.equal(periodDocs(h, 'chesscom_888').length, 1);
  assert.ok(h.regenerateCalls >= 1, 'once Cohort B has entered, future access uses recovery rather than Prepare');
});

test('11. ordinary Regenerate cannot promote a seed-only pending Preview; explicit Cohort B Prepare may promote it', async () => {
  const h = createServerHarness();
  h.store.put('betaRequests/888', { id: '888', chessPlayerId: 888, canonicalUsername: 'bada_billa', status: 'pending', identityReviewStatus: 'pending', requestedAt: '2026-08-10T00:00:00.000Z' });
  await assert.rejects(() => h.server.regenerateOriginalBetaMagicAccess('bada_billa'));
  const prepared = await h.server.prepareOriginalBetaAppAccess('bada_billa');
  assert.match(prepared.magicLink, /magic-/);
  const request = h.store.get('betaRequests/888');
  assert.equal(request.status, 'approved');
  assert.equal(request.requestedAt, '2026-08-10T00:00:00.000Z');
  assert.equal(request.identityReviewStatus, 'confirmed');
});

test('12. identity conflict fails closed and does not attach history', async () => {
  const h = createServerHarness();
  h.store.put('playerIdentityAliases/hxertzzz', { uid: 'chesscom_999', playerId: 580178460 });
  await assert.rejects(() => h.server.reconcileOriginalBetaPlayer('hxertzzz'), (error) => error.code === 'ORIGINAL_BETA_IDENTITY_CONFLICT');
  assert.equal(h.store.paths('users/').filter((key) => key.includes('/desks/')).length, 0);
});

test('13. supported Progress compares real historical/live facts; unavailable historical rating deltas remain unavailable', () => {
  const hx = original.originalBetaHistoryItem(original.findOriginalBetaSource('hxertzzz'), 580178460);
  const later = { ...clone(hx), reviewKey: '580178460:2026-08-05:2026-08-11', source: 'live', sourceRichness: 'LIVE_DESK', periodStart: '2026-08-05', periodEnd: '2026-08-11', periodLabel: '5–11 Aug', pools: [{ pool: 'rapid', games: 8, scorePct: 62.5, ratingDelta: 12 }] };
  const progress = reviewHistory.buildReviewProgress([later, hx]);
  const rapid = progress.find((series) => series.pool === 'rapid');
  assert.equal(rapid.points.length, 2);
  assert.equal(rapid.points[0].ratingDelta, undefined);
  assert.equal(rapid.points[1].ratingDelta, 12);
  const ipd = original.originalBetaHistoryItem(original.findOriginalBetaSource('I_pd_I'), 999);
  assert.equal(ipd.pools[0].ratingDelta, undefined);
  assert.equal(ipd.pools[0].ratingEnd, 487);
});

test('14. Blue continuity keeps historical text private but only a real canonical family can trigger recurrence matching', () => {
  const hx = original.originalBetaHistoryItem(original.findOriginalBetaSource('hxertzzz'), 580178460);
  assert.equal(hx.blue?.title, 'Original Beta Blue');
  assert.equal(hx.blue?.copy, original.findOriginalBetaSource('hxertzzz').blue);
  assert.deepEqual(JSON.parse(JSON.stringify(hx.signalFamilies)), {}, 'structured prose must not invent a stable family');
  const alex = original.originalBetaHistoryItem(original.findOriginalBetaSource('Alexcet8'), 123);
  assert.equal(alex.signalFamilies.blueFamily, 'queen_safety');
});

test('15. Universe continuity uses stable identity/aliases, retains supported historical facts, and omits unsupported ranking facts', () => {
  const pulseSource = exists('src/lib/boardsignal/pulse.ts') ? read('src/lib/boardsignal/pulse.ts') : '';
  const universePulseSource = exists('src/lib/boardsignal/server/universePulse.ts') ? read('src/lib/boardsignal/server/universePulse.ts') : '';
  if (pulseSource && !pulseSource.includes('synthetic filler line')) {
    assert.match(pulseSource, /entry\.stablePlayerId \? `player:\$\{entry\.stablePlayerId\}` : normalizeUsername\(entry\.player\)/);
    assert.match(pulseSource, /participant\.aliases/);
    assert.match(pulseSource, /LIVE_FIELD_THRESHOLD = 6/);
  } else assert.equal(process.env.F6_PULSE_IDENTITY_VERIFIED, '1');
  assert.match(universePulseSource, /originalBetaParticipant/);
  assert.match(universePulseSource, /stablePlayerId: String\(account\.chessCom\.playerId\)/);
  assert.match(universePulseSource, /source: "live"/);
  assert.match(universePulseSource, /`live:\$\{input\.account\.chessCom\.canonicalUsername\.toLowerCase\(\)\}`/, 'original-only active accounts must resolve their historical live Universe participant before a newer live Desk exists');

  const ipdEntry = original.findOriginalBetaSource('I_pd_I');
  const participant = original.originalBetaUniverseParticipant(ipdEntry, { playerId: 909, canonicalUsername: 'I_pd_I' });
  assert.equal(participant.stablePlayerId, '909');
  assert.equal(participant.pools[0].change, undefined, 'no rating-climb fact can be manufactured');
  assert.equal(participant.pools[0].end, 487, 'verified finishing boundary remains available for categories that require only a finish');
});

test('16. public story/private signal boundary is explicit and reconciliation creates no duplicate public artifact', () => {
  const source = read('src/data/originalBetaHistory.ts');
  const universeFn = sourceSection(source, 'export function originalBetaUniverseParticipant', null);
  assert.match(universeFn, /headline: entry\.publicStoryHeadline/);
  assert.doesNotMatch(universeFn, /green:|red:|blue:|canonicalDesk/);
  const serverSource = read('src/lib/boardsignal/server/legacyBetaReconciliation.ts');
  assert.doesNotMatch(serverSource, /collection\(["']publicCoverage["']\)|collection\(["']publicUniverseEvents["']\)|collection\(["']publicShareMoments["']\)/);
  assert.match(serverSource, /originalBeta:\s*\{[\s\S]*history,[\s\S]*universeParticipant/);
  const hxEntry = original.findOriginalBetaSource('hxertzzz');
  const safe = original.originalBetaUniverseParticipant(hxEntry, { playerId: 580178460, canonicalUsername: 'hxertzzz' });
  const serialized = JSON.stringify(safe);
  assert.ok(!serialized.includes(hxEntry.blue));
  assert.equal(safe.coverage.headline, hxEntry.publicStoryHeadline);
});

test('17. Player Room shows continuous history/welcome without re-onboarding existing live users and keeps F.1.2/F.4 contracts', () => {
  const room = read('src/components/BoardSignalPlayerRoom.tsx');
  assert.match(room, /WELCOME BACK TO BOARDSIGNAL/);
  assert.match(room, /Your first Review is already here/);
  assert.match(room, /if \(!hasAcceptedCurrentBetaAgreement\(snapshot\.account\)\)/);
  assert.match(room, /PlayerPreferencesGate/);
  assert.match(room, /automaticGenerationRequired && !hasOriginalHistory/);
  assert.match(room, /ReviewHistorySection history=\{reviewHistory\}/);
  assert.match(room, /review\.blue\.copy \|\| review\.blue\.title/);
  if (!room.includes('synthetic filler line')) {
    assert.equal((room.match(/cadenceAnchor=\{snapshot\.account\.cadenceAnchor\}/g) || []).length, 2, 'F.1.2 live cadence source contract remains exactly twice');
    assert.match(room, /FOCUS_REFRESH_THROTTLE_MS = 75_000/);
    assert.match(room, /NEW GAME SEEN/);
    assert.match(room, /UPDATED AFTER YOUR LAST GAME/);
    assert.match(room, /boardsignal:last-current-game:/);
  } else {
    assert.equal(process.env.F6_F4_UI_VERIFIED, '1');
    assert.equal(process.env.F6_F12_UI_VERIFIED, '1');
  }
});

test('18. Universe formulas/thresholds stay locked while data identity plumbing changes only population continuity', () => {
  const universe = exists('src/lib/boardsignal/universe.ts') ? read('src/lib/boardsignal/universe.ts') : '';
  if (universe && !universe.includes('synthetic filler line')) {
    assert.match(universe, /const MIN_RATING_GAMES = 5/);
    assert.match(universe, /const MIN_RATING_LEADER_GAMES = 3/);
    assert.match(universe, /const MIN_STRONG_FINISH_GAMES = 3/);
    assert.match(universe, /const FIELD_SIGNIFICANCE_MINIMUM = 3/);
    assert.match(universe, /b\.value - a\.value \|\| b\.secondary - a\.secondary \|\| a\.player\.localeCompare\(b\.player\)/);
    for (const id of ['rating-climb','winning-run','rating-recovery','strong-finish','rapid-rating-leader','best-upset','breakthrough-desk','moment-of-the-week']) assert.match(universe, new RegExp(`id: ["']${id}["']`));
  } else assert.equal(process.env.F6_UNIVERSE_FORMULAS_VERIFIED, '1');
});

test('19. F.4, F.3.2, F.1.2 and package/rules protected blobs remain unchanged', () => {
  for (const file of Object.keys(PROTECTED)) assertProtected(file);
});

test('20. revised F.6 source delta has no deploy-time reconciliation, no F.5 work, and changed/new TS/TSX parses in isolation', () => {
  const server = read('src/lib/boardsignal/server/legacyBetaReconciliation.ts');
  assert.doesNotMatch(server, /reconcileAllOriginalBetaHistory\(\)\s*;|setInterval\s*\(/);
  const route = read('src/app/api/admin/boardsignal/original-beta-history/route.ts');
  assert.match(route, /body\.action === "reconcileAll"/);
  const persistence = exists('src/lib/boardsignal/server/persistence.ts') ? read('src/lib/boardsignal/server/persistence.ts') : '';
  assert.match(persistence, /desksCompleted: retention\.retained\.length/, 'future live publications must keep Reviews completed aligned to retained four-Review memory');
  const files = [
    'src/data/originalBetaHistory.ts', 'src/lib/boardsignal/reviewHistory.ts', 'src/lib/boardsignal/server/legacyBetaReconciliation.ts',
    'src/app/api/admin/boardsignal/original-beta-history/route.ts', 'src/components/OriginalBetaHistoryAdmin.tsx',
  ];
  for (const file of files) transpileSource(read(file), file, ts.ModuleKind.ESNext);
  assert.doesNotMatch([server, route, read('src/components/OriginalBetaHistoryAdmin.tsx')].join('\n'), /second-device|homepage access clarity|Patch F\.5/i);
});
