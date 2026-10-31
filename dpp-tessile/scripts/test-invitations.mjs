import assert from "node:assert/strict";
import { hashToken, isInviteToken, newToken, parseInvite, safeNext } from "../lib/invitations.mjs";

const { token, hash } = newToken();
assert.ok(isInviteToken(token), "43 url-safe characters");
assert.match(hash, /^[0-9a-f]{64}$/);
assert.equal(hashToken(token), hash);
assert.notEqual(newToken().token, token);
assert.ok(!isInviteToken("short") && !isInviteToken(token + "x") && !isInviteToken("../" + token.slice(3)));

assert.equal(parseInvite({ email: "nope", role: "employee" }).error, "email");
assert.equal(parseInvite({ email: "a@b.co", role: "owner" }).error, "role");
assert.equal(parseInvite({ email: "a@b.co", role: "admin" }).error, "role", "only the owner may invite an admin");
assert.equal(parseInvite({ email: "a@b.co", role: "admin" }, { isOwner: true }).values.role, "admin");
assert.deepEqual(parseInvite({ email: "  Anna@Example.COM ", role: "approver" }).values, { email: "anna@example.com", role: "approver" });

// redirects after sign in cannot leave the site
assert.equal(safeNext(`/invite/${token}`), `/invite/${token}`);
for (const bad of ["//evil.com", "https://evil.com", "/settings", "/invite/x", `/invite/${token}/../..`, "", null]) assert.equal(safeNext(bad), null, String(bad));
console.log("invitation tests passed");
