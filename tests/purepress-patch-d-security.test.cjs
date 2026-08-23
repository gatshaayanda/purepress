const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function maybeRead(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

test("all Patch D operational routes require PurePress admin authorization", () => {
  for (const file of [
    "src/app/api/admin/purepress/quote-requests/[id]/convert/route.ts",
    "src/app/api/admin/purepress/jobs/route.ts",
    "src/app/api/admin/purepress/jobs/[projectId]/route.ts",
  ]) {
    const source = read(file);
    assert.match(source, /requirePurePressAdmin\(request\)/, file);
    assert.match(source, /Cache-Control.*no-store, private/, file);
  }
});

test("Patch D owner UI uses server APIs rather than direct Firestore writes", () => {
  for (const file of [
    "src/components/purepress/PurePressStudioDesk.tsx",
    "src/components/purepress/PurePressJobWorkspace.tsx",
    "src/components/purepress/PurePressQuoteRequests.tsx",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /firebase\/firestore|addDoc\(|setDoc\(|updateDoc\(|collection\(firestore/, file);
  }
  const jobs = read("src/lib/purepress/server/jobs.ts");
  assert.match(jobs, /getAdminDb\(\)/);
});

test("unlinked internal customers do not gain customer-side access", () => {
  const customers = read("src/lib/purepress/server/customers.ts");
  const jobs = read("src/lib/purepress/server/jobs.ts");
  assert.match(read("src/lib/purepress/domain.ts"), /firebaseUid\?: string/);
  assert.match(customers, /customer\.firebaseUid/);
  assert.match(jobs, /if \(customer\.firebaseUid\) job\.customerUid = customer\.firebaseUid/);
  assert.doesNotMatch(jobs, /purepressJobAccess|purepressOrderViews|purepressCustomerProfiles/);
  assert.doesNotMatch(customers, /purepressJobAccess|purepressOrderViews|purepressCustomerProfiles/);
});

test("customer reuse is explicit by customer id and never email authorization", () => {
  const jobs = read("src/lib/purepress/server/jobs.ts");
  assert.match(jobs, /existingCustomerId/);
  assert.match(jobs, /Selected PurePress customer was not found/);
  assert.doesNotMatch(jobs, /where\(["']email|where\(["']phone|customerUid\s*=\s*.*email/i);
});

test("conversion cannot publish or reclassify private quote artwork", () => {
  const jobs = read("src/lib/purepress/server/jobs.ts");
  assert.match(jobs, /file\.category !== "quote_artwork"/);
  assert.match(jobs, /file\.visibility !== "internal"/);
  assert.doesNotMatch(jobs, /PublicWorkMedia|safePublic|published:\s*true|production_ready/);
  assert.match(jobs, /transaction\.update\(artworkRef, \{ projectId: proposedProjectRef\.id, orderId: proposedProjectRef\.id \}\)/);
});

test("Patch C raw quote security remains intact when firestore rules are present", () => {
  const rules = maybeRead("firestore.rules");
  if (!rules) return;
  const start = rules.indexOf("match /purepressQuoteRequests/{requestId}");
  assert.ok(start >= 0);
  const block = rules.slice(start, rules.indexOf("}", start) + 1);
  assert.match(block, /allow read, create, update, delete: if isPurePressAdmin\(\);/);
  assert.doesNotMatch(block, /request\.auth == null|isUnsignedClient/);
});

test("projects remain raw admin-only and purepressCustomers receives no client permission when rules are present", () => {
  const rules = maybeRead("firestore.rules");
  if (!rules) return;
  assert.match(rules, /match \/projects\/\{projectId\}[\s\S]*?allow read, create, update, delete: if isPurePressAdmin\(\);/);
  assert.doesNotMatch(rules, /match \/purepressCustomers\//);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*?allow read, write: if false;/);
});

test("job mutations expose no public/customer bypass and no later-workflow shortcut", () => {
  const route = read("src/app/api/admin/purepress/jobs/[projectId]/route.ts");
  const logic = read("src/lib/purepress/jobDesk.ts");
  assert.match(route, /requirePurePressAdmin/);
  assert.doesNotMatch(route, /export async function (PUT|DELETE)/);
  assert.doesNotMatch(logic, /awaiting_quote_approval.*PATCH_D_MUTABLE|approved_for_production.*PATCH_D_MUTABLE|in_production.*PATCH_D_MUTABLE/);
  assert.match(logic, /readiness\.production.*display-only|display-only in Patch D/);
});
