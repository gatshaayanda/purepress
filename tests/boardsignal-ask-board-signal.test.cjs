const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const guide = require(path.join(root, '.test-dist-ask/src/lib/boardsignal/guide.js'));
const loader = require(path.join(root, '.test-dist-ask/src/lib/boardsignal/friendsLoader.js'));
const serverGuide = fs.readFileSync(path.join(root, 'src/lib/boardsignal/server/guide.ts'), 'utf8');
const guideRoute = fs.readFileSync(path.join(root, 'src/app/api/boardsignal/guide/route.ts'), 'utf8');
const widget = fs.readFileSync(path.join(root, 'src/components/AskBoardSignal.tsx'), 'utf8');
const profileControl = fs.readFileSync(path.join(root, 'src/components/GuidePreferenceControl.tsx'), 'utf8');
const playerRoom = fs.readFileSync(path.join(root, 'src/components/BoardSignalPlayerRoom.tsx'), 'utf8');
const playerFriends = fs.readFileSync(path.join(root, 'src/components/PlayerFriends.tsx'), 'utf8');
const offlineGuide = fs.readFileSync(path.join(root, 'src/lib/boardsignal/offline/guide.ts'), 'utf8');
const roomRoute = fs.readFileSync(path.join(root, 'src/app/api/boardsignal/player-room/route.ts'), 'utf8');
const comms = fs.readFileSync(path.join(root, 'src/lib/boardsignal/server/communications.ts'), 'utf8');
const social = fs.readFileSync(path.join(root, 'src/lib/boardsignal/server/social.ts'), 'utf8');
const universe = fs.readFileSync(path.join(root, 'src/lib/boardsignal/universe.ts'), 'utf8');
const pulse = fs.readFileSync(path.join(root, 'src/lib/boardsignal/pulse.ts'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');

function context(extra = {}) {
  return {
    authenticated: true,
    pathname: '/boardsignal/player-room',
    activeTab: 'desk',
    canonicalUsername: 'Ayandakopano',
    preferences: { ...guide.DEFAULT_GUIDE_PREFERENCES },
    tourState: 'completed',
    releaseHintDismissed: true,
    ...extra,
  };
}

// Locked Ask BoardSignal acceptance list.
test('1 guest cannot access private player context', () => {
  const response = guide.renderGuideResponse('what_changed', { authenticated:false, pathname:'/' });
  assert.match(response.reply, /only show personal changes after you sign in/i);
  assert.doesNotMatch(response.reply, /Signal|Desk 1|Ayandakopano/);
  assert.match(guideRoute, /action === "ask" \? await optionalToken\(request\)/);
  assert.match(widget, /continuityKey\(user\?\.uid\)/);
  assert.match(widget, /uid \|\| "guest"/);
});

test('2 authenticated context resolves the verified player instead of browser identity', () => {
  assert.match(serverGuide, /const account = await accountForToken\(token\)/);
  assert.match(serverGuide, /canonicalUsername: account\.chessCom\.canonicalUsername/);
});

test('3 browser cannot impersonate another BoardSignal user', () => {
  assert.match(guideRoute, /requirePlayerToken\(request\)/);
  assert.match(guideRoute, /guideResponse\(\{ token, message: body\.message, pathname: body\.pathname, activeTab: body\.activeTab, visibleEntityId: body\.visibleEntityId, recentConversation: body\.recentConversation \}\)/);
  assert.doesNotMatch(guideRoute, /guideResponse\([^\n]*(?:body\.userId|body\.uid|body\.playerId)/);
  assert.doesNotMatch(serverGuide, /input\.userId|input\.uid|input\.playerId/);
});

test('4 page context changes suggestions', () => {
  assert.notDeepEqual(guide.pageGuideSuggestions('/boardsignal/player-room','desk',true), guide.pageGuideSuggestions('/boardsignal/player-room','friends',true));
  assert.deepEqual(guide.pageGuideSuggestions('/boardsignal/player-room','inbox',true), ["What's unread?", 'Message Ayanda']);
  assert.equal(guide.detectGuideIntent('Get my BoardSignal', { pathname:'/', activeTab:undefined }), 'beta_next');
  assert.equal(guide.detectGuideIntent('Why am I here?', { pathname:'/feed', activeTab:'universe' }), 'universe_what');
  assert.equal(guide.detectGuideIntent('Where should I look first?', { pathname:'/boardsignal/player-room', activeTab:'desk' }), 'how_it_works');
  assert.deepEqual(guide.pageGuideSuggestions('/boardsignal/player-room','head-to-head',true), ['Who has the edge?', 'Where are we closest?', 'What changed recently?']);
  assert.equal(guide.detectGuideIntent('Explain this simply', { pathname:'/boardsignal/player-room', activeTab:'agreement' }), 'agreement');
});

test('5 What Changed uses factual saved Pulse only', () => {
  const response = guide.renderGuideResponse('what_changed', context({ pulseFacts:[{eyebrow:'SINCE YOU WERE AWAY',title:'6 games entered this episode.',body:'5W · 1L',facts:['Rapid moved +18.']}] }));
  assert.match(response.reply, /6 games entered this episode/i);
  assert.match(response.reply, /5W · 1L/);
  assert.match(response.reply, /Rapid moved \+18/);
});

test('6 no change produces no invented claim', () => {
  const response = guide.renderGuideResponse('what_changed', context({ pulseFacts:[] }));
  assert.match(response.reply, /won't manufacture movement/i);
  assert.doesNotMatch(response.reply, /moved \+|entered the Top|win run reached/i);
});

test('7 ranking explanation is supplied from deterministic Universe state', () => {
  const response = guide.renderGuideResponse('explain_rank', context({ standings:[{categoryTitle:'Winning Run',scopeLabel:'Rapid',rank:3,denominator:12,valueLabel:'5 straight'}] }));
  assert.match(response.reply, /#3 of 12 in Winning Run · Rapid/);
  assert.match(response.reply, /deterministic completed-Review field/);
  assert.match(universe, /rank|standing|category/i);
});

test('8 friend comparison is restricted to the already-safe Head-to-Head payload', () => {
  const response = guide.renderGuideResponse('compare_friend', context({ comparison:{left:{playerId:1,canonicalUsername:'Ayanda',desksAvailable:4},right:{playerId:2,canonicalUsername:'snoopyissocute',desksAvailable:4},recentFourLabel:'RECENT FOUR-DESK VIEW',comparablePools:['rapid'],metrics:[{key:'score',label:'RECENT FORM',leftValue:'67.6%',rightValue:'61.2%'}],universe:[],gameLinksEnabled:{left:false,right:false},privateFieldsExcluded:true} }));
  assert.match(response.reply, /67\.6% vs snoopyissocute 61\.2%/i);
  assert.doesNotMatch(response.reply, /Red|Amber|Blue|evidence/);
});

test('9 private Signal data from another player cannot enter Guide comparison context', () => {
  assert.match(serverGuide, /headToHead\(account, friend\.playerId\)/);
  assert.match(serverGuide, /item\.playerId === visibleEntityId/);
  assert.doesNotMatch(serverGuide, /friend.*(?:red|amber|blue|evidence)/i);
  assert.match(social, /privateFieldsExcluded|Head-to-Head/i);
});

test('10 random-position questions never trigger new chess engine analysis', () => {
  const intent = guide.detectGuideIntent('What is the best move in this random position?', {pathname:'/boardsignal/player-room',activeTab:'desk'});
  assert.equal(intent, 'random_position');
  const response = guide.renderGuideResponse(intent, context());
  assert.match(response.reply, /don't create new chess analysis/i);
  assert.doesNotMatch(serverGuide, /Stockfish|analy[sz]ePosition|processor/i);
});

test('11 explicit tone preference persists privately', () => {
  assert.match(serverGuide, /input\.confirmed !== true/);
  assert.match(serverGuide, /collection\("guide"\)\.doc\("profile"\)\.set/);
  assert.match(profileControl, /preferredTone/);
});

test('12 tone suggestion/change requires player confirmation', () => {
  const response = guide.renderGuideResponse('tone', context());
  assert.ok(response.actions.every((action) => action.kind !== 'preference' || action.requiresConfirmation === true));
  assert.match(widget, /window\.confirm\(`Confirm Ask BoardSignal preference/);
});

test('13 Founder Relationship Pulse stays descriptive and supported', () => {
  assert.match(serverGuide, /relationshipPulse/);
  assert.match(serverGuide, /oftenAsksAbout|preferredCommunication|openSupportIssue|lastGuideTopic/);
  assert.match(serverGuide, /recentSentimentAt/);
  assert.match(serverGuide, /openAskThreads/);
  assert.doesNotMatch(serverGuide, /scarcity|susceptib|manipulat/i);
});

test('14 no psychological diagnosis fields exist in Guide profile', () => {
  const forbidden = guide.forbiddenGuideProfileFields();
  assert.ok(forbidden.includes('mentalHealthDiagnosis'));
  for (const key of forbidden) {
    assert.equal(Object.prototype.hasOwnProperty.call(guide.DEFAULT_GUIDE_PREFERENCES, key), false);
  }
  assert.doesNotMatch(serverGuide, /depressed\s*:|anxious\s*:|manipulationScore\s*:/);
});

test('15 human handoff writes to the existing private conversation', () => {
  assert.match(serverGuide, /collection\("conversations"\)/);
  assert.match(serverGuide, /collection\("messages"\)/);
  assert.match(serverGuide, /unreadForFounder:\s*true/);
  assert.match(comms, /collection\("conversations"\)/);
});

test('16 support handoff context excludes secrets/private evidence', () => {
  const section = serverGuide.slice(serverGuide.indexOf('export async function createGuideHandoff'), serverGuide.indexOf('export async function founderGuideSummary'));
  assert.match(section, /Player:|Page:|Latest completed Review:|Current episode:|Category:/);
  assert.doesNotMatch(section, /accessCode|preferredContactValue|Authorization|evidence|privateKey|vapid/i);
});

test('17 guest onboarding questions work deterministically', () => {
  const guest = { authenticated:false, pathname:'/join' };
  assert.match(guide.renderGuideResponse('beta_next', guest).reply, /Ayanda reviews it/i);
  assert.match(guide.renderGuideResponse('username_reason', guest).reply, /stable Chess\.com player ID/i);
  assert.match(guide.renderGuideResponse('privacy', guest).reply, /stay private/i);
});

test('18 feature-tour dismissal persists and requires explicit state action', () => {
  assert.match(serverGuide, /\["completed", "dismissed"\]\.includes\(String\(input\.tourState\)\)/);
  assert.match(serverGuide, /collection\("guide"\)\.doc\("state"\)\.set/);
  assert.match(widget, /tourState = action\.id === "tour-start" \? "completed" : "dismissed"/);
});

test('19 Friends release hint is remembered and not repeatedly shown', () => {
  assert.match(serverGuide, /GUIDE_RELEASE_HINT = "friends-rivals-2026-08-12"/);
  assert.match(serverGuide, /releaseHintDismissed/);
  assert.match(widget, /releaseHint: "dismiss"/);
});

test('20 Guide memory stays bounded instead of storing an endless transcript', () => {
  const memory = guide.boundedGuideMemory({recentTopics:['a','b','c','d','e','f'],productSignals:['1','2','3','4','5','6','7','8']}, 'new', '9');
  assert.equal(memory.recentTopics.length, 6);
  assert.equal(memory.productSignals.length, 8);
  assert.match(widget, /slice\(-12\)/);
  assert.match(widget, /14 \* 24 \* 60 \* 60 \* 1000/);
});

test('21 account-changing actions require explicit confirmation', () => {
  assert.match(serverGuide, /Message Ayanda requires explicit confirmation/);
  assert.match(serverGuide, /Guide preference changes require explicit confirmation/);
  assert.match(serverGuide, /This guide action requires explicit confirmation/);
  assert.match(widget, /window\.confirm/);
});

test('22 existing Inbox remains the Guide handoff and unread source', () => {
  assert.match(serverGuide, /listPlayerInbox/);
  assert.match(widget, /Open Inbox/);
  assert.match(playerRoom, /<PlayerInbox/);
});

test('23 Friends and Rivals remain functional underneath Ask BoardSignal', () => {
  assert.match(playerRoom, /<PlayerFriends/);
  assert.match(social, /export async function headToHead/);
  assert.match(playerFriends, /HEAD TO HEAD/);
});

test('24 Universe Pulse remains the factual What Changed source', () => {
  assert.match(roomRoute, /recordGuidePlayerRoomSnapshot/);
  assert.match(serverGuide, /capture\.pulse\?\.sinceAway|capture\.pulse\?\.boardMoved/);
  assert.match(pulse, /PlayerPulse|sinceAway|boardMoved/);
});

test('25 full global contrast invariant gate passes', () => {
  cp.execFileSync(process.execPath, [path.join(root,'scripts/check-boardsignal-contrast.mjs')], { cwd:root, stdio:'pipe' });
});

test('26 Ask panel, chips and input inherit readable semantic contrast', () => {
  assert.match(widget, /ask-bs-panel bs-surface-paper/);
  assert.match(widget, /ask-bs-header bs-surface-dark/);
  assert.match(css, /\.ask-bs-panel[\s\S]*color:\s*var\(--bs-text-primary\)/);
  assert.match(css, /\.ask-bs-suggestions button[\s\S]*color:\s*var\(--bs-text-primary\)/);
  assert.match(css, /\.ask-bs-composer input[\s\S]*color:\s*var\(--bs-text-primary\)/);
});

test('27 mobile launcher/panel avoid the Player Room bottom navigation zone', () => {
  assert.match(css, /\.ask-bs \{ right: max\(12px, env\(safe-area-inset-right\)\); bottom: max\(84px/);
  assert.match(css, /\.ask-bs-panel \{ position: fixed; inset: max\(8px, env\(safe-area-inset-top\)\) 8px max\(74px/);
  assert.match(css, /\.ask-bs-feedback button \{ min-height: 44px/);
  assert.match(css, /\.ask-bs-suggestions button \{[^}]*min-height: 44px/);
});

test('28 Guide failure is isolated from Player Room', () => {
  assert.match(roomRoute, /recordGuidePlayerRoomSnapshot[\s\S]*\.catch\(\(\) => undefined\)/);
  assert.match(widget, /Ask BoardSignal isn't available right now/);
  assert.match(widget, /Open Inbox/);
});

// Critical Friends runtime hotfix acceptance.
test('29 PlayerFriends initial fetch is keyed to token, not parent onChanged identity', () => {
  assert.equal(loader.shouldRunInitialFriendsLoad(undefined, 'token-a'), true);
  assert.equal(loader.shouldRunInitialFriendsLoad('token-a', 'token-a'), false);
  assert.match(playerFriends, /const onChangedRef = useRef\(onChanged\)/);
  assert.match(playerFriends, /const load = useCallback\([\s\S]*?\}, \[token\]\);/);
  assert.doesNotMatch(playerFriends, /\}, \[onChanged, token\]\)/);
});

test('30 parent social state update cannot recreate the Friends initial-load dependency loop', () => {
  assert.match(playerRoom, /const handleFriendsChanged = useCallback\([\s\S]*?\}, \[\]\);/);
  assert.match(playerRoom, /onChanged=\{handleFriendsChanged\}/);
  assert.doesNotMatch(playerRoom, /<PlayerFriends[\s\S]*onChanged=\{\(overview\) =>/);
  assert.match(playerFriends, /onChangedRef\.current\?\.\(overviewBody\.overview\)/);
});

test('31 zero-friend state exits loading and exposes discovery UI', () => {
  assert.match(playerFriends, /\.finally\(\(\) => \{ if \(!controller\.signal\.aborted\) setLoading\(false\); \}\)/);
  assert.match(playerFriends, /Your board gets better with people you know\./);
  assert.match(playerFriends, /ACTIVE PLAYERS TO DISCOVER/);
  assert.match(playerFriends, /Search BoardSignal players/);
});

test('32 Friends loader aborts, times out and renders a failure state instead of spinning forever', () => {
  assert.match(playerFriends, /new AbortController\(\)/);
  assert.match(playerFriends, /12000/);
  assert.match(playerFriends, /controller\.abort\("unmounted"\)/);
  assert.match(playerFriends, /BoardSignal connections took too long to respond/);
  assert.match(playerFriends, /role="alert"/);
  assert.match(playerFriends, />Try again</);
});

test('33 Friends discovery/search/request/accepted compare surfaces remain available', () => {
  assert.match(playerFriends, /view=suggested/);
  assert.match(playerFriends, /view=search/);
  assert.match(playerFriends, /Add Friend/);
  assert.match(playerFriends, /REQUEST RECEIVED/);
  assert.match(playerFriends, /REQUEST SENT/);
  assert.match(playerFriends, /> Compare</);
  assert.match(playerFriends, /RIVAL WATCH/);
});

test('34 full merged Firestore rules keep Guide private and server-controlled', () => {
  assert.match(rules, /match \/guide\/\{guideId\}[\s\S]*allow read: if isOwner\(userId\);[\s\S]*allow write: if false;/);
  assert.match(rules, /match \/guideFeedback\/\{feedbackId\}[\s\S]*allow read: if isOwner\(userId\);[\s\S]*allow write: if false;/);
  assert.match(rules, /match \/guideAnalytics\/\{period\}[\s\S]*allow read, write: if false;/);
});

test('35 Ask BoardSignal is mounted globally but legacy Sparkle fake-bot is not wired in', () => {
  assert.match(layout, /<AskBoardSignal\s*\/>/);
  assert.doesNotMatch(layout, /<ChatWidget\s*\/>/);
  assert.doesNotMatch(serverGuide, /fake-bot|OpenAI|Anthropic|LLM/i);
});

// Conversational Continuity + Source Awareness hardening.
test('36 Whats New uses an explicit product announcement', () => {
  assert.equal(guide.isGuideWhatsNewMessage({ senderType:'founder', type:'beta_update' }), true);
  const response = guide.renderGuideResponse('whats_new', context({ latestAnnouncement:{ id:'release-1', title:'Friends & Rivals are here', body:'Compare recent Desks.', createdAt:'2026-08-12T12:00:00Z' } }));
  assert.match(response.reply, /Friends & Rivals are here/);
  assert.equal(response.provenance.kind, 'founder_announcement');
  assert.equal(response.provenance.id, 'release-1');
});

test('37 custom support/test message cannot masquerade as Whats New', () => {
  assert.equal(guide.isGuideWhatsNewMessage({ senderType:'founder', type:'custom' }), false);
  assert.match(serverGuide, /isGuideWhatsNewMessage\(item\)/);
  assert.doesNotMatch(serverGuide.slice(serverGuide.indexOf('function latestAnnouncement'), serverGuide.indexOf('async function buildAuthenticatedContext')), /type === "custom"/);
});

test('38 Why did you say that resolves the previous Guide response', () => {
  const recentConversation = [{ role:'guide', body:'Your Board moved into the Top 3.', intent:'what_changed', provenance:{ kind:'pulse', title:'Latest BoardSignal Pulse' } }];
  const brain = guide.runGuideBrain('Why did you say that?', context({ recentConversation }));
  const response = guide.deterministicGuideRenderer.render(brain);
  assert.equal(brain.intent, 'followup_why');
  assert.match(response.reply, /latest BoardSignal Pulse/i);
});

test('39 quoted phrase resolves the matching earlier Guide response', () => {
  const recentConversation = [
    { role:'guide', body:'Your saved Desk is ready.', intent:'explain_desk', provenance:{ kind:'desk', title:'3–9 Aug' } },
    { role:'player', body:'Okay.' },
    { role:'guide', body:'Phonkkrum is one place ahead.', intent:'in_reach', provenance:{ kind:'universe', title:'Winning Run' } },
  ];
  const target = guide.resolveGuideConversationTurn('Where did "saved Desk" come from?', recentConversation);
  assert.match(target.body, /saved Desk/);
  assert.equal(target.provenance.kind, 'desk');
});

test('40 What did you mean explains the immediately previous response', () => {
  const recentConversation = [{ role:'guide', body:'One place separates you.', intent:'in_reach', provenance:{ kind:'universe', title:'Winning Run' } }];
  const response = guide.deterministicGuideRenderer.render(guide.runGuideBrain('What did you mean?', context({ recentConversation })));
  assert.match(response.reply, /One place separates you/);
  assert.match(response.reply, /Universe/i);
});

test('41 Where did that come from returns source provenance', () => {
  const recentConversation = [{ role:'guide', body:'Six games entered this episode.', intent:'what_changed', provenance:{ kind:'pulse', timestamp:'2026-08-12T13:32:00Z' } }];
  const response = guide.deterministicGuideRenderer.render(guide.runGuideBrain('Where did that come from?', context({ recentConversation })));
  assert.equal(response.intent, 'followup_source');
  assert.equal(response.provenance.kind, 'pulse');
  assert.match(response.reply, /latest BoardSignal Pulse/i);
});

test('42 Desk answers carry Desk provenance', () => {
  const response = guide.renderGuideResponse('explain_desk', context({ latestDesk:{ periodLabel:'3–9 Aug', headline:'A strong finish.', summary:'You closed 6W from 8.', games:20,wins:12,draws:2,losses:6,score:65,primaryPool:'rapid' } }));
  assert.equal(response.provenance.kind, 'desk');
  assert.equal(response.provenance.title, '3–9 Aug');
});

test('43 Pulse answers carry Pulse provenance', () => {
  const response = guide.renderGuideResponse('what_changed', context({ pulseFacts:[{eyebrow:'SINCE',title:'6 games entered.',body:'5W · 1L'}], contextUpdatedAt:'2026-08-12T13:32:00Z' }));
  assert.equal(response.provenance.kind, 'pulse');
  assert.equal(response.provenance.timestamp, '2026-08-12T13:32:00Z');
});

test('44 Universe answers carry Universe provenance', () => {
  const response = guide.renderGuideResponse('explain_rank', context({ standings:[{categoryTitle:'Winning Run',rank:3,denominator:10,valueLabel:'5 straight'}] }));
  assert.equal(response.provenance.kind, 'universe');
  assert.equal(response.provenance.title, 'Winning Run');
});

test('45 Friends answers carry relationship-safe provenance', () => {
  const response = guide.renderGuideResponse('friends', context({ friends:[{playerId:2,canonicalUsername:'snoopyissocute'}] }));
  assert.equal(response.provenance.kind, 'friends');
  assert.match(response.reply, /public-safe sporting results/i);
  assert.doesNotMatch(response.reply, /privateFields|engine correction|recurrence:/i);
});

test('46 announcement answers carry Founder announcement provenance', () => {
  const response = guide.renderGuideResponse('whats_new', context({ latestAnnouncement:{ id:'beta-22', title:'BoardSignal PWA', body:'Offline continuity is live.', createdAt:'2026-08-12T15:00:00Z' } }));
  assert.deepEqual(response.provenance, { kind:'founder_announcement', id:'beta-22', title:'BoardSignal PWA', timestamp:'2026-08-12T15:00:00Z' });
});

test('47 offline snapshot provenance explains freshness boundary', () => {
  const recentConversation = [{ role:'guide', body:'Your saved Pulse says you moved.', intent:'what_changed', provenance:{ kind:'offline_snapshot', timestamp:'12 Aug, 13:32' } }];
  const response = guide.deterministicGuideRenderer.render(guide.runGuideBrain('How do you know that?', context({ recentConversation })));
  assert.match(response.reply, /snapshot saved on this device/i);
  assert.match(response.reply, /can't check whether anything newer happened/i);
  assert.match(offlineGuide, /recentConversation/);
});

test('48 conversation reference survives page navigation', () => {
  const recentConversation = [{ role:'guide', body:'By closest, I mean the player immediately ahead in that category.', intent:'in_reach', provenance:{ kind:'universe', title:'Rating Recovery' } }];
  const response = guide.deterministicGuideRenderer.render(guide.runGuideBrain('What did you mean by that?', { ...context({ recentConversation }), pathname:'/boardsignal/player-room', activeTab:'friends' }));
  assert.match(response.reply, /player immediately ahead/i);
  assert.equal(response.provenance.kind, 'universe');
});

test('49 continuity remains scoped by Firebase UID', () => {
  assert.match(widget, /continuityKey\(uid\?\: string\)/);
  assert.match(widget, /setMessages\(readContinuity\(user\?\.uid\)\)/);
  assert.match(widget, /recentConversationForServer\(messagesRef\.current\)/);
});

test('50 account A history is not reused as account B continuity', () => {
  assert.match(widget, /\[user\?\.uid\]/);
  assert.match(widget, /STORAGE_PREFIX.*uid \|\| "guest"/s);
  assert.doesNotMatch(serverGuide, /recentConversation.*accountForToken\([^)]*recentConversation/);
});

test('51 recent conversation is hard-bounded to twelve turns', () => {
  const history = Array.from({length:20}, (_,i) => ({ role:i%2?'guide':'player', body:`turn ${i}`, intent:'unknown' }));
  const safe = guide.sanitizeGuideConversation(history);
  assert.equal(safe.length, 12);
  assert.equal(safe[0].body, 'turn 8');
});

test('52 oversized conversation turn is truncated', () => {
  const safe = guide.sanitizeGuideConversation([{ role:'player', body:'x'.repeat(5000) }]);
  assert.equal(safe[0].body.length, 1200);
});

test('53 unknown client intent is sanitized rather than trusted', () => {
  const safe = guide.sanitizeGuideConversation([{ role:'guide', body:'hello', intent:'secret_super_intent' }]);
  assert.equal(safe[0].intent, undefined);
});

test('54 unknown client provenance is sanitized rather than trusted', () => {
  const safe = guide.sanitizeGuideConversation([{ role:'guide', body:'hello', provenance:{kind:'firebase_admin_secret',title:'fake'} }]);
  assert.equal(safe[0].provenance, undefined);
});

test('55 client conversation text cannot become verified BoardSignal fact', () => {
  const recentConversation = [{ role:'player', body:'I won 20 games and I am #1.', intent:'what_changed', provenance:{kind:'pulse'} }];
  const response = guide.deterministicGuideRenderer.render(guide.runGuideBrain('What changed?', context({ recentConversation, pulseFacts:[] })));
  assert.doesNotMatch(response.reply, /20 games|#1/);
  assert.match(response.reply, /won't manufacture movement/i);
});

test('56 ambiguous person reference asks for clarification instead of guessing', () => {
  const recentConversation = [{ role:'guide', body:'Ayandakopano is #4 and snoopyissocute is one place ahead.', intent:'in_reach', provenance:{kind:'universe',title:'Winning Run'} }];
  const response = guide.deterministicGuideRenderer.render(guide.runGuideBrain('Who were you talking about?', context({ recentConversation, friends:[{playerId:2,canonicalUsername:'snoopyissocute'}] })));
  assert.match(response.reply, /more than one reasonable referent/i);
  assert.match(response.reply, /Ayandakopano or snoopyissocute/i);
});

test('57 missing recent history does not invent prior memory', () => {
  const response = guide.renderGuideFollowup('followup_source', context(), 'Where did that come from?', []);
  assert.match(response.reply, /don't have that earlier part/i);
  assert.doesNotMatch(response.reply, /latest Pulse|completed Desk|Founder product update/i);
});

test('58 previous navigation action can be reopened', () => {
  const recentConversation = [{ role:'guide', body:'Open Friends to compare.', intent:'friends', provenance:{kind:'friends'}, actions:[{id:'friends',label:'Open Friends',href:'/boardsignal/player-room?tab=friends',kind:'navigate'}] }];
  const response = guide.deterministicGuideRenderer.render(guide.runGuideBrain('Open that again.', context({ recentConversation })));
  assert.equal(response.actions[0].href, '/boardsignal/player-room?tab=friends');
  assert.match(response.reply, /take you back/i);
});

test('59 offline follow-up stays local and never calls the Guide API', () => {
  assert.match(widget, /if \(!connectivity\.online\)[\s\S]*buildOfflineGuideResponse/);
  assert.match(offlineGuide, /renderGuideFollowup/);
  assert.doesNotMatch(offlineGuide, /fetch\(|\/api\/boardsignal\/guide/);
});

test('60 random chess analysis remains refused with conversation history present', () => {
  const recentConversation = [{ role:'guide', body:'Your Desk is saved.', intent:'explain_desk', provenance:{kind:'desk'} }];
  const brain = guide.runGuideBrain('What is the best move in this random position?', context({ recentConversation }));
  assert.equal(brain.intent, 'random_position');
  assert.match(guide.deterministicGuideRenderer.render(brain).reply, /don't create new chess analysis/i);
});

test('61 psychological-profile prohibitions remain intact', () => {
  assert.ok(guide.forbiddenGuideProfileFields().includes('psychologicalSusceptibility'));
  assert.doesNotMatch(serverGuide, /manipulationScore\s*:|psychologicalSusceptibility\s*:/);
});

test('62 Message Ayanda handoff remains the existing private conversation path', () => {
  assert.match(serverGuide, /export async function createGuideHandoff/);
  assert.match(widget, /authenticatedAction\("handoff"/);
  assert.match(serverGuide, /source: "ask_boardsignal"/);
});

test('63 PWA offline Ask receives the same bounded continuity metadata', () => {
  assert.match(widget, /buildOfflineGuideResponse\(\{[^}]*recentConversation: recentConversationForServer\(messagesRef\.current\)/s);
  assert.match(offlineGuide, /sanitizeGuideConversation\(recentConversation\)/);
  assert.match(offlineGuide, /provenance.*offline_snapshot/s);
});

test('64 contrast invariant remains a release gate', () => {
  cp.execFileSync(process.execPath, [path.join(root,'scripts/check-boardsignal-contrast.mjs')], { cwd:root, stdio:'pipe' });
});

test('65 Friends loading-loop hotfix remains structurally intact', () => {
  assert.match(playerFriends, /const onChangedRef = useRef\(onChanged\)/);
  assert.match(playerFriends, /const loadedTokenRef = useRef<string \| undefined>\(undefined\)/);
  assert.match(playerFriends, /\}, \[token\]\);/);
  assert.doesNotMatch(playerFriends, /\[onChanged, token\]/);
});
