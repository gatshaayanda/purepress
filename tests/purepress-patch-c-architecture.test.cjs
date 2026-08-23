const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const canonicalStatuses = [
  "new_request", "needs_information", "quote_ready", "awaiting_quote_approval",
  "artwork_proof", "awaiting_proof_approval", "approved_for_production",
  "in_production", "quality_check", "ready", "completed", "cancelled",
];

test("the 12 canonical lifecycle states are unchanged", () => {
  const source = read("src/lib/purepress/orderStatus.ts");
  const match = source.match(/PUREPRESS_ORDER_STATUSES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  assert.ok(match);
  const found = [...match[1].matchAll(/"([a-z_]+)"/g)].map((entry) => entry[1]);
  assert.deepEqual(found, canonicalStatuses);
});

test("internal readiness is separate and preserves permanent dimensions", () => {
  const source = read("src/lib/purepress/readiness.ts");
  for (const area of ["payment", "items", "artwork", "proof", "sample", "production", "qc"]) assert.match(source, new RegExp(`\\"${area}\\"`));
  for (const state of ["not_required_yet", "partially_received", "needs_digitizing", "changes_requested", "not_required", "paused", "passed", "issue"]) assert.match(source, new RegExp(`\\"${state}\\"`));
  assert.match(source, /OperationalNextAction/);
  assert.match(source, /SupplyReceivingFact/);
  assert.match(source, /EmbroideryProductionSpecification/);
  assert.doesNotMatch(source, /PurePressOrderStatus\s*=|PUREPRESS_ORDER_STATUSES\s*=/);
});

test("QuoteRequest remains intake while EmbroideryJob can preserve provenance", () => {
  const source = read("src/lib/purepress/domain.ts");
  assert.match(source, /interface QuoteRequest/);
  assert.match(source, /sourceQuoteRequestId\?: string/);
  assert.match(source, /reorderSourceOrderId\?: string/);
  assert.match(source, /quoteIntakeSessionId\?: string/);
  assert.match(source, /quoteRequestId\?: string/);
  assert.match(source, /interface PublicWorkMedia/);
});

test("anonymous quote artwork has a narrow allowlist and cannot use octet-stream", () => {
  const uploads = read("src/lib/purepress/uploads.ts");
  const quoteBlock = uploads.slice(uploads.indexOf("quote_artwork:"), uploads.indexOf("customer_artwork:"));
  for (const token of [".jpg", ".jpeg", ".png", ".webp", ".pdf"]) assert.match(quoteBlock, new RegExp(token.replace(/[./]/g, "\\$&")));
  for (const mime of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) assert.match(uploads, new RegExp(mime.replace(/[./]/g, "\\$&")));
  assert.doesNotMatch(quoteBlock, /octet-stream|\.ai|\.eps|postscript/);
  assert.match(uploads, /QUOTE_ARTWORK_MAX_FILES = 3/);
  assert.match(uploads, /QUOTE_ARTWORK_MAX_BYTES = 8 \* MB/);
});

test("quote artwork has its own private UploadThing route", () => {
  const source = read("src/app/api/uploadthing/core.ts");
  assert.match(source, /purePressQuoteArtwork/);
  assert.match(source, /acl: "private"/);
  assert.match(source, /authorizeQuoteArtworkUpload/);
  assert.match(source, /recordQuoteArtworkUpload/);
  const route = source.slice(source.indexOf("purePressQuoteArtwork"), source.indexOf("purePressUpload:"));
  assert.doesNotMatch(route, /public_gallery_candidate|PublicWorkMedia/);
});

test("quote intake authorization is scoped, expiring, bounded and consumable", () => {
  const source = read("src/lib/purepress/server/quoteIntakeSessions.ts");
  assert.match(source, /QUOTE_INTAKE_TTL_MS = 15 \* 60 \* 1000/);
  assert.match(source, /scope: "quote_artwork"/);
  assert.match(source, /tokenHash/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /state: "active" \| "consumed"/);
  assert.match(source, /already been consumed/);
  assert.match(source, /has expired/);
  assert.match(source, /uploadedFileIds/);
});

test("new quote status and internal fields are server controlled", () => {
  const server = read("src/lib/purepress/server/quoteRequests.ts");
  const validator = read("src/lib/purepress/quoteIntake.ts");
  assert.match(server, /status: "new_request"/);
  assert.match(server, /source: "public_quote_form"/);
  assert.match(validator, /FORBIDDEN_CLIENT_FIELDS/);
  assert.match(validator, /"status"/);
  assert.match(validator, /"customerUid"/);
  assert.match(validator, /"readiness"/);
  assert.doesNotMatch(server, /collection\(["']PublicWorkMedia|new EmbroideryJob/);
});

test("public endpoint is POST-only and raw quote reads stay owner-only", () => {
  const publicRoute = read("src/app/api/purepress/quote-requests/route.ts");
  const ownerList = read("src/app/api/admin/purepress/quote-requests/route.ts");
  const ownerDetail = read("src/app/api/admin/purepress/quote-requests/[id]/route.ts");
  assert.match(publicRoute, /export async function POST/);
  assert.match(publicRoute, /status: 405/);
  assert.match(publicRoute, /MAX_BODY_BYTES/);
  assert.match(ownerList, /requirePurePressAdmin/);
  assert.match(ownerDetail, /requirePurePressAdmin/);
});

test("owner artwork access is quote-bound and delivered through short-lived signed URLs", () => {
  const server = read("src/lib/purepress/server/quoteRequests.ts");
  const detailRoute = read("src/app/api/admin/purepress/quote-requests/[id]/route.ts");
  assert.match(server, /file\.quoteRequestId !== cleanId/);
  assert.match(server, /generateSignedURL\(fileKey, \{ expiresIn: "2 minutes" \}\)/);
  assert.match(server, /viewUrl: signed\.ufsUrl/);
  assert.match(detailRoute, /requirePurePressAdmin/);
  assert.match(detailRoute, /Cache-Control.*no-store, private/);
});

test("customer quote UI is nine-step, mobile progressive and does not force account creation", () => {
  const source = read("src/components/purepress/PurePressQuoteIntake.tsx");
  assert.match(source, /STEP \{step \+ 1\} OF \{STEPS\.length\}/);
  assert.match(source, /What are we branding\?/);
  assert.match(source, /Where are the items coming from\?/);
  assert.match(source, /Collection \/ delivery intent/);
  assert.match(source, /uploadFiles\("purePressQuoteArtwork"/);
  assert.match(source, /request-a-quote|quote-requests/);
  assert.doesNotMatch(source, /create account|sign up|password/i);
  assert.match(read("src/components/purepress/PurePressQuoteIntake.module.css"), /@media \(max-width: 640px\)/);
  assert.match(read("src/components/purepress/PurePressQuoteIntake.module.css"), /prefers-reduced-motion/);
});

test("Studio adds a bounded New Quote Requests intake surface without replacing the primer", () => {
  const page = read("src/app/admin/page.tsx");
  const source = read("src/components/purepress/PurePressQuoteRequests.tsx");
  assert.match(page, /PurePressStudioPrimer/);
  assert.match(page, /PurePressQuoteRequests/);
  assert.match(source, /NEW QUOTE REQUESTS/);
  for (const heading of ["CUSTOMER", "WHAT THEY ARE BRANDING", "WHO SUPPLIES THE ITEMS", "QUANTITY \/ KNOWN VARIANTS", "PLACEMENTS", "ARTWORK", "REQUESTED TIMING", "FULFILMENT INTENT", "CUSTOMER NOTES", "NEXT ACTION"]) assert.match(source, new RegExp(heading));
  assert.doesNotMatch(source, /machine scheduling|quote builder|quality checklist/i);
});
