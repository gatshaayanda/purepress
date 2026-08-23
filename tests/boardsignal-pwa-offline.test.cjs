const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manifest = read("src/app/manifest.ts");
const sw = read("public/sw.js");
const register = read("src/components/ServiceWorkerRegister.tsx");
const install = read("src/components/InstallPrompt.tsx");
const installLib = read("src/lib/boardsignal/offline/install.ts");
const db = read("src/lib/boardsignal/offline/db.ts");
const snapshots = read("src/lib/boardsignal/offline/snapshots.ts");
const offlineTypes = read("src/lib/boardsignal/offline/types.ts");
const room = read("src/components/BoardSignalPlayerRoom.tsx");
const offlineRoom = read("src/components/OfflinePlayerRoom.tsx");
const friends = read("src/components/PlayerFriends.tsx");
const ask = read("src/components/AskBoardSignal.tsx");
const offlineGuide = read("src/lib/boardsignal/offline/guide.ts");
const connectivity = read("src/components/ConnectivityProvider.tsx");
const connectivityCore = read("src/lib/boardsignal/offline/connectivity.ts");
const connectivityRoute = read("src/app/api/boardsignal/connectivity/route.ts");
const profileDevice = read("src/components/DeviceOfflineControl.tsx");
const push = read("src/components/BrowserPushControl.tsx");
const css = read("src/app/globals.css");
const pkg = JSON.parse(read("package.json"));
const offlinePage = read("src/app/offline/page.tsx");
const offlinePlayerPage = read("src/app/offline/player-room/page.tsx");
const launch = read("src/components/PwaLaunchRedirect.tsx");
const routes = read("src/lib/purepress/publicRoutes.ts");
const chrome = read("src/components/RouteAwarePublicChrome.tsx");
const appleIcon = read("src/app/apple-icon.tsx");

function pngSize(file) {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.toString("ascii", 1, 4), "PNG");
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

function installHandlerSource() {
  const start = sw.indexOf('self.addEventListener("install"');
  const end = sw.indexOf('self.addEventListener("message"');
  return sw.slice(start, end);
}

test("manifest deliberately migrates installed public identity to PurePress", () => {
  assert.match(
    manifest,
    /name:\s*"PurePress Printers — Your Vision, Fully Printed"/,
  );
  assert.match(manifest, /short_name:\s*"PurePress"/);
  assert.match(manifest, /id:\s*"\/"/);
  assert.match(manifest, /start_url:\s*"\/\?source=pwa"/);
  assert.match(manifest, /scope:\s*"\/"/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /purepress-app-192\.png/);
  assert.match(manifest, /purepress-app-512\.png/);
  assert.match(
    manifest,
    /purepress-maskable-512\.png[\s\S]*purpose:\s*"maskable"/,
  );
  assert.match(manifest, /Request a Quote/);
  assert.match(manifest, /My PurePress/);
  assert.match(manifest, /Our Work/);
  assert.doesNotMatch(manifest, /BoardSignal/);
});

