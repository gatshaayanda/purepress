const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));

const factual = read('src/lib/boardsignal/factualReview.ts');
const persistence = read('src/lib/boardsignal/server/persistence.ts');
const route = read('src/app/api/boardsignal/player-room/route.ts');
const room = read('src/components/BoardSignalPlayerRoom.tsx');
const deskUi = read('src/components/UniversalPlayerDesk.tsx');
const quality = read('src/lib/boardsignal/quality.ts');

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  return source.slice(from, to < 0 ? source.length : to);
}

const validateDraft = section(factual, 'export function validateFactualReviewInput', 'export function createFactualReviewDraft');
const createDraft = section(factual, 'export function createFactualReviewDraft', 'function withheld');
const retryDesk = section(factual, 'export function factualReviewToRetryDesk', undefined);
const saveDraft = section(persistence, 'export async function savePendingFactualReview', 'export async function loadPendingFactualReviews');
const loadDrafts = section(persistence, 'export async function loadPendingFactualReviews', 'async function deleteDeskTree');
const publishDesk = section(persistence, 'export async function publishPrivateDesk', 'export async function loadPublishedDesks');
const snapshot = section(persistence, 'export async function buildPlayerRoomSnapshot', undefined);
const retryAction = section(deskUi, 'const retryAnalysis = () =>', 'if (isPendingFactualView && !analysisEnabled)');
const recoveryEffect = section(deskUi, 'const failed = reviewable.filter', 'useEffect(() => {\n    if (!desk || desk.source !== "live" || isPublishedView || typeof window === "undefined") return;');
const engineHold = section(deskUi, 'function DeskQualityHold', 'function SignalCard');

test('completed factual LIVE week is validated and stored separately before engine completion', () => {
  // 1 / 2: verified LIVE, owner-bound, exact closed seven-day period and coherent facts.
  assert.match(validateDraft, /desk\.source === "live"/);
  assert.match(validateDraft, /desk\.provenance\?\.verified === true/);
  assert.match(validateDraft, /desk\.player\.playerId === owner\.chessCom\.playerId/);
  assert.match(validateDraft, /end - start === 6 \* DAY_MS/);
  assert.match(validateDraft, /end < today/);
  assert.match(validateDraft, /desk\.wins \+ desk\.draws \+ desk\.losses === desk\.games/);
  assert.match(validateDraft, /timelineGames === desk\.games/);
  assert.match(validateDraft, /gamesReconstructed === desk\.games/);

  // 3: one stable period key, one server-owned factualReviews document, transactional overwrite/reuse.
  assert.match(saveDraft, /collection\("users"\)\.doc\(account\.uid\)\.collection\("factualReviews"\)/);
  assert.match(saveDraft, /doc\(safeDocumentId\(next\.deskKey\)\)/);
  assert.match(saveDraft, /runTransaction/);
  assert.match(saveDraft, /transaction\.set\(ref, clean\(stored\), \{ merge: false \}\)/);
});

test('durable factual representation excludes unsupported final guidance and keeps private retry input', () => {
  // 4 / 5 / 6: distinct pending representation, safe facts, legal bounded retry candidates.
  assert.match(factual, /schemaVersion: typeof FACTUAL_REVIEW_SCHEMA_VERSION/);
  assert.match(factual, /status: "engine_pending"/);
  assert.match(createDraft, /retryCandidates: desk\.candidates/);
  assert.match(validateDraft, /desk\.candidates\.length <= MAX_FACTUAL_REVIEW_CANDIDATES/);
  assert.match(validateDraft, /candidate\.reconstruction === "legal"/);
  assert.match(validateDraft, /isLegalFen\(before\)/);

  // 11: no final Red/Blue/evidence conclusion is represented as completed fact.
  assert.doesNotMatch(createDraft, /signals:\s*desk\.signals|turningPoint:\s*desk\.turningPoint|pocketCard:\s*desk\.pocketCard|replay:\s*desk\.replay/);
  assert.match(retryDesk, /red: withheld/);
  assert.match(retryDesk, /blue: withheld/);
  assert.match(retryDesk, /turningPoint: undefined/);
  assert.match(retryDesk, /pocketCard: undefined/);
});

