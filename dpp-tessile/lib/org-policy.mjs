// Who compiles and who approves passports. Pure rules, covered by `npm test`.
export const APPROVAL_MODES = ["same_person", "separate"];

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

// raw: { approval_mode, responsible_name, compiler_name, approver_name }
// Returns { values } or { error: "mode" | "responsible" | "compiler" | "approver" | "same" }.
export function parsePolicy(raw) {
  const mode = clean(raw.approval_mode);
  if (!APPROVAL_MODES.includes(mode)) return { error: "mode" };
  const okName = (n) => n.length >= 2 && n.length <= 200;
  if (mode === "same_person") {
    const responsible = clean(raw.responsible_name);
    if (!okName(responsible)) return { error: "responsible" };
    return { values: { approval_mode: mode, responsible_name: responsible, compiler_name: null, approver_name: null } };
  }
  const compiler = clean(raw.compiler_name);
  const approver = clean(raw.approver_name);
  if (!okName(compiler)) return { error: "compiler" };
  if (!okName(approver)) return { error: "approver" };
  if (compiler.toLowerCase() === approver.toLowerCase()) return { error: "same" };
  return { values: { approval_mode: mode, responsible_name: null, compiler_name: compiler, approver_name: approver } };
}

// Mirrors public.can_approve_passport(): permission first, then the separation rule.
export function canApprove({ mode, userId, creatorId, submitterId, hasApprovePermission }) {
  if (!hasApprovePermission) return false;
  if (mode === "same_person") return true;
  return userId !== creatorId && userId !== submitterId;
}

// Name shown as the person who will approve (for the passport summary).
export function approverLabel(policy) {
  if (!policy) return null;
  return policy.approval_mode === "separate" ? policy.approver_name : policy.responsible_name;
}
