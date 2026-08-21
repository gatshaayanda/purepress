const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = 'f2ac3b908f7e5b8f43748c346bd9760e4bb7b9e7';
const SERVER = 'src/lib/boardsignal/server/betaRequests.ts';
const F31_COMPONENT = 'src/components/FoundingBetaPlayersAdmin.tsx';
const F3_HELPER = 'src/lib/boardsignal/playerEntryRecovery.mjs';
const F12_HELPER = 'src/lib/boardsignal/firstReviewGeneration.mjs';
const source = fs.readFileSync(path.join(ROOT, SERVER), 'utf8');

const EXPECTED_BLOBS = Object.freeze({
  [F31_COMPONENT]: 'b6ed5ebb1dfcb54da83e061260f5635ba9a357aa',
  [F3_HELPER]: '74ca0dc9e8b002f07792610454468be09673f959',
  [F12_HELPER]: 'd8d375e1ad421674e27d3ae40c683ae165a503c7',
  'src/lib/boardsignal/server/activation.ts': '2cec6ed6eaac76b83d9e81609cd12b11afcabcbb',
  'package.json': '95e6b72c781711c23b9b1a173a6c2c16bafb5882',
  'package-lock.json': '0a6af980d8c90f8a877045e323993785806756bf',
  'firestore.rules': 'a08d287ecba85bec03ca68db327fb8a92a304b2a',
});

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

function envKeyFor(file) {
  return `F32_BLOB_${file.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
}

function assertProtectedBlob(file) {
  const expected = EXPECTED_BLOBS[file];
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) {
    assert.equal(gitBlobSha(fs.readFileSync(full)), expected, `${file} changed from the frozen F.3.2 baseline`);
  } else {
    assert.equal(process.env[envKeyFor(file)], expected, `${file} baseline blob was not verified`);
  }
}

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return text.slice(start, end);
}

function compileActualRegenerate(deps) {
  const cleanLine = 'function clean<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }';
  assert.ok(source.includes(cleanLine), 'product clean() helper changed unexpectedly');
  const regenerate = extractBetween(
    source,
    'export async function regenerateFoundingBetaMagicAccess(requestId: string)',
    '\nexport async function rejectFoundingBetaRequest',
  ).replace(/^export\s+/, '');

  const harnessTs = `
    type FoundingBetaRequest = any;
    export function makeRegenerate(deps: any) {
      const { getAdminDb, betaMagicAccessCredential, accessMessage } = deps;
      ${cleanLine}
      ${regenerate}
      return regenerateFoundingBetaMagicAccess;
    }
  `;
  const transpiled = ts.transpileModule(harnessTs, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      isolatedModules: true,
    },
  });
  const errors = (transpiled.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, [], 'actual regeneration function could not compile in focused harness');
  const module = { exports: {} };
  new Function('module', 'exports', transpiled.outputText)(module, module.exports);
  return module.exports.makeRegenerate(deps);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeFirestoreStyle(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      mergeFirestoreStyle(target[key], value);
    } else {
      target[key] = clone(value);
    }
  }
  return target;
}

function ticketHash(ticket) {
  return crypto.createHash('sha256').update(ticket).digest('hex');
}

function consumeOneTimeMagic(store, ticket, now = '2026-08-16T09:15:00.000Z') {
  const magic = store.magicAccess;
  if (!magic || ticketHash(ticket) !== magic.ticketHash) {
    const error = Object.assign(new Error('This BoardSignal access link is no longer active.'), { code: 'MAGIC_ACCESS_INVALID' });
    throw error;
  }
  if (magic.consumedAt || Date.parse(magic.expiresAt) <= Date.parse(now)) {
    const error = Object.assign(new Error('This BoardSignal access link expired or was already used.'), { code: 'MAGIC_ACCESS_EXPIRED' });
    throw error;
  }
  magic.consumedAt = now;
  store.claimedAt = now;
  return { requestId: magic.requestId, playerId: magic.playerId, uid: magic.uid };
}

function buildScenario() {
  const requestId = 'request-skara-568816694';
  const playerId = 568816694;
  const uid = 'chesscom_568816694';
  const oldTicket = `${requestId}.old-consumed-ticket-secret-0000000000000000`;
  const freshTicket = `${requestId}.fresh-one-time-ticket-secret-1111111111111111`;
  const store = {
    id: requestId,
    chessPlayerId: playerId,
    canonicalUsername: 'skara-din-don',
    firebaseUid: uid,
    requestedAt: '2026-08-16T08:00:00.000Z',
    status: 'approved',
    statusTokenHash: 'private-status-hash',
    claimedAt: '2026-08-16T08:30:00.000Z',
    previewClaimConsumedAt: '2026-08-16T08:30:00.000Z',
    magicAccess: {
      ticketHash: ticketHash(oldTicket),
      expiresAt: '2026-08-17T08:00:00.000Z',
      createdAt: '2026-08-16T08:00:00.000Z',
      requestId,
      playerId,
      uid,
      consumedAt: '2026-08-16T08:30:00.000Z',
    },
  };
  const writes = [];
  const ref = {
    async get() { return { exists: true, data: () => clone(store) }; },
    async set(payload, options) {
      writes.push({ payload: clone(payload), options: clone(options) });
      if (options?.merge) mergeFirestoreStyle(store, payload);
      else Object.assign(store, clone(payload));
    },
  };
  const deps = {
    getAdminDb: () => ({ collection: (name) => {
      assert.equal(name, 'betaRequests');
      return { doc: (id) => {
        assert.equal(id, requestId);
        return ref;
      } };
    } }),
    betaMagicAccessCredential: (actualRequestId, actualPlayerId, actualUid) => {
      assert.equal(actualRequestId, requestId);
      assert.equal(actualPlayerId, playerId);
      assert.equal(actualUid, uid);
      return {
        link: `https://www.adminhub-global.com/boardsignal/access#ticket=${freshTicket}`,
        expiresAt: '2026-08-17T09:00:00.000Z',
        record: {
          ticketHash: ticketHash(freshTicket),
          expiresAt: '2026-08-17T09:00:00.000Z',
          createdAt: '2026-08-16T09:00:00.000Z',
          requestId,
          playerId,
          uid,
        },
      };
    },
    accessMessage: (username, link) => `BoardSignal access for ${username}: ${link}`,
  };
  return { requestId, playerId, uid, oldTicket, freshTicket, store, writes, deps };
}

