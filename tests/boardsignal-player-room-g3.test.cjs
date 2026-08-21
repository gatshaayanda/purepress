const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  buildPlayerRoomQuickRead,
  groupReviewEvidence,
  evidenceSupportLabels,
} = require('../.test-dist-g3/lib/boardsignal/playerRoomPresentation.js');

function signal(title, copy, status = 'supported', evidenceIds = []) {
  return { label: title, title, copy, status, evidenceIds };
}
function desk(overrides = {}) {
  return {
    period: { label:'3–9 Aug 2026', start:'2026-08-03', end:'2026-08-09' },
    headline:'A controlled week with a strong finish',
    summary:'You finished the week stronger than you started.',
    wins:6, draws:1, losses:3, score:65,
    signals: {
      green: signal('Passed pawns converted well','You converted the supported passed-pawn chances.', 'supported', ['p1']),
      amber: signal('Watch the clock','Some clock evidence deserves attention.', 'supported', ['p2']),
      red: signal('Forcing replies cost games','Immediate forcing replies were the clearest supported cost.', 'supported', ['p2']),
      blue: signal('Scan forcing replies first','Check their forcing reply before your continuation.', 'supported', ['p2']),
    },
    candidates: [
      {id:'p1', gameUrl:'https://example.com/1', opponent:'A', playerColor:'white', result:'win', reason:'strength', reconstruction:'legal'},
      {id:'p2', gameUrl:'https://example.com/2', opponent:'B', playerColor:'black', result:'loss', reason:'correction', reconstruction:'legal'},
      {id:'p3', gameUrl:'https://example.com/3', opponent:'C', playerColor:'white', result:'draw', reason:'reviewed', reconstruction:'legal'},
    ],
    ...overrides,
  };
}
function episode(status='insufficient_evidence', overrides={}) {
  return {
    nextGameGuidance: {
      status,
      source: status === 'fallback_previous_review' ? 'previous_review' : status === 'available' ? 'current_week' : 'insufficient_current_evidence',
      title: status === 'insufficient_evidence' ? undefined : 'Check the forcing reply first.',
      copy: status === 'insufficient_evidence' ? undefined : 'Scan checks and captures before your follow-up.',
      gamesConsidered: 4,
      supportingFacts: [],
      previousReviewPeriod: status === 'fallback_previous_review' ? '27 Jul–2 Aug 2026' : undefined,
      ...overrides,
    },
  };
}

test('Quick Read: WHAT HAPPENED comes only from the latest completed Review', () => {
  const d = desk();
  const q = buildPlayerRoomQuickRead({latest:d});
  assert.deepEqual(q.happened, {headline:d.headline,copy:d.summary,periodLabel:d.period.label,wins:6,draws:1,losses:3,score:65});
});

test('Quick Read: KEEPS HAPPENING uses the first existing repeated pattern', () => {
  const patterns = [
    {family:'queen_safety',status:'repeated',appearances:2,desksCompared:3,message:'Queen-safety evidence repeated across compatible Reviews.'},
    {family:'loss_run',status:'repeated',appearances:2,desksCompared:3,message:'Later repeated pattern.'},
  ];
  const q = buildPlayerRoomQuickRead({latest:desk(), recurringPatterns:patterns});
  assert.equal(q.recurring.copy, patterns[0].message);
  assert.equal(q.recurring.confirmed, true);
});

test('Quick Read: no recurring pattern returns truthful neutral copy', () => {
  const q = buildPlayerRoomQuickRead({latest:desk(), recurringPatterns:[{family:'queen_safety',status:'not-repeated',appearances:1,desksCompared:2,message:'Not repeated.'}]});
  assert.equal(q.recurring.title, 'No repeating pattern is confirmed yet.');
  assert.match(q.recurring.copy, /compatible completed Reviews/);
});

test('Quick Read: WORKING uses supported Green', () => {
  const q = buildPlayerRoomQuickRead({latest:desk()});
  assert.equal(q.working.title, 'Passed pawns converted well');
  assert.equal(q.working.confirmed, true);
});

test('Quick Read: withheld Green is not presented as confirmed', () => {
  const d = desk();
  d.signals.green = signal('Withheld strength','Do not show as confirmed','withheld',['p1']);
  const q = buildPlayerRoomQuickRead({latest:d});
  assert.equal(q.working.confirmed, false);
  assert.notEqual(q.working.title, d.signals.green.title);
});

test('Quick Read: COSTING YOU prefers supported Red', () => {
  const q = buildPlayerRoomQuickRead({latest:desk()});
  assert.equal(q.costing.signal, 'red');
  assert.equal(q.costing.title, 'Forcing replies cost games');
});

