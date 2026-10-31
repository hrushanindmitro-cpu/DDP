// Pure rules for the passport wizard. Covered by `npm test`.
import { isUuid } from "../validation.mjs";

export const STAGE_TYPES = ["raw_material", "spinning", "weaving_knitting", "dyeing_finishing", "sewing", "other"];
export const PASSPORT_STATUSES = ["draft", "in_review", "approved", "published", "unpublished"];
export const STEPS = [1, 2, 3, 4, 5];
export const COMPOSITION_TOLERANCE = 0.01;

const s = (v) => String(v ?? "").trim();
const orNull = (v) => (v === "" ? null : v);
const round2 = (n) => Math.round(n * 100) / 100;
const dateOk = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && +v.slice(0, 4) >= 1950 && +v.slice(0, 4) <= 2100;
};
function percent(v) {
  const n = Number(s(v).replace(",", "."));
  return Number.isFinite(n) ? round2(n) : NaN;
}

export const clampStep = (v, fallback = 1) => {
  const n = parseInt(v, 10);
  return STEPS.includes(n) ? n : fallback;
};

// create / step 1. productRequired is false when editing an existing passport.
export function parseHeader(raw, { productRequired = true } = {}) {
  const values = {};
  if (productRequired) {
    if (!isUuid(s(raw.product_id))) return { error: "product_id" };
    values.product_id = s(raw.product_id);
  }
  const batch = s(raw.batch_code);
  if (batch.length > 64) return { error: "batch_code" };
  const produced = s(raw.produced_on);
  if (produced && !dateOk(produced)) return { error: "produced_on" };
  return { values: { ...values, batch_code: orNull(batch), produced_on: orNull(produced) } };
}

// step 2 row
export function parseComposition(raw) {
  const fiber = s(raw.fiber);
  if (fiber.length < 2 || fiber.length > 120) return { error: "fiber" };
  const pct = percent(raw.percent);
  if (!(pct > 0 && pct <= 100)) return { error: "percent" };
  const recycled = ["on", "true", "1"].includes(s(raw.recycled));
  let recycledPct = null;
  if (recycled && s(raw.recycled_percent) !== "") {
    recycledPct = percent(raw.recycled_percent);
    if (!(recycledPct >= 0 && recycledPct <= 100)) return { error: "recycled_percent" };
  }
  for (const k of ["material_id", "lot_id"]) if (s(raw[k]) && !isUuid(s(raw[k]))) return { error: k };
  return { values: { fiber, percent: pct, recycled, recycled_percent: recycledPct, material_id: orNull(s(raw.material_id)), lot_id: orNull(s(raw.lot_id)) } };
}

// step 3 stage
export function parseStage(raw) {
  const type = s(raw.stage_type);
  if (!STAGE_TYPES.includes(type)) return { error: "stage_type" };
  for (const k of ["site_id", "supplier_id", "lot_id"]) if (s(raw[k]) && !isUuid(s(raw[k]))) return { error: k };
  const started = s(raw.started_on), finished = s(raw.finished_on);
  if (started && !dateOk(started)) return { error: "started_on" };
  if (finished && !dateOk(finished)) return { error: "finished_on" };
  if (started && finished && finished < started) return { error: "finished_on" };
  const notes = s(raw.notes);
  if (notes.length > 1000) return { error: "notes" };
  return { values: { stage_type: type, site_id: orNull(s(raw.site_id)), supplier_id: orNull(s(raw.supplier_id)), lot_id: orNull(s(raw.lot_id)),
    started_on: orNull(started), finished_on: orNull(finished), notes: orNull(notes) } };
}

export const compositionTotal = (rows) => round2(rows.reduce((sum, r) => sum + Number(r.percent || 0), 0));
export const compositionComplete = (rows) => rows.length > 0 && Math.abs(compositionTotal(rows) - 100) <= COMPOSITION_TOLERANCE;