async function runRegenerationScenario() {
  const scenario = buildScenario();
  const regenerate = compileActualRegenerate(scenario.deps);
  const result = await regenerate(scenario.requestId);
  return { ...scenario, result };
}

test('1. frozen live baseline is the shipped F.3.1 commit', () => {
  assert.equal(process.env.BOARD_SIGNAL_F32_BASELINE_SHA, BASELINE);
});

test('2. regeneration explicitly clears nested consumedAt while retaining claimed markers reset', () => {
  const body = extractBetween(source, 'export async function regenerateFoundingBetaMagicAccess', '\nexport async function rejectFoundingBetaRequest');
  assert.match(body, /magicAccess:\s*\{\s*\.\.\.magic\.record,\s*consumedAt:\s*null\s*\}/);
  assert.match(body, /claimedAt:\s*null/);
  assert.match(body, /previewClaimConsumedAt:\s*null/);
});

test('3. starting state models an already-consumed one-time link', () => {
  const { store } = buildScenario();
  assert.ok(store.magicAccess.consumedAt);
  assert.ok(store.claimedAt);
});

test('4. actual product regeneration stores a fresh magic map with no truthy consumedAt', async () => {
  const { store, writes } = await runRegenerationScenario();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.merge, true);
  assert.equal(writes[0].payload.magicAccess.consumedAt, null);
  assert.equal(store.magicAccess.consumedAt, null);
  assert.equal(store.claimedAt, null);
  assert.equal(store.previewClaimConsumedAt, null);
});

test('5. regenerated ticket has a new hash, createdAt and expiresAt', async () => {
  const { store, oldTicket, freshTicket } = await runRegenerationScenario();
  assert.notEqual(ticketHash(oldTicket), ticketHash(freshTicket));
  assert.equal(store.magicAccess.ticketHash, ticketHash(freshTicket));
  assert.equal(store.magicAccess.createdAt, '2026-08-16T09:00:00.000Z');
  assert.equal(store.magicAccess.expiresAt, '2026-08-17T09:00:00.000Z');
});

test('6. old ticket is invalid immediately after regeneration', async () => {
  const { store, oldTicket } = await runRegenerationScenario();
  assert.throws(() => consumeOneTimeMagic(store, oldTicket), (error) => error.code === 'MAGIC_ACCESS_INVALID');
});

test('7. fresh ticket consumes successfully exactly once', async () => {
  const { store, freshTicket, uid, playerId, requestId } = await runRegenerationScenario();
  const consumed = consumeOneTimeMagic(store, freshTicket);
  assert.deepEqual(consumed, { uid, playerId, requestId });
  assert.equal(store.magicAccess.consumedAt, '2026-08-16T09:15:00.000Z');
  assert.equal(store.claimedAt, '2026-08-16T09:15:00.000Z');
});

