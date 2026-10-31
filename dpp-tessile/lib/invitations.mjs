// Pure rules for invitations. The secret token never leaves the server except in the link shown once.
import { createHash, randomBytes } from "node:crypto";

export const INVITE_ROLES = ["admin", "employee", "passport_author", "document_specialist", "approver", "auditor", "supplier"];
export const INVITE_DAYS = 7;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const isInviteToken = (v) => TOKEN.test(String(v || ""));
export const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");
export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

// Returns { values } or { error: "email" | "role" }. The owner role cannot be invited; admin only by the owner (checked in the database too).
export function parseInvite(raw, { isOwner = false } = {}) {
  const email = String(raw.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return { error: "email" };
  const role = String(raw.role ?? "").trim();
  if (!INVITE_ROLES.includes(role) || (role === "admin" && !isOwner)) return { error: "role" };
  return { values: { email, role } };
}

// Where to go after sign in: only an invitation link, never an arbitrary address.
export function safeNext(value) {
  const v = String(value || "");
  const m = /^\/invite\/([A-Za-z0-9_-]{43})$/.exec(v);
  return m ? v : null;
}
