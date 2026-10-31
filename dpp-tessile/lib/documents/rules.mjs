// Pure rules for documents and files. No framework imports, so they are covered by `npm test`.
import { isUuid } from "../validation.mjs";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const DOC_TYPES = ["certificate", "lab_report", "invoice", "contract", "declaration", "other"];
export const REVIEW_STATUSES = ["unverified", "verified", "rejected"];
export const LINK_TYPES = ["product", "supplier", "lot", "site", "material", "passport"];
export const EXPIRY_WARNING_DAYS = 30;

const OOXML = "application/vnd.openxmlformats-officedocument.";
export const FILE_TYPES = {
  pdf:  { mime: "application/pdf", kind: "pdf" },
  jpg:  { mime: "image/jpeg", kind: "jpeg" },
  jpeg: { mime: "image/jpeg", kind: "jpeg" },
  png:  { mime: "image/png", kind: "png" },
  webp: { mime: "image/webp", kind: "webp" },
  xlsx: { mime: OOXML + "spreadsheetml.sheet", kind: "zip" },
  docx: { mime: OOXML + "wordprocessingml.document", kind: "zip" },
  xls:  { mime: "application/vnd.ms-excel", kind: "ole" }
};

export function extensionOf(name) {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || "").trim());
  return m ? m[1].toLowerCase() : "";
}

export function safeFileName(name) {
  const cleaned = String(name || "").replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 255);
  return cleaned || "file";
}

// Cheap checks done before upload. Returns { ext, mime } or { error: "type" | "size" }.
export function checkFileMeta({ name, size }) {
  const ext = extensionOf(name);
  if (!Object.prototype.hasOwnProperty.call(FILE_TYPES, ext)) return { error: "type" };
  if (!Number.isFinite(size) || size < 1 || size > MAX_FILE_BYTES) return { error: "size" };
  return { ext, mime: FILE_TYPES[ext].mime };
}

const startsWith = (b, sig, offset = 0) => sig.every((v, i) => b[offset + i] === v);

// Detects the real kind from the first bytes, ignoring the name and the declared type.
export function sniffKind(b) {
  if (!b || b.length < 12) return null;
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  return null;
}

// Office files that carry macros contain a vbaProject part.
export function containsMacro(bytes) {
  return Buffer.from(bytes).includes("vbaProject");
}

// Full content check done on the server after upload.
export function verifyContent(ext, bytes) {
  const type = FILE_TYPES[ext];
  if (!type || sniffKind(bytes) !== type.kind) return false;
  if (type.kind === "zip" && containsMacro(bytes)) return false;
  return true;
}

const dateOk = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && +v.slice(0, 4) >= 1950 && +v.slice(0, 4) <= 2100;
};

// "none" | "expired" | "soon" | "ok". Dates are plain YYYY-MM-DD strings.
export function expiryState(validUntil, today = new Date().toISOString().slice(0, 10)) {
  if (!validUntil) return "none";
  if (validUntil < today) return "expired";
  const limit = new Date(today + "T00:00:00Z");
  limit.setUTCDate(limit.getUTCDate() + EXPIRY_WARNING_DAYS);
  return validUntil <= limit.toISOString().slice(0, 10) ? "soon" : "ok";
}

export const addDays = (today, days) => {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const s = (v) => String(v ?? "").trim();
const orNull = (v) => (v === "" ? null : v);

// Returns { values } or { error: "title" | "doc_type" | "issuer" | "issued_date" | "valid_until" | "dates" | "notes" }.
export function parseDocument(raw) {
  const title = s(raw.title);
  if (title.length < 2 || title.length > 200) return { error: "title" };
  const docType = s(raw.doc_type) || "other";
  if (!DOC_TYPES.includes(docType)) return { error: "doc_type" };
  const issuer = s(raw.issuer);
  if (issuer.length > 200) return { error: "issuer" };
  const issued = s(raw.issued_date);
  const valid = s(raw.valid_until);
  if (issued && !dateOk(issued)) return { error: "issued_date" };
  if (valid && !dateOk(valid)) return { error: "valid_until" };
  if (issued && valid && valid < issued) return { error: "dates" };
  const notes = s(raw.notes);
  if (notes.length > 2000) return { error: "notes" };
  return { values: { title, doc_type: docType, issuer: orNull(issuer), issued_date: orNull(issued), valid_until: orNull(valid), notes: orNull(notes) } };
}

export function parseReview(raw) {
  const status = s(raw.review_status);
  if (!REVIEW_STATUSES.includes(status)) return { error: "status" };
  const note = s(raw.review_note);
  if (note.length > 500) return { error: "note" };
  return { values: { review_status: status, review_note: orNull(note) } };
}

// "product:<uuid>" -> { type, id } or null
export function parseLinkTarget(value) {
  const [type, id] = String(value || "").split(":");
  return LINK_TYPES.includes(type) && isUuid(id) ? { type, id } : null;
}