test('Quick Read: COSTING YOU falls back to supported Amber', () => {
  const d = desk();
  d.signals.red = signal('Withheld Red','No','withheld',['p2']);
  const q = buildPlayerRoomQuickRead({latest:d});
  assert.equal(q.costing.signal, 'amber');
  assert.equal(q.costing.title, d.signals.amber.title);
});

test('Quick Read: no supported Red or Amber returns a neutral cost state', () => {
  const d = desk();
  d.signals.red = signal('R','No','withheld');
  d.signals.amber = signal('A','No','withheld');
  const q = buildPlayerRoomQuickRead({latest:d});
  assert.equal(q.costing.signal, 'none');
  assert.equal(q.costing.confirmed, false);
});

test('Quick Read: BEFORE NEXT GAME prefers current-week F.4 available guidance', () => {
  const q = buildPlayerRoomQuickRead({latest:desk(),currentEpisode:episode('available')});
  assert.equal(q.beforeNextGame.source, 'current_week');
  assert.equal(q.beforeNextGame.title, 'Check the forcing reply first.');
  assert.equal(q.beforeNextGame.sourceLabel, 'THIS WEEK · PROVISIONAL');
});

test('Quick Read: fallback_previous_review stays labelled as the previous Review', () => {
  const q = buildPlayerRoomQuickRead({latest:desk(),currentEpisode:episode('fallback_previous_review')});
  assert.equal(q.beforeNextGame.source, 'previous_review');
  assert.equal(q.beforeNextGame.sourceLabel, 'FROM YOUR LAST REVIEW · 27 Jul–2 Aug 2026');
});

test('Quick Read: unavailable current guidance falls back to supported latest Blue', () => {
  const q = buildPlayerRoomQuickRead({latest:desk(),currentEpisode:episode('insufficient_evidence')});
  assert.equal(q.beforeNextGame.source, 'latest_review');
  assert.equal(q.beforeNextGame.title, 'Scan forcing replies first');
  assert.equal(q.beforeNextGame.sourceLabel, 'FROM YOUR LAST REVIEW · 3–9 Aug 2026');
});

test('Quick Read: no current, Blue or pocket guidance does not fabricate advice', () => {
  const d = desk({pocketCard:undefined});
  d.signals.blue = signal('Hidden blue','No','withheld');
  const q = buildPlayerRoomQuickRead({latest:d,currentEpisode:episode('insufficient_evidence')});
  assert.equal(q.beforeNextGame.source, 'none');
  assert.equal(q.beforeNextGame.title, 'Nothing specific yet.');
});

test('Evidence: signal evidenceIds link to the correct candidates', () => {
  const grouped = groupReviewEvidence(desk());
  assert.deepEqual(grouped.linked.find((item)=>item.candidate.id==='p1').supports.map((s)=>s.signal), ['green']);
  assert.ok(grouped.linked.find((item)=>item.candidate.id==='p2').supports.some((s)=>s.signal==='red'));
});

test('Evidence: one candidate may support multiple signal labels', () => {
  const labels = evidenceSupportLabels(desk(), 'p2').map((item)=>item.label);
  assert.ok(labels.includes('COSTING YOU'));
  assert.ok(labels.includes('FOCUS NEXT'));
  assert.ok(labels.includes('KEEP AN EYE ON'));
});

test('Evidence: withheld signal does not label evidence as confirmed support', () => {
  const d = desk();
  d.signals.red = signal('Hidden red','No','withheld',['p2']);
  const supports = evidenceSupportLabels(d,'p2');
  assert.ok(!supports.some((item)=>item.signal==='red'));
});

test('Evidence: unlinked candidate remains available as other reviewed', () => {
  const grouped = groupReviewEvidence(desk());
  assert.deepEqual(grouped.otherReviewed.map((candidate)=>candidate.id), ['p3']);
});

test('Evidence: no candidate is silently lost', () => {
  const d = desk();
  const grouped = groupReviewEvidence(d);
  const ids = [...grouped.linked.map((item)=>item.candidate.id), ...grouped.otherReviewed.map((item)=>item.id)].sort();
  assert.deepEqual(ids, d.candidates.map((item)=>item.id).sort());
});

const root = path.resolve(__dirname, '..');
const quickReadSource = fs.readFileSync(path.join(root,'src/components/PlayerRoomQuickRead.tsx'),'utf8');
const room = fs.readFileSync(path.join(root,'src/components/BoardSignalPlayerRoom.tsx'),'utf8');
const universal = fs.readFileSync(path.join(root,'src/components/UniversalPlayerDesk.tsx'),'utf8');
const helper = fs.readFileSync(path.join(root,'src/lib/boardsignal/playerRoomPresentation.ts'),'utf8');
const css = fs.readFileSync(path.join(root,'src/app/boardsignal-player-room-g3.css'),'utf8');
const layout = fs.readFileSync(path.join(root,'src/app/layout.tsx'),'utf8');

