const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const statuses = [
  "new_request", "needs_information", "quote_ready", "awaiting_quote_approval",
  "artwork_proof", "awaiting_proof_approval", "approved_for_production",
  "in_production", "quality_check", "ready", "completed", "cancelled",
];

test("canonical lifecycle remains exactly 12 states and readiness remains separate", () => {
  const order = read("src/lib/purepress/orderStatus.ts");
  const match = order.match(/PUREPRESS_ORDER_STATUSES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  assert.ok(match);
  assert.deepEqual([...match[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]), statuses);
  const readiness = read("src/lib/purepress/readiness.ts");
  for (const area of ["payment", "items", "artwork", "proof", "sample", "production", "qc"]) {
    assert.match(readiness, new RegExp(`\\"${area}\\"`));
  }
  assert.doesNotMatch(readiness, /PUREPRESS_ORDER_STATUSES\s*=/);
});

test("anonymous customers and jobs support genuine unlinked identity without fake UID", () => {
  const domain = read("src/lib/purepress/domain.ts");
  const customers = read("src/lib/purepress/server/customers.ts");
  assert.match(domain, /firebaseUid\?: string/);
  assert.match(domain, /customerUid\?: string/);
  assert.match(customers, /customer\.firebaseUid/);
  assert.match(customers, /contact-field matching never grants access/i);
  assert.doesNotMatch(customers, /createUser\(|email.*firebaseUid|firebaseUid.*email/i);
});

test("projects remains the single operational compatibility root", () => {
  const jobs = read("src/lib/purepress/server/jobs.ts");
  const compat = read("src/lib/purepress/projectCompatibility.ts");
  assert.match(jobs, /PUREPRESS_PROJECTS_COLLECTION = "projects"/);
  assert.match(jobs, /purepress: EmbroideryJob/);
  assert.match(compat, /namespaced `purepress` job payload/);
  assert.doesNotMatch(jobs, /purepressOrders|PUREPRESS_ORDERS_COLLECTION/);
});

test("quote conversion is retry-safe and preserves durable provenance", () => {
  const jobs = read("src/lib/purepress/server/jobs.ts");
  assert.match(jobs, /quote\.internal\?\.assignedProjectId/);
  assert.match(jobs, /return \{ projectId: assignedProjectId, referenceCode: existing\.referenceCode, created: false \}/);
  assert.match(jobs, /sourceQuoteRequestId: quote\.id/);
  assert.match(jobs, /"internal\.assignedProjectId": proposedProjectRef\.id/);
  assert.match(jobs, /"internal\.convertedAt": now/);
  assert.match(jobs, /runTransaction/);
  assert.doesNotMatch(jobs, /transaction\.delete\(quoteRef\)/);
});

test("source quote artwork remains private intake material after conversion", () => {
  const jobs = read("src/lib/purepress/server/jobs.ts");
  assert.match(jobs, /file\.category !== "quote_artwork"/);
  assert.match(jobs, /file\.visibility !== "internal"/);
  assert.match(jobs, /transaction\.update\(artworkRef, \{ projectId: proposedProjectRef\.id, orderId: proposedProjectRef\.id \}\)/);
  assert.doesNotMatch(jobs, /category:\s*"proof"|category:\s*"customer_artwork"|production_ready/);
  assert.doesNotMatch(jobs, /PublicWorkMedia|purepressPublicWorkMedia|safePublic|published:\s*true/);
});

test("owner-created work uses the same operational job model and conservative source/status", () => {
  const jobs = read("src/lib/purepress/server/jobs.ts");
  const desk = read("src/lib/purepress/jobDesk.ts");
  assert.match(jobs, /source: "owner_created"/);
  assert.match(desk, /"new_request",\s*"needs_information"/);
  assert.doesNotMatch(jobs, /status:\s*"in_production"/);
});

test("Studio exposes real deterministic desk views and no demo priority scoring", () => {
  const page = read("src/app/admin/page.tsx");
  const desk = read("src/components/purepress/PurePressStudioDesk.tsx");
  const logic = read("src/lib/purepress/jobDesk.ts");
  assert.match(page, /PurePressStudioDesk/);
  for (const label of ["ATTENTION", "WAITING ON CUSTOMER", "IN PRODUCTION", "READY \/ DUE NEXT", "ALL JOBS"]) {
    assert.match(desk, new RegExp(label));
  }
  assert.match(logic, /classifyJob/);
  assert.doesNotMatch(desk, /demo job|sample job|fake count|priority score/i);
  assert.doesNotMatch(logic, /priorityScore|aiPriority/i);
});

test("dedicated job workspace separates status, readiness, next action and requested timing", () => {
  const workspace = read("src/components/purepress/PurePressJobWorkspace.tsx");
  for (const heading of ["NEXT ACTION", "READINESS", "CUSTOMER BRIEF", "ARTWORK", "SOURCE / PROVENANCE"]) {
    assert.match(workspace, new RegExp(heading));
  }
  assert.match(workspace, /Internal notes/i);
  assert.match(workspace, /Customer requested date/i);
  assert.match(workspace, /not.*production-ready/i);
  assert.match(workspace, /PATCH D OWNER CONTROLS|OWNER CONTROLS/i);
  assert.doesNotMatch(workspace, /quote price|accept quote|approve proof|machine assignment|QC complete/i);
});

test("Patch C and Patch D regressions are permanent explicit prebuild gates", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["test:purepress-patch-c"]);
  assert.ok(pkg.scripts["test:purepress-patch-d"]);
  for (const file of [
    "tests/purepress-patch-c-validation.test.cjs",
    "tests/purepress-patch-c-architecture.test.cjs",
    "tests/purepress-patch-c-security-boundary.test.cjs",
  ]) assert.match(pkg.scripts["test:purepress-patch-c"], new RegExp(file.replace(/[.]/g, "\\.")));
  for (const file of [
    "tests/purepress-patch-d-validation.test.cjs",
    "tests/purepress-patch-d-architecture.test.cjs",
    "tests/purepress-patch-d-security.test.cjs",
  ]) assert.match(pkg.scripts["test:purepress-patch-d"], new RegExp(file.replace(/[.]/g, "\\.")));
  assert.match(pkg.scripts.prebuild, /test:purepress-patch-c/);
  assert.match(pkg.scripts.prebuild, /test:purepress-patch-d/);
  const ignore = read(".gitignore");
  assert.match(ignore, /\.test-dist-purepress-c/);
  assert.match(ignore, /\.test-dist-purepress-d/);
});

test("future workflow actions are displayed when present but not prematurely enabled", () => {
  const workspace = read("src/components/purepress/PurePressJobWorkspace.tsx");
  const logic = read("src/lib/purepress/jobDesk.ts");
  assert.match(logic, /PATCH_D_MUTABLE_STATUSES/);
  assert.match(logic, /"new_request"[\s\S]*"needs_information"[\s\S]*"cancelled"/);
  assert.match(logic, /readiness\.proof.*display-only|display-only in Patch D/);
  assert.doesNotMatch(workspace, /Start production|Approve quotation|Send proof|Mark QC passed|Schedule machine/i);
});
