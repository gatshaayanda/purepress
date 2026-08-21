const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const context = read('src/lib/boardsignal/server/askContext.ts');
const route = read('src/app/api/boardsignal/guide/route.ts');
const widget = read('src/components/AskBoardSignal.tsx');
const combined = `${context}\n${route}\n${widget}`;

const D_BASELINE = '216056e2766c980ca3e898aec0872a082b540340';

test('1 post-D baseline and surgical deterministic architecture are locked', () => {
  assert.match(context, new RegExp(`PATCH_E_BASELINE = "${D_BASELINE}"`));
  assert.match(route, /contextualGuideResponse, guideContextObservation/);
  assert.doesNotMatch(combined, /OpenAI|Anthropic|Gemini|Vercel AI|ai-sdk|useChat\s*\(/i);
  assert.doesNotMatch(context, /from\s+["\'][^"\']*stockfish|import[^\n]*stockfish|buildCurrentEpisodeSummary|buildLiveDesk|fetchChess|chess\.com\/pub/i);
  assert.doesNotMatch(context, /deriveActiveWeekNextGameGuidance|withPreviousReviewGuidance/);
  assert.doesNotMatch(context, /accountDeletion|deleteBoardSignalAccount/);
});

test('2 first-open is contextual and generic chatbot theater is removed', () => {
  assert.doesNotMatch(widget, /callGuide\(""\)/);
  assert.match(widget, /const opener = observation\?\.opener\.reply \?\? "What do you want to understand\?"/);
  assert.match(widget, /observation\?\.chips\?\.length/);
  assert.doesNotMatch(combined, /\bHi!|Hey there!|How can I help\?|What can I assist you with\?|Welcome to Ask BoardSignal!/i);
  assert.match(widget, /I explain verified BoardSignal context/);
});

test('3 unsolicited contextual prompt is optional, nonblocking and once per meaningful state', () => {
  assert.match(widget, /promptAlreadyShown\(user\?\.uid, observation\.stateKey\)/);
  assert.match(widget, /rememberPrompt\(user\?\.uid, observation\.stateKey\);\s*setContextPrompt\(observation\)/);
  assert.match(widget, /MAX_CONTEXT_PROMPT_KEYS = 12/);
  assert.match(widget, /setTimeout\(\(\) => setContextPrompt[\s\S]*9000\)/);
  assert.match(widget, /aria-label="Dismiss Ask BoardSignal suggestion"/);
  assert.doesNotMatch(widget.slice(widget.indexOf('className="ask-bs-context-prompt'), widget.indexOf('{open ? <div className="ask-bs-panel')), /\.focus\(/);
  assert.doesNotMatch(widget, /vibrate\(|new Audio|\.play\(\)/);
  const ambientEffect = widget.slice(widget.indexOf('setContextPrompt(undefined);\n    if (!observation?.prompt'), widget.indexOf('const suggestions = useMemo'));
  assert.doesNotMatch(ambientEffect, /setOpen\(true\)/);
  // checkedAt is freshness only; unchanged active-week facts do not create a new ambient state key.
  const activeKeyLine = context.split('\n').find((line) => line.includes('stateKey([PATCH_E_BASELINE, state.uid, "active-week"')) || '';
  assert.ok(activeKeyLine);
  assert.doesNotMatch(activeKeyLine, /checkedAt/);
  assert.match(activeKeyLine, /episode\.games/);
  assert.match(activeKeyLine, /guidance\.source/);
});

test('4 B.1 guidance is consumed structurally with exact source distinctions', () => {
  assert.match(context, /currentEpisode\(session\?\.currentEpisode\)/);
  assert.match(context, /nextGameGuidance/);
  for (const source of ['current_week', 'previous_review', 'current_week_reinforces_previous_review', 'insufficient_current_evidence']) {
    assert.match(context, new RegExp(source));
  }
  assert.match(context, /guidance\.source === "current_week_reinforces_previous_review"/);
  assert.match(context, /guidance\.source === "previous_review"/);
  assert.match(context, /guidance\.status === "insufficient_evidence"/);
  assert.match(context, /evidenceCount/);
  assert.match(context, /supportingFacts/);
  assert.doesNotMatch(context, /similarity|levenshtein|fuzzy|includes\(.*previousTitle/i);
});

test('5 B.1 explanations preserve unfinished-week safety and never manufacture advice', () => {
  assert.match(context, /games checked so far/);
  assert.match(context, /not your previous Review/);
  assert.match(context, /That reminder comes from your last completed Review/);
  assert.match(context, /given BoardSignal enough evidence to replace it yet/);
  assert.match(context, /One concrete current-week event supports the reminder; BoardSignal is not calling it a repeated pattern/);
  assert.match(context, /doesn't have enough current-game evidence yet for a new next-game action/);
  assert.match(context, /I won't manufacture one/);
  assert.doesNotMatch(context, /Your biggest weakness|This is your main problem|This is why you keep losing|You have fixed/i);
});

test('6 A.1 factual Review and position-review state remain explicitly distinct', () => {
  assert.match(context, /loadPendingFactualReviews/);
  assert.match(context, /The week itself is complete and your factual Review is saved/);
  assert.match(context, /Already confirmed:/);
  assert.match(context, /chronology, pool\/rating boundaries/);
  assert.match(context, /engine-supported position conclusions/);
  assert.match(context, /Focus Next[\s\S]*still finishing/);
  assert.match(context, /does not contain a verified runtime-failure reason/);
  assert.match(context, /I won't guess why the engine step failed/);
  assert.doesNotMatch(context, /Your Review failed|Stockfish found|best move|blunder/i);
});

test('7 completed Review answers stay answer-first and use consumer language plus published evidence', () => {
  assert.match(context, /WHAT HAPPENED — You played/);
  assert.match(context, /WHAT MATTERED —/);
  assert.match(context, /FOCUS NEXT —/);
  assert.match(context, /desk\.signals\.blue/);
  assert.match(context, /blue\.evidenceIds/);
  assert.match(context, /bundle\.engineResults\[id\]/);
  assert.match(context, /did not publish a supported Focus Next[\s\S]*won't invent a replacement/);
  assert.match(context, /consumerLanguage/);
});

test('8 provenance, freshness and longitudinal caution are explicit', () => {
  assert.match(context, /CURRENT WEEK/);
  assert.match(context, /LAST COMPLETED REVIEW/);
  assert.match(context, /POSITION REVIEW/);
  assert.match(context, /PROGRESS/);
  assert.match(context, /timestamp: episode\.checkedAt/);
  assert.match(widget, /provenanceLabel/);
  assert.match(widget, /Intl\.DateTimeFormat/);
  assert.match(context, /needs at least two comparable completed Reviews/);
  assert.match(context, /same-pool samples/);
  assert.match(context, /won't turn a short window into a blanket claim that you're improving overall/);
});

test('9 private/public and Preview boundaries remain server-authoritative', () => {
  assert.match(route, /action === "ask" \? await optionalToken\(request\)/);
  assert.match(route, /action === "observe" \? await optionalToken\(request\)/);
  assert.match(context, /if \(!input\.token \|\| !pathname\.includes\("boardsignal\/player-room"\)\) return undefined/);
  assert.match(context, /verifyBetaPreviewStatusCredential/);
  assert.match(context, /previewSnapshot/);
  assert.doesNotMatch(context.slice(context.indexOf('async function previewObservation'), context.indexOf('export async function guideContextObservation')), /loadPrivateState|signals\.blue|loadPublishedDesks/);
  assert.match(context, /relationship-safe metrics/);
  assert.match(context, /won't expose the other player's private guidance/);
});

test('10 Ask remains noncritical, bounded and UID/account-generation safe', () => {
  assert.match(widget, /Ambient context failure never becomes a BoardSignal failure state/);
  assert.match(widget, /setObservation\(undefined\)/);
  assert.match(widget, /messages\.slice\(-12\)/);
  assert.match(widget, /recentConversationForServer\(messagesRef\.current\)/);
  assert.match(widget, /metadata\.creationTime/);
  assert.match(widget, /continuityKey\(uid\?: string\)/);
  assert.match(widget, /removeItem\(`\$\{STORAGE_PREFIX\}:\$\{user\.uid\}`\)/);
  assert.match(widget, /window\.confirm/);
  assert.match(route, /return response\(\{ ok: false, error:/);
});

test('11 accessibility, mobile obstruction restraint and Patch D motion vocabulary are reused', () => {
  assert.match(widget, /launcherRef/);
  assert.match(widget, /if \(event\.key === "Escape"\) closePanel\(true\)/);
  assert.match(widget, /launcherRef\.current\?\.focus\(\)/);
  assert.match(widget, /aria-live="polite"/);
  assert.match(widget, /aria-label="Ask BoardSignal suggestion"/);
  assert.match(widget, /minHeight: "44px"/);
  assert.match(widget, /width: "min\(306px, calc\(100vw - 16px\)\)"/);
  assert.match(widget, /bs-motion-observation-change/);
  assert.doesNotMatch(widget, /@keyframes|animationName|requestAnimationFrame/);
  assert.match(widget, /var\(--bs-ui-border\)/);
  assert.match(widget, /var\(--bs-text\)/);
  assert.match(widget, /bs-surface-paper/);
});

test('12 existing offline Guide and confirmation paths are preserved without rules/dependency/security rewrites', () => {
  assert.match(widget, /buildOfflineGuideResponse/);
  assert.match(widget, /loadPlayerRoomOfflineSnapshot/);
  assert.match(widget, /saveOfflineDraft/);
  assert.match(widget, /Reconnect before changing Ask BoardSignal preferences/);
  assert.match(widget, /Send this support request to Ayanda[\s\S]*window\.confirm|window\.confirm[\s\S]*Send this support request to Ayanda/);
  assert.doesNotMatch(combined, /firestore\.rules|package\.json|package-lock\.json|public\/stockfish|public\/sw\.js|src\/app\/api\/cron/);
  assert.doesNotMatch(combined, /deleteBoardSignalAccount|recursiveDelete|Firebase Auth model/i);
});
