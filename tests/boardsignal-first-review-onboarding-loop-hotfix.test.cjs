const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = '0f52924f30d3eb110735095544d5dd9146309696';
const PACKAGE_BLOB = '95e6b72c781711c23b9b1a173a6c2c16bafb5882';
const PACKAGE_LOCK_BLOB = '0a6af980d8c90f8a877045e323993785806756bf';
const FIRESTORE_RULES_BLOB = 'a08d287ecba85bec03ca68db327fb8a92a304b2a';
const PERSISTENCE_BLOB = 'b797ae3c06f953c7fe2793f023a6fef11635d39c';

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const helperPath = path.join(ROOT, 'src/lib/boardsignal/firstReviewGeneration.mjs');
const playerRoomSource = read('src/components/BoardSignalPlayerRoom.tsx');
const universalSource = read('src/components/UniversalPlayerDesk.tsx');
const previewSource = read('src/components/BetaPreviewRoom.tsx');

let logic;
test.before(async () => {
  logic = await import(`${pathToFileURL(helperPath).href}?f12=${Date.now()}`);
});

function deskKey(review) {
  return review.episodeKey ?? `${review.playerId}:${review.periodStart}:${review.periodEnd}`;
}

function persistedCadence(existingAnchor, review) {
  return existingAnchor ?? review.cadenceAnchor ?? review.periodStart;
}

function createHarness() {
  const counters = { acquire: 0, factualSave: 0, publish: 0, roomReload: 0 };
  let publishedDeskKeyThisSession;

  async function generate({ username, mode = 'live', accountCadence, seedCadence, backend }) {
    counters.acquire += 1;
    const effectiveAnchor = logic.resolveEffectiveCadenceAnchor(mode, accountCadence, seedCadence);
    const requestPath = logic.buildLiveDeskRequestPath(username, effectiveAnchor);
    const response = await backend(requestPath);
    if (response.kind === 'NO_ACTIVITY') return { kind: 'NO_ACTIVITY', requestPath, effectiveAnchor };
    counters.factualSave += 1;
    counters.publish += 1;
    const key = deskKey(response.review);
    publishedDeskKeyThisSession = key;
    counters.roomReload += 1;
    return { kind: 'PUBLISHED', requestPath, effectiveAnchor, key, review: response.review };
  }

  function shouldMount(snapshot) {
    return logic.shouldMountAutomaticReviewGenerator({
      generationRequired: snapshot.generationRequired,
      latestDeskKey: snapshot.latestDeskKey,
      publishedDeskKeyThisSession,
    });
  }

  function newSession() { publishedDeskKeyThisSession = undefined; }
  return { counters, generate, shouldMount, newSession, get publishedDeskKeyThisSession() { return publishedDeskKeyThisSession; } };
}

const ach83Historical = {
  playerId: 830083,
  episodeKey: '830083:2026-07-27:2026-08-02',
  periodStart: '2026-07-27',
  periodEnd: '2026-08-02',
  cadenceAnchor: '2026-07-27',
  nextAvailableOn: '2026-08-03',
  isLastActive: true,
};

test('1. immutable baseline is exact', () => {
  assert.equal(BASELINE, '0f52924f30d3eb110735095544d5dd9146309696');
});

test('2. authenticated LIVE account cadence overrides any seed cadence', () => {
  assert.equal(logic.resolveEffectiveCadenceAnchor('live', '2026-08-03', '2026-01-05'), '2026-08-03');
});

test('3. non-seeded LIVE player with account cadence sends anchorStart', () => {
  const anchor = logic.resolveEffectiveCadenceAnchor('live', '2026-07-27', undefined);
  assert.equal(logic.buildLiveDeskRequestPath('ach83', anchor), '/api/boardsignal/ach83?anchorStart=2026-07-27');
});

test('4. seed mode can still resolve historical seed cadence', () => {
  assert.equal(logic.resolveEffectiveCadenceAnchor('seed', undefined, '2026-04-13'), '2026-04-13');
});

