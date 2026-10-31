import { t } from "../i18n";

export const DOC_TYPE_LABELS = {
  certificate: t("documents.type.certificate"),
  lab_report: t("documents.type.lab_report"),
  invoice: t("documents.type.invoice"),
  contract: t("documents.type.contract"),
  declaration: t("documents.type.declaration"),
  other: t("documents.type.other")
};
export const REVIEW_LABELS = {
  unverified: t("documents.review.status.unverified"),
  verified: t("documents.review.status.verified"),
  rejected: t("documents.review.status.rejected")
};
export const REVIEW_TONES = { unverified: "neutral", verified: "success", rejected: "error" };

export const LINK_GROUPS = [
  { type: "product", table: "products", label: t("documents.links.product"), href: "/products", column: "name" },
  { type: "supplier", table: "suppliers", label: t("documents.links.supplier"), href: "/suppliers", column: "name" },
  { type: "lot", table: "lots", label: t("documents.links.lot"), href: "/lots", column: "lot_number" },
  { type: "site", table: "production_sites", label: t("documents.links.site"), href: "/sites", column: "name" },
  { type: "material", table: "materials", label: t("documents.links.material"), href: "/materials", column: "name" },
  { type: "passport", table: "passports", label: t("documents.links.passport"), href: "/passports", column: "title" }
];

export function formatBytes(n) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} ${t("documents.unit.mb")}`;
  return `${Math.max(1, Math.round(n / 1024))} ${t("documents.unit.kb")}`;
}

export const DOCUMENT_ERRORS = {
  title: t("documents.error.title"),
  doc_type: t("documents.error.doc_type"),
  issuer: t("documents.error.generic"),
  issued_date: t("documents.error.date"),
  valid_until: t("documents.error.date"),
  dates: t("documents.error.dates"),
  notes: t("documents.error.generic"),
  noFile: t("documents.review.error.noFile"),
  link: t("documents.links.error"),
  generic: t("documents.error.generic")
};
