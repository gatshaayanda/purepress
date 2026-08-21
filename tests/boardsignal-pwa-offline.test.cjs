const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = read('src/app/manifest.ts');
const sw = read('public/sw.js');
const register = read('src/components/ServiceWorkerRegister.tsx');
const install = read('src/components/InstallPrompt.tsx');
const installLib = read('src/lib/boardsignal/offline/install.ts');
const db = read('src/lib/boardsignal/offline/db.ts');
const snapshots = read('src/lib/boardsignal/offline/snapshots.ts');
const offlineTypes = read('src/lib/boardsignal/offline/types.ts');
const room = read('src/components/BoardSignalPlayerRoom.tsx');
const offlineRoom = read('src/components/OfflinePlayerRoom.tsx');
const friends = read('src/components/PlayerFriends.tsx');
const ask = read('src/components/AskBoardSignal.tsx');
const offlineGuide = read('src/lib/boardsignal/offline/guide.ts');
const connectivity = read('src/components/ConnectivityProvider.tsx');
const connectivityCore = read('src/lib/boardsignal/offline/connectivity.ts');
const connectivityRoute = read('src/app/api/boardsignal/connectivity/route.ts');
const profileDevice = read('src/components/DeviceOfflineControl.tsx');
const push = read('src/components/BrowserPushControl.tsx');
const css = read('src/app/globals.css');
const pkg = JSON.parse(read('package.json'));
const offlinePage = read('src/app/offline/page.tsx');
const offlinePlayerPage = read('src/app/offline/player-room/page.tsx');
const launch = read('src/components/PwaLaunchRedirect.tsx');

function pngSize(file) {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.toString('ascii', 1, 4), 'PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function installHandlerSource() {
  const start = sw.indexOf('self.addEventListener("install"');
  const end = sw.indexOf('self.addEventListener("message"');
  return sw.slice(start, end);
}

test('manifest is a standalone BoardSignal PWA with stable identity and shortcuts', () => {
  assert.match(manifest, /name:\s*"BoardSignal — Weekly Chess Review"/); // 1
  assert.match(manifest, /short_name:\s*"BoardSignal"/); // 2
  assert.match(manifest, /id:\s*"\/boardsignal"/); // 3
  assert.match(manifest, /start_url:\s*"\/boardsignal\?source=pwa"/); // 4
  assert.match(manifest, /scope:\s*"\/"/); // 5
  assert.match(manifest, /display:\s*"standalone"/); // 6
  assert.match(manifest, /boardsignal-192\.png/); // 7
  assert.match(manifest, /boardsignal-512\.png/); // 8
  assert.match(manifest, /boardsignal-maskable-512\.png[\s\S]*purpose:\s*"maskable"/); // 9
  assert.match(manifest, /Player Room[\s\S]*\/boardsignal\/player-room/); // 10
  assert.match(manifest, /Inbox[\s\S]*tab=inbox/); // 11
  assert.match(manifest, /Friends[\s\S]*tab=friends/); // 12
});

test('manifest icon files have real required dimensions and a separate maskable artifact', () => {
  assert.deepEqual(pngSize('public/icons/boardsignal-192.png'), { width: 192, height: 192 }); // 13
  assert.deepEqual(pngSize('public/icons/boardsignal-512.png'), { width: 512, height: 512 }); // 14
  assert.deepEqual(pngSize('public/icons/boardsignal-maskable-512.png'), { width: 512, height: 512 }); // 15
  assert.notDeepEqual(fs.readFileSync(path.join(root, 'public/icons/boardsignal-512.png')), fs.readFileSync(path.join(root, 'public/icons/boardsignal-maskable-512.png'))); // 16
});