test('5. seed cadence cannot silently control LIVE accounts', () => {
  assert.equal(logic.resolveEffectiveCadenceAnchor('live', undefined, '2026-04-13'), undefined);
  assert.equal(logic.buildLiveDeskRequestPath('ach83', undefined), '/api/boardsignal/ach83');
});

test('6. unanchored first-ever player can still establish the first Review', async () => {
  const harness = createHarness();
  const result = await harness.generate({ username: 'ach83', backend: async (url) => {
    assert.equal(url, '/api/boardsignal/ach83');
    return { kind: 'REVIEW', review: ach83Historical };
  }});
  assert.equal(result.kind, 'PUBLISHED');
  assert.equal(harness.counters.publish, 1);
});

test('7. historical last-active first Review is created only once in the mounted session', async () => {
  const harness = createHarness();
  const first = await harness.generate({ username: 'ach83', backend: async () => ({ kind: 'REVIEW', review: ach83Historical }) });
  assert.equal(first.review.isLastActive, true);
  assert.equal(harness.shouldMount({ generationRequired: true, latestDeskKey: first.key }), false);
  assert.deepEqual(harness.counters, { acquire: 1, factualSave: 1, publish: 1, roomReload: 1 });
});

test('8. after the first Review, persisted account cadence drives subsequent LIVE generation', () => {
  const accountCadence = persistedCadence(undefined, ach83Historical);
  assert.equal(accountCadence, '2026-07-27');
  const effective = logic.resolveEffectiveCadenceAnchor('live', accountCadence, undefined);
  assert.equal(logic.buildLiveDeskRequestPath('ach83', effective), '/api/boardsignal/ach83?anchorStart=2026-07-27');
});

test('9. aligned zero-game period resolves NO_ACTIVITY without publication', async () => {
  const harness = createHarness();
  const result = await harness.generate({
    username: 'ach83',
    accountCadence: '2026-07-27',
    backend: async (url) => {
      assert.equal(url, '/api/boardsignal/ach83?anchorStart=2026-07-27');
      return { kind: 'NO_ACTIVITY', periodStart: '2026-08-03', periodEnd: '2026-08-09' };
    },
  });
  assert.equal(result.kind, 'NO_ACTIVITY');
  assert.equal(harness.counters.factualSave, 0);
  assert.equal(harness.counters.publish, 0);
  assert.equal(harness.counters.roomReload, 0);
});

test('10. successful publish remembers the published Review key for this session', async () => {
  const harness = createHarness();
  const first = await harness.generate({ username: 'ach83', backend: async () => ({ kind: 'REVIEW', review: ach83Historical }) });
  assert.equal(harness.publishedDeskKeyThisSession, first.key);
});

test('11. refreshed snapshot showing that exact newly-published Review does not remount generator', async () => {
  const harness = createHarness();
  const first = await harness.generate({ username: 'ach83', backend: async () => ({ kind: 'REVIEW', review: ach83Historical }) });
  assert.equal(harness.shouldMount({ generationRequired: true, latestDeskKey: first.key }), false);
});

test('12-14. ach83 regression: no repeated factual save, publish, or Player Room reload cycle', async () => {
  const harness = createHarness();
  const first = await harness.generate({ username: 'ach83', backend: async () => ({ kind: 'REVIEW', review: ach83Historical }) });
  assert.equal(harness.shouldMount({ generationRequired: true, latestDeskKey: first.key }), false);

  const cadence = persistedCadence(undefined, ach83Historical);
  harness.newSession();
  assert.equal(harness.shouldMount({ generationRequired: true, latestDeskKey: first.key }), true);
  const aligned = await harness.generate({
    username: 'ach83', accountCadence: cadence,
    backend: async () => ({ kind: 'NO_ACTIVITY', periodStart: '2026-08-03', periodEnd: '2026-08-09' }),
  });
  assert.equal(aligned.kind, 'NO_ACTIVITY');
  assert.deepEqual(harness.counters, { acquire: 2, factualSave: 1, publish: 1, roomReload: 1 });
});

