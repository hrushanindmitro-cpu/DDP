import assert from "node:assert/strict";
import { isValidEdrpou, normalizeRegistryId } from "../lib/ua.mjs";

// real, publicly known company codes
for (const ok of ["14360570", "20077720", "00100227", "40081216"]) assert.ok(isValidEdrpou(ok), ok);
for (const bad of ["14360571", "2007772", "abcdefgh", "", "123456789"]) assert.ok(!isValidEdrpou(bad), bad);
assert.equal(normalizeRegistryId(" 1436 0570-"), "14360570");

// UA2026 price list given by the owner (30% off, rounded)
const base = { lite: 49, base: 99, factory: 149, export: 199 };
const ua = { lite: 35, base: 69, factory: 104, export: 139 };
for (const k of Object.keys(base)) assert.ok(Math.abs(base[k] * 0.7 - ua[k]) < 1, `${k}: ${base[k] * 0.7} vs ${ua[k]}`);
console.log("ua tests passed");
