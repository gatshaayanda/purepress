import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const globalsPath = path.join(root, 'src/app/globals.css');
const foundationPath = path.join(root, 'src/app/boardsignal-foundation.css');
const hardeningPath = path.join(root, 'src/app/boardsignal-accessibility.css');
const f2Path = path.join(root, 'src/app/boardsignal-f2-readability.css');
const layoutPath = path.join(root, 'src/app/layout.tsx');

const globals = fs.readFileSync(globalsPath, 'utf8');
const foundation = fs.existsSync(foundationPath) ? fs.readFileSync(foundationPath, 'utf8') : '';
const hardening = fs.readFileSync(hardeningPath, 'utf8');
const f2 = fs.readFileSync(f2Path, 'utf8');
const layout = fs.readFileSync(layoutPath, 'utf8');
const css = `${globals}\n${foundation}\n${hardening}\n${f2}`;
const failures = [];

function luminance(hex) {
  const value = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
}
function declarationTokens(block) {
  const values = new Map();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)\s*;/g)) values.set(match[1], match[2].trim());
  return values;
}
function mergeTokens(target, source) {
  for (const [name, value] of source) target.set(name, value);
}
function blocksFor(selector, source) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...source.matchAll(new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`, 'g'))].map((match) => match[1]);
}
function resolveToken(theme, name, seen = new Set()) {
  if (seen.has(name)) {
    failures.push(`circular semantic token alias ${[...seen, name].join(' -> ')}`);
    return '#000000';
  }
  const value = theme.get(name);
  if (!value) {
    failures.push(`missing semantic token ${name}`);
    return '#000000';
  }
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  if (alias) return resolveToken(theme, alias[1], new Set([...seen, name]));
  failures.push(`semantic token ${name} is not a resolvable color: ${value}`);
  return '#000000';
}

const light = new Map();
for (const source of [globals, foundation, hardening, f2]) {
  for (const block of blocksFor(':root', source)) mergeTokens(light, declarationTokens(block));
}
const dark = new Map(light);
for (const source of [globals, foundation, hardening, f2]) {
  for (const block of blocksFor('html[data-bs-theme="dark"]', source)) mergeTokens(dark, declarationTokens(block));
}

function checkPair(themeName, theme, pairName, foreground, background, minimum) {
  const fg = resolveToken(theme, foreground);
  const bg = resolveToken(theme, background);
  const ratio = contrast(fg, bg);
  if (ratio < minimum) failures.push(`${themeName}:${pairName} ${ratio.toFixed(3)}:1 < ${minimum}:1`);
  return `${themeName}:${pairName} ${fg} on ${bg} ${ratio.toFixed(2)}:1`;
}

const reports = [];
const canonicalTextPairs = [
  ['primary/surface', '--bs-text-primary', '--bs-surface', 4.5],
  ['primary/elevated', '--bs-text-primary', '--bs-surface-elevated', 4.5],
  ['secondary/surface', '--bs-text-secondary', '--bs-surface', 4.5],
  ['secondary/elevated', '--bs-text-secondary', '--bs-surface-elevated', 4.5],
  ['muted/surface', '--bs-text-muted', '--bs-surface', 4.5],
  ['muted/elevated', '--bs-text-muted', '--bs-surface-elevated', 4.5],
  ['link/surface', '--bs-blue-readable', '--bs-surface', 4.5],
  ['positive/status', '--bs-positive', '--bs-positive-surface', 4.5],
  ['warning/status', '--bs-warning', '--bs-warning-surface', 4.5],
  ['danger/status', '--bs-danger', '--bs-danger-surface', 4.5],
  ['selection', '--bs-selection-text', '--bs-selection-bg', 4.5],
  ['inverse-primary', '--bs-text-on-inverse', '--bs-surface-inverse', 4.5],
  ['inverse-secondary', '--bs-text-on-inverse-secondary', '--bs-surface-inverse', 4.5],
  ['inverse-muted', '--bs-text-on-inverse-muted', '--bs-surface-inverse', 4.5],
  ['text-on-lime/lime', '--bs-on-lime', '--bs-lime', 4.5],
  ['disabled', '--bs-disabled-text', '--bs-disabled-surface', 4.5],
];
for (const [themeName, theme] of [['light', light], ['dark', dark]]) {
  for (const [name, fg, bg, min] of canonicalTextPairs) reports.push(checkPair(themeName, theme, name, fg, bg, min));
  reports.push(checkPair(themeName, theme, 'ui-border/surface', '--bs-ui-border', '--bs-surface', 3));
  reports.push(checkPair(themeName, theme, 'ui-border/elevated', '--bs-ui-border', '--bs-surface-elevated', 3));
  reports.push(checkPair(themeName, theme, 'focus/surface', '--bs-focus', '--bs-surface', 3));
  reports.push(checkPair(themeName, theme, 'focus/elevated', '--bs-focus', '--bs-surface-elevated', 3));
  reports.push(checkPair(themeName, theme, 'primary/learning-card', '--bs-text-on-dark', '--bs-f2-learning-card-dark', 4.5));
  reports.push(checkPair(themeName, theme, 'secondary/learning-card', '--bs-text-on-dark-secondary', '--bs-f2-learning-card-dark', 4.5));
  reports.push(checkPair(themeName, theme, 'muted/learning-card', '--bs-text-on-dark-muted', '--bs-f2-learning-card-dark', 4.5));
}

if (!foundation) failures.push('G.1 foundation stylesheet missing: src/app/boardsignal-foundation.css');

const canonical = [
  '--bs-surface', '--bs-surface-elevated', '--bs-surface-inverse',
  '--bs-text-primary', '--bs-text-secondary', '--bs-text-muted', '--bs-text-on-inverse',
  '--bs-border', '--bs-border-strong',
  '--bs-brand-primary', '--bs-positive', '--bs-warning', '--bs-danger', '--bs-focus',
];
const foundationLight = new Map();
for (const block of blocksFor(':root', foundation)) mergeTokens(foundationLight, declarationTokens(block));
const foundationDark = new Map();
for (const block of blocksFor('html[data-bs-theme="dark"]', foundation)) mergeTokens(foundationDark, declarationTokens(block));
for (const name of canonical) {
  if (!foundationLight.has(name)) failures.push(`G.1 canonical light role missing: ${name}`);
  if (!foundationDark.has(name)) failures.push(`G.1 canonical dark role missing: ${name}`);
}

const aliasContracts = [
  ['--bs-surface-raised', '--bs-surface-elevated'],
  ['--bs-surface-dark', '--bs-surface-inverse'],
  ['--bs-text', '--bs-text-primary'],
  ['--bs-text-on-dark', '--bs-text-on-inverse'],
  ['--bs-blue', '--bs-brand-primary'],
  ['--bs-focus-ring', '--bs-focus'],
  ['--bs-positive-text', '--bs-positive'],
  ['--bs-warning-text', '--bs-warning'],
  ['--bs-danger-text', '--bs-danger'],
];
for (const [legacy, canonicalName] of aliasContracts) {
  const escapedLegacy = legacy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedCanonical = canonicalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`${escapedLegacy}\\s*:\\s*var\\(${escapedCanonical}\\)\\s*;`).test(foundation)) {
    failures.push(`G.1 compatibility alias missing: ${legacy} -> ${canonicalName}`);
  }
}

const importOrder = [
  'import "./globals.css";',
  'import "./boardsignal-foundation.css";',
  'import "./boardsignal-accessibility.css";',
  'import "./boardsignal-motion.css";',
  'import "./boardsignal-f2-readability.css";',
];
let previous = -1;
for (const statement of importOrder) {
  const index = layout.indexOf(statement);
  if (index < 0) failures.push(`layout stylesheet import missing: ${statement}`);
  if (index >= 0 && index <= previous) failures.push(`layout stylesheet import order invalid at: ${statement}`);
  if (index >= 0) previous = index;
}

const c1Required = [
  '--bs-ui-border:', '--bs-positive:', '--bs-warning:', '--bs-danger:',
  '--bs-text-on-inverse-secondary:', '--bs-disabled-text:', '--bs-selection-bg:',
];
for (const invariant of c1Required) if (!foundation.includes(invariant)) failures.push(`G.1/C.1 foundation invariant missing: ${invariant}`);
for (const invariant of ['@media (prefers-contrast: more)', '@media (forced-colors: active)', 'scroll-padding-bottom:', 'scroll-margin-bottom:', '::selection', ':focus-visible']) {
  if (!hardening.includes(invariant)) failures.push(`C.1 accessibility invariant missing: ${invariant}`);
}
if (!/\.player-inbox-list button\.is-selected[\s\S]*?--bs-ui-border/.test(hardening)) failures.push('G.1 selected Inbox boundary must use --bs-ui-border');
if (!/\.universal-section\.universe-learning-section \.universe-learning-grid > :is\(a, article\)[\s\S]*?background:\s*var\(--bs-f2-learning-card-dark\)/.test(hardening)) failures.push('G.1 protected F.2 Universe card must defeat the older translucent selector');
if (/forced-color-adjust\s*:\s*none/i.test(css)) failures.push('forced-colors is globally or locally disabled');
if (/(?:^|[}\s])(?:\*|html|body)\s*\{[^}]*user-select\s*:\s*none/ims.test(css)) failures.push('global user-select:none is forbidden');
if (/!important/.test(`${foundation}\n${hardening}\n${f2}`)) failures.push('BoardSignal foundation/accessibility/F.2 hardening path must not rely on !important overrides');

// G.1 regression guard: BoardSignal-specific heading/paragraph presentation must
// not be established by generic unscoped element selectors.
const globalsWithoutComments = globals.replace(/\/\*[\s\S]*?\*\//g, '');
const rulePattern = /([^{}]+)\{([^{}]+)\}/g;
const forbiddenPresentation = /(?:^|;)\s*(?:color|font-family|font-weight|font-size|letter-spacing)\s*:/i;
function splitSelectors(selectorList) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (const char of selectorList) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
for (const match of globalsWithoutComments.matchAll(rulePattern)) {
  if (!forbiddenPresentation.test(match[2])) continue;
  const selectors = splitSelectors(match[1]);
  for (const selector of selectors) {
    if (!/\b(?:h1|h2|h3|h4|p)\b/.test(selector)) continue;
    if (/\.site-frame\b/.test(selector)) continue;
    if (!/[.#]/.test(selector)) failures.push(`unscoped generic typography/foreground rule: ${selector}`);
  }
}

// Scan only Patch C onward plus foundation/C.1/F.2 to avoid flagging historical
// legacy CSS that the later visual system deliberately supersedes.
const patchCStart = globals.indexOf('Patch C — BoardSignal visual system + dark mode');
const boardSignalCss = `${patchCStart >= 0 ? globals.slice(patchCStart) : globals}\n${foundation}\n${hardening}\n${f2}`;
const knownDark = /bs-surface-dark|bs-surface-inverse|first-value-preview|pipeline-preview|universal-cover-copy|engine-section|feed-hero|beta-preview-sticky-access|return-loop-next|site-footer|ask-bs-header|ask-bs-launcher|beta-preview-access-cta|universe-learning-section/;
for (const match of boardSignalCss.matchAll(rulePattern)) {
  const selector = match[1].trim();
  const body = match[2];
  const lightSurface = /background(?:-color)?\s*:\s*(?:var\(--(?:bs-surface|bs-surface-raised|bs-surface-elevated|bs-bg|bs-bg-subtle|bs-surface-paper|bs-surface-soft|bs-surface-light)\)|#[fF][0-9a-fA-F]{5}|#fff(?:fff)?)/.test(body);
  const unsafeLightText = /color\s*:\s*(?:var\(--(?:bs-lime|bs-accent)\)|#c9f65d|white|#fff(?:fff)?)/i.test(body);
  if (lightSurface && unsafeLightText && !/bs-surface-accent|button-lime|universal-score-card/.test(selector)) failures.push(`unsafe light-surface foreground in ${selector}`);
  const darkSurface = /background(?:-color)?\s*:[^;]*(?:bs-surface-dark|bs-surface-inverse|#101923|#08111e|#17365f|#172e50)/i.test(body) || knownDark.test(selector);
  const unsafeDarkText = /color\s*:\s*var\(--(?:bs-text-muted|bs-text-secondary|bs-text|text-muted|ink-soft)\)/i.test(body);
  if (darkSurface && unsafeDarkText && !/html\[data-bs-theme="dark"\]/.test(selector)) failures.push(`unsafe dark-surface foreground role in ${selector}`);
}

// F.2 cross-rule/cascade guards: final semantic selectors must resolve the exact
// Preview and Universe failure classes rather than relying on source-order luck.
function selectorRules(source, target) {
  const matches = [];
  for (const match of source.matchAll(rulePattern)) {
    const selectors = match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((item) => item.trim());
    if (selectors.includes(target)) matches.push(match[2]);
  }
  return matches;
}
function requireContract(target, tests) {
  const bodies = selectorRules(f2, target);
  if (!bodies.length) { failures.push(`F.2 selector contract missing: ${target}`); return; }
  const body = bodies.join('\n');
  for (const [name, pattern] of tests) if (!pattern.test(body)) failures.push(`F.2 ${target} missing ${name}`);
}
requireContract('.beta-preview-access-cta', [
  ['dark background', /background\s*:\s*var\(--bs-surface-dark\)/],
  ['on-dark foreground', /color\s*:\s*var\(--bs-text-on-dark\)/],
]);
requireContract('.beta-preview-next.bs-surface-paper', [
  ['light background', /background\s*:\s*var\(--bs-surface\)/],
  ['light foreground', /color\s*:\s*var\(--bs-text\)/],
]);
requireContract('.universal-section.universe-learning-section', [
  ['dark background', /background\s*:\s*var\(--bs-surface-dark\)/],
  ['on-dark foreground', /color\s*:\s*var\(--bs-text-on-dark\)/],
]);
for (const target of ['.universe-learning-grid > a', '.universe-learning-grid > article', '.universe-learning-grid > article > a']) {
  requireContract(target, [['readable on-dark foreground', /color\s*:\s*var\(--bs-text-on-dark\)/]]);
}
const previewLightRules = [...f2.matchAll(rulePattern)].filter((match) => /beta-preview-next\.bs-surface-paper|beta-preview-approval-alert/.test(match[1]));
for (const match of previewLightRules) {
  if (/color\s*:\s*(?:white|#fff(?:fff)?|var\(--bs-lime\)|var\(--bs-accent\))/i.test(match[2])) failures.push(`F.2 unsafe Preview light-surface foreground in ${match[1].trim()}`);
}
for (const match of f2.matchAll(rulePattern)) {
  if (/beta-preview-access-cta|universe-learning-section|universe-learning-grid/.test(match[1])
      && /color\s*:\s*var\(--(?:bs-text|bs-text-secondary|bs-text-muted)\)/.test(match[2])) {
    failures.push(`F.2 dark surface uses light-surface text role in ${match[1].trim()}`);
  }
}

// Catch component-level semantic contradictions without brittle whitespace hashing.
const sourceRoot = path.join(root, 'src');
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
for (const file of walk(sourceRoot).filter((file) => /\.(tsx|ts)$/.test(file))) {
  const source = fs.readFileSync(file, 'utf8');
  if (/className=["'`][^"'`]*(?:bs-surface-paper|bs-surface-soft|bs-surface-light)[^"'`]*(?:text-white|text-lime|bs-accent-on-dark)/.test(source)) failures.push(`forbidden light-surface class combination in ${path.relative(root, file)}`);
  if (/className=["'`][^"'`]*beta-preview-next[^"'`]*bs-surface-dark/.test(source) || /className=["'`][^"'`]*bs-surface-dark[^"'`]*beta-preview-next/.test(source)) failures.push(`F.2 unresolved beta-preview-next dark/light contradiction in ${path.relative(root, file)}`);
}

if (failures.length) {
  console.error('BoardSignal static contrast/token invariant FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('BoardSignal static contrast/token invariant PASS');
reports.forEach((report) => console.log(report));
console.log('Rendered browser verification is still required.');
