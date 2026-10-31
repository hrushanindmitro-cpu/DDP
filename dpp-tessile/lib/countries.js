import { COUNTRY_CODES } from "./validation.mjs";
import { ACTIVE_LOCALE } from "./i18n";

export function countryName(code) {
  try { return new Intl.DisplayNames([ACTIVE_LOCALE], { type: "region" }).of(code) || code; } catch { return code; }
}
export function countryOptions() {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, ACTIVE_LOCALE));
}
