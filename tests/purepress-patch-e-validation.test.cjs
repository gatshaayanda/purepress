const test = require("node:test");
const assert = require("node:assert/strict");
const { PUREPRESS_QUOTE_CURRENCY, PUREPRESS_QUOTE_LINE_CATEGORIES, calculateQuoteTotals, calculatePercentageTaxMinor, lineTotalMinor, parseQuoteDraftInput, publicQuoteView, formatBwp } = require("../.test-dist-purepress-e/quotation.js");
function draft(overrides={}){return{lineItems:[{id:"emb-1",category:"embroidery",description:"Left chest embroidery",quantity:10,unitPriceMinor:12550}],discountMinor:0,tax:{mode:"none"},validUntil:"2026-09-15",customerVisibleNotes:"Thank you for considering PurePress.",...overrides};}
function quote(overrides={}){const input=parseQuoteDraftInput(draft());const totals=calculateQuoteTotals(input.lineItems,input.discountMinor,input.tax);return{id:"quote-internal-id",projectId:"project-internal-id",quoteNumber:"PPQ-20260823-A1B2C3D4",revision:1,currency:"BWP",status:"issued",customerSnapshot:{displayName:"Test Customer",email:"customer@example.com"},jobSnapshot:{referenceCode:"PPJ-20260823-ABCD1234",itemSummary:"Black polos",quantity:10,supplySource:"customer_supplied",customerRequestedDate:"2026-09-10"},lineItems:totals.lineItems,subtotalMinor:totals.subtotalMinor,discountMinor:totals.discountMinor,tax:input.tax,taxMinor:totals.taxMinor,totalMinor:totals.totalMinor,validUntil:input.validUntil,customerVisibleNotes:input.customerVisibleNotes,internalNotes:"OWNER ONLY",createdAt:"2026-08-23T12:00:00.000Z",updatedAt:"2026-08-23T12:00:00.000Z",issuedAt:"2026-08-23T12:00:00.000Z",approval:{tokenHash:"a".repeat(64),issuedAt:"2026-08-23T12:00:00.000Z",expiresAt:"2026-09-15T21:59:59.999Z"},...overrides};}
test("BWP is the explicit quotation currency",()=>assert.equal(PUREPRESS_QUOTE_CURRENCY,"BWP"));
test("quotation lines use embroidery-shop categories",()=>assert.deepEqual([...PUREPRESS_QUOTE_LINE_CATEGORIES],["garment","embroidery","digitising","design","delivery","other"]));
test("line totals use integer minor units",()=>assert.equal(lineTotalMinor(3,12550),37650));
test("zero quantity is rejected",()=>assert.throws(()=>lineTotalMinor(0,100),/quantity/i));
test("excessive quantity is rejected",()=>assert.throws(()=>lineTotalMinor(100001,100),/quantity/i));
test("negative unit price is rejected",()=>assert.throws(()=>lineTotalMinor(1,-1),/unitPriceMinor/i));
test("fractional minor-unit prices are rejected",()=>assert.throws(()=>lineTotalMinor(1,10.5),/unitPriceMinor/i));
test("unreasonably large unit prices are rejected",()=>assert.throws(()=>lineTotalMinor(1,100000001),/unitPriceMinor/i));
test("multiple line subtotals are deterministic",()=>{const r=calculateQuoteTotals([{category:"garment",description:"Polo",quantity:2,unitPriceMinor:10000},{category:"embroidery",description:"Logo",quantity:2,unitPriceMinor:2500}],0,{mode:"none"});assert.equal(r.subtotalMinor,25000);assert.equal(r.totalMinor,25000);});
test("quote-level discount is subtracted in minor units",()=>{const r=calculateQuoteTotals(draft().lineItems,550,{mode:"none"});assert.equal(r.totalMinor,125500-550);});
test("discount cannot make a quote negative",()=>assert.throws(()=>calculateQuoteTotals(draft().lineItems,200000,{mode:"none"}),/cannot exceed/i));
test("tax is zero when owner did not configure it",()=>assert.equal(calculateQuoteTotals(draft().lineItems,0,{mode:"none"}).taxMinor,0));
test("percentage tax uses deterministic basis-point arithmetic",()=>assert.equal(calculatePercentageTaxMinor(10005,1250),1251));
test("zero tax percentage is rejected",()=>assert.throws(()=>calculatePercentageTaxMinor(10000,0),/taxRateBps/i));
test("tax percentage above 100 percent is rejected",()=>assert.throws(()=>calculatePercentageTaxMinor(10000,10001),/taxRateBps/i));
test("unknown quotation draft fields are rejected",()=>assert.throws(()=>parseQuoteDraftInput(draft({invoiceNumber:"INV-1"})),/not an accepted quotation draft/i));
test("unknown line item fields are rejected",()=>assert.throws(()=>parseQuoteDraftInput(draft({lineItems:[{category:"other",description:"x",quantity:1,unitPriceMinor:100,secret:true}]})),/not accepted/i));
test("strict calendar dates are enforced",()=>assert.throws(()=>parseQuoteDraftInput(draft({validUntil:"15-09-2026"})),/YYYY-MM-DD/i));
test("customer requested date cannot be supplied as a quote promise field",()=>assert.throws(()=>parseQuoteDraftInput(draft({requestedDate:"2026-09-10"})),/not an accepted quotation draft/i));
test("valid percentage tax is normalized without hardcoding a tax label",()=>assert.deepEqual(parseQuoteDraftInput(draft({tax:{mode:"percentage",taxRateBps:1400}})).tax,{mode:"percentage",taxRateBps:1400}));
test("public quote projection excludes project ID internal notes approval hash",()=>{const v=publicQuoteView(quote(),"2026-08-24");assert.equal(Object.hasOwn(v,"projectId"),false);assert.equal(Object.hasOwn(v,"internalNotes"),false);assert.equal(Object.hasOwn(v,"approval"),false);});
test("expired issued quote cannot expose decision actions",()=>{const v=publicQuoteView(quote({validUntil:"2026-08-20"}),"2026-08-24");assert.equal(v.state,"expired");assert.equal(v.canAccept,false);assert.equal(v.canRequestChanges,false);});
test("accepted projection records accepted state and no further actions",()=>{const v=publicQuoteView(quote({status:"accepted",decision:{type:"accepted",source:"secure_link",revision:1,decidedAt:"2026-08-24T10:00:00Z"}}),"2026-08-24");assert.equal(v.state,"accepted");assert.equal(v.canAccept,false);});
test("BWP formatting preserves thebe",()=>assert.equal(formatBwp(12550),"P 125.50"));
