// Declarative description of simple catalog entities. The generic list, form and actions are built from it.
// i18n keys are derived: <i18n>.title/.subtitle/.add/.emptyTitle/.emptyText/.search/.deleted/.new.title/.edit.title/
// .delete/.deleteConfirm, <i18n>.col.<name>, <i18n>.field.<name>, <i18n>.hint.<name> (if hint), <i18n>.opt.<field>.<value>.
const STATUS = ["active", "inactive"];

export const ENTITIES = {
  suppliers: {
    table: "suppliers", base: "/suppliers", i18n: "suppliers", group: "suppliers",
    readPerm: "supplier.read", writePerm: "supplier.manage", feature: "manual_entry", limitKey: "suppliers",
    search: ["name", "contact_name", "email"], order: { col: "name", asc: true },
    columns: ["name", "country", "status", "updated_at"],
    fields: [
      { name: "name", type: "text", required: true, min: 2, max: 200 },
      { name: "country", type: "country" },
      { name: "contact_name", type: "text", max: 200 },
      { name: "email", type: "email", max: 200 },
      { name: "website", type: "url", max: 300, hint: true },
      { name: "status", type: "select", options: STATUS, default: "active" },
      { name: "notes", type: "textarea", max: 2000, hint: true }
    ]
  },
  sites: {
    table: "production_sites", base: "/sites", i18n: "sites", group: "suppliers",
    readPerm: "supplier.read", writePerm: "supplier.manage", feature: "manual_entry", limitKey: null,
    search: ["name", "address"], order: { col: "name", asc: true },
    columns: ["name", "supplier_id", "country", "activity"],
    fields: [
      { name: "name", type: "text", required: true, min: 2, max: 200 },
      { name: "supplier_id", type: "ref", refTable: "suppliers", hint: true },
      { name: "country", type: "country" },
      { name: "activity", type: "select", options: ["spinning", "weaving", "knitting", "dyeing_finishing", "sewing", "other"], default: "other", required: true },
      { name: "address", type: "text", max: 300 },
      { name: "notes", type: "textarea", max: 2000 }
    ]
  },
  materials: {
    table: "materials", base: "/materials", i18n: "materials", group: "suppliers",
    readPerm: "supplier.read", writePerm: "supplier.manage", feature: "manual_entry", limitKey: null,
    search: ["name", "fiber_type"], order: { col: "name", asc: true },
    columns: ["name", "kind", "fiber_type"],
    fields: [
      { name: "name", type: "text", required: true, min: 2, max: 200 },
      { name: "kind", type: "select", options: ["fiber", "yarn", "fabric", "trim", "other"], default: "fiber", required: true },
      { name: "fiber_type", type: "text", max: 120, hint: true },
      { name: "notes", type: "textarea", max: 2000 }
    ]
  },
  lots: {
    table: "lots", base: "/lots", i18n: "lots", group: "suppliers",
    readPerm: "supplier.read", writePerm: "supplier.manage", feature: "manual_entry", limitKey: null,
    search: ["lot_number"], order: { col: "updated_at", asc: false },
    columns: ["lot_number", "material_id", "supplier_id", "quantity", "received_date", "origin_basis"],
    // if the first field is filled, the second is required
    rules: [["quantity", "unit"]],
    fields: [
      { name: "lot_number", type: "text", required: true, min: 1, max: 64 },
      { name: "material_id", type: "ref", refTable: "materials", required: true },
      { name: "supplier_id", type: "ref", refTable: "suppliers" },
      { name: "site_id", type: "ref", refTable: "sites" },
      { name: "quantity", type: "number", max: 99999999999 },
      { name: "unit", type: "select", options: ["kg", "m", "m2", "pcs"] },
      { name: "received_date", type: "date" },
      { name: "origin_country", type: "country" },
      // "document" appears when documents are built; a supplier declaration is never presented as proof
      { name: "origin_basis", type: "select", options: ["supplier_declaration", "verified"], default: "supplier_declaration", required: true, hint: true },
      { name: "notes", type: "textarea", max: 2000 }
    ]
  }
};

// refTable here is an entity key; the real table name is ENTITIES[key].table
export const entityKeys = Object.keys(ENTITIES);
