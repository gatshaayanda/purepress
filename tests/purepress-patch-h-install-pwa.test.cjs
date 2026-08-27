const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const install = read("src/components/purepress/PurePressInstallPrompt.tsx");
const installCss = read("src/components/purepress/PurePressInstallPrompt.module.css");
const layout = read("src/app/layout.tsx");
const sw = read("public/sw.js");
const offlineCustomer = read("src/lib/purepress/offline/customer.ts");
const offlineDb = read("src/lib/purepress/offline/db.ts");
const portal = read("src/components/purepress/PurePressCustomerPortal.tsx");
const pkg = JSON.parse(read("package.json"));

function handlerBody(name) {
  const marker = `const ${name}`;
  const start = install.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  const next = install.indexOf("\n  },", start);
  return install.slice(start, next >= 0 ? next + 5 : undefined);
}

test("PurePress has a dedicated branded install component mounted once at the app shell", () => {
  assert.match(layout, /import PurePressInstallPrompt from "@\/components\/purepress\/PurePressInstallPrompt"/);
  assert.equal((layout.match(/<PurePressInstallPrompt \/>/g) || []).length, 1);
  assert.doesNotMatch(install, /InstallPrompt from|BoardSignal|Review close/);
  assert.match(install, /PUREPRESS ON YOUR DEVICE/);
  assert.match(install, /INSTALL PUREPRESS/);
});

test("PurePress install UI is eligible on public and My PurePress surfaces only", () => {
  assert.match(install, /isPurePressPublicRoute\(pathname\)/);
  assert.match(install, /pathname === "\/my-purepress"/);
  assert.match(install, /pathname\?\.startsWith\("\/my-purepress\/"\)/);
  assert.match(install, /if \(!eligibleRoute \|\| installed\) return null/);
});

test("beforeinstallprompt is captured and browser default is deferred only on PurePress surfaces", () => {
  assert.match(install, /window\.addEventListener\("beforeinstallprompt", onBeforeInstallPrompt\)/);
  assert.match(install, /isPurePressInstallSurface\(window\.location\.pathname\)/);
  assert.match(install, /event\.preventDefault\(\)/);
  assert.match(install, /setDeferredPrompt\(event as BeforeInstallPromptEvent\)/);
});

test("native install prompt can only run from explicit INSTALL PUREPRESS button action", () => {
  const installHandler = handlerBody("install");
  assert.match(installHandler, /await prompt\.prompt\(\)/);
  assert.match(installHandler, /await prompt\.userChoice/);
  assert.match(install, /onClick=\{\(\) => void install\(\)\}[\s\S]*INSTALL PUREPRESS/);
  const nonClickSource = install.replace(/onClick=\{\(\) => void install\(\)\}/g, "");
  assert.equal((nonClickSource.match(/\binstall\(\)/g) || []).length, 0);
});

test("consumed programmatic prompt is cleared for accepted or dismissed native choice", () => {
  const installHandler = handlerBody("install");
  assert.match(installHandler, /setDeferredPrompt\(null\)/);
  assert.match(installHandler, /choice\.outcome === "dismissed"/);
  assert.match(installHandler, /rememberDismissal\(\)/);
});

test("appinstalled immediately removes all PurePress install UI", () => {
  assert.match(install, /window\.addEventListener\("appinstalled", onAppInstalled\)/);
  assert.match(install, /setInstalled\(true\)/);
  assert.match(install, /setDeferredPrompt\(null\)/);
  assert.match(install, /setAutomaticVisible\(false\)/);
  assert.match(install, /setManualOpen\(false\)/);
});

test("standalone and iOS standalone signals suppress repeated install invitations", () => {
  assert.match(install, /matchMedia\("\(display-mode: standalone\)"\)\.matches/);
  assert.match(install, /NavigatorWithStandalone/);
  assert.match(install, /standalone === true/);
  assert.match(install, /if \(!eligibleRoute \|\| installed\) return null/);
});

