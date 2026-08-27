const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const orderStatusSource = fs.readFileSync(path.join(root, 'src/lib/purepress/orderStatus.ts'), 'utf8');
const projectionSource = fs.readFileSync(path.join(root, 'src/lib/purepress/customerProjection.ts'), 'utf8');
const projection = require(path.join(root, '.test-dist-purepress-h/src/lib/purepress/customerProjection.js'));
const statusModule = require(path.join(root, '.test-dist-purepress-h/src/lib/purepress/orderStatus.js'));

const expected = {
  new_request: ['QUOTE', 'We received your request.', 'NONE'],
  needs_information: ['QUOTE', 'We need a few details from you.', 'CONTACT_PUREPRESS'],
  quote_ready: ['QUOTE', 'PurePress is preparing your quote.', 'NONE'],
  awaiting_quote_approval: ['QUOTE', 'Your quote is ready.', 'REVIEW_QUOTE'],
  artwork_proof: ['ARTWORK', 'We’re preparing your artwork.', 'NONE'],
  awaiting_proof_approval: ['ARTWORK', 'Your artwork is ready to check.', 'REVIEW_ARTWORK'],
  approved_for_production: ['MAKING', 'Everything is approved. We’re getting ready to make your order.', 'NONE'],
  in_production: ['MAKING', 'We’re making your order.', 'NONE'],
  quality_check: ['MAKING', 'We’re checking your finished order.', 'NONE'],
  ready: ['READY', 'Your order is ready for collection.', 'NONE'],
  completed: ['COMPLETE', 'Your order is complete. Thank you.', 'NONE'],
  cancelled: ['CANCELLED', 'This order was cancelled.', 'CONTACT_PUREPRESS'],
};

test('canonical lifecycle remains exactly 12 statuses', () => {
  assert.deepEqual(statusModule.PUREPRESS_ORDER_STATUSES, Object.keys(expected));
  assert.equal(statusModule.PUREPRESS_ORDER_STATUSES.length, 12);
});

test('customer progress stages are separate and exactly five', () => {
  assert.deepEqual(projection.PUREPRESS_CUSTOMER_STAGES, ['QUOTE', 'ARTWORK', 'MAKING', 'READY', 'COMPLETE']);
  assert.doesNotMatch(orderStatusSource, /PUREPRESS_CUSTOMER_STAGES/);
});

for (const [status, [stage, headline, action]] of Object.entries(expected)) {
  test(`${status} maps deterministically to customer stage/copy/action`, () => {
    const result = projection.projectPurePressCustomerStatus(status);
    assert.equal(result.stage, stage);
    assert.equal(result.headline, headline);
    assert.equal(result.action, action);
  });
}

test('cancelled never renders a misleading complete tracker', () => {
  assert.deepEqual(projection.customerProgressFor('cancelled'), []);
});

test('active tracker uses text state in addition to visual treatment', () => {
  assert.deepEqual(projection.customerProgressFor('quality_check').map((s) => [s.stage, s.state]), [
    ['QUOTE', 'done'], ['ARTWORK', 'done'], ['MAKING', 'current'], ['READY', 'future'], ['COMPLETE', 'future'],
  ]);
});

test('customer-action orders sort before other active/ready/completed orders', () => {
  const make = (id, status, updatedAt) => ({ projectId: id, referenceCode: id, title: id, status: projection.projectPurePressCustomerStatus(status), progress: projection.customerProgressFor(status), updatedAt, collection: projection.PUREPRESS_COLLECTION_DETAILS });
  const sorted = projection.sortPurePressCustomerOrders([
    make('complete', 'completed', '2026-08-27T09:00:00Z'),
    make('ready', 'ready', '2026-08-27T10:00:00Z'),
    make('active', 'in_production', '2026-08-27T11:00:00Z'),
    make('action', 'awaiting_proof_approval', '2026-08-27T08:00:00Z'),
  ]);
  assert.deepEqual(sorted.map((row) => row.projectId), ['action', 'active', 'ready', 'complete']);
});

test('projection type does not admit named internal production/security fields', () => {
  for (const forbidden of ['ownerNotes','readiness','nextAction','machineAssignment','operatorName','supplier','receiving','rejectedQuantity','reworkQuantity','qualityChecks','operationsVersion','tokenHash','activeTokenHash','productionFileIds','sampleEvidenceFileIds','firebaseUid','customerUid','signedUrl']) {
    assert.doesNotMatch(projectionSource, new RegExp(`\\b${forbidden}\\b`), forbidden);
  }
});

test('projection contains confirmed PurePress collection details only', () => {
  assert.equal(projection.PUREPRESS_COLLECTION_DETAILS.address, 'Plot 17879, Gaborone West, Gaborone, Botswana');
  assert.deepEqual([...projection.PUREPRESS_COLLECTION_DETAILS.phones], ['+267 78 013 297', '+267 77 116 195']);
  assert.equal(projection.PUREPRESS_COLLECTION_DETAILS.email, 'purepressprinters@gmail.com');
});
