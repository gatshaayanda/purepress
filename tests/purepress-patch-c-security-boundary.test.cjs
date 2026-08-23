const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function matchBlock(source, header) {
  const start = source.indexOf(header);
  assert.ok(start >= 0, `Missing ${header}`);
  let depth = 0;
  let opened = false;
  const bodyStart = source.indexOf("{", start + header.length);
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") { depth += 1; opened = true; }
    if (source[i] === "}") depth -= 1;
    if (opened && depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed block: ${header}`);
}

test("raw QuoteRequests are admin-only for every Firestore client operation", () => {
  const rules = read("firestore.rules");
  const block = matchBlock(rules, "match /purepressQuoteRequests/{requestId}");
  assert.match(block, /allow read, create, update, delete: if isPurePressAdmin\(\);/);
  assert.doesNotMatch(block, /isUnsignedClient|request\.auth == null|allow create: if request\.resource/);

  const admin = matchBlock(rules, "function isPurePressAdmin()");
  assert.match(admin, /request\.auth != null/);
  assert.match(admin, /purepress_admin == true/);
  assert.match(admin, /admin == true/);
});

test("unsigned and authenticated non-admin clients have no raw QuoteRequest rule path", () => {
  const rules = read("firestore.rules");
  const block = matchBlock(rules, "match /purepressQuoteRequests/{requestId}");
  assert.equal((block.match(/allow /g) ?? []).length, 1);
  assert.match(block, /isPurePressAdmin\(\)/);
  assert.doesNotMatch(block, /isOwner\(|request\.auth\.uid|if true|isUnsignedClient\(/);
});

test("legacy inquiries and contact_messages public-create rules remain intact", () => {
  const rules = read("firestore.rules");
  const inquiries = matchBlock(rules, "match /inquiries/{inquiryId}");
  const contacts = matchBlock(rules, "match /contact_messages/{messageId}");
  assert.match(inquiries, /allow create: if isUnsignedClient\(\)/);
  assert.match(inquiries, /allow read, update, delete: if isPurePressAdmin\(\);/);
  assert.match(contacts, /allow create: if isUnsignedClient\(\)/);
  assert.match(contacts, /allow read, update, delete: if isPurePressAdmin\(\);/);
});

test("anonymous quote POST is wired only to server-side Firebase Admin persistence", () => {
  const route = read("src/app/api/purepress/quote-requests/route.ts");
  const server = read("src/lib/purepress/server/quoteRequests.ts");
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.match(route, /createPublicQuoteRequest\(body/);
  assert.match(route, /status: 201/);
  assert.match(route, /export async function GET\(\)[\s\S]*status: 405/);
  assert.match(server, /getAdminDb\(\)/);
  assert.match(server, /collection\(QUOTE_REQUESTS_COLLECTION\)/);
  assert.match(server, /parseQuoteRequestSubmission\(raw\)/);
  assert.doesNotMatch(route, /firebase\/firestore|addDoc\(|setDoc\(/);
});

test("public server endpoint owns body limits, source/status and artwork-session linkage", () => {
  const route = read("src/app/api/purepress/quote-requests/route.ts");
  const server = read("src/lib/purepress/server/quoteRequests.ts");
  const validator = read("src/lib/purepress/quoteIntake.ts");
  assert.match(route, /MAX_BODY_BYTES = 32 \* 1024/);
  assert.match(route, /Buffer\.byteLength\(bodyText, "utf8"\) > MAX_BODY_BYTES/);
  assert.match(server, /status: "new_request"/);
  assert.match(server, /source: "public_quote_form"/);
  assert.match(server, /assertStoredQuoteIntakeSession\(sessionSnapshot\.data\(\) \?\? \{\}, token, submission\.artworkFileIds\)/);
  assert.match(server, /data\.quoteIntakeSessionId !== intakeId/);
  assert.match(server, /transaction\.update\(sessionRef,[\s\S]*state: "consumed"/);
  for (const field of ["status", "source", "internal", "readiness", "adminNotes", "published"]) {
    assert.match(validator, new RegExp(`"${field}"`));
  }
});

test("quote artwork remains private and cannot auto-publish", () => {
  const router = read("src/app/api/uploadthing/core.ts");
  const sessions = read("src/lib/purepress/server/quoteIntakeSessions.ts");
  const domain = read("src/lib/purepress/domain.ts");
  const route = router.slice(router.indexOf("purePressQuoteArtwork"), router.indexOf("purePressUpload:"));
  assert.match(route, /acl: "private"/);
  assert.match(sessions, /category: "quote_artwork"/);
  assert.match(sessions, /visibility: "internal"/);
  assert.match(sessions, /uploadedBy: "system"/);
  assert.match(route, /recordQuoteArtworkUpload/);
  assert.doesNotMatch(route, /PublicWorkMedia|safePublic|published:\s*true/);
  assert.match(domain, /interface PublicWorkMedia/);
  assert.match(domain, /published: boolean/);
});
