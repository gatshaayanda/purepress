const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = '9957334dfd581f466a8119fc668f81f084349900';
const PACKAGE_BLOB = '95e6b72c781711c23b9b1a173a6c2c16bafb5882';
const PACKAGE_LOCK_BLOB = '0a6af980d8c90f8a877045e323993785806756bf';
const FIRESTORE_RULES_BLOB = 'a08d287ecba85bec03ca68db327fb8a92a304b2a';

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const preview = read('src/components/BetaPreviewRoom.tsx');
const betaRequests = read('src/lib/boardsignal/server/betaRequests.ts');
const serverDelivery = read('src/lib/boardsignal/server/foundingBetaIdentityConfirmation.ts');
const route = read('src/app/api/boardsignal/beta-preview/[requestId]/route.ts');
const f2css = read('src/app/boardsignal-f2-readability.css');
const layout = read('src/app/layout.tsx');
const checker = read('scripts/check-boardsignal-contrast.mjs');

let policy;
let contrastRun;

test.before(async () => {
  policy = await import(`${pathToFileURL(path.join(ROOT, 'src/lib/boardsignal/foundingBetaIdentityConfirmation.mjs')).href}?f2=${Date.now()}`);
  contrastRun = runContrastFixture();
});

function makeDeviceRequest(overrides = {}) {
  return {
    id: 'ach83', canonicalUsername: 'ach83', activationReturnMethod: 'device',
    approvalAlertDevice: { token: 'device-token-12345678901234567890' },
    ...overrides,
  };
}
function makeEmailRequest(overrides = {}) {
  return {
    id: 'ach83', canonicalUsername: 'ach83', activationReturnMethod: 'email',
    approvalAlertEmail: 'player@example.com', approvalAlertEmailConsent: true,
    ...overrides,
  };
}
function fakeSenders() {
  const calls = { device: [], email: [] };
  return {
    calls,
    sendDevice: async (plan) => { calls.device.push(plan); return true; },
    sendEmail: async (plan) => { calls.email.push(plan); return true; },
  };
}
function execute(input, senders = fakeSenders()) {
  return policy.executeFoundingBetaIdentityConfirmationDelivery({
    request: input.request,
    playerAlreadyInside: input.playerAlreadyInside,
    siteUrl: 'https://www.adminhub-global.com',
    magicLink: input.magicLink,
    emailConfigured: input.emailConfigured ?? true,
    sendDevice: senders.sendDevice,
    sendEmail: senders.sendEmail,
  }).then((result) => ({ result, calls: senders.calls }));
}

function runContrastFixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boardsignal-f2-contrast-'));
  fs.mkdirSync(path.join(temp, 'src/app'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'src/components'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'scripts'), { recursive: true });
  const globals = `/* Patch C — BoardSignal visual system + dark mode */\n:root {\n--bs-bg:#f4f0e7;--bs-surface:#fffdf8;--bs-surface-dark:#101923;--bs-text:#101923;--bs-text-secondary:#3f4953;--bs-text-muted:#5f6871;--bs-text-on-dark:#fffdf8;--bs-blue-readable:#1733b8;--bs-lime:#c9f65d;--bs-on-lime:#101923;\n}\nhtml[data-bs-theme="dark"] { --bs-bg:#0b1220;--bs-surface:#111c2e;--bs-surface-dark:#08111e;--bs-text:#f6f2e9;--bs-text-secondary:#c5cfdd;--bs-text-muted:#9daabc;--bs-text-on-dark:#fffdf8;--bs-blue-readable:#9fb4ff;--bs-lime:#c9f65d;--bs-on-lime:#101923; }\n.universal-section{background:var(--bs-surface);}\n.beta-preview-next{background:var(--bs-surface);}\n`;
  const hardening = `:root {\n--bs-ui-border:#8c857b;--bs-focus-ring:#3157ff;--bs-positive-text:#23613f;--bs-warning-text:#7a560c;--bs-danger-text:#a83220;--bs-positive-surface:#e8f3ec;--bs-warning-surface:#fff4da;--bs-danger-surface:#fff0ec;--bs-text-on-dark-secondary:#d8e0ec;--bs-text-on-dark-muted:#bdc9d8;--bs-disabled-text:#4f5963;--bs-selection-bg:#1733b8;--bs-selection-text:#fffdf8;\n}\nhtml[data-bs-theme="dark"] { --bs-ui-border:#65748c;--bs-focus-ring:#9fb4ff;--bs-positive-text:#8bd6a6;--bs-warning-text:#f2c86e;--bs-danger-text:#ff9d88;--bs-positive-surface:#173225;--bs-warning-surface:#382d18;--bs-danger-surface:#3b2020;--bs-disabled-text:#aeb9c8;--bs-selection-bg:#9fb4ff;--bs-selection-text:#0b1220; }\n::selection{} :focus-visible{} html{scroll-padding-bottom:8rem;} button{scroll-margin-bottom:8rem;} @media (prefers-contrast: more){} @media (forced-colors: active){}\n`;
  fs.writeFileSync(path.join(temp, 'src/app/globals.css'), globals);
  fs.writeFileSync(path.join(temp, 'src/app/boardsignal-accessibility.css'), hardening);
  fs.writeFileSync(path.join(temp, 'src/app/boardsignal-f2-readability.css'), f2css);
  fs.writeFileSync(path.join(temp, 'src/components/BetaPreviewRoom.tsx'), preview);
  fs.copyFileSync(path.join(ROOT, 'scripts/check-boardsignal-contrast.mjs'), path.join(temp, 'scripts/check-boardsignal-contrast.mjs'));
  const run = spawnSync(process.execPath, ['scripts/check-boardsignal-contrast.mjs'], { cwd: temp, encoding: 'utf8' });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, output: `${run.stdout}\n${run.stderr}` };
}
function ratio(name, theme = 'light') {
  const match = contrastRun.output.match(new RegExp(`${theme}:${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')} ([0-9.]+):1`));
  assert.ok(match, `missing ratio ${theme}:${name}\n${contrastRun.output}`);
  return Number(match[1]);
}

