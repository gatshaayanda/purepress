const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const widget = read('src/components/AskBoardSignal.tsx');
const context = read('src/lib/boardsignal/server/askContext.ts');
const route = read('src/app/api/boardsignal/guide/route.ts');
const rules = read('firestore.rules');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

const E1_BASELINE = 'a600850024ca510c88cee2d01b118dc58daf3bca';

test('1 exact Patch E baseline is explicitly locked without byte-hash testing', () => {
  assert.match(context, new RegExp(`PATCH_E1_BASELINE = "${E1_BASELINE}"`));
  assert.match(context, /PATCH_E_BASELINE = "216056e2766c980ca3e898aec0872a082b540340"/);
});

test('2 YES records helpful=true through the existing feedback path', () => {
  assert.match(widget, /handleFeedback\(message\.id, true, message\.response\)/);
  assert.match(widget, /authenticatedAction\("feedback", \{ helpful, category:/);
});

test('3 YES visibly acknowledges the feedback', () => {
  assert.match(widget, /message\.feedback === "helpful" \? "Got it\."/);
  assert.match(widget, /role="status"/);
});

test('4 YES does not trigger another Guide answer', () => {
  const section = widget.slice(widget.indexOf('async function handleFeedback'), widget.indexOf('if (!eligiblePath'));
  assert.match(section, /if \(!helpful\) await callGuide\("Explain that more simply\.", clarificationContext\)/);
  assert.doesNotMatch(section, /if \(helpful\).*callGuide/s);
});

test('5 NOT REALLY records helpful=false', () => {
  assert.match(widget, /handleFeedback\(message\.id, false, message\.response\)/);
  assert.match(widget, /void feedback\(helpful, response\)/);
});

test('6 NOT REALLY re-explains the previous Guide answer instead of starting a generic topic', () => {
  assert.match(widget, /if \(!helpful\) await callGuide\("Explain that more simply\.", clarificationContext\)/);
  assert.match(route, /contextualGuideFeedbackFollowup\(/);
  assert.match(route, /if \(feedbackFollowup\.handled && feedbackFollowup\.response\) return response/);
});

test('7 negative feedback preserves previous Guide intent/context', () => {
  assert.match(context, /previous\.intent \?\? "followup_clarify"/);
  assert.match(context, /lastImmediateGuideTurn\(input\.recentConversation, message\)/);
});

test('8 negative feedback preserves previous provenance', () => {
  assert.match(context, /previous\.provenance,/);
  assert.match(context, /provenanceId\?\.startsWith\("active-week:"\)/);
  assert.match(context, /provenanceId\?\.startsWith\("position-review:"\)/);
  assert.match(context, /completedReferent\(provenanceId\)/);
  assert.match(context, /provenanceId\?\.startsWith\("preview:"\)/);
});

test('9 typed not really becomes contextual feedback follow-up', () => {
  assert.match(widget, /not really/);
  assert.match(widget, /negativeFeedback && previous\?\.sender === "guide" && previous\.response/);
  assert.match(widget, /await callGuide\("Explain that more simply\.", clarificationContext\)/);
});

test("10 typed I don't get it uses the same contextual path", () => {
  assert.match(widget, /i don't get it/);
  assert.match(context, /i don't get it/);
});

test("11 typed that wasn't clear uses the same contextual path", () => {
  assert.match(widget, /that wasn't clear/);
  assert.match(context, /that wasn't clear/);
});

test('12 standalone ambiguous no without prior Guide context does not invent a referent', () => {
  assert.match(widget, /if \(negativeFeedback\) \{[\s\S]*What would you like me to explain more simply\?/);
  assert.match(context, /if \(!previous\) \{[\s\S]*What would you like me to explain more simply\?/);
});

test('13 each Guide answer can submit at most one feedback action locally', () => {
  assert.match(widget, /feedbackHandledRef = useRef\(new Set<string>\(\)\)/);
  assert.match(widget, /if \(feedbackHandledRef\.current\.has\(messageId\)\) return/);
  assert.match(widget, /feedbackHandledRef\.current\.add\(messageId\)/);
  assert.match(widget, /message\.feedback \? <div className="ask-bs-feedback" role="status"/);
});

test('14 double click cannot create a duplicate simpler explanation', () => {
  const section = widget.slice(widget.indexOf('async function handleFeedback'), widget.indexOf('if (!eligiblePath'));
  assert.ok(section.indexOf('if (feedbackHandledRef.current.has(messageId)) return;') < section.indexOf('if (!helpful) await callGuide'));
});

test('15 feedback API failure is explicitly non-blocking', () => {
  assert.match(widget, /catch \{ \/\* feedback never blocks chat \*\/ \}/);
  assert.match(widget, /void feedback\(helpful, response\);\n    if \(!helpful\) await callGuide/);
});

test('16 E.1 performs no Stockfish or new chess analysis', () => {
  const touched = `${widget}\n${context}\n${route}`;
  assert.doesNotMatch(touched, /new Worker\s*\(|ENGINE_JS_URL|ENGINE_WASM_URL|analy[sz]ePosition\s*\(|applyEngineInterpretation/);
  assert.match(context, /position check is the part still finishing/);
});

test('17 E.1 adds no LLM or external AI API dependency', () => {
  const touched = `${context}\n${route}`;
  assert.doesNotMatch(touched, /openai|anthropic|gemini|chatgpt|api\.openai\.com|generateText|streamText/i);
});

test('18 Firestore rules remain outside the hotfix and retain private owner rules', () => {
  assert.ok(rules.length > 1000);
  assert.match(rules, /match \/users\/\{userId\}/);
  assert.doesNotMatch(`${widget}\n${context}\n${route}`, /firestore\.rules|allow write|allow read/);
});

test('19 package and package-lock retain the existing Ask/prebuild contract with no E.1 dependency', () => {
  assert.equal(pkg.scripts.prebuild, 'npm run prepare:stockfish && npm run test:contrast');
  assert.match(pkg.scripts['test:ask'], /tsc -p tsconfig\.ask-board-signal\.json/);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(Boolean(pkg.dependencies?.openai || pkg.dependencies?.anthropic), false);
});

test('20 Patch E contextual Ask architecture remains intact', () => {
  assert.match(route, /guideContextObservation/);
  assert.match(route, /contextualGuideResponse/);
  assert.match(context, /loadPrivateState\(input\.token\)/);
  assert.match(context, /recentConversation\.slice\(-12\)/);
  assert.match(context, /activeProvenance|pendingProvenance|completedProvenance|progressProvenance/);
  assert.match(context, /verifyBetaPreviewStatusCredential/);
});