test("PurePress icon files have real required dimensions and a separate maskable artifact", () => {
  assert.deepEqual(
    pngSize("public/purepress/brand/purepress-app-192.png"),
    { width: 192, height: 192 },
  );
  assert.deepEqual(
    pngSize("public/purepress/brand/purepress-app-512.png"),
    { width: 512, height: 512 },
  );
  assert.deepEqual(
    pngSize("public/purepress/brand/purepress-maskable-512.png"),
    { width: 512, height: 512 },
  );
  assert.notDeepEqual(
    fs.readFileSync(
      path.join(root, "public/purepress/brand/purepress-app-512.png"),
    ),
    fs.readFileSync(
      path.join(root, "public/purepress/brand/purepress-maskable-512.png"),
    ),
  );

  const icon = read("src/app/icon.tsx");
  assert.match(icon, /#00AEEF/i);
  assert.match(icon, /#EC168C/i);
  assert.match(icon, /#FFE500/i);
  assert.match(icon, /background:\s*"#FFFFFF"/);
  assert.doesNotMatch(icon, /chess|boardsignal/i);

  assert.match(appleIcon, /#00AEEF/i);
  assert.match(appleIcon, /#EC168C/i);
  assert.match(appleIcon, /#FFE500/i);
  assert.doesNotMatch(appleIcon, /#3157ff|#c9f65d|>B</i);
});

test("one native service worker preserves push while hardening cache behavior", () => {
  assert.equal(
    (register.match(/navigator\.serviceWorker\s*\.register\("\/sw\.js"\)/g) || [])
      .length,
    1,
  );
  assert.match(sw, /boardsignal-shell-\$\{CACHE_VERSION\}/);
  assert.match(sw, /boardsignal-static-\$\{CACHE_VERSION\}/);
  assert.match(sw, /boardsignal-public-\$\{CACHE_VERSION\}/);
  assert.match(sw, /if \(request\.method !== "GET"\) return;/);
  assert.match(sw, /if \(url\.pathname\.startsWith\("\/api\/"\)\) return;/);
  assert.match(sw, /url\.pathname\.startsWith\("\/admin"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/client"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/app"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/connect"\)/);
  assert.match(sw, /\/boardsignal\/player-room[\s\S]*\/offline\/player-room/);
  assert.match(sw, /\/player\/[\s\S]*\/share\//);
  assert.match(
    sw,
    /url\.pathname\.startsWith\("\/stockfish\/"\)[\s\S]*cacheFirst/,
  );
  assert.doesNotMatch(
    sw.slice(sw.indexOf("const APP_SHELL"), sw.indexOf('self.addEventListener("install"')),
    /stockfish/,
  );
  assert.match(sw, /self\.addEventListener\("push"/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /self\.addEventListener\("notificationclick"/);
  assert.match(sw, /openWindow/);
  assert.doesNotMatch(installHandlerSource(), /skipWaiting\s*\(/);
  assert.match(
    sw,
    /event\.data\?\.type === "SKIP_WAITING"[\s\S]*self\.skipWaiting\(\)/,
  );
  assert.match(sw, /key\.startsWith\(BOARDSIGNAL_CACHE_PREFIX\)/);
  assert.match(sw, /trimCache\(PUBLIC_CACHE, 24\)/);
  assert.match(sw, /trimCache\(STATIC_CACHE, 80\)/);
  assert.match(sw, /precacheSafeShell/);
  assert.match(sw, /\/_next\/static\//);
});

test("PurePress routing keeps client login public and authenticated client routes internal", () => {
  assert.match(routes, /pathname === "\/client\/login"/);
  assert.match(routes, /pathname === "\/client"/);
  assert.match(routes, /pathname\.startsWith\("\/client\/"\)/);
  assert.match(routes, /pathname !== "\/client\/login"/);
  const publicPrefixes = routes.slice(
    routes.indexOf("const PUREPRESS_PUBLIC_PREFIXES"),
    routes.indexOf("] as const;") + "] as const;".length,
  );
  assert.doesNotMatch(publicPrefixes, /"\/client"/);
});

test("PurePress connectivity copy is route-aware while BoardSignal copy remains available", () => {
  assert.match(connectivity, /isPurePressPublicRoute\(pathname\)/);
  assert.match(connectivity, /isPurePressInternalRoute\(pathname\)/);
  assert.match(
    connectivity,
    /You're offline\. Some live PurePress features need a connection\./,
  );
  assert.match(connectivity, /PurePress is live again\./);
  assert.match(connectivity, /You're offline\. Showing saved BoardSignal\./);
  assert.match(connectivity, /BoardSignal is live again\./);
  assert.match(connectivity, /purePressSurface \? "OFFLINE" : "SAVED"/);
});

test("PurePress public shell leaves installation to the browser instead of mounting BoardSignal handlers", () => {
  const purePressStart = chrome.indexOf("if (isPurePressPublicRoute(pathname))");
  const boardSignalStart = chrome.indexOf("return (", purePressStart + 1);
  const purePressBranch = chrome.slice(purePressStart, boardSignalStart);

  assert.ok(purePressStart >= 0);
  assert.doesNotMatch(purePressBranch, /<InstallPrompt\s*\/>/);
  assert.doesNotMatch(purePressBranch, /<PwaLaunchRedirect\s*\/>/);
  assert.match(chrome.slice(boardSignalStart), /<InstallPrompt \/>/);
  assert.match(chrome.slice(boardSignalStart), /<PwaLaunchRedirect \/>/);
});

test("service worker update remains user-controlled, route-aware and reloads once", () => {
  assert.match(register, /registration\.waiting/);
  assert.match(register, /isPurePressPublicRoute\(pathname\)/);
  assert.match(register, /isPurePressInternalRoute\(pathname\)/);
  assert.match(register, /purePressSurface \? "PurePress" : "BoardSignal"/);
  assert.match(register, /waiting\.postMessage\(\{ type: "SKIP_WAITING" \}\)/);
  assert.match(register, /controllerchange/);
  assert.match(register, /reloadForUpdateRef\.current/);
  assert.match(register, /Your current screen will not reload on/);
});

test("private IndexedDB data remains UID-scoped and bounded", () => {
  assert.match(
    offlineTypes,
    /BOARDSIGNAL_OFFLINE_DB_NAME = "boardsignal-offline-v1"/,
  );
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_MAX_DESKS = 4/);
  assert.match(offlineTypes, /BOARDSIGNAL_OFFLINE_MAX_DRAFTS = 4/);
  assert.match(
    offlineTypes,
    /BOARDSIGNAL_OFFLINE_MAX_SOCIAL_COMPARISONS = 4/,
  );
  assert.match(db, /return `\$\{uid\}:\$\{kind\}:\$\{id\}`/);
  assert.match(db, /record\.uid !== expectedUid/);
  assert.match(
    snapshots,
    /if \(input\.account\.uid !== uid\) throw new Error\("Offline snapshot identity mismatch\."\)/,
  );
  assert.match(snapshots, /slice\(0, BOARDSIGNAL_OFFLINE_MAX_DESKS\)/);
  assert.match(snapshots, /activeDeskKeys\.has\(point\.deskKey\)/);
  assert.match(snapshots, /lastSyncedAt:\s*now/);
  assert.match(snapshots, /savedAt:\s*now/);
  assert.match(
    room,
    /previousUid && nextUid && previousUid !== nextUid[\s\S]*setSnapshot\(null\)[\s\S]*setOfflineSnapshot\(null\)[\s\S]*clearBoardSignalPrivateOfflineData\(previousUid\)/,
  );
  assert.match(
    room,
    /user\?\.uid[\s\S]*clearBoardSignalPrivateOfflineData\(user\.uid\)/,
  );
  assert.match(db, /key\.startsWith\("boardsignal-"\)/);
  assert.doesNotMatch(
    snapshots,
    /Firebase ID token|Beta Access plaintext|CRON_SECRET|VAPID/i,
  );
});

test("offline Player Room remains a truthful read-only saved sports desk", () => {
  assert.match(offlinePlayerPage, /OfflinePlayerRoom/);
  assert.match(offlineRoom, /offline\. Showing your saved BoardSignal from/);
  assert.match(
    offlineRoom,
    /New Chess\.com games, Pulse movement, messages and account changes are not included after/,
  );
  assert.match(offlineRoom, /Latest four saved Reviews/);
  assert.match(offlineRoom, /UniversalPlayerDesk[\s\S]*publishedDesk=/);
  assert.match(offlineRoom, /PROGRESS · SAVED/);
  assert.match(offlineRoom, /PULSE · LAST SYNCHRONIZED/);
  assert.match(offlineRoom, /UNIVERSE · SAVED/);
  assert.match(offlineRoom, /What's Hot — saved/);
  assert.match(offlineRoom, /FRIENDS · SAVED/);
  assert.match(offlineRoom, /Inbox needs a connection/);
  assert.match(offlineRoom, /no new analysis runs offline/);
  assert.match(
    offlineRoom,
    /No BoardSignal has been saved for this account on this device yet/,
  );
});

test("network-only social and account mutations do not fake success offline", () => {
  assert.match(
    friends,
    /if \(!connectivity\.online\) \{ setError\("Reconnect to change your BoardSignal connections\."\); return; \}/,
  );
  assert.match(friends, /Reconnect to search active BoardSignal players/);
  assert.match(
    friends,
    /disabled=\{Boolean\(busy\) \|\| !connectivity\.online\}/,
  );
  assert.match(friends, /loadSocialOfflineSnapshot\(uid\)/);
  assert.match(friends, /savedComparison/);
  assert.match(profileDevice, /disabled=\{!connectivity\.online/);
  assert.match(
    read("src/components/PlayerProfileNotifications.tsx"),
    /disabled=\{busy \|\| !connectivity\.online/,
  );
  assert.match(
    room,
    /Reconnect before accepting the Founding Access Agreement/,
  );
  assert.match(
    room,
    /Reconnect before changing BoardSignal account or communication settings/,
  );
  assert.match(room, /Reconnect before finishing or saving a review/);
  assert.match(
    room,
    /connectivity\.state !== "offline"[\s\S]*loadPlayerRoomOfflineSnapshot\(user\.uid\)/,
  );
  assert.match(room, /Reconnect to sign in/);
  assert.match(push, /navigator\.serviceWorker\.ready/);
  assert.match(push, /Reconnect before changing browser alerts/);
});

test("Friends loading-loop hotfix remains intact", () => {
  assert.match(friends, /const onChangedRef = useRef\(onChanged\)/);
  assert.match(
    friends,
    /useEffect\(\(\) => \{ onChangedRef\.current = onChanged; \}, \[onChanged\]\)/,
  );
  assert.match(
    friends,
    /const load = useCallback[\s\S]*\}, \[messageTarget, token\]\)/,
  );
  assert.doesNotMatch(friends, /\}, \[onChanged, token/);
  assert.match(
    friends,
    /loadedTokenRef = useRef<string \| undefined>\(undefined\)/,
  );
  assert.match(friends, /AbortController/);
  assert.match(friends, /12000/);
  assert.match(friends, /Your board gets better with people you know/);
});

test("Ask BoardSignal retains factual offline behavior and bounded drafts", () => {
  assert.match(ask, /if \(!connectivity\.online\)/);
  assert.match(ask, /buildOfflineGuideResponse/);
  assert.match(ask, /saveOfflineDraft/);
  assert.match(ask, /Saved locally\. When you're back online/);
  assert.match(ask, /Your message draft for Ayanda is ready/);
  assert.match(ask, /Send to Ayanda/);
  assert.match(offlineGuide, /You're offline/);
  assert.match(offlineGuide, /can't check Chess\.com for anything newer/);
  assert.match(offlineGuide, /don't create new chess analysis/);
  assert.match(snapshots, /slice\(0, BOARDSIGNAL_OFFLINE_MAX_DRAFTS\)/);
});

test("connectivity recovery remains probed and coordinated once", () => {
  assert.match(connectivityCore, /\/api\/boardsignal\/connectivity/);
  assert.match(connectivityRoute, /status:\s*204/);
  assert.match(
    connectivityRoute,
    /["']Cache-Control["']:\s*"no-store[^"']*"/,
  );
  assert.doesNotMatch(
    connectivityRoute,
    /firebase|firestore|requirePlayerToken|database/i,
  );
  assert.match(connectivity, /inFlightRef/);
  assert.match(
    connectivityCore,
    /BOARDSIGNAL_RECONNECTED_EVENT = "boardsignal:reconnected"/,
  );
  assert.match(room, /reconnectRefreshRef/);
  assert.match(room, /boardsignal:refresh-complete/);
  assert.match(offlineRoom, /boardsignal:pwa-recovery-refresh/);
  assert.match(
    offlineRoom,
    /window\.location\.replace\("\/boardsignal\/player-room"\)/,
  );
});

test("install experience remains engagement-aware standalone-aware and iOS-aware", () => {
  assert.match(install, /pathname\.startsWith\("\/boardsignal\/player-room"\)/);
  assert.match(install, /PWA_ENGAGED_KEY/);
  assert.match(install, /installDismissedRecently/);
  assert.match(installLib, /14 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(install, /beforeinstallprompt/);
  assert.match(install, /appinstalled/);
  assert.match(profileDevice, /Add to Home Screen/);
  assert.match(profileDevice, /Install BoardSignal/);
  assert.match(launch, /isStandaloneBoardSignal/);
  assert.match(
    launch,
    /window\.location\.replace\("\/boardsignal\/player-room"\)/,
  );
});

test("offline page and standalone CSS retain readable native-feeling UX", () => {
  assert.match(offlinePage, /The newsroom lost its signal/);
  assert.match(offlinePage, /Open saved Player Room/);
  assert.match(css, /@media \(display-mode: standalone\)/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(
    css,
    /\.bs-connectivity-strip\.is-offline[\s\S]*var\(--bs-text-on-dark\)/,
  );
  assert.match(css, /\.offline-room-tabs button[\s\S]*min-height:\s*44px/);
  assert.match(
    css,
    /\.device-offline-actions \.button[\s\S]*min-height:\s*44px/,
  );
  assert.match(css, /\.install-card \{ display: none !important; \}/);
});

test("PurePress build gate runs inherited and PurePress regressions without adding PWA dependencies", () => {
  assert.equal(
    pkg.scripts.prebuild,
    "npm run prepare:stockfish && npm run test:contrast && npm run test:purepress && npm run test:purepress-brand && npm run test:critical && npm run test:pwa",
  );
  assert.ok(pkg.scripts["test:pwa"]);
  assert.match(pkg.scripts.prebuild, /test:purepress/);
  assert.match(pkg.scripts.prebuild, /test:purepress-brand/);
  assert.match(pkg.scripts.prebuild, /test:critical/);
  assert.match(pkg.scripts.prebuild, /test:pwa/);
  assert.equal(pkg.dependencies?.workbox, undefined);
  assert.equal(pkg.dependencies?.["next-pwa"], undefined);

  const pwaSources = [
    "src/lib/boardsignal/offline/db.ts",
    "src/lib/boardsignal/offline/types.ts",
    "src/lib/boardsignal/offline/snapshots.ts",
    "src/lib/boardsignal/offline/connectivity.ts",
    "src/lib/boardsignal/offline/install.ts",
    "src/components/ConnectivityProvider.tsx",
    "src/components/DeviceOfflineControl.tsx",
  ]
    .map(read)
    .join("\n");
  assert.doesNotMatch(pwaSources, /process\.env\./);
});
