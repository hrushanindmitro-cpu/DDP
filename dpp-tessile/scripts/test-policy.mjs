import assert from "node:assert/strict";
import { approverLabel, canApprove, parsePolicy } from "../lib/org-policy.mjs";

assert.equal(parsePolicy({ approval_mode: "x" }).error, "mode");
assert.equal(parsePolicy({ approval_mode: "same_person", responsible_name: "A" }).error, "responsible");
const same = parsePolicy({ approval_mode: "same_person", responsible_name: "  Іваненко   Олена  ", compiler_name: "ignored" });
assert.deepEqual(same.values, { approval_mode: "same_person", responsible_name: "Іваненко Олена", compiler_name: null, approver_name: null });
assert.equal(parsePolicy({ approval_mode: "separate", compiler_name: "Rossi Anna" }).error, "approver");
assert.equal(parsePolicy({ approval_mode: "separate", approver_name: "Rossi Anna" }).error, "compiler");
assert.equal(parsePolicy({ approval_mode: "separate", compiler_name: "Rossi Anna", approver_name: "rossi  anna" }).error, "same");
const sep = parsePolicy({ approval_mode: "separate", compiler_name: "Rossi Anna", approver_name: "Bianchi Luca", responsible_name: "x" });
assert.deepEqual(sep.values, { approval_mode: "separate", responsible_name: null, compiler_name: "Rossi Anna", approver_name: "Bianchi Luca" });

// separation of duties
const base = { userId: "u1", creatorId: "u1", submitterId: "u1", hasApprovePermission: true };
assert.equal(canApprove({ ...base, mode: "same_person" }), true);
assert.equal(canApprove({ ...base, mode: "separate" }), false, "creator cannot approve");
assert.equal(canApprove({ ...base, mode: "separate", creatorId: "u2" }), false, "submitter cannot approve");
assert.equal(canApprove({ ...base, mode: "separate", creatorId: "u2", submitterId: "u3" }), true);
assert.equal(canApprove({ ...base, mode: "same_person", hasApprovePermission: false }), false, "permission is always required");
assert.equal(approverLabel({ approval_mode: "separate", approver_name: "B", responsible_name: null }), "B");
assert.equal(approverLabel({ approval_mode: "same_person", responsible_name: "R" }), "R");
console.log("policy tests passed");
