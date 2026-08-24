const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const issue = () => read("src/lib/purepress/server/quoteIssueRepair.ts");
const diagnostics = () => read("src/lib/purepress/server/quoteDiagnostics.ts");
const route = () => read("src/app/api/admin/purepress/jobs/[projectId]/quotes/[quoteId]/route.ts");
const panel = () => read("src/components/purepress/PurePressQuotationPanel.tsx");
const approval = () => read("src/components/purepress/PurePressQuoteApproval.tsx");
const pdf = () => read("src/lib/purepress/server/quotePdf.ts");
const workspace = () => read("src/components/purepress/PurePressJobWorkspace.tsx");

test("ISSUE QUOTE runtime uses the E.1 repair path", () => {
  assert.match(route(), /issueOwnerQuoteE1/);
  assert.match(route(), /action === "issue"[\s\S]*issueOwnerQuoteE1\(projectId, quoteId\)/);
});

test("E.1 issue persistence updates only lifecycle fields it owns", () => {
  const source = issue();
  assert.match(source, /"purepress\.status": "awaiting_quote_approval"/);
  assert.match(source, /"purepress\.internal\.nextAction"/);
  assert.match(source, /"purepress\.updatedAt"/);
  assert.doesNotMatch(source, /transaction\.update\(projectRef,\s*\{\s*purepress:\s*updatedJob/);
});

test("E.1 validates every ISSUE persistence payload before commit", () => {
  const source = issue();
  for (const label of ["issuedQuote", "approvalToken", "projectIssueUpdate"]) {
    assert.match(source, new RegExp(`assertPersistencePayload\\(\\"${label}\\"`));
  }
});

test("persistence validation rejects undefined, non-finite, bigint and circular values", () => {
  const source = issue();
  assert.match(source, /current === undefined/);
  assert.match(source, /!Number\.isFinite\(current\)/);
  assert.match(source, /typeof current === "bigint"/);
  assert.match(source, /seen\.has\(current\)/);
});

test("raw approval token is blocked from every persisted ISSUE payload", () => {
  const source = issue();
  assert.match(source, /current\.includes\(rawToken\)/);
  assert.match(source, /PUREPRESS_QUOTE_RAW_TOKEN_PERSISTENCE_BLOCKED/);
  assert.match(source, /sharePath: `\/quote\/\$\{rawToken\}`/);
  assert.doesNotMatch(source, /tokenRecord\([^)]*rawToken/);
});

test("approval authorization still uses 256-bit random token plus SHA-256 hash", () => {
  const source = issue();
  assert.match(source, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(source, /hashQuoteApprovalToken\(rawToken\)/);
  assert.match(source, /doc\(tokenHash\)/);
});

test("replacement revisions still supersede old quote and token mapping", () => {
  const source = issue();
  assert.match(source, /status: "superseded"/);
  assert.match(source, /state: "superseded"/);
  assert.match(source, /prior\.approval\.tokenHash/);
});

test("ISSUE remains retry-safe without recovering a raw token from storage", () => {
  const source = issue();
  assert.match(source, /state\.currentIssuedQuoteId === quoteId && quote\.status === "issued"/);
  assert.match(source, /sharePath: null as string \| null/);
});

test("quotation server 500s receive a safe diagnostic id", () => {
  const source = route();
  assert.match(source, /logPurePressQuoteServerError/);
  assert.match(source, /diagnosticId/);
  assert.match(source, /status < 500/);
});

test("diagnostics never log request bodies or raw approval tokens", () => {
  const source = diagnostics();
  assert.match(source, /redacted-token/);
  assert.match(source, /fingerprint\(context\.projectId\)/);
  assert.match(source, /fingerprint\(context\.quoteId\)/);
  assert.doesNotMatch(source, /bodyText|request\.text|rawToken|customerSnapshot|lineItems/);
});

test("Issue Quote clearly says it does not send automatically", () => {
  const source = panel();
  assert.match(source, /Issue Quote does not send anything automatically/);
  assert.match(source, /copy and send to the customer yourself/);
});

test("issued quote provides fresh approval-link generation after reload", () => {
  const source = panel();
  assert.match(source, /raw approval link is not stored after it is shown/);
  assert.match(source, /GENERATE FRESH APPROVAL LINK/);
  assert.match(source, /onAction\(quote\.id,"rotate_link"\)/);
});

test("owner acceptance field says customer or approver name", () => {
  assert.match(panel(), /Customer \/ approver name \(optional\)/);
});

test("customer decision field says customer or approver name", () => {
  assert.match(approval(), /Customer \/ approver name \(optional\)/);
  assert.doesNotMatch(approval(), /<label>Your name \(optional\)/);
});

test("PDF supply wording is human-readable", () => {
  const source = pdf();
  assert.match(source, /Customer supplying items/);
  assert.match(source, /PurePress supplying items/);
  assert.match(source, /Customer \+ PurePress supply/);
  assert.match(source, /Supply source not yet confirmed/);
  assert.doesNotMatch(source, /supplySource\.replaceAll\("_", " "\)/);
});

test("PDF magenta total divider has dedicated spacing", () => {
  const source = pdf();
  assert.match(source, /const totalDividerY = y \+ 1/);
  assert.match(source, /doc\.setDrawColor\(\.\.\.MAGENTA\)/);
  assert.match(source, /doc\.line\(totalX, totalDividerY, totalValueX, totalDividerY\)/);
  assert.match(source, /y = totalDividerY \+ 5/);
  assert.doesNotMatch(source, /doc\.line\(totalX, y - 2, right, y - 2\)/);
});

test("job workspace contains no visible Patch D roadmap language", () => {
  const source = workspace();
  assert.doesNotMatch(source, /Bounded Patch D updates/);
  assert.doesNotMatch(source, /display-only in Patch D/);
  assert.doesNotMatch(source, /Later workflow patches own forward transitions/);
  assert.doesNotMatch(source, />[^<]*Patch D[^<]*</);
});

test("E.1 is a permanent prebuild gate after Patch E", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["test:purepress-patch-e1"], "node --test tests/purepress-patch-e1-qa.test.cjs");
  const e = pkg.scripts.prebuild.indexOf("npm run test:purepress-patch-e");
  const e1 = pkg.scripts.prebuild.indexOf("npm run test:purepress-patch-e1");
  const critical = pkg.scripts.prebuild.indexOf("npm run test:critical");
  assert.ok(e >= 0 && e1 > e && critical > e1);
});

test("E.1 adds no dependency or second PDF library", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies.jspdf, "^4.2.1");
  assert.equal(pkg.dependencies.pdfkit, undefined);
  assert.equal(pkg.dependencies.puppeteer, undefined);
  assert.equal(pkg.dependencies["@react-pdf/renderer"], undefined);
});

test("E.1 repair stays inside quotation QA boundaries", () => {
  const combined = [issue(), diagnostics(), route(), panel(), approval(), pdf(), workspace()].join("\n");
  assert.doesNotMatch(combined, /createInvoice|capturePayment|markProofApproved|scheduleMachine|PublicWorkMedia|firebase\/firestore/);
});
