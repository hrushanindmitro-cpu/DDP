import assert from "node:assert/strict";
import { isValidGtin, parseProduct, parseCollection, isUuid } from "../lib/validation.mjs";

// GTIN
for (const ok of ["4006381333931", "96385074", "036000291452", "00012345678905"]) assert.ok(isValidGtin(ok), ok);
for (const bad of ["4006381333932", "1234567", "abcdefgh", "", "123456789012345"]) assert.ok(!isValidGtin(bad), bad);

// product
assert.equal(parseProduct({ name: "A" }).error, "name");
assert.equal(parseProduct({ name: "T-shirt", gtin: "123" }).error, "gtin");
assert.equal(parseProduct({ name: "T-shirt", country_of_origin: "XX" }).error, "country");
assert.equal(parseProduct({ name: "T-shirt", hs_code: "61.09" }).error, "hs");
assert.equal(parseProduct({ name: "T-shirt", hs_code: "6109.10", hs_status: "verified" }).error, "hsVerified");
assert.equal(parseProduct({ name: "T-shirt", collection_id: "nope" }).error, "collection");
const ok = parseProduct({ name: " Organic T-shirt ", gtin: "4006 3813 33931", country_of_origin: "tr", hs_code: "6109.10.00", hs_source: "broker", hs_status: "verified", sku: "" });
assert.deepEqual([ok.values.name, ok.values.gtin, ok.values.country_of_origin, ok.values.hs_code, ok.values.sku, ok.values.hs_status],
  ["Organic T-shirt", "4006381333931", "TR", "61091000", null, "verified"]);

// collection
assert.equal(parseCollection({ name: "x" }).error, "name");
assert.equal(parseCollection({ name: "Spring", year: "99" }).error, "year");
assert.equal(parseCollection({ name: "Spring 2025", year: "2025", season: "SS" }).values.year, 2025);
assert.ok(isUuid("123e4567-e89b-12d3-a456-426614174000") && !isUuid("x"));
console.log("validation tests passed");
