const assert = require("node:assert/strict");
const test = require("node:test");
const {
  initialReadinessFromQuote,
  initialReadinessFromOwnerJob,
  parseNextAction,
  parseOwnerCreatedJob,
  parseJobPatch,
  classifyJob,
} = require("../.test-dist-purepress-d/jobDesk.js");

function quote(overrides = {}) {
  return {
    customerVisible: {
      supplySource: "customer_supplied",
      artworkFileIds: ["art-1"],
      ...overrides,
    },
  };
}

function ownerJob(overrides = {}) {
  return {
    customerName: "Workshop Customer",
    organisation: "Workshop Co",
    email: " CUSTOMER@Example.COM ",
    phone: "",
    itemCategory: "shirts_polos",
    supplySource: "purepress_supplied",
    quantity: 24,
    sizeBreakdown: "12 M, 12 L",
    itemColours: ["Black"],
    placements: [{ position: "left_chest" }],
    requestedDate: "2026-09-15",
    timingFlexible: false,
    fulfillmentIntent: "collect",
    customerNotes: "Call before collection",
    internalNotes: "Known repeat customer, not yet account linked",
    status: "new_request",
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    id: "project-1",
    projectId: "project-1",
    referenceCode: "PPJ-20260823-ABC12345",
    customerId: "customer-1",
    supplySource: "customer_supplied",
    status: "new_request",
    customerVisible: {
      title: "Polos",
      quantity: 24,
      requestedDate: "2026-09-20",
      timingFlexible: false,
    },
    internal: {
      source: "quote_request",
      readiness: {
        payment: "not_required_yet",
        items: "customer_supplied",
        artwork: "received",
        proof: "not_started",
        sample: "not_required",
        production: "not_ready",
        qc: "not_started",
      },
      nextAction: { actor: "owner", action: "Review artwork" },
    },
    createdAt: "2026-08-23T10:00:00.000Z",
    updatedAt: "2026-08-23T10:00:00.000Z",
    ...overrides,
  };
}

test("quote conversion readiness is conservative and fact-derived", () => {
  assert.deepEqual(initialReadinessFromQuote(quote()), {
    payment: "not_required_yet",
    items: "customer_supplied",
    artwork: "received",
    proof: "not_started",
    sample: "not_required",
    production: "not_ready",
    qc: "not_started",
  });
  assert.deepEqual(initialReadinessFromQuote(quote({ supplySource: "purepress_supplied", artworkFileIds: [] })), {
    payment: "not_required_yet",
    items: "needs_procurement",
    artwork: "missing",
    proof: "not_started",
    sample: "not_required",
    production: "not_ready",
    qc: "not_started",
  });
  assert.equal(initialReadinessFromQuote(quote({ supplySource: "mixed" })).items, "unknown");
});

test("owner-created job readiness never invents completed work", () => {
  const readiness = initialReadinessFromOwnerJob({ supplySource: "purepress_supplied" });
  assert.equal(readiness.items, "needs_procurement");
  assert.equal(readiness.artwork, "missing");
  assert.equal(readiness.production, "not_ready");
  assert.equal(readiness.qc, "not_started");
  assert.notEqual(readiness.artwork, "production_ready");
});

test("owner-created intake is bounded, normalized and conservative", () => {
  const parsed = parseOwnerCreatedJob(ownerJob());
  assert.equal(parsed.email, "customer@example.com");
  assert.equal(parsed.status, "new_request");
  assert.equal(parsed.requestedDate, "2026-09-15");
  assert.equal(parsed.quantity, 24);
  assert.equal(Object.hasOwn(parsed, "customerUid"), false);
  assert.equal(Object.hasOwn(parsed, "firebaseUid"), false);
  assert.throws(() => parseOwnerCreatedJob(ownerJob({ email: "", phone: "" })), /email address or phone/i);
  assert.throws(() => parseOwnerCreatedJob(ownerJob({ quantity: 0 })), /quantity/i);
  assert.throws(() => parseOwnerCreatedJob(ownerJob({ status: "in_production" })), /status has an invalid value/i);
});

