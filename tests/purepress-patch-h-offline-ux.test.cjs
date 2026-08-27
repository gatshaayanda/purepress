const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const offline = read('src/lib/purepress/offline/customer.ts');
const db = read('src/lib/purepress/offline/db.ts');
const ui = read('src/components/purepress/PurePressCustomerPortal.tsx');
const login = read('src/components/purepress/PurePressCustomerLogin.tsx');
const offlineUi = read('src/components/purepress/PurePressCustomerOffline.tsx');
const css = read('src/components/purepress/PurePressCustomerPortal.module.css');
const sw = read('public/sw.js');
const pkg = JSON.parse(read('package.json'));

test('customer private cache is UID-scoped IndexedDB on the existing PurePress offline DB', () => {
  assert.match(db, /indexedDB/);
  assert.match(db, /purePressOfflineKey\(uid/);
  assert.match(offline, /purePressOfflineKey\(uid, ORDER_KIND/);
  assert.doesNotMatch(offline, /localStorage|email.*key/i);
});

test('durable customer cache requires explicit trusted-device opt-in', () => {
  assert.match(offline, /customer-trusted-device/);
  assert.match(offline, /if \(!\(await isPurePressCustomerTrustedDevice\(uid\)\)\) return/);
  assert.match(ui, /KEEP MY ORDERS ON THIS DEVICE/);
  assert.match(ui, /This saves a private copy of your order status on this device/);
});

test('only safe customer projections are written to the customer offline cache', () => {
  assert.match(offline, /PurePressCustomerOrderProjection/);
  assert.doesNotMatch(offline, /JobFile|ProofState|EmbroideryJob|fileKey|ufsUrl|Blob|ArrayBuffer/);
});

test('offline view is unmistakably a saved copy and shows last updated', () => {
  assert.match(ui + offlineUi, /SAVED COPY/);
  assert.match(ui + offlineUi, /You’re offline\. This is the last update saved on this device\./);
  assert.match(ui + offlineUi, /LAST UPDATED/);
});

test('quote and artwork approvals require internet and are never queued', () => {
  assert.match(ui, /CONNECT TO THE INTERNET TO APPROVE THIS QUOTE\./);
  assert.match(ui, /CONNECT TO THE INTERNET TO APPROVE THIS ARTWORK\./);
  assert.doesNotMatch(ui + offline, /WAITING TO SYNC|outbox|queue.*approval/i);
});

test('sign out clears customer cache and Firebase auth state', () => {
  const authClient = read('src/lib/purepress/auth/customerApi.ts');
  assert.match(authClient, /clearPurePressCustomerOfflineData\(uid\)/);
  assert.match(authClient, /signOut\(auth\)/);
  assert.match(authClient, /clearPendingPurePressSignInEmail/);
});

test('passwordless email-link flow has no password field and auto-completes same-browser handoff', () => {
  assert.match(login, /sendPurePressCustomerSignInLink/);
  assert.match(login, /pendingPurePressSignInEmail/);
  assert.match(login, /completePurePressCustomerSignIn\(pending, href\)/);
  assert.match(login, /OPENING MY PUREPRESS/);
  assert.doesNotMatch(login, /type="password"|password/i);
});

test('cross-device email-link completion asks one clear email question', () => {
  assert.match(login, /Enter the email you used with PurePress\./);
  assert.match(login, /mode === "cross-device"/);
});

test('My PurePress home has no generic analytics counters', () => {
  assert.match(ui, /YOUR ORDERS/);
  assert.doesNotMatch(ui, /TOTAL ORDERS|OPEN ORDERS|MESSAGES 2|At a glance/);
});

test('main order screen exposes status, next step, explicit no-action state, and visible buttons', () => {
  assert.match(ui, /WHERE YOUR ORDER IS/);
  assert.match(ui, /WHAT HAPPENS NEXT/);
  assert.match(ui, /NOTHING NEEDED FROM YOU RIGHT NOW\./);
  for (const label of ['VIEW ORDER','REVIEW QUOTE','REVIEW ARTWORK','CONTACT PUREPRESS','BACK TO MY ORDERS','SIGN OUT']) assert.match(ui, new RegExp(label));
});

test('five customer progress labels are visible text, not colour-only state', () => {
  assert.match(ui, /DONE/); assert.match(ui, /NOW/); assert.match(ui, /NEXT/);
  assert.match(ui, /step\.stage/);
});

test('ready for collection is unmistakable and uses only confirmed PurePress details', () => {
  assert.match(ui, /YOUR ORDER IS READY FOR COLLECTION/);
  assert.match(ui, /Plot 17879, Gaborone West/);
  assert.match(ui, /\+267 78 013 297/);
  assert.match(ui, /\+267 77 116 195/);
  assert.match(ui, /purepressprinters@gmail\.com/);
  assert.doesNotMatch(ui, /opening hours|whatsapp|delivery available/i);
});

test('mobile controls are large and keyboard focus remains visible', () => {
  assert.match(css, /min-height: 48px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:/);
  assert.doesNotMatch(css, /:hover[^\n]*display/);
});

test('service worker never caches customer APIs and uses a safe My PurePress offline shell', () => {
  assert.match(sw, /if \(url\.pathname\.startsWith\("\/api\/"\)\) return/);
  assert.match(sw, /\/offline\/my-purepress/);
  assert.match(sw, /url\.pathname\.startsWith\("\/my-purepress"\)/);
});

test('Patch H is permanently gated after G and before critical/PWA', () => {
  assert.ok(pkg.scripts['test:purepress-patch-h']);
  const prebuild = pkg.scripts.prebuild;
  assert.ok(prebuild.indexOf('test:purepress-patch-g') < prebuild.indexOf('test:purepress-patch-h'));
  assert.ok(prebuild.indexOf('test:purepress-patch-h') < prebuild.indexOf('test:critical'));
  assert.ok(prebuild.indexOf('test:purepress-patch-h') < prebuild.indexOf('test:pwa'));
});

test('Patch H package edit changes no dependency versions', () => {
  assert.equal(pkg.dependencies.firebase, '^11.9.0');
  assert.equal(pkg.dependencies['firebase-admin'], '^13.4.0');
  assert.equal(pkg.dependencies.next, '^15.5.15');
  assert.equal(pkg.dependencies.react, '^19.2.3');
});
