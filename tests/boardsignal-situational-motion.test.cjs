const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const css = read("src/app/boardsignal-motion.css");
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const controller = read("src/components/BoardSignalSituationalMotion.tsx");
const layout = read("src/app/layout.tsx");
const playerRoom = read("src/components/BoardSignalPlayerRoom.tsx");
const desk = read("src/components/UniversalPlayerDesk.tsx");
const theme = read("src/components/BoardSignalThemeControl.tsx");
const packageJson = JSON.parse(read("package.json"));

test("Patch D exposes bounded semantic motion tokens", () => {
  assert.match(css, /--bs-motion-fast:\s*140ms/);
  assert.match(css, /--bs-motion-standard:\s*220ms/);
  assert.match(css, /--bs-motion-slow:\s*360ms/);
  assert.match(css, /--bs-ease-standard:/);
  assert.match(css, /--bs-ease-enter:/);
  assert.match(css, /--bs-ease-exit:/);
  assert.doesNotMatch(css, /\b(?:[2-9]|\d{2,})s\b/);
});

test("reduced motion is a first-class system behavior", () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(controller, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.button-spinner[\s\S]*animation:\s*none\s*!important/);
  assert.match(css, /\.bs-motion-guidance-current[\s\S]*animation:\s*none\s*!important/);
});

test("core UI has no perpetual decorative animation", () => {
  const infiniteLines = css.split("\n").filter((line) => /\binfinite\b/.test(line));
  assert.equal(infiniteLines.length, 1);
  assert.match(css, /\.last-active-banner\.bs-motion-engine-active\s*>\s*svg:first-child[\s\S]*infinite/);
  assert.doesNotMatch(cssWithoutComments, /particle|parallax|marquee|scroll-jack|animated-gradient/i);
});

test("active-week facts and B.1 guidance react only to meaningful changes", () => {
  assert.match(controller, /\.current-episode-stats > div/);
  assert.match(controller, /\.forming-pools > article/);
  assert.match(controller, /\.return-loop-amber/);
  assert.match(controller, /\.return-loop-blue/);
  assert.match(controller, /FROM YOUR LAST REVIEW/);
  assert.match(controller, /Based on /);
  assert.match(controller, /bs-motion-guidance-current/);
  assert.match(playerRoom, /BEFORE YOUR NEXT GAME/);
  assert.match(playerRoom, /CurrentEpisodeWithNextGameGuidance/);
});

test("completed Review readiness is staged and bounded", () => {
  assert.match(css, /#what-mattered\.universal-section[\s\S]*30ms/);
  assert.match(css, /#focus-next\.universal-section[\s\S]*70ms/);
  assert.match(css, /bs-motion-review-ready/);
  assert.match(controller, /hadPendingReview/);
  assert.match(controller, /\.universal-cover/);
  assert.match(controller, /#focus-next\.universal-section/);
});

test("A.1 engine recovery moves only the position-review state", () => {
  assert.match(desk, /Your week is ready\. Position review is finishing\./);
  assert.match(desk, /Everything below is already confirmed from your games\./);
  assert.match(desk, /TRY POSITION CHECK AGAIN/);
  assert.match(controller, /\.last-active-banner/);
  assert.match(controller, /bs-motion-engine-active/);
  assert.doesNotMatch(controller, /setSnapshot|setDesk|fetch\(|localStorage|sessionStorage|firestore/i);
  assert.doesNotMatch(css, /\.universal-desk-page\s*\{[^}]*opacity:\s*0/s);
});

test("engine processing motion stays lightweight", () => {
  assert.match(css, /@keyframes bs-motion-engine-spin[\s\S]*rotate\(360deg\)/);
  assert.doesNotMatch(controller, /canvas|getContext|requestAnimationFrame\([^)]*requestAnimationFrame/s);
  assert.doesNotMatch(css, /filter:\s*blur|backdrop-filter.*animation/i);
});

test("Patch C theme bootstrap and switching remain intact", () => {
  assert.match(layout, /boardSignalThemeBootstrap/);
  assert.match(layout, /data\.bsTheme|dataset\.bsTheme/);
  assert.match(layout, /boardsignal-accessibility\.css/);
  assert.match(layout, /boardsignal-motion\.css/);
  assert.match(theme, /applyBoardSignalTheme/);
  assert.match(theme, /BOARDSIGNAL_THEME_CHANGE_EVENT/);
});

test("Patch B hierarchy and B.1 copy remain intact", () => {
  assert.match(playerRoom, /Your week is taking shape\./);
  assert.match(playerRoom, /BEFORE YOUR NEXT GAME/);
  assert.match(desk, /WHAT HAPPENED/);
  assert.match(desk, /WHAT MATTERED/);
  assert.match(desk, /FOCUS NEXT/);
  assert.match(desk, /Your week is ready\. Position review is finishing\./);
});

test("evidence disclosure stays native and keyboard accessible", () => {
  assert.match(desk, /<details className="quality-reference"/);
  assert.match(desk, /<summary>Beta engine diagnostics<\/summary>/);
  assert.match(css, /details\.quality-reference\[open\]/);
  assert.doesNotMatch(controller, /preventDefault\(\).*summary|querySelector\([^)]*summary/i);
});

test("situational motion does not create backend or durable presentation state", () => {
  assert.deepEqual([...controller.matchAll(/^import .* from "([^"]+)";/gm)].map((match) => match[1]), ["react"]);
  assert.doesNotMatch(controller, /api\/|server\/|firebase|firestore|fetch\(|localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(css, /url\(|@import/);
});

test("Patch D adds no motion dependency", () => {
  assert.equal(packageJson.dependencies?.["framer-motion"], undefined);
  assert.equal(packageJson.dependencies?.["motion"], undefined);
  assert.equal(packageJson.devDependencies?.["framer-motion"], undefined);
  assert.equal(packageJson.devDependencies?.["motion"], undefined);
});
