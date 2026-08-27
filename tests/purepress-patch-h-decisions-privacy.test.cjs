const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const decisions = read('src/lib/purepress/server/customerDecisions.ts');
const portal = read('src/lib/purepress/server/customerPortal.ts');
const quoteRoute = read('src/app/api/purepress/customer/orders/[projectId]/quote-decision/route.ts');
const proofRoute = read('src/app/api/purepress/customer/orders/[projectId]/proof-decision/route.ts');
const fileRoute = read('src/app/api/purepress/customer/orders/[projectId]/proof-file/[index]/route.ts');

test('authenticated quote decision rechecks customer ownership inside its transaction', () => {
  assert.match(decisions, /assertOwned\(job, customer, identity, projectId\)/);
  assert.match(decisions, /project\.purepress_customer_uid !== identity\.uid/);
});

test('quote accepts only exact current issued revision', () => {
  assert.match(decisions, /state\.currentIssuedQuoteId !== quote\.id/);
  assert.match(decisions, /state\.currentIssuedRevision !== quote\.revision/);
  assert.match(decisions, /quote\.status !== "issued"/);
});

test('expired quote cannot be approved', () => {
  assert.match(decisions, /isQuoteExpired\(quote as PurePressQuote, todayInGaborone\(\)\)/);
});

test('portal quote decisions reuse the existing quote token state so secure-link authority cannot conflict', () => {
  assert.match(decisions, /PUREPRESS_QUOTE_TOKEN_COLLECTION/);
  assert.match(decisions, /quote\.approval\?\.tokenHash/);
  assert.match(decisions, /state: "accepted"|"changes_requested"/);
});

test('authenticated quote decision source is recorded cleanly', () => {
  assert.match(decisions, /source: "authenticated_customer"/);
  assert.match(decisions, /decidedByUid: identity\.uid/);
});

test('quote change request requires a bounded explanation', () => {
  assert.match(decisions, /slice\(0, max\)/);
  assert.match(decisions, /decision === "request_changes" && !comment/);
  assert.match(decisions, /1200/);
});

test('quote acceptance moves only to artwork proof, not production', () => {
  const quoteBlock = decisions.slice(decisions.indexOf('decideAuthenticatedCustomerQuote'), decisions.indexOf('decideAuthenticatedCustomerProof'));
  assert.match(quoteBlock, /status: "artwork_proof"/);
  assert.doesNotMatch(quoteBlock, /status: "in_production"/);
});

test('authenticated proof decision rechecks current proof and exact revision', () => {
  assert.match(decisions, /proof\.id !== proofId/);
  assert.match(decisions, /proof\.revision !== currentRevision/);
  assert.match(decisions, /state\.revision !== currentRevision/);
  assert.match(decisions, /state\.status !== "awaiting_customer"/);
});

test('proof changes use Patch F decision parser, including required comment', () => {
  assert.match(decisions, /parseDecisionInput/);
  assert.match(decisions, /decision: input\.decision/);
  assert.match(decisions, /comment: input\.comment/);
});

test('proof approval does not start production', () => {
  const proofBlock = decisions.slice(decisions.indexOf('decideAuthenticatedCustomerProof'));
  assert.match(proofBlock, /"purepress\.status": "artwork_proof"/);
  assert.match(proofBlock, /"purepress\.internal\.readiness\.production": "not_ready"/);
  assert.doesNotMatch(proofBlock, /"purepress\.status": "in_production"/);
});

test('quote/proof API routes authenticate, authorize, then mutate', () => {
  for (const route of [quoteRoute, proofRoute]) {
    assert.match(route, /requirePurePressCustomer\(request\)/);
    assert.match(route, /requirePurePressCustomerOrderOwnership\(identity, projectId\)/);
    assert.match(route, /MAX_BODY_BYTES/);
    assert.match(route, /Cache|purePressCustomerJson/);
  }
});

test('customer projection is explicit and never spreads raw job/project data', () => {
  const projectionBlock = portal.slice(portal.indexOf('async function projectCustomerOrder'), portal.indexOf('export async function listPurePressCustomerOrders'));
  assert.doesNotMatch(projectionBlock, /\.\.\.job\b/);
  assert.doesNotMatch(projectionBlock, /\.\.\.projectData\b/);
  for (const forbidden of ['ownerNotes','adminNotes','productionInstructions','qualityNotes','machineAssignment','operatorName','supplier','receiving','rejectedQuantity','reworkQuantity','qualityChecks','operationsVersion','tokenHash','activeTokenHash','productionFileIds','sampleEvidenceFileIds']) {
    assert.doesNotMatch(projectionBlock, new RegExp(`\\b${forbidden}\\b`));
  }
});

test('proof projection contains only a preview count, never durable file IDs or signed URLs', () => {
  const proofProjection = portal.slice(portal.indexOf('function proofProjection'), portal.indexOf('function formatBwpMinor'));
  assert.match(proofProjection, /previewCount/);
  assert.doesNotMatch(proofProjection, /proofFileIds:/);
  assert.doesNotMatch(proofProjection, /ufsUrl|signed/);
});

test('proof file access is separately authenticated and signed for five minutes', () => {
  assert.match(fileRoute, /requirePurePressCustomer\(request\)/);
  assert.match(portal, /createPrivateJobFileViewUrl/);
  assert.match(portal, /expiresIn: "5 minutes"/);
  assert.match(portal, /file\.category !== "proof"/);
});

test('client-supplied email and UID are not inputs to either decision model', () => {
  assert.doesNotMatch(decisions, /input\.(?:email|uid|customerUid)/);
  assert.doesNotMatch(quoteRoute + proofRoute, /body\.(?:email|uid|customerUid)/);
});
