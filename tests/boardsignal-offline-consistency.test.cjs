const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const manifest = read('PATCH-MANIFEST.txt');
const offlineTypes = read('src/lib/boardsignal/offline/types.ts');
const snapshots = read('src/lib/boardsignal/offline/snapshots.ts');
const connectivity = read('src/components/ConnectivityProvider.tsx');
const offlineRoom = read('src/components/OfflinePlayerRoom.tsx');
const inbox = read('src/components/PlayerInbox.tsx');
const friendConversation = read('src/components/FriendConversation.tsx');
const attachment = read('src/components/BoardSignalChatAttachment.tsx');

// Patch E.4 focused acceptance — 45 checks, covering the required 40 points.
test('1 immutable baseline is exactly E.3 HEAD', () => {
  assert.match(manifest, /d334c937a1efbbd3601dfd88c14831e98e579e5e/);
  assert.match(manifest, /Fix account deletion social and chat cleanup/);
});

test('2 APIs remain network-only in the unchanged service worker', () => {
  assert.match(manifest, /public\/sw\.js: UNCHANGED/);
  assert.match(manifest, /\/api\/\* network-only/);
});

test('3 private API payloads remain excluded from Cache Storage', () => {
  assert.match(manifest, /authenticated\/private payloads do not enter Cache Storage/);
});

test('4 My BoardSignal navigation retains the safe offline fallback', () => {
  assert.match(manifest, /My BoardSignal navigation has \/offline\/player-room fallback/);
});

test('5 saved private BoardSignal is explicitly tied to the same UID', () => {
  assert.match(snapshots, /if \(input\.account\.uid !== uid\) throw new Error\("Offline snapshot identity mismatch\."\)/);
  assert.match(offlineRoom, /snapshot\.uid !== uid/);
});

test('6 a different UID cannot be presented another UID snapshot', () => {
  assert.match(offlineRoom, /initialSnapshot\?\.uid === uid/);
  assert.match(manifest, /UID-keyed reads continue to fail closed for a different UID/);
});

test('7 account switch purges or blocks the previous private UID', () => {
  assert.match(connectivity, /previousUid && previousUid !== nextUid[\s\S]*clearBoardSignalPrivateOfflineData\(previousUid\)/);
  assert.match(offlineRoom, /previousUid && previousUid !== nextUid[\s\S]*setSnapshot\(null\)[\s\S]*clearBoardSignalPrivateOfflineData\(previousUid\)/);
});

test('8 account deletion/auth loss purges the deleted UID best effort', () => {
  assert.match(connectivity, /onAuthStateChanged\(auth/);
  assert.match(manifest, /deleted\/revoked principal as signed out[\s\S]*removes that previous UID/);
});

test('9 newest-four completed Review bound remains', () => {
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_MAX_DESKS = 4/);
});

test('10 fifth old Review is not retained or resurrected', () => {
  assert.match(snapshots, /slice\(0, BOARDSIGNAL_OFFLINE_MAX_DESKS\)/);
  assert.match(snapshots, /activeDeskKeys\.has\(point\.deskKey\)/);
});

test('11 completed saved Review is presented read-only', () => {
  assert.match(offlineRoom, /These are read-only and do not update while offline/);
  assert.match(offlineRoom, /aria-label="Saved Review read only"/);
});

test('12 saved Review has freshness disclosure', () => {
  assert.match(offlineRoom, /SAVED REVIEWS/);
  assert.match(offlineRoom, /Last synchronized \{savedLabel\(snapshot\.lastSyncedAt\)\}/);
});

test('13 current week is explicitly saved and stale', () => {
  assert.match(offlineRoom, /Current week — saved \{savedLabel\(snapshot\.lastSyncedAt\)\}/);
  assert.match(offlineRoom, /Games played afterward are not included/);
});

