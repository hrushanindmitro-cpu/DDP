// Plain-text notification e-mails. Pure functions, covered by `npm test`.
// Values are flattened to one line so nothing a user typed can add headers or fake lines.
const line = (v, max = 200) => String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || "—";

export function buildOperatorEmail({ orgId, orgName, country, ownerName, ownerEmail, promoPending, when = new Date() }) {
  const rows = [
    ["Организация", line(orgName)],
    ["Страна", line(country)],
    ["Владелец", `${line(ownerName)} <${line(ownerEmail)}>`],
    ["Идентификатор", line(orgId, 60)],
    ["Время (UTC)", when.toISOString().slice(0, 16).replace("T", " ")]
  ];
  if (promoPending) rows.push(["Скидка UA2026", "добавлена, ждёт проверки бизнеса (ЄДРПОУ в Настройки → Тариф)"]);
  return {
    subject: promoPending ? "DPP Tessile: новая организация, нужна проверка скидки UA2026" : "DPP Tessile: зарегистрирована новая организация",
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`
  };
}
