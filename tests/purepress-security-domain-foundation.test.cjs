const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const statuses = [
  "new_request",
  "needs_information",
  "quote_ready",
  "awaiting_quote_approval",
  "artwork_proof",
  "awaiting_proof_approval",
  "approved_for_production",
  "in_production",
  "quality_check",
  "ready",
  "completed",
  "cancelled",
];

test("PurePress order lifecycle is centralized and complete", () => {
  const source = read("src/lib/purepress/orderStatus.ts");
  for (const status of statuses) assert.match(source, new RegExp(`\\"${status}\\"`));
  assert.match(source, /PUREPRESS_ORDER_STATUS_META/);
  assert.match(source, /isPurePressOrderStatus/);
});

test("PurePress domain separates customer-visible and internal information", () => {
  const source = read("src/lib/purepress/domain.ts");
  for (const name of ["Customer", "QuoteRequest", "EmbroideryJob", "JobFile", "ProofApproval", "ProductionUpdate", "OrderMessage", "PublicWorkMedia"]) {
    assert.match(source, new RegExp(`interface ${name}`));
  }
  assert.match(source, /customerVisible/);
  assert.match(source, /internal/);
  assert.match(source, /CustomerOrderView/);
  assert.doesNotMatch(source, /payment|invoice|accounting/i);
});

test("projects and raw project messages are no longer anonymously readable", () => {
  const rules = read("firestore.rules");
  assert.doesNotMatch(rules, /function isAdminWrite/);
  assert.doesNotMatch(rules, /admin_id\s*==\s*['\"]admin['\"]/);
  assert.match(rules, /match \/projects\/\{projectId\}[\s\S]*?allow read, create, update, delete: if isPurePressAdmin\(\);/);
  assert.match(rules, /match \/messages\/\{messageId\}[\s\S]*?allow read, create, update, delete: if isPurePressAdmin\(\);/);
});

test("customer projections are UID-scoped and public media requires deliberate publication", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/purepressCustomerProfiles\/\{userId\}/);
  assert.match(rules, /match \/purepressJobAccess\/\{userId\}\/jobs\/\{jobId\}/);
  assert.match(rules, /resource\.data\.customerUid == request\.auth\.uid/);
  assert.match(rules, /resource\.data\.visibility == 'customer'/);
  assert.match(rules, /resource\.data\.published == true && resource\.data\.safePublic == true/);
});

test("legacy password-map login is retired and Firebase auth foundation exists", () => {
  const legacy = read("src/app/api/client-login/route.ts");
  const clientAuth = read("src/lib/purepress/auth/client.ts");
  const serverAuth = read("src/lib/purepress/auth/server.ts");
  assert.match(legacy, /status: 410/);
  assert.doesNotMatch(legacy, /CLIENT_PASSWORD_/);
  assert.match(clientAuth, /sendSignInLinkToEmail/);
  assert.match(clientAuth, /signInWithEmailLink/);
  assert.match(serverAuth, /verifyIdToken/);
  assert.match(serverAuth, /purepressJobAccess/);
});

test("PurePress upload routes are categorized, authorized and never auto-published", () => {
  const policies = read("src/lib/purepress/uploads.ts");
  const router = read("src/app/api/uploadthing/core.ts");
  for (const category of ["quote_artwork", "customer_artwork", "proof", "order_document", "order_message_attachment", "completion_media", "public_gallery_candidate"]) {
    assert.match(policies, new RegExp(category));
  }
  assert.match(router, /purePressUpload/);
  assert.match(router, /authorizePurePressUpload/);
  assert.match(router, /published: false/);
});

test("PurePress private offline cache is Firebase UID-scoped and avoids localStorage", () => {
  const source = read("src/lib/purepress/offline/db.ts");
  assert.match(source, /indexedDB/);
  assert.match(source, /A Firebase UID is required/);
  assert.match(source, /clearPurePressPrivateDataOnLogout/);
  assert.match(source, /clearPurePressPrivateDataOnAccountDeletion/);
  assert.match(source, /handlePurePressAccountChange/);
  assert.doesNotMatch(source, /localStorage/);
});
