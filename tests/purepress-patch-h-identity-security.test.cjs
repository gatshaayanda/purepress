const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const auth = read('src/lib/purepress/auth/server.ts');
const portal = read('src/lib/purepress/server/customerPortal.ts');
const listRoute = read('src/app/api/purepress/customer/orders/route.ts');
const detailRoute = read('src/app/api/purepress/customer/orders/[projectId]/route.ts');
const ui = read('src/components/purepress/PurePressCustomerPortal.tsx');
const middleware = read('middleware.ts');
const rules = read('firestore.rules');

test('Firebase bearer token is required and revocation checked', () => {
  assert.match(auth, /authorization\.toLowerCase\(\)\.startsWith\("bearer "\)/);
  assert.match(auth, /verifyIdToken\(token, true\)/);
});

test('UID and verified email are derived only from verified token', () => {
  assert.match(auth, /token\.uid/);
  assert.match(auth, /token\.email_verified !== true/);
  assert.match(auth, /normalizePurePressServerEmail\(token\.email\)/);
});

test('unlinked jobs can self-link only by exact normalized canonical customer email', () => {
  assert.match(portal, /canonicalEmail !== identity\.email/);
  assert.match(portal, /normalizePurePressServerEmail\(customer\.customerVisible\.email\)/);
});

test('linking is a Firestore transaction that binds the stable UID to customer and one canonical job', () => {
  assert.match(portal, /runTransaction/);
  assert.match(portal, /firebaseUid: identity\.uid/);
  assert.match(portal, /purepress_customer_uid: identity\.uid/);
  assert.match(portal, /purepress: linkedJob/);
  assert.doesNotMatch(portal, /collection\("purepressOrders"\)/);
});

test('same UID replay is explicitly idempotent', () => {
  assert.match(portal, /const jobAlreadyLinked = job\.customerUid === identity\.uid/);
  assert.match(portal, /const customerAlreadyLinked = customer\.firebaseUid === identity\.uid/);
});

test('different UID cannot steal linked customer or job', () => {
  assert.match(portal, /linkedToAnother\(job\.customerUid, identity\.uid\)/);
  assert.match(portal, /linkedToAnother\(customer\.firebaseUid, identity\.uid\)/);
});

test('project ID knowledge alone is not authorization', () => {
  assert.match(portal, /transaction\.get\(customerRef\)/);
  assert.match(portal, /throw unavailableOrder\(\)/);
  assert.match(detailRoute, /requirePurePressCustomer\(request\)/);
  assert.match(detailRoute, /getPurePressCustomerOrder\(identity, projectId\)/);
});

test('list route authenticates and returns only server-selected orders', () => {
  assert.match(listRoute, /requirePurePressCustomer\(request\)/);
  assert.match(listRoute, /listPurePressCustomerOrders\(identity\)/);
  assert.doesNotMatch(listRoute, /request\.json/);
});

test('foreign and unknown order IDs use the same customer-safe denial', () => {
  assert.match(portal, /function unavailableOrder\(\)/);
  assert.match(portal, /status: 404/);
});

test('new My PurePress customer UI never imports browser Firestore', () => {
  assert.doesNotMatch(ui, /firebase\/firestore/);
  assert.doesNotMatch(ui, /\bfirestore\b/i);
  assert.match(ui, /purePressCustomerFetch/);
});

test('no role cookie or email-keyed localStorage authentication exists in H customer code', () => {
  const h = [auth, portal, ui, read('src/lib/purepress/auth/client.ts'), read('src/lib/purepress/offline/customer.ts')].join('\n');
  assert.doesNotMatch(h, /document\.cookie|startsWith\([\"']role=|role=;\s*path=/);
  assert.doesNotMatch(h, /localStorage/);
});

test('raw projects and quote requests remain admin-only in Firestore rules', () => {
  assert.match(rules, /match \/projects\/\{projectId\}[\s\S]*allow read, create, update, delete: if isPurePressAdmin\(\)/);
  assert.match(rules, /match \/purepressQuoteRequests\/\{requestId\}[\s\S]*isPurePressAdmin\(\)/);
});

test('legacy customer routes are retired into My PurePress by middleware', () => {
  assert.match(middleware, /\/client\/login/);
  assert.match(middleware, /\/my-purepress\/login/);
  assert.match(middleware, /\/client\/dashboard/);
  assert.match(middleware, /\/my-purepress/);
  assert.match(middleware, /\/client\\\/project/);
});