test("requested customer date is not an operational next-action due date", () => {
  const parsed = parseOwnerCreatedJob(ownerJob({ requestedDate: "2026-09-15" }));
  const next = parseNextAction({ actor: "owner", action: "Review artwork", dueAt: "2026-08-29" });
  assert.equal(parsed.requestedDate, "2026-09-15");
  assert.equal(next.dueAt, "2026-08-29");
  assert.notEqual(parsed.requestedDate, next.dueAt);
});

test("next action validates actor, text, date, readiness area and blocker bounds", () => {
  assert.deepEqual(parseNextAction({
    actor: "supplier",
    action: "Order 24 black polos",
    dueAt: "2026-08-30",
    readinessArea: "items",
    blocker: "Awaiting supplier stock confirmation",
  }), {
    actor: "supplier",
    action: "Order 24 black polos",
    dueAt: "2026-08-30",
    readinessArea: "items",
    blocker: "Awaiting supplier stock confirmation",
  });
  assert.throws(() => parseNextAction({ actor: "manager", action: "Do it" }), /actor has an invalid value/i);
  assert.throws(() => parseNextAction({ actor: "owner", action: "x".repeat(241) }), /too long/i);
  assert.throws(() => parseNextAction({ actor: "owner", action: "Review", dueAt: "30-08-2026" }), /YYYY-MM-DD/i);
  assert.throws(() => parseNextAction({ actor: "owner", action: "Review", readinessArea: "machine" }), /invalid value/i);
});

test("Patch D job mutations permit only early lifecycle and readiness facts", () => {
  assert.deepEqual(parseJobPatch({
    status: "needs_information",
    supplySource: "mixed",
    readiness: { items: "received", artwork: "needs_digitizing" },
    ownerNotes: "Customer will return Friday",
  }), {
    status: "needs_information",
    supplySource: "mixed",
    readiness: { items: "received", artwork: "needs_digitizing" },
    ownerNotes: "Customer will return Friday",
  });
  assert.throws(() => parseJobPatch({ status: "quote_ready" }), /status has an invalid value/i);
  assert.throws(() => parseJobPatch({ readiness: { proof: "approved" } }), /display-only/i);
  assert.throws(() => parseJobPatch({ readiness: { production: "running" } }), /display-only/i);
  assert.throws(() => parseJobPatch({ publicMedia: true }), /not an accepted Patch D job mutation/i);
});

test("attention and waiting classification is deterministic from real facts", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");
  const attention = classifyJob(job({
    status: "new_request",
    internal: {
      ...job().internal,
      nextAction: { actor: "owner", action: "Review", dueAt: "2026-08-22", blocker: "Need garment count" },
    },
  }), now);
  assert.equal(attention.attention, true);
  assert.deepEqual(attention.attentionReasons, ["new_request", "overdue_owner_action", "blocker"]);

  const waiting = classifyJob(job({
    status: "needs_information",
    internal: { ...job().internal, nextAction: { actor: "customer", action: "Send sizes" } },
  }), now);
  assert.equal(waiting.waitingOnCustomer, true);
});

test("production and ready/due-next classification does not rely on priority scores", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");
  assert.equal(classifyJob(job({ status: "in_production" }), now).inProduction, true);
  assert.equal(classifyJob(job({ status: "quality_check" }), now).inProduction, true);
  assert.equal(classifyJob(job({ status: "ready" }), now).readyDueNext, true);
  assert.equal(classifyJob(job({
    status: "needs_information",
    internal: { ...job().internal, nextAction: { actor: "supplier", action: "Confirm stock", dueAt: "2026-08-25" } },
  }), now).readyDueNext, true);
});

test("completed and cancelled jobs do not become attention merely from stale facts", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");
  for (const status of ["completed", "cancelled"]) {
    const classified = classifyJob(job({
      status,
      internal: { ...job().internal, nextAction: { actor: "owner", action: "Old task", dueAt: "2026-08-01", blocker: "Old blocker" } },
    }), now);
    assert.equal(classified.attention, false);
  }
});