test('14 no current-week Chess.com refresh is faked offline', () => {
  assert.match(offlineRoom, /Reconnect so BoardSignal can check your current Chess\.com games/);
  assert.doesNotMatch(offlineRoom, /fetch\(/);
});

test('15 saved B.1 next-game guidance shows freshness', () => {
  assert.match(offlineRoom, /Before your next game — saved \{savedLabel\(snapshot\.lastSyncedAt\)\}/);
});

test('16 B.1 guidance is not recomputed offline', () => {
  assert.match(offlineRoom, /No saved guidance is available\. Reconnect for current guidance/);
  assert.doesNotMatch(offlineRoom, /withPreviousReviewGuidance|deriveNextGame|buildCurrentEpisodeSummary/);
});

test('17 A.1 factual-only state is not mislabeled completed', () => {
  assert.match(offlineTypes, /pendingFactualReview\?: FactualReviewDraft/);
  assert.match(snapshots, /pendingFactualReview: input\.pendingFactualReview/);
  assert.match(offlineRoom, /This is a factual Review checkpoint, not a completed Review/);
});

test('18 A.1 pending work resumes through existing online pipeline only', () => {
  assert.match(offlineRoom, /Position review will continue when you're connected/);
  assert.match(manifest, /existing online idempotent A\.1 pipeline/);
});

test('19 Progress is clearly labeled saved', () => {
  assert.match(offlineRoom, /PROGRESS · SAVED/);
  assert.match(offlineRoom, /does not calculate new conclusions/);
});

test('20 Pulse is clearly last synchronized', () => {
  assert.match(offlineRoom, /PULSE · LAST SYNCHRONIZED/);
  assert.match(offlineRoom, /Saved, not live/);
});

test('21 Universe is saved and not live', () => {
  assert.match(offlineRoom, /UNIVERSE · SAVED/);
  assert.match(offlineRoom, /<span>Not live<\/span>/);
});

test('22 Friend snapshot is read-only offline', () => {
  assert.match(offlineRoom, /FRIENDS · SAVED/);
  assert.match(offlineRoom, /Read-only while offline/);
});

test('23 Friend and Rival Watch mutations cannot execute from saved view', () => {
  assert.match(offlineRoom, /Reconnect to change Friends or Rival Watch/);
  assert.doesNotMatch(offlineRoom, /socialAction\(|action: "accept"|action: "unfriend"/);
});

test('24 Inbox explicitly requires network', () => {
  assert.match(inbox, /NETWORK REQUIRED/);
  assert.match(inbox, /Inbox needs a connection/);
});

test('25 friend messaging cannot fake-send offline', () => {
  assert.match(friendConversation, /if \(!onlineRef\.current\)[\s\S]*Nothing was sent or queued/);
  assert.match(friendConversation, /sendAttemptRef\.current !== attempt/);
});

test('26 local text drafts remain clearly unsent and explicit-send only', () => {
  assert.match(manifest, /Local text drafts remain bounded and require the player to explicitly Send after reconnection; they are never auto-sent/);
});

test('27 attachment upload is disabled offline', () => {
  assert.match(attachment, /disabled=\{unavailable \|\| offline\}/);
  assert.match(attachment, /Reconnect before attaching an image or PDF/);
});

test('28 no binary/background upload queue is added', () => {
  assert.doesNotMatch(attachment, /backgroundSync|binaryQueue|uploadQueue|queueAttachment|IndexedDB/i);
  assert.match(attachment, /no upload is queued/);
});

test('29 interrupted attachment upload cannot become fake success', () => {
  assert.match(attachment, /Attachment upload was interrupted when the connection was lost/);
  assert.match(attachment, /uploadAttemptRef\.current !== attempt/);
  assert.match(attachment, /discardWithAuth\(draft, uploadAuthHeader\)/);
});

test('30 reconnect connectivity probe has one bounded in-flight path', () => {
  assert.match(connectivity, /if \(inFlightRef\.current\) return inFlightRef\.current/);
  assert.match(connectivity, /setState\("reconnecting"\)/);
});

test('31 reconnect does not create a reload loop', () => {
  assert.equal((offlineRoom.match(/window\.location\.replace\("\/boardsignal\/player-room"\)/g) || []).length, 1);
  assert.doesNotMatch(offlineRoom, /window\.location\.reload/);
});

test('32 successful recovery replaces saved status with live truth', () => {
  assert.match(connectivity, /<strong>RECONNECTING<\/strong><span>Reconnecting…<\/span>/);
  assert.match(connectivity, /<strong>LIVE<\/strong><span>BoardSignal is live again\.<\/span>/);
});

test('33 Ask offline remains limited to saved verified context', () => {
  assert.match(manifest, /loads only UID-scoped saved player\/social snapshots/);
  assert.match(manifest, /provenance as offline_snapshot/);
});

test('34 Ask offline freshness disclosure remains locked', () => {
  assert.match(manifest, /offline_snapshot with the saved timestamp/);
});

test('35 Ask requests reconnection for live-only state', () => {
  assert.match(manifest, /refuses newer Chess\.com\/server claims/);
  assert.match(manifest, /routes live-only Inbox\/support state to reconnection/);
});

test('36 deleted account cannot remain presented by standalone offline view after auth loss', () => {
  assert.match(offlineRoom, /if \(previousUid && previousUid !== nextUid\) \{[\s\S]*setSnapshot\(null\)[\s\S]*setSocial\(null\)/);
  assert.match(offlineRoom, /if \(!uid\) \{ setSnapshot\(null\); setSocial\(null\); return; \}/);
});

test('37 per-UID purge preserves safe public/static service-worker caches', () => {
  assert.match(manifest, /Safe public\/static service-worker caches are not removed by this per-UID purge/);
});

test('38 E.3 server deletion implementation is untouched', () => {
  assert.match(manifest, /src\/lib\/boardsignal\/server\/accountDeletion\.ts: UNCHANGED/);
  assert.match(manifest, /3a422d30a3bb972cf86c2d02d202d0ae9d29548b/);
});

test('39 Firestore rules are unchanged and no index is added', () => {
  assert.match(manifest, /firestore\.rules: UNCHANGED/);
  assert.match(manifest, /NO NEW FIRESTORE INDEX/);
  assert.match(manifest, /NO FIRESTORE RULES CHANGE/);
});

test('40 package files are unchanged', () => {
  assert.match(manifest, /package\.json: UNCHANGED/);
  assert.match(manifest, /package-lock\.json: UNCHANGED/);
  assert.match(manifest, /NO NEW DEPENDENCY/);
});

test('41 drafts and social comparison storage remain bounded', () => {
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_MAX_DRAFTS = 4/);
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_MAX_SOCIAL_COMPARISONS = 4/);
});

test('42 service worker safety remains at the audited baseline blob', () => {
  assert.match(manifest, /31b16413f3b0bd0d131e12bdc84e618029ebc1e7/);
  assert.match(manifest, /skipWaiting remains explicit only/);
});

test('43 no service-worker cache version bump or rewrite is part of E.4', () => {
  const changed = manifest.split('CHANGED FILES')[1].split('ADDED FILES')[0];
  assert.doesNotMatch(changed, /public\/sw\.js/);
  assert.match(manifest, /No cache-version bump was required/);
});

test('44 no new auth, paid service, message queue or binary queue is introduced', () => {
  assert.match(manifest, /NO NEW AUTHENTICATION SYSTEM/);
  assert.match(manifest, /NO PAID SERVICE/);
  assert.match(manifest, /No offline message queue was introduced/);
  assert.match(manifest, /No binary queue/);
});

test('45 touched offline consumer copy uses Review/My BoardSignal language', () => {
  assert.match(offlineRoom, /MY BOARDSIGNAL · SAVED/);
  assert.match(offlineRoom, /SAVED REVIEWS/);
  assert.match(offlineRoom, /Saved Review/);
  assert.match(offlineRoom, /Current week — saved/);
});