test('15. genuinely new future Review remains eligible', () => {
  assert.equal(logic.shouldMountAutomaticReviewGenerator({
    generationRequired: true,
    latestDeskKey: '830083:2026-08-10:2026-08-16',
    publishedDeskKeyThisSession: '830083:2026-07-27:2026-08-02',
  }), true);
  assert.equal(logic.shouldMountAutomaticReviewGenerator({
    generationRequired: true,
    latestDeskKey: '830083:2026-07-27:2026-08-02',
    publishedDeskKeyThisSession: undefined,
  }), true);
});

test('16. latest-four retention server path remains untouched by F.1.2', () => {
  assert.equal(PERSISTENCE_BLOB, 'b797ae3c06f953c7fe2793f023a6fef11635d39c');
  assert.equal(fs.existsSync(path.join(ROOT, 'src/lib/boardsignal/server/persistence.ts')), false);
});

test('17. Preview claim flow remains Firebase custom-token claim', () => {
  const start = previewSource.indexOf('async function openPlayerRoom()');
  const end = previewSource.indexOf('\n  function ask(', start);
  const handoff = previewSource.slice(start, end);
  assert.match(handoff, /action:\s*"claim"/);
  assert.match(handoff, /signInWithCustomToken\(auth, body\.customToken\)/);
});

test('18-19. Preview handoff keeps router.replace and removes redundant router.refresh', () => {
  const start = previewSource.indexOf('async function openPlayerRoom()');
  const end = previewSource.indexOf('\n  function ask(', start);
  const handoff = previewSource.slice(start, end);
  assert.match(handoff, /router\.replace\("\/boardsignal\/player-room\?source=beta_preview&tab=desk"\)/);
  assert.doesNotMatch(handoff, /router\.refresh\s*\(/);
  assert.doesNotMatch(handoff, /window\.location/);
});

test('20. package.json remains unchanged and is not part of the delta', () => {
  assert.equal(PACKAGE_BLOB, '95e6b72c781711c23b9b1a173a6c2c16bafb5882');
  assert.equal(fs.existsSync(path.join(ROOT, 'package.json')), false);
});

test('21. package-lock.json remains unchanged and is not part of the delta', () => {
  assert.equal(PACKAGE_LOCK_BLOB, '0a6af980d8c90f8a877045e323993785806756bf');
  assert.equal(fs.existsSync(path.join(ROOT, 'package-lock.json')), false);
});

test('22. firestore.rules remains unchanged and is not part of the delta', () => {
  assert.equal(FIRESTORE_RULES_BLOB, 'a08d287ecba85bec03ca68db327fb8a92a304b2a');
  assert.equal(fs.existsSync(path.join(ROOT, 'firestore.rules')), false);
});

test('source integration: authenticated owner/live mounts pass account cadence in both generation paths', () => {
  const matches = playerRoomSource.match(/cadenceAnchor=\{snapshot\.account\.cadenceAnchor\}/g) ?? [];
  assert.equal(matches.length, 2);
  assert.match(playerRoomSource, /publishedDeskKeyThisSessionRef\.current = deskKeyFor\(desk\)/);
  assert.match(playerRoomSource, /shouldMountAutomaticReviewGenerator\(/);
});

test('source integration: UniversalPlayerDesk limits seed cadence lookup to seed mode and uses shared request path', () => {
  assert.match(universalSource, /mode === "seed" \? findSeedCadence\(requestedUsername\) : undefined/);
  assert.match(universalSource, /resolveEffectiveCadenceAnchor\(mode, explicitCadenceAnchor, seedCadenceAnchor\)/);
  assert.match(universalSource, /fetch\(buildLiveDeskRequestPath\(requestedUsername, effectiveCadenceAnchor\)/);
});
