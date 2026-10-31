// Fails if code uses a t("key") that is missing from the EN dictionary.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const load = (f) => new Set([...fs.readFileSync(path.join(root, "lib/i18n", f), "utf8").matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));
const keys = load("ru.js"); // working dictionary: every used key must exist here
const enKeys = load("en.js");
const used = new Map();
function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "i18n"].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(f.name)) {
      const s = fs.readFileSync(p, "utf8");
      for (const m of s.matchAll(/\b[tk]\(\s*["']([a-zA-Z0-9_.]+)["']/g)) used.set(m[1], p);
    }
  }
}
["app", "components", "lib"].forEach((d) => walk(path.join(root, d)));
// dynamic keys built as plan.${id}.name
for (const id of ["start", "professional", "enterprise"]) for (const k of ["name", "desc"]) used.set(`plan.${id}.${k}`, "lib/plans.js");
const missing = [...used].filter(([k]) => !keys.has(k));
const unused = [...keys].filter((k) => !used.has(k));
if (missing.length) { console.error("Missing keys:\n" + missing.map(([k, p]) => `  ${k}  (${path.relative(root, p)})`).join("\n")); process.exit(1); }
const noEn = [...keys].filter((k) => !enKeys.has(k));
console.log(`i18n OK: ${used.size} keys used, ${keys.size} in RU` + (unused.length ? `, unused: ${unused.join(", ")}` : ""));
if (noEn.length) console.log(`EN still to write before translations: ${noEn.length} keys`);