test('one native service worker preserves push while hardening cache behavior', () => {
  assert.equal((register.match(/navigator\.serviceWorker\.register\("\/sw\.js"/g) || []).length, 1); // 17
  assert.match(sw, /boardsignal-shell-\$\{CACHE_VERSION\}/); // 18
  assert.match(sw, /boardsignal-static-\$\{CACHE_VERSION\}/); // 19
  assert.match(sw, /boardsignal-public-\$\{CACHE_VERSION\}/); // 20
  assert.match(sw, /if \(request\.method !== "GET"\) return;/); // 21
  assert.match(sw, /if \(url\.pathname\.startsWith\("\/api\/"\)\) return;/); // 22
  assert.match(sw, /url\.pathname\.startsWith\("\/admin"\)/); // 23
  assert.match(sw, /url\.pathname\.startsWith\("\/app"\)/); // 24
  assert.match(sw, /url\.pathname\.startsWith\("\/connect"\)/); // 25
  assert.match(sw, /\/boardsignal\/player-room[\s\S]*\/offline\/player-room/); // 26
  assert.match(sw, /\/player\/[\s\S]*\/share\//); // 27
  assert.match(sw, /url\.pathname\.startsWith\("\/stockfish\/"\)[\s\S]*cacheFirst/); // 28
  assert.doesNotMatch(sw.slice(sw.indexOf('const APP_SHELL'), sw.indexOf('self.addEventListener("install"')), /stockfish/); // 29
  assert.match(sw, /self\.addEventListener\("push"/); // 30
  assert.match(sw, /showNotification/); // 31
  assert.match(sw, /self\.addEventListener\("notificationclick"/); // 32
  assert.match(sw, /openWindow/); // 33
  assert.doesNotMatch(installHandlerSource(), /skipWaiting\s*\(/); // 34
  assert.match(sw, /event\.data\?\.type === "SKIP_WAITING"[\s\S]*self\.skipWaiting\(\)/); // 35
  assert.match(sw, /key\.startsWith\(BOARDSIGNAL_CACHE_PREFIX\)/); // 36
  assert.match(sw, /trimCache\(PUBLIC_CACHE, 24\)/); // 37
  assert.match(sw, /trimCache\(STATIC_CACHE, 80\)/); // 38
  assert.match(sw, /precacheSafeShell/); // 39
  assert.match(sw, /\/_next\/static\//); // 40
});

test('service worker update is player-controlled and reloads once', () => {
  assert.match(register, /registration\?\.waiting/); // 41
  assert.match(register, /BoardSignal update ready/); // 42
  assert.match(register, /waiting\.postMessage\(\{ type: "SKIP_WAITING" \}\)/); // 43
  assert.match(register, /controllerchange/); // 44
  assert.match(register, /reloadedRef\.current/); // 45
  assert.match(register, /Your current session will not reload by itself/); // 46
});

test('private IndexedDB data is UID-scoped and bounded', () => {
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_DB_NAME = "boardsignal-offline-v1"/); // 47
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_MAX_DESKS = 4/); // 48
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_MAX_DRAFTS = 4/); // 49
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_MAX_SOCIAL_COMPARISONS = 4/); // 50
  assert.match(db, /return `\$\{uid\}:\$\{kind\}:\$\{id\}`/); // 51
  assert.match(db, /record\.uid !== expectedUid/); // 52
  assert.match(snapshots, /if \(input\.account\.uid !== uid\) throw new Error\("Offline snapshot identity mismatch\."\)/); // 53
  assert.match(snapshots, /slice\(0, BOARDSIGNAL_OFFLINE_MAX_DESKS\)/); // 54
  assert.match(snapshots, /activeDeskKeys\.has\(point\.deskKey\)/); // 55
  assert.match(snapshots, /lastSyncedAt:\s*now/); // 56
  assert.match(snapshots, /savedAt:\s*now/); // 57
  assert.match(room, /previousUid && nextUid && previousUid !== nextUid[\s\S]*setSnapshot\(null\)[\s\S]*setOfflineSnapshot\(null\)[\s\S]*clearBoardSignalPrivateOfflineData\(previousUid\)/); // 58
  assert.match(room, /user\?\.uid[\s\S]*clearBoardSignalPrivateOfflineData\(user\.uid\)/); // 59
  assert.match(db, /key\.startsWith\("boardsignal-"\)/); // 60
  assert.doesNotMatch(snapshots, /Firebase ID token|Beta Access plaintext|CRON_SECRET|VAPID/i); // 61
});

test('offline Player Room is a saved truthful read-only sports desk', () => {
  assert.match(offlinePlayerPage, /OfflinePlayerRoom/); // 62
  assert.match(offlineRoom, /Offline • showing your saved BoardSignal from/); // 63
  assert.match(offlineRoom, /New Chess\.com games, Pulse movement, messages and account changes will appear after you reconnect/); // 64
  assert.match(offlineRoom, /Latest four active Desks/); // 65
  assert.match(offlineRoom, /UniversalPlayerDesk[\s\S]*publishedDesk=/); // 66
  assert.match(offlineRoom, /PROGRESS · SAVED/); // 67
  assert.match(offlineRoom, /PULSE · LAST SYNCHRONIZED/); // 68
  assert.match(offlineRoom, /UNIVERSE · OFFLINE SNAPSHOT/); // 69
  assert.match(offlineRoom, /What's Hot — saved/); // 70
  assert.match(offlineRoom, /FRIENDS · SAVED/); // 71
  assert.match(offlineRoom, /Inbox needs a connection/); // 72
  assert.match(offlineRoom, /No new episode analysis runs offline/); // 73
  assert.match(offlineRoom, /No BoardSignal has been saved for this account on this device yet/); // 74
});

test('network-only social and account mutations do not fake success offline', () => {
  assert.match(friends, /if \(!connectivity\.online\) \{ setError\("Reconnect to change your BoardSignal connections\."\); return; \}/); // 75
  assert.match(friends, /Reconnect to search active BoardSignal players/); // 76
  assert.match(friends, /disabled=\{Boolean\(busy\) \|\| !connectivity\.online\}/); // 77
  assert.match(friends, /loadSocialOfflineSnapshot\(uid\)/); // 78
  assert.match(friends, /savedComparison/); // 79
  assert.match(profileDevice, /disabled=\{!connectivity\.online/); // 80
  assert.match(read('src/components/PlayerProfileNotifications.tsx'), /disabled=\{busy \|\| !connectivity\.online/); // 81
  assert.match(room, /Reconnect before accepting the Founding Access Agreement/);
  assert.match(room, /Reconnect before changing BoardSignal account or communication settings/);
  assert.match(room, /Reconnect before finishing or saving a review/);
  assert.match(room, /connectivity\.state !== "offline"[\s\S]*loadPlayerRoomOfflineSnapshot\(user\.uid\)/);
  assert.match(room, /Reconnect to sign in/);
  assert.match(push, /navigator\.serviceWorker\.ready/); // 82
  assert.match(push, /Reconnect before changing browser alerts/); // 83
});

test('Friends loading-loop hotfix remains intact', () => {
  assert.match(friends, /const onChangedRef = useRef\(onChanged\)/); // 84
  assert.match(friends, /useEffect\(\(\) => \{ onChangedRef\.current = onChanged; \}, \[onChanged\]\)/); // 85
  assert.match(friends, /const load = useCallback[\s\S]*\}, \[messageTarget, token\]\)/); // 86
  assert.doesNotMatch(friends, /\}, \[onChanged, token/); // 87
  assert.match(friends, /loadedTokenRef = useRef<string \| undefined>\(undefined\)/); // 88
  assert.match(friends, /AbortController/); // 89
  assert.match(friends, /12000/); // 90
  assert.match(friends, /Your board gets better with people you know/); // 91
});

test('Ask BoardSignal has a factual offline path and bounded local drafts', () => {
  assert.match(ask, /if \(!connectivity\.online\)/); // 92
  assert.match(ask, /buildOfflineGuideResponse/); // 93
  assert.match(ask, /saveOfflineDraft/); // 94
  assert.match(ask, /Saved locally\. When you're back online/); // 95
  assert.match(ask, /Your message draft for Ayanda is ready/); // 96
  assert.match(ask, /Send to Ayanda/); // 97
  assert.match(offlineGuide, /You're offline/); // 98
  assert.match(offlineGuide, /can't check Chess\.com for anything newer/); // 99
  assert.match(offlineGuide, /don't create new chess analysis/); // 100
  assert.match(snapshots, /slice\(0, BOARDSIGNAL_OFFLINE_MAX_DRAFTS\)/); // 101
});

test('connectivity recovery is probed and coordinated once', () => {
  assert.match(connectivityCore, /\/api\/boardsignal\/connectivity/); // 102
  assert.match(connectivityRoute, /status:\s*204/); // 103
  assert.match(connectivityRoute, /["']Cache-Control["']:\s*"no-store[^"']*"/); // 104
  assert.doesNotMatch(connectivityRoute, /firebase|firestore|requirePlayerToken|database/i); // 105
  assert.match(connectivity, /inFlightRef/); // 106
  assert.match(connectivityCore, /BOARDSIGNAL_RECONNECTED_EVENT = "boardsignal:reconnected"/); // 107
  assert.match(room, /reconnectRefreshRef/); // 108
  assert.match(room, /boardsignal:refresh-complete/); // 109
  assert.match(offlineRoom, /boardsignal:pwa-recovery-refresh/); // 110
  assert.match(offlineRoom, /window\.location\.replace\("\/boardsignal\/player-room"\)/); // 111
});

test('install experience is engagement-aware, standalone-aware and iOS-aware', () => {
  assert.match(install, /pathname\.startsWith\("\/boardsignal\/player-room"\)/); // 112
  assert.match(install, /PWA_ENGAGED_KEY/); // 113
  assert.match(install, /installDismissedRecently/); // 114
  assert.match(installLib, /14 \* 24 \* 60 \* 60 \* 1000/); // 115
  assert.match(install, /beforeinstallprompt/); // 116
  assert.match(install, /appinstalled/); // 117
  assert.match(profileDevice, /Add to Home Screen/); // 118
  assert.match(profileDevice, /Install BoardSignal/); // 119
  assert.match(launch, /isStandaloneBoardSignal/); // 120
  assert.match(launch, /window\.location\.replace\("\/boardsignal\/player-room"\)/); // 121
});

test('offline page and standalone CSS preserve readable native-feeling UX', () => {
  assert.match(offlinePage, /The newsroom lost its signal/); // 122
  assert.match(offlinePage, /Open saved Player Room/); // 123
  assert.match(css, /@media \(display-mode: standalone\)/); // 124
  assert.match(css, /safe-area-inset-top/); // 125
  assert.match(css, /safe-area-inset-bottom/); // 126
  assert.match(css, /\.bs-connectivity-strip\.is-offline[\s\S]*var\(--bs-text-on-dark\)/); // 127
  assert.match(css, /\.offline-room-tabs button[\s\S]*min-height:\s*44px/); // 128
  assert.match(css, /\.device-offline-actions \.button[\s\S]*min-height:\s*44px/); // 129
  assert.match(css, /\.install-card \{ display: none !important; \}/); // 130
});

test('PurePress build gate runs inherited and PurePress regressions without adding PWA dependencies', () => {
  assert.equal(pkg.scripts.prebuild, 'npm run prepare:stockfish && npm run test:contrast && npm run test:purepress && npm run test:critical && npm run test:pwa'); // 131
  assert.ok(pkg.scripts['test:pwa']); // 132
  assert.match(pkg.scripts.prebuild, /test:purepress/); // 133
  assert.match(pkg.scripts.prebuild, /test:critical/); // 134
  assert.match(pkg.scripts.prebuild, /test:pwa/); // 135
  assert.equal(pkg.dependencies?.workbox, undefined); // 136
  assert.equal(pkg.dependencies?.['next-pwa'], undefined); // 137
  const pwaSources = [
    'src/lib/boardsignal/offline/db.ts',
    'src/lib/boardsignal/offline/types.ts',
    'src/lib/boardsignal/offline/snapshots.ts',
    'src/lib/boardsignal/offline/connectivity.ts',
    'src/lib/boardsignal/offline/install.ts',
    'src/components/ConnectivityProvider.tsx',
    'src/components/DeviceOfflineControl.tsx',
  ].map(read).join('\n');
  assert.doesNotMatch(pwaSources, /process\.env\./); // 138
});