test("NOT NOW uses a bounded non-private dismissal timestamp", () => {
  assert.match(install, /purepress:install:dismissed-at/);
  assert.match(install, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(install, /Date\.now\(\) - at < PUREPRESS_INSTALL_DISMISS_MS/);
  assert.match(install, /NOT NOW/);
  assert.doesNotMatch(install, /uid|customerUid|customerName|orderId|projectId|referenceCode/);
});

test("dismissal never becomes permanent and supported install remains discoverable", () => {
  assert.match(install, /if \(!showCard\)/);
  assert.match(install, /setManualOpen\(true\)/);
  assert.match(install, /manualAvailable \? "ADD PUREPRESS" : "INSTALL PUREPRESS"/);
  assert.doesNotMatch(install, /never ask|neverAsk|permanent/i);
});

test("iPhone and iPad Safari receive manual Home Screen instructions without fake prompt behavior", () => {
  assert.match(install, /iPad\|iPhone\|iPod/);
  assert.match(install, /navigator\.platform === "MacIntel"/);
  assert.match(install, /CriOS\|FxiOS\|EdgiOS\|OPiOS/);
  assert.match(install, /ADD PUREPRESS TO YOUR HOME SCREEN/);
  assert.match(install, /<li>Tap Share\.<\/li>/);
  assert.match(install, /<li>Tap Add to Home Screen\.<\/li>/);
  assert.match(install, /GOT IT/);
});

test("unsupported browsers render no dead install control", () => {
  assert.match(install, /const programmaticAvailable = Boolean\(deferredPrompt\)/);
  assert.match(install, /const manualAvailable = iosManual/);
  assert.match(install, /if \(!programmaticAvailable && !manualAvailable\) return null/);
});

test("customer-facing installation copy contains no implementation jargon", () => {
  const customerStrings = [
    "PUREPRESS ON YOUR DEVICE",
    "KEEP PUREPRESS WITHIN EASY REACH",
    "INSTALL PUREPRESS",
    "NOT NOW",
    "ADD PUREPRESS TO YOUR HOME SCREEN",
    "Tap Share.",
    "Tap Add to Home Screen.",
    "GOT IT",
  ];
  for (const text of customerStrings) assert.match(install, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const renderedInstallUi = install.slice(install.indexOf("if (!showCard)"));
  assert.doesNotMatch(renderedInstallUi, />[^<]*(?:PWA|service worker|manifest|beforeinstallprompt|standalone mode)[^<]*</i);
});

test("install experience contains no private customer or order content", () => {
  assert.doesNotMatch(install, /purePressCustomerFetch|PurePressCustomerOrderProjection|customerUid|customerName|referenceCode|quote|proof/i);
  assert.doesNotMatch(install, /firebase|firestore|getIdToken/i);
});

test("installing PurePress is separate from KEEP MY ORDERS ON THIS DEVICE", () => {
  assert.match(portal, /KEEP MY ORDERS ON THIS DEVICE/);
  assert.doesNotMatch(install, /KEEP MY ORDERS ON THIS DEVICE/);
  assert.doesNotMatch(install, /setPurePressCustomerTrustedDevice|savePurePressCustomerOrders|putPurePressOfflineRecord/);
  assert.match(offlineCustomer, /setPurePressCustomerTrustedDevice/);
});

test("PurePress install card is non-blocking, mobile safe and keyboard visible", () => {
  assert.match(installCss, /position:\s*fixed/);
  assert.match(installCss, /pointer-events:\s*none/);
  assert.match(installCss, /safe-area-inset-bottom/);
  assert.match(installCss, /min-height:\s*48px/);
  assert.match(installCss, /:focus-visible/);
});

test("one service worker remains and customer APIs stay network-only", () => {
  assert.equal((layout.match(/<ServiceWorkerRegister \/>/g) || []).length, 1);
  assert.match(sw, /if \(url\.pathname\.startsWith\("\/api\/"\)\) return/);
  assert.match(sw, /url\.pathname\.startsWith\("\/my-purepress"\)/);
  assert.match(sw, /\/offline\/my-purepress/);
  assert.doesNotMatch(sw, /purepressCustomerOrders|customerUid|referenceCode/);
});

test("private order persistence remains UID-scoped IndexedDB with explicit customer opt-in", () => {
  assert.match(offlineDb, /purepress-private-v1/);
  assert.match(offlineDb, /record\.uid/);
  assert.match(offlineDb, /record\.key\.startsWith\(`\$\{record\.uid\}:`\)/);
  assert.match(offlineCustomer, /trusted-device/);
  assert.doesNotMatch(install, /offline\/customer|offline\/db/);
});

test("Patch H focused gate includes dedicated install tests without a PWA dependency", () => {
  assert.match(pkg.scripts["test:purepress-patch-h"], /purepress-patch-h-install-pwa\.test\.cjs/);
  assert.equal(pkg.dependencies?.workbox, undefined);
  assert.equal(pkg.dependencies?.["next-pwa"], undefined);
  assert.equal(pkg.devDependencies?.workbox, undefined);
  assert.equal(pkg.devDependencies?.["next-pwa"], undefined);
});
