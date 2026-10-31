import assert from "node:assert/strict";
import { clampStep, compositionComplete, compositionTotal, parseComposition, parseHeader, parseStage } from "../lib/passport/rules.mjs";
import { hasErrors, runChecks } from "../lib/passport/checks.mjs";

const U = "123e4567-e89b-12d3-a456-426614174000";
// header
assert.equal(parseHeader({ product_id: "x" }).error, "product_id");
assert.equal(parseHeader({ product_id: U, produced_on: "2026-13-01" }).error, "produced_on");
assert.equal(parseHeader({}, { productRequired: false }).values.batch_code, null);
assert.equal(parseHeader({ product_id: U, batch_code: " B-1 " }).values.batch_code, "B-1");
// composition
assert.equal(parseComposition({ fiber: "c", percent: "50" }).error, "fiber");
assert.equal(parseComposition({ fiber: "Cotton", percent: "0" }).error, "percent");
assert.equal(parseComposition({ fiber: "Cotton", percent: "100,5" }).error, "percent");
assert.equal(parseComposition({ fiber: "Cotton", percent: "60,5", recycled: "on", recycled_percent: "120" }).error, "recycled_percent");
const c = parseComposition({ fiber: " Cotton ", percent: "60,5", recycled: "on", recycled_percent: "30" });
assert.deepEqual([c.values.fiber, c.values.percent, c.values.recycled, c.values.recycled_percent], ["Cotton", 60.5, true, 30]);
assert.equal(parseComposition({ fiber: "Cotton", percent: "50", recycled_percent: "30" }).values.recycled_percent, null, "ignored when not recycled");
// totals
const rows = [{ percent: 60.5 }, { percent: 39.5 }];
assert.equal(compositionTotal(rows), 100);
assert.ok(compositionComplete(rows));
assert.ok(!compositionComplete([{ percent: 60 }, { percent: 39.5 }]));
assert.ok(!compositionComplete([]));
assert.ok(compositionComplete([{ percent: 33.33 }, { percent: 33.33 }, { percent: 33.34 }]));
// stages
assert.equal(parseStage({ stage_type: "magic" }).error, "stage_type");
assert.equal(parseStage({ stage_type: "sewing", started_on: "2026-05-02", finished_on: "2026-05-01" }).error, "finished_on");
assert.equal(parseStage({ stage_type: "sewing", site_id: "bad" }).error, "site_id");
assert.equal(parseStage({ stage_type: "sewing" }).values.site_id, null);
assert.equal(clampStep("9", 1), 1);
assert.equal(clampStep("3", 1), 3);

// checks
const base = { product: { country_of_origin: "IT", manufacturer: "X", category: "T-shirt", gtin: "4006381333931", hs_code: "610910", hs_status: "verified" },
  composition: [], stages: [], documents: [], supportedRowIds: new Set(), declaredLots: 0, today: "2026-10-26" };
const codes = (r) => r.map((i) => `${i.severity}:${i.code}`);
let r = runChecks(base);
assert.ok(codes(r).includes("error:composition_empty") && codes(r).includes("warning:no_stages") && codes(r).includes("warning:no_documents"));
assert.ok(hasErrors(r));
r = runChecks({ ...base, product: { ...base.product, country_of_origin: null, manufacturer: null, gtin: null, hs_code: null } });
assert.ok(["error:no_country", "error:no_manufacturer", "recommendation:no_gtin", "recommendation:no_hs"].every((c) => codes(r).includes(c)));
r = runChecks({ ...base, composition: [{ id: "1", fiber: "Cotton", percent: 70 }] });
assert.ok(codes(r).includes("error:composition_sum"));
r = runChecks({ ...base, composition: [{ id: "1", fiber: "Cotton", percent: 100 }], stages: [{}],
  documents: [{ title: "OEKO", valid_until: "2026-01-01", review_status: "verified" }, { title: "GOTS", valid_until: "2026-11-01", review_status: "unverified" }] });
assert.ok(codes(r).includes("error:doc_expired") && codes(r).includes("warning:doc_expiring") && codes(r).includes("warning:doc_unverified"));
assert.ok(codes(r).includes("warning:composition_unsupported"), "manual composition is not confirmed");
r = runChecks({ ...base, composition: [{ id: "1", fiber: "Cotton", percent: 100 }], stages: [{}], supportedRowIds: new Set(["1"]),
  documents: [{ title: "OEKO", valid_until: "2027-06-01", review_status: "verified" }] });
assert.ok(!hasErrors(r) && !codes(r).some((c) => c.startsWith("warning:")), codes(r).join());
console.log("passport tests passed");