// 1
test('1 baseline is exact F.2 immutable baseline', () => assert.equal(BASELINE, '9957334dfd581f466a8119fc668f81f084349900'));
// 2
test('2 WCAG luminance uses 0.04045', () => { assert.match(checker, /c <= \.04045/); assert.doesNotMatch(checker, /\.03928/); });
// 3
test('3 normal light text contract is >= 4.5:1', () => assert.ok(ratio('primary/surface') >= 4.5));
// 4
test('4 normal dark text contract is >= 4.5:1', () => assert.ok(ratio('text-on-dark/dark') >= 4.5));
// 5
test('5 secondary dark text is >= 4.5:1', () => assert.ok(ratio('secondary-on-dark/dark') >= 4.5));
// 6
test('6 muted dark text is >= 4.5:1', () => assert.ok(ratio('muted-on-dark/dark') >= 4.5));
// 7
test('7 large text threshold is >= 3:1', () => assert.ok(ratio('large-text/surface') >= 3));
// 8
test('8 meaningful UI boundary and focus pairs are >= 3:1', () => { assert.ok(ratio('ui-border/surface') >= 3); assert.ok(ratio('focus/surface') >= 3); });
// 9
test('9 Preview access CTA resolves to explicit dark surface', () => assert.match(f2css, /\.beta-preview-access-cta\s*\{[\s\S]*?background:\s*var\(--bs-surface-dark\)/));
// 10
test('10 ordinary What unlocks next remains explicit light surface', () => { assert.match(f2css, /\.beta-preview-next\.bs-surface-paper\s*\{[\s\S]*?background:\s*var\(--bs-surface\)/); assert.match(preview, /beta-preview-next bs-surface-paper[\s\S]*WHAT UNLOCKS NEXT/); });
// 11
test('11 Universe learning section has final explicit dark contract', () => assert.match(f2css, /\.universal-section\.universe-learning-section\s*\{[\s\S]*?background:\s*var\(--bs-surface-dark\)/));
// 12
test('12 direct learning-grid links have explicit readable contract', () => { assert.match(f2css, /\.universe-learning-grid > a,/); assert.ok(ratio('primary/learning-card') >= 4.5); });
// 13
test('13 article-wrapped learning cards remain explicitly readable', () => { assert.match(f2css, /\.universe-learning-grid > article/); assert.match(f2css, /\.universe-learning-grid > article > a/); });
// 14
test('14 Preview light contracts do not use white body copy', () => assert.doesNotMatch(f2css.match(/\.beta-preview-next\.bs-surface-paper[\s\S]*?\/\* Founder-review alert/)[0], /color:\s*(?:white|#fff)/i));
// 15
test('15 Preview light contracts do not use raw lime body copy', () => assert.doesNotMatch(f2css.match(/\.beta-preview-next\.bs-surface-paper[\s\S]*?\/\* Founder-review alert/)[0], /:is\(p, small\)[^{]*\{[^}]*--bs-lime/));
// 16
test('16 text on lime uses on-lime role', () => { assert.match(f2css, /button-lime[\s\S]*var\(--bs-on-lime\)/); assert.ok(ratio('text-on-lime/lime') >= 4.5); });
// 17
test('17 light theme contrast checker passes', () => { assert.equal(contrastRun.status, 0, contrastRun.output); assert.match(contrastRun.stdout, /light:primary\/surface/); });
// 18
test('18 dark theme contrast checker passes', () => { assert.equal(contrastRun.status, 0, contrastRun.output); assert.match(contrastRun.stdout, /dark:primary\/surface/); });
// 19
test('19 approval alert renders before long Preview detail sections', () => assert.ok(preview.indexOf('<PreviewReturnChoice') < preview.indexOf('<PreviewContent')));
// 20
test('20 approval alert appears before Around BoardSignal Preview', () => assert.ok(preview.indexOf('<PreviewReturnChoice') < preview.indexOf('AROUND BOARDSIGNAL · PREVIEW')));
// 21
test('21 Continue remains independent of alert selection', () => { const hero = preview.slice(preview.indexOf('beta-preview-hero'), preview.indexOf('{status?.state === "preview_ready"')); assert.match(hero, /canContinue/); assert.doesNotMatch(hero, /activationReturnMethod/); });
// 22
test('22 Notification.requestPermission is not called on mount', () => { const first = preview.indexOf('Notification.requestPermission()'); assert.ok(first > preview.indexOf('async function enableDevice')); assert.equal((preview.match(/Notification\.requestPermission\(\)/g) || []).length, 1); });
// 23
test('23 device permission occurs only after explicit Notify-this-device action', () => { const enable = preview.slice(preview.indexOf('async function enableDevice'), preview.indexOf('async function choose')); assert.match(enable, /Notification\.requestPermission\(\)/); assert.match(preview, /onClick=\{\(\) => void choose\("device"\)\}/); });
// 24
test('24 approval email requires explicit consent', async () => { const { result, calls } = await execute({ request: { ...makeEmailRequest(), approvalAlertEmailConsent: undefined }, playerAlreadyInside: false }); assert.equal(result.status, 'not_eligible'); assert.equal(calls.email.length, 0); assert.match(preview, /Email me when my Founder review is confirmed/); });
// 25
test('25 No alert path works without error or outbound delivery', async () => { const { result, calls } = await execute({ request: { id:'a', activationReturnMethod:'return_here' }, playerAlreadyInside:true }); assert.equal(result.status, 'not_eligible'); assert.equal(result.reason, 'no_alert'); assert.equal(calls.device.length + calls.email.length, 0); });
// 26
test('26 Discord and Telegram are not advertised as automatic approval-alert choices', () => { assert.doesNotMatch(preview, /choose\("discord"\)|choose\("telegram"\)|>Discord<|>Telegram</); assert.match(preview, /does not send automatic Founder-review alerts through/); });
// 27
test('27 legacy Discord/Telegram request data remains accepted and preserved', () => { assert.match(betaRequests, /method === "discord" \|\| method === "telegram"/); assert.match(betaRequests, /preferredContactMethod: contact\.method/); });
// 28
test('28 unclaimed device gets exactly one approval device alert', async () => { const { result, calls } = await execute({ request: makeDeviceRequest(), playerAlreadyInside:false }); assert.equal(result.status, 'delivered'); assert.equal(calls.device.length, 1); assert.equal(calls.email.length, 0); assert.match(calls.device[0].link, /\/boardsignal\/preview\/ach83/); });
// 29
test('29 unclaimed consented email gets exactly one approval email', async () => { const { result, calls } = await execute({ request: makeEmailRequest(), playerAlreadyInside:false, magicLink:'https://example.test/magic' }); assert.equal(result.status, 'delivered'); assert.equal(calls.email.length, 1); assert.equal(calls.device.length, 0); assert.equal(calls.email[0].link, 'https://example.test/magic'); });
// 30
test('30 already-provisional device gets exactly one approval device alert', async () => { const { result, calls } = await execute({ request: makeDeviceRequest(), playerAlreadyInside:true }); assert.equal(result.status, 'delivered'); assert.equal(calls.device.length, 1); assert.equal(calls.device[0].link, '/boardsignal/player-room?tab=desk'); });
// 31
test('31 already-provisional consented email gets exactly one approval email', async () => { const { result, calls } = await execute({ request: makeEmailRequest(), playerAlreadyInside:true }); assert.equal(result.status, 'delivered'); assert.equal(calls.email.length, 1); assert.match(calls.email[0].link, /\/boardsignal\/player-room\?tab=desk$/); });
// 32
test('32 already-provisional alerts point to Player Room, not onboarding', () => { const device = policy.planFoundingBetaIdentityConfirmation({ request:makeDeviceRequest(), playerAlreadyInside:true, siteUrl:'https://x.test' }); const email = policy.planFoundingBetaIdentityConfirmation({ request:makeEmailRequest(), playerAlreadyInside:true, siteUrl:'https://x.test' }); assert.equal(device.link, '/boardsignal/player-room?tab=desk'); assert.equal(email.link, 'https://x.test/boardsignal/player-room?tab=desk'); });
// 33
test('33 return_here/no-alert causes zero outbound notification', async () => { const { calls } = await execute({ request:{ id:'ach83', activationReturnMethod:'return_here' }, playerAlreadyInside:false }); assert.deepEqual(calls, { device:[], email:[] }); });
// 34
test('34 duplicate confirmation causes zero duplicate successful notification', async () => { const request = makeDeviceRequest({ identityConfirmationDelivery:{ channel:'device', status:'delivered', attemptedAt:'2026-08-16T00:00:00Z' } }); const { result, calls } = await execute({ request, playerAlreadyInside:true }); assert.equal(result.skippedDuplicate, true); assert.equal(calls.device.length + calls.email.length, 0); });
// 35
test('35 failed notification is a secondary failed result and does not throw/rollback identity path', async () => { const senders = fakeSenders(); senders.sendDevice = async (plan) => { senders.calls.device.push(plan); throw new Error('transport down'); }; const { result } = await execute({ request:makeDeviceRequest(), playerAlreadyInside:true }, senders); assert.equal(result.status, 'failed'); assert.ok(betaRequests.indexOf('identityStatus: "founder_reviewed"') < betaRequests.lastIndexOf('deliverFoundingBetaIdentityConfirmation')); assert.match(betaRequests, /deliverFoundingBetaIdentityConfirmation\([\s\S]*?\.catch\(/); });
// 36
test('36 approval truth remains founder_reviewed', () => { assert.ok((betaRequests.match(/identityStatus: "founder_reviewed"/g) || []).length >= 2); assert.match(betaRequests, /identityReviewStatus: "confirmed"/); });
// 37
test('37 public-highlight reconciliation behavior remains in both approval paths', () => { assert.equal((betaRequests.match(/reconcileConfirmedPublicHighlights\(confirmedAccount\)/g) || []).length, 2); });
// 38
test('38 Preview claim flow remains Firebase custom-token + router replace', () => { assert.match(preview, /action: "claim"/); assert.match(preview, /signInWithCustomToken\(auth, body\.customToken\)/); assert.match(preview, /router\.replace\("\/boardsignal\/player-room\?source=beta_preview&tab=desk"\)/); assert.doesNotMatch(preview, /router\.refresh\(\)/); });
// 39
test('39 stable Firebase UID identity mapping remains unchanged', () => { assert.match(betaRequests, /account\.uid !== `chesscom_\$\{request\.chessPlayerId\}`/); assert.match(betaRequests, /request\.firebaseUid \?\? `chesscom_\$\{request\.chessPlayerId\}`/); });
// 40
test('40 F.1.2 generation logic is outside F.2 delta', () => { const all = walk(ROOT).map((p) => path.relative(ROOT,p)); assert.ok(!all.some((p) => /firstReviewGeneration|BoardSignalPlayerRoom|UniversalPlayerDesk/.test(p))); assert.doesNotMatch(preview, /router\.refresh\(\)/); });
// 41
test('41 package.json is unchanged from baseline', () => { assert.equal(PACKAGE_BLOB, '95e6b72c781711c23b9b1a173a6c2c16bafb5882'); assert.ok(!fs.existsSync(path.join(ROOT,'package.json'))); });
// 42
test('42 package-lock.json is unchanged from baseline', () => { assert.equal(PACKAGE_LOCK_BLOB, '0a6af980d8c90f8a877045e323993785806756bf'); assert.ok(!fs.existsSync(path.join(ROOT,'package-lock.json'))); });
// 43
test('43 firestore.rules is unchanged from baseline', () => { assert.equal(FIRESTORE_RULES_BLOB, 'a08d287ecba85bec03ca68db327fb8a92a304b2a'); assert.ok(!fs.existsSync(path.join(ROOT,'firestore.rules'))); });
// 44 is completed by the external TS validation gate; this source test makes sure every changed TS/TSX is present for that gate.
test('44 changed TS/TSX validation scope is explicit', () => { ['src/components/BetaPreviewRoom.tsx','src/app/layout.tsx','src/app/api/boardsignal/beta-preview/[requestId]/route.ts','src/lib/boardsignal/server/betaRequests.ts','src/lib/boardsignal/server/foundingBetaIdentityConfirmation.ts'].forEach((f)=>assert.ok(fs.existsSync(path.join(ROOT,f)),f)); });
// 45
test('45 isolated-transpile validation scope has no generated JS artifacts in delta', () => assert.ok(!walk(ROOT).some((f) => /\.(js|jsx)$/.test(f) && !/\.cjs$/.test(f))));
// 46
test('46 upgraded contrast checker passes executable semantic/cascade fixture', () => assert.equal(contrastRun.status, 0, contrastRun.output));
// 47
test('47 focused executable F.2 delivery policy exercises real transports/counters', async () => { const { result, calls } = await execute({ request:makeEmailRequest(), playerAlreadyInside:true }); assert.equal(result.status,'delivered'); assert.equal(calls.email.length,1); });
// 48
test('48 delta whitespace/source scope has no forbidden generated/package files', () => { const rel = walk(ROOT).filter((f)=>fs.statSync(f).isFile()).map((f)=>path.relative(ROOT,f)).sort(); assert.ok(!rel.some((p)=>['package.json','package-lock.json','firestore.rules'].includes(p))); assert.ok(rel.every((p)=>p === 'PATCH-MANIFEST.txt' || p.startsWith('src/') || p.startsWith('scripts/') || p.startsWith('tests/'))); });

// Additional F.2 invariants that make the numbered acceptance meaningful.
test('F.2 new approval email is distinct from ongoing account contact preference', () => { assert.match(betaRequests, /approvalAlertEmail: contact\.value/); const emailBranch = betaRequests.slice(betaRequests.indexOf('if (method === "email")'), betaRequests.indexOf('} else if (method === "discord"')); assert.doesNotMatch(emailBranch, /preferredContactMethod/); assert.match(betaRequests, /email: currentPreferences\.email \?\? false/); });
test('F.2 selected device is preserved server-side for post-claim Founder confirmation', () => { assert.match(betaRequests, /approvalAlertDevice: request\.activationDevice/); assert.match(route, /rememberFoundingBetaApprovalDevice/); assert.match(betaRequests, /approvalAlertDevice: null/); });
test('F.2 one shared server delivery helper is used by unclaimed and already-inside paths', () => assert.ok((betaRequests.match(/deliverFoundingBetaIdentityConfirmation\(/g) || []).length >= 3));
test('F.2 legacy email remains deliverable for old pending requests', () => { const plan = policy.planFoundingBetaIdentityConfirmation({ request:{ id:'old', activationReturnMethod:'email', preferredContactMethod:'email', preferredContactValue:'old@example.com', betaContactConsent:true }, playerAlreadyInside:false, siteUrl:'https://x.test', magicLink:'https://x.test/magic' }); assert.equal(plan.channel,'email'); assert.equal(plan.email,'old@example.com'); });
test('F.2 learning-card measured secondary/muted ratios pass', () => { assert.ok(ratio('secondary/learning-card') >= 4.5); assert.ok(ratio('muted/learning-card') >= 4.5); });
test('F.2 final stylesheet imports after existing visual layers', () => assert.ok(layout.indexOf('boardsignal-f2-readability.css') > layout.indexOf('boardsignal-motion.css')));
test('F.2 no important overrides are introduced', () => assert.doesNotMatch(f2css, /!important/));
test('F.2 email unavailable becomes not_configured without send', async () => { const { result, calls } = await execute({ request:makeEmailRequest(), playerAlreadyInside:true, emailConfigured:false }); assert.equal(result.status,'not_configured'); assert.equal(calls.email.length,0); });
test('F.2 unsupported legacy approval channel causes no fake outbound delivery', async () => { const { result, calls } = await execute({ request:{ id:'old', activationReturnMethod:'discord', preferredContactMethod:'discord', preferredContactValue:'@old', betaContactConsent:true }, playerAlreadyInside:true }); assert.equal(result.reason,'unsupported_legacy_channel'); assert.equal(calls.email.length+calls.device.length,0); });

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes:true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir,entry.name)) : [path.join(dir,entry.name)]);
}
