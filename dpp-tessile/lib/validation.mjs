// Pure validation, no framework imports, so it can be tested with plain node (npm test).
export const COUNTRY_CODES = [
  "IT","DE","FR","ES","PT","PL","RO","TR","UA","NL","BE","AT","CH","GB","GR","BG","HU","CZ","SK","HR","SI","RS","AL","MK","LT","LV","EE","FI","SE","DK","NO","IE",
  "MA","TN","EG","IN","PK","BD","LK","VN","CN","ID","KH","MM","UZ","TJ","KG","TM","KZ","GE","AM","AZ","US","BR","PE","MX"
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => UUID.test(String(s || ""));

// GS1 GTIN-8/12/13/14 with check digit.
export function isValidGtin(value) {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) return false;
  const digits = value.split("").map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

const s = (v) => String(v ?? "").trim();
const orNull = (v) => (v === "" ? null : v);

// raw: object of strings from a form. Returns { values } or { error } (error = key suffix of products.error.*)
export function parseProduct(raw) {
  const name = s(raw.name);
  if (name.length < 2 || name.length > 200) return { error: "name" };
  const gtin = s(raw.gtin).replace(/[\s-]/g, "");
  if (gtin && !isValidGtin(gtin)) return { error: "gtin" };
  const country = s(raw.country_of_origin).toUpperCase();
  if (country && !COUNTRY_CODES.includes(country)) return { error: "country" };
  const hs = s(raw.hs_code).replace(/[\s.]/g, "");
  if (hs && !/^\d{6,10}$/.test(hs)) return { error: "hs" };
  const hsSource = s(raw.hs_source).slice(0, 300);
  const hsStatus = s(raw.hs_status) === "verified" ? "verified" : "unverified";
  if (hsStatus === "verified" && (!hs || !hsSource)) return { error: "hsVerified" };
  const collection = s(raw.collection_id);
  if (collection && !isUuid(collection)) return { error: "collection" };
  for (const [k, max] of [["sku", 64], ["brand", 120], ["category", 120], ["manufacturer", 200], ["notes", 2000]]) {
    if (s(raw[k]).length > max) return { error: "generic" };
  }
  return {
    values: {
      name, sku: orNull(s(raw.sku)), gtin: orNull(gtin), brand: orNull(s(raw.brand)), category: orNull(s(raw.category)),
      manufacturer: orNull(s(raw.manufacturer)), country_of_origin: orNull(country), collection_id: orNull(collection),
      hs_code: orNull(hs), hs_source: orNull(hsSource), hs_status: hsStatus, notes: orNull(s(raw.notes))
    }
  };
}

export function parseCollection(raw) {
  const name = s(raw.name);
  if (name.length < 2 || name.length > 120) return { error: "name" };
  const season = s(raw.season);
  if (season.length > 40) return { error: "generic" };
  const yearRaw = s(raw.year);
  let year = null;
  if (yearRaw) {
    if (!/^\d{4}$/.test(yearRaw) || +yearRaw < 1990 || +yearRaw > 2100) return { error: "year" };
    year = +yearRaw;
  }
  const description = s(raw.description);
  if (description.length > 1000) return { error: "generic" };
  return { values: { name, season: orNull(season), year, description: orNull(description) } };
}
