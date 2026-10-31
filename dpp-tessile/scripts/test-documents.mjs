import assert from "node:assert/strict";
import {
  checkFileMeta, containsMacro, expiryState, parseDocument, parseLinkTarget, parseReview, safeFileName, sniffKind, verifyContent
} from "../lib/documents/rules.mjs";

const bytes = (...a) => Uint8Array.from([...a, ...new Array(16).fill(0)]);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d), PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04), EXE = bytes(0x4d, 0x5a, 0x90, 0x00);

// pre-upload checks
assert.equal(checkFileMeta({ name: "cert.pdf", size: 1000 }).mime, "application/pdf");
assert.equal(checkFileMeta({ name: "run.exe", size: 1000 }).error, "type");
assert.equal(checkFileMeta({ name: "macro.xlsm", size: 1000 }).error, "type");
assert.equal(checkFileMeta({ name: "noext", size: 1000 }).error, "type");
assert.equal(checkFileMeta({ name: "a.pdf", size: 0 }).error, "size");
assert.equal(checkFileMeta({ name: "a.pdf", size: 21 * 1024 * 1024 }).error, "size");
assert.equal(checkFileMeta({ name: "SCAN.JPG", size: 5 }).ext, "jpg");

// real content must match the extension
assert.equal(sniffKind(PDF), "pdf");
assert.ok(verifyContent("pdf", PDF));
assert.ok(!verifyContent("pdf", PNG), "png renamed to pdf");
assert.ok(!verifyContent("pdf", EXE), "exe renamed to pdf");
assert.ok(verifyContent("xlsx", ZIP));
assert.ok(!verifyContent("xlsx", PDF));
const macroZip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, ...Buffer.from("xl/vbaProject.bin"), 0, 0, 0, 0]);
assert.ok(containsMacro(macroZip) && !verifyContent("xlsx", macroZip), "macro-enabled office file");

assert.equal(safeFileName('a/b\\c:"d".pdf'), "a_b_c_d_.pdf");
assert.equal(safeFileName("   "), "file");

// expiry
assert.equal(expiryState(null, "2026-10-26"), "none");
assert.equal(expiryState("2026-10-25", "2026-10-26"), "expired");
assert.equal(expiryState("2026-10-26", "2026-10-26"), "soon");
assert.equal(expiryState("2026-11-25", "2026-10-26"), "soon");
assert.equal(expiryState("2026-11-26", "2026-10-26"), "ok");

// metadata
assert.equal(parseDocument({ title: "x" }).error, "title");
assert.equal(parseDocument({ title: "OEKO-TEX", doc_type: "visa" }).error, "doc_type");
assert.equal(parseDocument({ title: "OEKO-TEX", issued_date: "2026-02-30" }).error, "issued_date");
assert.equal(parseDocument({ title: "OEKO-TEX", issued_date: "2026-05-01", valid_until: "2026-04-01" }).error, "dates");
const d = parseDocument({ title: " OEKO-TEX 100 ", doc_type: "certificate", valid_until: "2027-01-31" });
assert.deepEqual([d.values.title, d.values.doc_type, d.values.issued_date, d.values.valid_until], ["OEKO-TEX 100", "certificate", null, "2027-01-31"]);
assert.equal(parseReview({ review_status: "approved" }).error, "status");
assert.equal(parseReview({ review_status: "verified", review_note: "ok" }).values.review_status, "verified");
assert.deepEqual(parseLinkTarget("lot:123e4567-e89b-12d3-a456-426614174000"), { type: "lot", id: "123e4567-e89b-12d3-a456-426614174000" });
assert.equal(parseLinkTarget("user:123e4567-e89b-12d3-a456-426614174000"), null);
assert.equal(parseLinkTarget("lot:nope"), null);
console.log("documents tests passed");
