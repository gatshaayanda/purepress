const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const css = read('src/app/globals.css');
const layout = read('src/app/layout.tsx');
const theme = read('src/components/BoardSignalThemeControl.tsx');
const header = read('src/components/Header.tsx');
const home = read('src/app/page.tsx');
const username = read('src/components/UsernameDeskForm.tsx');
const review = read('src/components/UniversalPlayerDesk.tsx');
const room = read('src/components/BoardSignalPlayerRoom.tsx');
const pkg = read('package.json');

const patchCss = css.slice(css.indexOf('Patch C — BoardSignal visual system + dark mode'));

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
function token(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escaped}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `missing ${name}`);
  return match[1];
}

test('shared semantic BoardSignal visual tokens define light and dark roles', () => {
  for (const token of [
    '--bs-bg:', '--bs-bg-subtle:', '--bs-surface:', '--bs-surface-raised:', '--bs-surface-dark:',
    '--bs-text:', '--bs-text-secondary:', '--bs-text-muted:', '--bs-text-on-dark:',
    '--bs-border:', '--bs-border-strong:', '--bs-blue:', '--bs-blue-readable:', '--bs-blue-soft:',
    '--bs-lime:', '--bs-lime-readable:', '--bs-lime-soft:', '--bs-positive:', '--bs-warning:', '--bs-danger:'
  ]) assert.match(patchCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(patchCss, /html\[data-bs-theme="dark"\]/);
  assert.match(patchCss, /--bs-bg:\s*#0b1220/);
  assert.match(patchCss, /--bs-surface-raised:\s*#162338/);
});

test('semantic light and dark text roles retain readable contrast', () => {
  const lightBlock = patchCss.slice(patchCss.indexOf(':root {'), patchCss.indexOf('html[data-bs-theme=\"dark\"]'));
  const darkStart = patchCss.indexOf('html[data-bs-theme=\"dark\"]');
  const darkBlock = patchCss.slice(darkStart, patchCss.indexOf('html[data-bs-theme=\"light\"]', darkStart));
  const lightBg = token(lightBlock, '--bs-bg');
  const darkBg = token(darkBlock, '--bs-bg');
  for (const name of ['--bs-text', '--bs-text-secondary', '--bs-text-muted', '--bs-blue-readable', '--bs-lime-readable']) {
    assert.ok(contrast(token(lightBlock, name), lightBg) >= 4.5, `${name} must remain readable in light mode`);
    assert.ok(contrast(token(darkBlock, name), darkBg) >= 4.5, `${name} must remain readable in dark mode`);
  }
});

test('theme choice supports system light and dark and persists locally', () => {
  assert.match(theme, /boardsignal:theme/);
  assert.match(theme, /"light"\s*\|\s*"dark"\s*\|\s*"system"/);
  assert.match(theme, /localStorage\.setItem\(BOARDSIGNAL_THEME_STORAGE_KEY, choice\)/);
  assert.match(theme, /prefers-color-scheme: dark/);
  assert.match(header, /BoardSignalThemeControl/);
  assert.match(theme, /aria-label="BoardSignal appearance"/);
});

test('pre-hydration theme bootstrap is presentation-only', () => {
  assert.match(layout, /boardSignalThemeBootstrap/);
  assert.match(layout, /window\.localStorage\.getItem\(key\)/);
  assert.match(layout, /window\.matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(layout, /root\.dataset\.bsTheme/);
  assert.doesNotMatch(layout, /firebase|auth\.|Firestore/i);
  assert.doesNotMatch(theme, /firebase|firestore|auth\./i);
});

test('Patch B homepage promise and primary action remain locked', () => {
  assert.match(home, /See what your games are actually telling you\./);
  assert.match(home, /Know what happened\./);
  assert.match(home, /See what keeps repeating\./);
  assert.match(home, /Know what to work on next\./);
  assert.match(username, /SHOW ME MY REVIEW/);
  assert.match(username, /No password\. No uploads\./);
});

test('completed review keeps WHAT HAPPENED WHAT MATTERED and FOCUS NEXT as the primary hierarchy', () => {
  const happened = review.indexOf('WHAT HAPPENED');
  const mattered = review.indexOf('WHAT MATTERED');
  const focus = review.indexOf('FOCUS NEXT');
  const replay = review.indexOf('HOW IT UNFOLDED');
  assert.ok(happened >= 0 && mattered > happened && focus > mattered && replay > focus);
  assert.match(patchCss, /#what-mattered\.universal-section/);
  assert.match(patchCss, /#focus-next\.universal-section/);
  assert.match(review, /Why BoardSignal thinks this/);
});

test('active week remains distinct from A.1 completed factual review', () => {
  assert.match(room, /Your week is taking shape\./);
  assert.match(room, /WHAT'S HAPPENED SO FAR\?/);
  assert.match(room, /CARRY INTO YOUR NEXT GAMES/);
  assert.match(room, /WHAT BOARDSIGNAL IS WATCHING/);
  assert.match(review, /Your week is ready\. Position review is finishing\./);
  assert.match(review, /TRY POSITION CHECK AGAIN/);
  assert.match(patchCss, /\.current-episode-card/);
  assert.match(patchCss, /A\.1 pending factual review/);
});

test('lime stays an accent with readable dark copy and keyboard focus remains explicit', () => {
  assert.match(patchCss, /--bs-on-lime:\s*#101923/);
  assert.match(patchCss, /\.button-lime\s*\{[^}]*color:\s*var\(--bs-on-lime\)/s);
  assert.doesNotMatch(patchCss, /body\s*\{[^}]*color:\s*var\(--bs-lime\)/s);
  assert.match(patchCss, /:focus-visible/);
  assert.match(patchCss, /outline:\s*3px solid var\(--bs-blue\)/);
});

test('responsive composition covers phone tablet and desktop-critical surfaces', () => {
  assert.match(patchCss, /@media \(max-width: 1000px\)/);
  assert.match(patchCss, /@media \(max-width: 900px\)/);
  assert.match(patchCss, /@media \(max-width: 680px\)/);
  assert.match(patchCss, /@media \(max-width: 390px\)/);
  assert.match(patchCss, /\.username-entry-row/);
  assert.match(patchCss, /\.universal-cover/);
  assert.match(patchCss, /\.current-episode-stats/);
  assert.match(patchCss, /\.beta-preview-sticky-access/);
  assert.match(patchCss, /\.room-tab-nav/);
});

test('Patch C does not add theme frameworks or styling-driven backend/schema concepts', () => {
  assert.doesNotMatch(pkg, /next-themes|styled-components|framer-motion|@emotion|chakra|mui/i);
  assert.doesNotMatch(theme, /BoardSignalDesk|deskKey|episodeKey|playerId|Firebase/);
  assert.match(review, /BoardSignalDesk/);
  assert.match(review, /episodeKey/);
  assert.match(room, /\/boardsignal\/player-room/);
  assert.doesNotMatch(patchCss, /@keyframes|animation:/);
});
