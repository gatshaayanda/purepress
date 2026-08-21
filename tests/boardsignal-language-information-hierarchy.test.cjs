const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

const home = read('src/app/page.tsx');
const username = read('src/components/UsernameDeskForm.tsx');
const room = read('src/components/BoardSignalPlayerRoom.tsx');
const review = read('src/components/UniversalPlayerDesk.tsx');
const preview = read('src/components/BetaPreviewRoom.tsx');
const publicPlayer = read('src/app/player/[handle]/page.tsx');
const feed = read('src/app/feed/page.tsx');
const header = read('src/components/Header.tsx');
const types = read('src/lib/boardsignal/types.ts');

test('homepage explains the consumer value before mechanics', () => {
  assert.match(home, /See what your games are actually telling you\./);
  assert.match(home, /BoardSignal reviews your recent Chess\.com games together to show what changed, what&apos;s costing you games, and what to focus on next\./);
  assert.match(username, /SHOW ME MY REVIEW/);
  assert.match(username, /No password\. No uploads\./);
  assert.match(home, /Know what happened\./);
  assert.match(home, /See what keeps repeating\./);
  assert.match(home, /Know what to work on next\./);
  assert.match(home, /WHAT STOOD OUT/);
  assert.match(home, /BIGGEST OPPORTUNITY/);
  assert.match(home, /FOCUS NEXT/);
});

test('completed private review prioritizes the three player questions', () => {
  const whatHappened = review.indexOf('WHAT HAPPENED');
  const whatMattered = review.indexOf('WHAT MATTERED');
  const focusNext = review.indexOf('FOCUS NEXT');
  const unfolded = review.indexOf('HOW IT UNFOLDED');
  const evidence = review.indexOf('WHY BOARDSIGNAL THINKS THIS');
  assert.ok(whatHappened >= 0 && whatMattered > whatHappened && focusNext > whatMattered);
  assert.ok(unfolded > focusNext, 'chronology should sit after the three primary answers');
  assert.ok(evidence > focusNext, 'evidence should be progressive/deeper information');
  assert.match(review, /Why BoardSignal thinks this →/);
  assert.match(review, /WHAT WENT WELL/);
  assert.match(review, /BIGGEST OPPORTUNITY/);
});

test('private consumer area says My BoardSignal without renaming its route', () => {
  assert.match(header, /label: "My BoardSignal", href: "\/boardsignal\/player-room"/);
  assert.match(room, /MY BOARDSIGNAL/);
  assert.match(room, /label: "Review"/);
  assert.match(types, /export type BoardSignalDesk =/);
});

test('active incomplete week is useful now and remains evidence restrained', () => {
  assert.match(room, /Your week is taking shape\./);
  assert.doesNotMatch(room, />Desk forming</);
  const happened = room.indexOf("WHAT'S HAPPENED SO FAR?");
  const standout = room.indexOf("WHAT'S STARTING TO STAND OUT?");
  const carry = room.indexOf('CARRY INTO YOUR NEXT GAMES');
  const watching = room.indexOf('WHAT BOARDSIGNAL IS WATCHING');
  const ready = room.indexOf('When the review will be ready:');
  assert.ok(happened >= 0 && standout > happened && carry > standout && watching > carry && ready > watching);
  assert.match(room, /From your last completed review\./);
  assert.match(room, /No final diagnosis is made from an unfinished week\./);
  assert.match(room, /Position-based conclusions wait for the completed review\./);
});

test('A.1 completed factual pending review remains a distinct state', () => {
  assert.match(review, /Your factual week is ready/);
  assert.match(review, /Your week is ready\. Position review is finishing\./);
  assert.match(review, /Everything below is already confirmed from your games\./);
  assert.match(review, /TRY POSITION CHECK AGAIN/);
  assert.doesNotMatch(review.slice(review.indexOf('function DeskQualityHold')), /Your week is taking shape\./);
});

test('Preview leads from found games to private My BoardSignal', () => {
  assert.match(preview, /WE FOUND YOUR GAMES/);
  assert.match(preview, /WHAT STOOD OUT/);
  assert.match(preview, /READY FOR THE FULL PICTURE\?/);
  assert.match(preview, /Continue to My BoardSignal/);
  assert.match(preview, /Private improvement guidance and reviewed position evidence stay inside My BoardSignal\./);
});

test('public surfaces use highlights and Around BoardSignal without private weakness vocabulary', () => {
  assert.match(publicPlayer, /BOARD SIGNAL HIGHLIGHTS/);
  assert.match(publicPlayer, /THIS WEEK'S STANDOUTS/);
  assert.match(feed, /Around BoardSignal/);
  assert.match(feed, /HIGHLIGHTS/);
  assert.match(feed, /THIS WEEK&apos;S STANDOUTS/);
  for (const source of [publicPlayer, feed]) {
    assert.doesNotMatch(source, /Signal Board|Blue Signal|Red Signal|Amber Signal/);
  }
  assert.match(publicPlayer, /Private improvement guidance, reviewed positions and personal progress never appear on this public page\./);
});