test('Quick Read source: player-language layer contains no Green/Red/Amber/Blue signal terminology', () => {
  for (const forbidden of [
    'NO CONFIRMED GREEN SIGNAL',
    'NO CONFIRMED RED / AMBER SIGNAL',
    'GREEN SIGNAL',
    'RED SIGNAL',
    'AMBER SIGNAL',
    'BLUE SIGNAL',
  ]) {
    assert.ok(!quickReadSource.includes(forbidden), `Quick Read must not contain visible ${forbidden}`);
  }
  assert.match(quickReadSource, /NOT ENOUGH EVIDENCE YET/);
});

test('Structure: all six Player Room destinations remain directly defined', () => {
  for (const pair of [['desk','Review'],['progress','Progress'],['universe','Around BoardSignal'],['friends','Friends'],['inbox','Inbox'],['profile','Profile']]) {
    assert.match(room, new RegExp(`id: "${pair[0]}"[^\\n]+label: "${pair[1]}"`));
  }
});

test('Structure: internal tab IDs and Ask context remain unchanged', () => {
  assert.match(room, /type RoomTab = "desk" \| "progress" \| "universe" \| "friends" \| "inbox" \| "profile"/);
  assert.match(room, /boardsignal:context[\s\S]*activeTab: tab/);
  assert.match(room, /URLSearchParams\(window\.location\.search\)\.get\("tab"\)/);
  assert.match(room, /searchParams\.set\("tab", nextTab\)/);
});

test('Structure: Review History is no longer rendered in the primary Review flow', () => {
  const reviewBlock = room.slice(room.indexOf('id="player-room-panel-desk"'), room.indexOf('id="player-room-panel-progress"'));
  assert.doesNotMatch(reviewBlock, /ReviewHistorySection/);
});

test('Structure: full Review History remains accessible under Progress', () => {
  const progressFn = room.slice(room.indexOf('function ProgressSection'), room.indexOf('function ShareMomentsSection'));
  assert.match(progressFn, /<details className="g3-disclosure g3-review-history-disclosure">/);
  assert.match(progressFn, /<ReviewHistorySection history=\{history\} embedded \/>/);
});

test('Structure: F.4 derivation is not reproduced or changed by the presentation helper', () => {
  assert.doesNotMatch(helper, /deriveActiveWeekNextGameGuidance|MIN_DISTINCT_GAMES|MIN_WEEK_GAMES|ACTIONABILITY/);
  const protectedFile = fs.readFileSync(path.join(root,'src/lib/boardsignal/activeWeekGuidance.ts'));
  const sha = crypto.createHash('sha256').update(protectedFile).digest('hex');
  assert.equal(sha, '418c2c8433563ab2f6f45bbb82f5dc1c87c31c397b8bd5b519aa63f0d5750701');
});

test('Structure: G.3 stylesheet introduces no unscoped generic typography rule', () => {
  assert.doesNotMatch(css, /(^|\})\s*(h1|h2|h3|p|article|button)\s*\{/m);
  assert.match(css, /\.player-room-authenticated/);
});

test('Structure: G.3 stylesheet is after motion and F.2 remains last', () => {
  const order = ['globals.css','boardsignal-foundation.css','boardsignal-accessibility.css','boardsignal-motion.css','boardsignal-player-room-g3.css','boardsignal-f2-readability.css'].map((name)=>layout.indexOf(name));
  assert.ok(order.every((value)=>value>=0));
  assert.deepEqual([...order].sort((a,b)=>a-b), order);
  assert.ok(order[5] > order[4]);
});

test('Accessibility: tablist keyboard movement supports arrows plus Home and End', () => {
  assert.match(room, /ArrowRight/);
  assert.match(room, /ArrowLeft/);
  assert.match(room, /ArrowDown/);
  assert.match(room, /ArrowUp/);
  assert.match(room, /event\.key === \"Home\"/);
  assert.match(room, /event\.key === \"End\"/);
  assert.match(room, /requestAnimationFrame\(\(\) => document\.getElementById/);
});

test('Structure: embedded UniversalPlayerDesk cannot create a duplicate main id', () => {
  assert.doesNotMatch(universal, /id="main"/);
  assert.match(universal, /id=\{embedded \? undefined : "main"\}/);
  assert.match(room, /presentationMode="player-room" embedded/);
  const calls = [...room.matchAll(/<UniversalPlayerDesk[\s\S]*?\/>/g)].map((match)=>match[0]);
  assert.ok(calls.length >= 3);
  for (const call of calls) assert.match(call, /embedded/);
});