test('8. same fresh ticket fails on its second consumption', async () => {
  const { store, freshTicket } = await runRegenerationScenario();
  consumeOneTimeMagic(store, freshTicket);
  assert.throws(() => consumeOneTimeMagic(store, freshTicket), (error) => error.code === 'MAGIC_ACCESS_EXPIRED');
});

test('9. stable Firebase uid is identical across regeneration and consumption', async () => {
  const { store, freshTicket, uid, result } = await runRegenerationScenario();
  assert.equal(store.magicAccess.uid, uid);
  assert.equal(result.request.firebaseUid, uid);
  assert.equal(consumeOneTimeMagic(store, freshTicket).uid, uid);
});

test('10. playerId remains identical', async () => {
  const { store, freshTicket, playerId, result } = await runRegenerationScenario();
  assert.equal(store.magicAccess.playerId, playerId);
  assert.equal(result.request.chessPlayerId, playerId);
  assert.equal(consumeOneTimeMagic(store, freshTicket).playerId, playerId);
});

test('11. requestId remains identical', async () => {
  const { store, freshTicket, requestId, result } = await runRegenerationScenario();
  assert.equal(store.magicAccess.requestId, requestId);
  assert.equal(result.request.id, requestId);
  assert.equal(consumeOneTimeMagic(store, freshTicket).requestId, requestId);
});

test('12. regeneration does not create a Firebase account or token', () => {
  const body = extractBetween(source, 'export async function regenerateFoundingBetaMagicAccess', '\nexport async function rejectFoundingBetaRequest');
  assert.doesNotMatch(body, /createUser|createCustomToken|ensureStablePlayerAccount|getAdminAuth|signIn/);
});

test('13. regeneration keeps rejected/revoked gate and does not weaken eligibility', () => {
  const body = extractBetween(source, 'export async function regenerateFoundingBetaMagicAccess', '\nexport async function rejectFoundingBetaRequest');
  assert.match(body, /request\.status === "pending" && Boolean\(request\.provisionalClaimedAt\) && request\.identityReviewStatus !== "rejected"/);
  assert.match(body, /request\.status === "approved" \|\| provisionalRecovery/);
});

test('14. F.3.1 CLAIMED Regenerate magic link button remains present', () => {
  assertProtectedBlob(F31_COMPONENT);
  const componentPath = path.join(ROOT, F31_COMPONENT);
  if (fs.existsSync(componentPath)) {
    const component = fs.readFileSync(componentPath, 'utf8');
    const claimedStart = component.indexOf('<p className="kicker">CLAIMED</p>');
    const claimedEnd = component.indexOf('<p className="kicker">IDENTITY CONFIRMED</p>', claimedStart);
    const claimed = component.slice(claimedStart, claimedEnd);
    assert.match(claimed, /onClick=\{\(\) => regenerate\(request\)\}/);
    assert.match(claimed, /Regenerate magic link/);
  }
});

test('15. F.3 player-entry helper is unchanged', () => assertProtectedBlob(F3_HELPER));
test('16. F.1.2 first Review cadence helper is unchanged', () => assertProtectedBlob(F12_HELPER));
test('17. consumeBetaMagicTicket implementation is unchanged', () => assertProtectedBlob('src/lib/boardsignal/server/activation.ts'));
test('18. package.json is unchanged', () => assertProtectedBlob('package.json'));
test('19. package-lock.json is unchanged', () => assertProtectedBlob('package-lock.json'));
test('20. firestore.rules is unchanged', () => assertProtectedBlob('firestore.rules'));

test('21. changed betaRequests.ts has zero TypeScript parse diagnostics', () => {
  const parsed = ts.createSourceFile(SERVER, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(parsed.parseDiagnostics, []);
});

test('22. changed betaRequests.ts has zero isolated-transpile errors', () => {
  const result = ts.transpileModule(source, {
    fileName: SERVER,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      isolatedModules: true,
    },
  });
  const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors, []);
});

test('23. production scope is the one regeneration write change only', () => {
  const baselinePath = process.env.BOARD_SIGNAL_F32_BASELINE_SERVER;
  assert.ok(baselinePath && fs.existsSync(baselinePath), 'baseline server fixture required');
  const baseline = fs.readFileSync(baselinePath, 'utf8');
  const expected = baseline.replace(
    'await ref.set(clean({ magicAccess: magic.record, claimedAt: null, previewClaimConsumedAt: null }), { merge: true });',
    'await ref.set(clean({ magicAccess: { ...magic.record, consumedAt: null }, claimedAt: null, previewClaimConsumedAt: null }), { merge: true });',
  );
  assert.notEqual(expected, baseline, 'baseline regeneration write not found');
  assert.equal(source, expected);
});
