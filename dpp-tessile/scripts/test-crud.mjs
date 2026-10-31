import assert from "node:assert/strict";
import { ENTITIES } from "../lib/crud/entities.mjs";
import { parseEntity } from "../lib/crud/parse.mjs";

const U = "123e4567-e89b-12d3-a456-426614174000";
const p = (k, raw) => parseEntity(ENTITIES[k], raw);

// suppliers
assert.equal(p("suppliers", { name: "A" }).error, "name");
assert.equal(p("suppliers", { name: "Cotton Co", email: "bad" }).error, "email");
assert.equal(p("suppliers", { name: "Cotton Co", website: "ftp://x" }).error, "website");
assert.equal(p("suppliers", { name: "Cotton Co", country: "XX" }).error, "country");
assert.equal(p("suppliers", { name: "Cotton Co", status: "weird" }).error, "status");
const sup = p("suppliers", { name: " Cotton Co ", country: "tr", email: "a@b.co", website: "https://b.co" });
assert.deepEqual([sup.values.name, sup.values.country, sup.values.status, sup.values.notes], ["Cotton Co", "TR", "active", null]);

// sites / materials defaults
assert.equal(p("sites", { name: "Plant 1" }).values.activity, "other");
assert.equal(p("sites", { name: "Plant 1", supplier_id: "nope" }).error, "supplier_id");
assert.equal(p("materials", { name: "Organic cotton" }).values.kind, "fiber");

// lots
assert.equal(p("lots", { lot_number: "L1" }).error, "material_id");
assert.equal(p("lots", { lot_number: "L1", material_id: U, quantity: "10" }).error, "unit");
assert.equal(p("lots", { lot_number: "L1", material_id: U, quantity: "-1", unit: "kg" }).error, "quantity");
assert.equal(p("lots", { lot_number: "L1", material_id: U, received_date: "2025-02-30" }).error, "received_date");
assert.equal(p("lots", { lot_number: "L1", material_id: U, origin_basis: "document" }).error, "origin_basis");
const lot = p("lots", { lot_number: "L1", material_id: U, quantity: "12,5", unit: "kg", received_date: "2025-03-01" });
assert.deepEqual([lot.values.quantity, lot.values.origin_basis, lot.values.supplier_id], [12.5, "supplier_declaration", null]);
console.log("crud tests passed");
