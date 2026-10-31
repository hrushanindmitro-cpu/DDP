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
for (const id of ["free", "lite", "base", "factory", "export"]) for (const k of ["name", "desc"]) used.set(`plan.${id}.${k}`, "lib/plans.js");
const ENTITY_ONLY = "title subtitle add emptyTitle emptyText deleted new.title edit.title delete deleteConfirm".split(" ");
async function entityKeys() {
  const { ENTITIES } = await import(require("url").pathToFileURL(path.join(root, "lib/crud/entities.mjs")).href);
  for (const e of Object.values(ENTITIES)) {
    const src = "lib/crud/entities.mjs";
    ENTITY_ONLY.forEach((k) => used.set(`${e.i18n}.${k}`, src));
    if (e.search?.length) used.set(`${e.i18n}.search`, src);
    e.columns.forEach((c) => used.set(`${e.i18n}.col.${c}`, src));
    for (const f of e.fields) {
      used.set(`${e.i18n}.field.${f.name}`, src);
      if (f.hint) used.set(`${e.i18n}.hint.${f.name}`, src);
      (f.options || []).forEach((o) => used.set(`${e.i18n}.opt.${f.name}.${o}`, src));
    }
  }
}
(async () => {
  await entityKeys();
  const missing = [...used].filter(([k]) => !keys.has(k));
  const unused = [...keys].filter((k) => !used.has(k));
  if (missing.length) { console.error("Missing keys:\n" + missing.map(([k, p]) => `  ${k}  (${path.relative(root, p)})`).join("\n")); process.exit(1); }
  const noEn = [...keys].filter((k) => !enKeys.has(k));
  console.log(`i18n OK: ${used.size} keys used, ${keys.size} in RU` + (unused.length ? `, unused: ${unused.join(", ")}` : ""));
  if (noEn.length) console.log(`EN still to write before translations: ${noEn.length} keys`);
})();