test('Player Room reload restores pending factual review without counting it as a completed Desk', () => {
  // 4 / 5 / 7 / 8: GET snapshot loads separately from currentEpisode and all memory derives from published summaries only.
  assert.match(snapshot, /const factualReviews = await loadPendingFactualReviews\(account\.uid\)/);
  assert.match(snapshot, /currentEpisode,/);
  assert.match(snapshot, /pendingFactualReview,/);
  assert.match(snapshot, /const generationRequired = pendingFactualReview \? false/);
  assert.match(snapshot, /progress: buildPoolProgress\(summaries\)/);
  assert.match(snapshot, /recurringPatterns: deriveRecurringPatterns\(summaries\)/);
  assert.match(snapshot, /desksCompleted: summaries\.length/);
  assert.match(room, /snapshot\.pendingFactualReview \? <UniversalPlayerDesk/);
  assert.match(room, /pendingFactualReview=\{snapshot\.pendingFactualReview\}/);

  // 6: published bundles still come only from users/{uid}/desks, never factualReviews.
  const loadPublished = section(persistence, 'export async function loadPublishedDesks', 'export async function buildPlayerRoomSnapshot');
  assert.match(loadPublished, /collection\("desks"\)/);
  assert.doesNotMatch(loadPublished, /factualReviews/);
});

test('same fixed episode can retry in browser and publish only through existing quality gate', () => {
  // 9 / 10: reconstructed pending draft feeds same retry candidates; failure leaves server draft untouched.
  assert.match(retryDesk, /candidates: draft\.retryCandidates/);
  assert.match(route, /action\?: "acceptAgreement" \| "saveFactualReview" \| "publishDesk"/);
  assert.match(room, /action: "saveFactualReview", desk/);
  assert.match(room, /action: "publishDesk", desk, engineResults/);

  // 12 / 14: unchanged publication validator still decides completed Desk persistence.
  assert.match(publishDesk, /validateDeskForPublication\(desk, engineResults\)/);
  assert.match(publishDesk, /if \(quality\.status !== "PASS"\)/);
  assert.match(quality, /ENGINE_REVIEW_INCOMPLETE/);
  assert.match(quality, /ENGINE_REVIEW_UNAVAILABLE/);

  // 13: matching factual draft is deleted only in the successful private-Desk batch.
  assert.match(publishDesk, /const factualReviewRef = .*collection\("factualReviews"\)/s);
  assert.match(publishDesk, /batch\.delete\(factualReviewRef\)/);
  assert.match(publishDesk, /await batch\.commit\(\)/);
});

test('engine recovery keeps confirmed facts visible and retries only unfinished/failed positions', () => {
  // New A.1 recovery UX: no blocking processing screen for authenticated durable factual review.
  assert.match(deskUi, /ownerToken && onFactualReviewReady/);
  assert.match(deskUi, /<DeskQualityHold desk=\{desk\} codes=\{\["ENGINE_REVIEW_INCOMPLETE"\]\}/);
  assert.match(engineHold, /Your week is ready\. Position review is finishing\./);
  assert.match(engineHold, /Everything below is already confirmed from your games\./);
  assert.match(engineHold, /TRY POSITION CHECK AGAIN/);

  // One bounded automatic fresh-Worker recovery pass; established completed results are retained.
  assert.match(deskUi, /MAX_AUTO_ENGINE_RECOVERY_PASSES = 1/);
  assert.match(recoveryEffect, /retryable = failed\.filter/);
  assert.match(recoveryEffect, /setRetryCandidateIds\(retryable\.map/);
  assert.match(retryAction, /!engineResults\[candidate\.id\] \|\| engineResults\[candidate\.id\]\?\.status === "failed"/);
  assert.doesNotMatch(retryAction, /setEngineResults\(\{\}\)/);
  assert.match(deskUi, /new Worker\(ENGINE_JS_URL/);

  // Confirmed non-retryable capability/asset failures are classified and not auto-looped.
  assert.match(deskUi, /NON_RETRYABLE_ENGINE_CODES = new Set<EngineDiagnosticCode>\(\["ENGINE_UNSUPPORTED", "ENGINE_ASSET_404"\]\)/);
  assert.match(recoveryEffect, /if \(!retryable\.length\).*setRecoveryState\("blocked"\)/s);
});

test('saving a factual review has no public, Universe, Progress, or share side effects', () => {
  // 15 / 16: save path is private and does not mutate public identity/community state.
  assert.doesNotMatch(saveDraft, /publicPlayers|publicCoverage|Universe|shareMoment|writePublic|personalRecords|previousBlue|previousAmber/);
  assert.match(saveDraft, /accountForToken\(token\)/);
  assert.match(saveDraft, /createFactualReviewDraft\(account, desk\)/);

  // Production prebuild remains unchanged.
  assert.equal(pkg.scripts.prebuild, 'npm run prepare:stockfish && npm run test:contrast');
});
