const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseQuoteRequestSubmission,
  SUPPLY_SOURCES,
} = require("../.test-dist-purepress-c/quoteIntake.js");

function valid(overrides = {}) {
  return {
    itemCategory: "corporate_uniforms",
    supplySource: "customer_supplied",
    quantity: 25,
    placements: [
      { position: "left_chest" },
      { position: "sleeve", notes: "right sleeve" },
    ],
    artworkState: "artwork_ready",
    artworkFileIds: [],
    requestedDate: "2026-09-15",
    timingFlexible: false,
    contact: {
      fullName: "  Test   Customer ",
      organisation: " Test School ",
      email: " TEST@Example.COM ",
      phone: "+267 71 234 567",
      preferredContactMethod: "whatsapp",
    },
    fulfillmentIntent: "collect",
    customerNotes: "  Please call before collection.  ",
    processingAcknowledged: true,
    ...overrides,
  };
}

test("valid anonymous quote input is normalized without inventing operational fields", () => {
  const parsed = parseQuoteRequestSubmission(valid());
  assert.equal(parsed.contact.fullName, "Test Customer");
  assert.equal(parsed.contact.email, "test@example.com");
  assert.equal(parsed.contact.phone, "+26771234567");
  assert.equal(parsed.supplySource, "customer_supplied");
  assert.equal(parsed.placements.length, 2);
  assert.equal(parsed.requestedDate, "2026-09-15");
  assert.equal(Object.hasOwn(parsed, "promisedDate"), false);
  assert.equal(Object.hasOwn(parsed, "status"), false);
});

test("all four supply sources remain distinct and invalid values are rejected", () => {
  assert.deepEqual([...SUPPLY_SOURCES], ["customer_supplied", "purepress_supplied", "mixed", "unknown"]);
  for (const supplySource of SUPPLY_SOURCES) {
    assert.equal(parseQuoteRequestSubmission(valid({ supplySource })).supplySource, supplySource);
  }
  assert.throws(() => parseQuoteRequestSubmission(valid({ supplySource: "stockroom" })), /invalid value/i);
});

test("browser cannot spoof lifecycle, identity, internal or readiness fields", () => {
  for (const field of ["status", "source", "referenceCode", "customerUid", "internal", "readiness", "adminNotes", "productionDueDate", "published"]) {
    assert.throws(
      () => parseQuoteRequestSubmission(valid({ [field]: field === "status" ? "completed" : "spoofed" })),
      /server-controlled/i,
    );
  }
});


test("unknown browser fields are rejected instead of silently ignored", () => {
  assert.throws(() => parseQuoteRequestSubmission(valid({ surpriseField: "x" })), /not an accepted quote intake field/i);
  assert.throws(
    () => parseQuoteRequestSubmission(valid({ contact: { ...valid().contact, role: "admin" } })),
    /contact\.role.*not an accepted/i,
  );
  assert.throws(
    () => parseQuoteRequestSubmission(valid({ placements: [{ position: "left_chest", internal: "x" }] })),
    /placements\[0\]\.internal.*not an accepted/i,
  );
});

test("quantity, requested timing and placement bounds are enforced", () => {
  assert.throws(() => parseQuoteRequestSubmission(valid({ quantity: 0 })), /quantity/i);
  assert.throws(() => parseQuoteRequestSubmission(valid({ quantity: 100001 })), /quantity/i);
  assert.throws(() => parseQuoteRequestSubmission(valid({ requestedDate: "15-09-2026" })), /YYYY-MM-DD/i);
  assert.throws(() => parseQuoteRequestSubmission(valid({ placements: [] })), /1 and 8/i);
  assert.throws(() => parseQuoteRequestSubmission(valid({ placements: [{ position: "machine_slot" }] })), /invalid value/i);
});

test("flexible timing does not require a requested date", () => {
  const parsed = parseQuoteRequestSubmission(valid({ requestedDate: "", timingFlexible: true }));
  assert.equal(parsed.timingFlexible, true);
  assert.equal(parsed.requestedDate, undefined);
});

test("artwork references are bounded and processing acknowledgement is required", () => {
  assert.throws(() => parseQuoteRequestSubmission(valid({ artworkFileIds: ["1", "2", "3", "4"] })), /at most 3/i);
  assert.throws(() => parseQuoteRequestSubmission(valid({ processingAcknowledged: false })), /confirm PurePress/i);
});

test("phone is required when customer preference is phone or WhatsApp", () => {
  assert.throws(() => parseQuoteRequestSubmission(valid({ contact: { ...valid().contact, phone: "", preferredContactMethod: "phone" } })), /Phone is required/i);
  assert.doesNotThrow(() => parseQuoteRequestSubmission(valid({ contact: { ...valid().contact, phone: "", preferredContactMethod: "email" } })));
});
