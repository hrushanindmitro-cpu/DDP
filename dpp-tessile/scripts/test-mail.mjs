import assert from "node:assert/strict";
import { buildOperatorEmail } from "../lib/mail-templates.mjs";
import { safeCallbackNext } from "../lib/auth/next.mjs";

const when = new Date("2026-10-28T09:30:00Z");
const m = buildOperatorEmail({ orgId: "abc", orgName: "Tessile SRL", country: "UA", ownerName: "Anna", ownerEmail: "a@b.co", promoPending: true, when });
assert.match(m.subject, /UA2026/);
for (const s of ["Организация: Tessile SRL", "Страна: UA", "Владелец: Anna <a@b.co>", "Время (UTC): 2026-10-28 09:30", "Скидка UA2026"]) assert.ok(m.text.includes(s), s);
const plain = buildOperatorEmail({ orgId: "abc", orgName: "X Y", country: null, ownerName: "A", ownerEmail: "a@b.co", promoPending: false, when });
assert.ok(!plain.subject.includes("UA2026") && !plain.text.includes("Скидка") && plain.text.includes("Страна: —"));
// user-typed values cannot break lines or add fake rows
const evil = buildOperatorEmail({ orgId: "1", orgName: "Evil\r\nBcc: x@y.z\nСкидка UA2026: ok", country: "UA", ownerName: "n", ownerEmail: "e@e.ee", when });
assert.equal(evil.text.split("\n").filter((l) => l.startsWith("Bcc:") || l.startsWith("Скидка UA2026")).length, 0);
assert.equal(evil.text.trim().split("\n").length, 5);

assert.equal(safeCallbackNext("/reset-password"), "/reset-password");
for (const bad of ["//evil.com", "https://evil.com", "/settings", "", null, "/reset-password/../x"]) assert.equal(safeCallbackNext(bad), "/", String(bad));
console.log("mail tests passed");
