const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const c1 = read('src/app/boardsignal-accessibility.css');
const globals = read('src/app/globals.css');
const layout = read('src/app/layout.tsx');
const home = read('src/app/page.tsx');
const username = read('src/components/UsernameDeskForm.tsx');
const review = read('src/components/UniversalPlayerDesk.tsx');
const room = read('src/components/BoardSignalPlayerRoom.tsx');

function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function literalTokens(block) {
  const values = new Map();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) values.set(match[1], match[2]);
  return values;
}
function blocks(selector, source) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...source.matchAll(new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`, 'g'))].map((match) => match[1]);
}
function themeTokens(darkMode) {
  const values = new Map();
  for (const source of [globals, c1]) for (const block of blocks(':root', source)) for (const entry of literalTokens(block)) values.set(...entry);
  if (darkMode) for (const source of [globals, c1]) for (const block of blocks('html[data-bs-theme="dark"]', source)) for (const entry of literalTokens(block)) values.set(...entry);
  return values;
}
function mustPass(theme, fg, bg, minimum, label) {
  assert.ok(theme.has(fg), `missing ${fg}`);
  assert.ok(theme.has(bg), `missing ${bg}`);
  const ratio = contrast(theme.get(fg), theme.get(bg));
  assert.ok(ratio >= minimum, `${label}: ${ratio.toFixed(3)}:1 is below ${minimum}:1`);
}

const light = themeTokens(false);
const dark = themeTokens(true);

test('C.1 is layered after Patch C without replacing the theme system', () => {
  assert.match(globals, /Patch C — BoardSignal visual system \+ dark mode/);
  assert.match(layout, /import "\.\/globals\.css";\s*import "\.\/boardsignal-accessibility\.css";/);
  assert.match(globals, /html\[data-bs-theme="dark"\]/);
  assert.match(c1, /Patch C\.1 — complete contrast, readability \+ state safety/);
});

test('normal and state text pairs meet WCAG AA in light and dark themes', () => {
  const textPairs = [
    ['--bs-text', '--bs-bg'], ['--bs-text', '--bs-surface'],
    ['--bs-text-secondary', '--bs-bg'], ['--bs-text-secondary', '--bs-surface'],
    ['--bs-text-muted', '--bs-bg'], ['--bs-text-muted', '--bs-surface'],
    ['--bs-blue-readable', '--bs-surface'],
    ['--bs-positive-text', '--bs-positive-surface'],
    ['--bs-warning-text', '--bs-warning-surface'],
    ['--bs-danger-text', '--bs-danger-surface'],
    ['--bs-selection-text', '--bs-selection-bg'],
  ];
  for (const [fg, bg] of textPairs) {
    mustPass(light, fg, bg, 4.5, `light ${fg}/${bg}`);
    mustPass(dark, fg, bg, 4.5, `dark ${fg}/${bg}`);
  }
});

test('meaningful UI boundaries and focus meet non-text contrast targets', () => {
  for (const theme of [light, dark]) {
    mustPass(theme, '--bs-ui-border', '--bs-surface', 3, 'UI boundary/surface');
    mustPass(theme, '--bs-ui-border', '--bs-bg', 3, 'UI boundary/background');
    mustPass(theme, '--bs-focus-ring', '--bs-surface', 3, 'focus/surface');
    mustPass(theme, '--bs-focus-ring', '--bs-bg', 3, 'focus/background');
  }
  assert.match(c1, /:focus-visible/);
  assert.match(c1, /outline:\s*3px solid var\(--bs-focus-ring\)/);
});

test('lime is an accent or surface, never faint light-surface body copy', () => {
  mustPass(light, '--bs-on-lime', '--bs-lime', 4.5, 'text on lime');
  assert.match(c1, /Lime remains an accent\/surface/);
  assert.doesNotMatch(c1, /(?:p|small|label|li)[^{]*\{[^}]*color:\s*var\(--bs-lime\)/s);
  assert.match(c1, /\.button-lime[\s\S]*color:\s*var\(--bs-on-lime\)/);
});

test('dark cards use direct readable on-dark roles instead of opacity', () => {
  mustPass(light, '--bs-text-on-dark-secondary', '--bs-surface-dark', 4.5, 'secondary on dark');
  mustPass(light, '--bs-text-on-dark-muted', '--bs-surface-dark', 4.5, 'muted on dark');
  assert.match(c1, /\.universal-cover-copy/);
  assert.match(c1, /\.current-episode-card \.return-loop-next small/);
  assert.match(c1, /\.site-footer/);
  assert.doesNotMatch(c1, /opacity:\s*\.(?:[0-8]\d*)/);
});

test('Stockfish A.1 states preserve factual-review safety and readable retry presentation', () => {
  assert.match(review, /Your week is ready\. Position review is finishing\./);
  assert.match(review, /Everything below is already confirmed from your games\./);
  assert.match(review, /auto-retrying/);
  assert.match(review, /ENGINE_UNSUPPORTED/);
  assert.match(review, /ENGINE_ASSET_404/);
  assert.match(review, /TRY POSITION CHECK AGAIN/);
  assert.match(review, /Your review is saved\. You may leave and return/);
  assert.match(c1, /A\.1 \/ Stockfish recovery presentation/);
  assert.match(c1, /\.last-active-banner[\s\S]*var\(--bs-warning-surface\)/);
  assert.match(c1, /\.quality-actions \.button-lime/);
});

test('status is not color-only and empty/error states retain readable text roles', () => {
  assert.match(c1, /\.state-pill\.ready::before\s*\{\s*content:\s*"✓"/);
  assert.match(c1, /\.state-pill\.processing::before\s*\{\s*content:\s*"…"/);
  assert.match(c1, /\.state-pill\.exception::before\s*\{\s*content:\s*"!"/);
  assert.match(c1, /\[role="alert"\]/);
  assert.match(c1, /\.section-empty/);
  assert.match(c1, /\.public-coverage-empty/);
});

test('forms, disabled states, selection, and links remain legible', () => {
  assert.match(c1, /input, textarea\)::placeholder[\s\S]*opacity:\s*1/);
  assert.match(c1, /:disabled[\s\S]*opacity:\s*1/);
  assert.match(c1, /::selection[\s\S]*var\(--bs-selection-bg\)[\s\S]*var\(--bs-selection-text\)/);
  assert.match(c1, /text-decoration:\s*underline/);
});

test('contrast preference, forced colors and selection safety are explicit', () => {
  assert.match(c1, /@media \(prefers-contrast: more\)/);
  assert.match(c1, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(`${globals}\n${c1}`, /forced-color-adjust\s*:\s*none/i);
  assert.doesNotMatch(c1, /user-select\s*:\s*none/i);
});

test('sticky and floating UI has focus/scroll obstruction protection at required phone widths', () => {
  assert.match(c1, /scroll-padding-bottom:/);
  assert.match(c1, /scroll-margin-bottom:/);
  assert.match(c1, /@media \(max-width: 390px\)/);
  assert.match(c1, /@media \(max-width: 360px\)/);
  assert.match(c1, /@media \(max-width: 320px\)/);
  assert.match(c1, /\.ask-bs/);
  assert.match(c1, /\.room-tab-nav/);
});

test('Patch B copy and Patch C theme hierarchy remain intact', () => {
  assert.match(home, /See what your games are actually telling you\./);
  assert.match(home, /Know what happened\./);
  assert.match(home, /See what keeps repeating\./);
  assert.match(home, /Know what to work on next\./);
  assert.match(username, /SHOW ME MY REVIEW/);
  assert.match(username, /No password\. No uploads\./);
  assert.match(review, /WHAT HAPPENED/);
  assert.match(review, /WHAT MATTERED/);
  assert.match(review, /FOCUS NEXT/);
  assert.match(room, /Your week is taking shape\./);
  assert.match(room, /CARRY INTO YOUR NEXT GAMES/);
});

test('C.1 remains presentation-only and does not encode backend behavior', () => {
  assert.doesNotMatch(c1, /firebase|firestore|stockfish-18|Worker\(|fetch\(|processor|quality\.ts|factualReview/i);
  assert.doesNotMatch(layout, /boardsignal-accessibility\.css[\s\S]*firebase/i);
  assert.doesNotMatch(c1, /!important/);
});
