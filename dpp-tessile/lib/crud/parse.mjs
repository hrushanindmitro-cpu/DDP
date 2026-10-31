import { COUNTRY_CODES, isUuid } from "../validation.mjs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v) => String(v ?? "").trim();

function validUrl(v) {
  try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}
function validDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && +v.slice(0, 4) >= 1950 && +v.slice(0, 4) <= 2100;
}

// Returns { values } or { error: <field name> }.
export function parseEntity(entity, raw) {
  const values = {};
  for (const f of entity.fields) {
    let v = s(raw[f.name]);
    if (f.type === "select" && v === "" && f.default) v = f.default;
    if (v === "") {
      if (f.required) return { error: f.name };
      values[f.name] = null;
      continue;
    }
    switch (f.type) {
      case "text":
      case "textarea":
        if (v.length < (f.min || 0) || v.length > (f.max || 200)) return { error: f.name };
        break;
      case "email":
        if (v.length > (f.max || 200) || !EMAIL.test(v)) return { error: f.name };
        break;
      case "url":
        if (v.length > (f.max || 300) || !validUrl(v)) return { error: f.name };
        break;
      case "country":
        v = v.toUpperCase();
        if (!COUNTRY_CODES.includes(v)) return { error: f.name };
        break;
      case "select":
        if (!f.options.includes(v)) return { error: f.name };
        break;
      case "ref":
        if (!isUuid(v)) return { error: f.name };
        break;
      case "number": {
        const n = Number(v.replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > (f.max || 1e11)) return { error: f.name };
        v = Math.round(n * 1000) / 1000;
        break;
      }
      case "date":
        if (!validDate(v)) return { error: f.name };
        break;
      default:
        return { error: f.name };
    }
    values[f.name] = v;
  }
  for (const [ifField, thenField] of entity.rules || []) {
    if (values[ifField] !== null && values[thenField] === null) return { error: thenField };
  }
  return { values };
}
