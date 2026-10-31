import { t } from "../i18n";

export const STEP_TITLES = {
  1: t("passports.step.1"), 2: t("passports.step.2"), 3: t("passports.step.3"), 4: t("passports.step.4"), 5: t("passports.step.5")
};
export const STATUS_LABELS = {
  draft: t("passports.status.draft"), in_review: t("passports.status.in_review"), approved: t("passports.status.approved"),
  published: t("passports.status.published"), unpublished: t("passports.status.unpublished")
};
export const STATUS_TONES = { draft: "neutral", in_review: "info", approved: "success", published: "success", unpublished: "warning" };

export const STAGE_LABELS = {
  raw_material: t("passports.stage.raw_material"), spinning: t("passports.stage.spinning"), weaving_knitting: t("passports.stage.weaving_knitting"),
  dyeing_finishing: t("passports.stage.dyeing_finishing"), sewing: t("passports.stage.sewing"), other: t("passports.stage.other")
};
export const SEVERITY_LABELS = {
  error: t("passports.severity.error"), warning: t("passports.severity.warning"), recommendation: t("passports.severity.recommendation")
};
export const SEVERITY_TONES = { error: "error", warning: "warning", recommendation: "info" };

export const CHECK_MESSAGES = {
  no_country: t("passports.check.no_country"), no_manufacturer: t("passports.check.no_manufacturer"),
  composition_empty: t("passports.check.composition_empty"), composition_sum: t("passports.check.composition_sum"),
  composition_unsupported: t("passports.check.composition_unsupported"), origin_declared: t("passports.check.origin_declared"),
  no_stages: t("passports.check.no_stages"), no_documents: t("passports.check.no_documents"),
  doc_expired: t("passports.check.doc_expired"), doc_expiring: t("passports.check.doc_expiring"),
  doc_rejected: t("passports.check.doc_rejected"), doc_unverified: t("passports.check.doc_unverified"),
  no_category: t("passports.check.no_category"), no_gtin: t("passports.check.no_gtin"), no_hs: t("passports.check.no_hs"),
  hs_unverified: t("passports.check.hs_unverified")
};

export const PASSPORT_ERRORS = {
  product_id: t("passports.error.product_id"), batch_code: t("passports.error.batch_code"), produced_on: t("passports.error.date"),
  fiber: t("passports.error.fiber"), percent: t("passports.error.percent"), recycled_percent: t("passports.error.recycled_percent"),
  material_id: t("passports.error.ref"), lot_id: t("passports.error.ref"), site_id: t("passports.error.ref"), supplier_id: t("passports.error.ref"),
  stage_type: t("passports.error.stage_type"), started_on: t("passports.error.date"), finished_on: t("passports.error.finished"),
  notes: t("passports.error.generic"), document_id: t("passports.error.ref"),
  quota: t("passports.error.quota"), duplicate: t("passports.error.duplicate"), checks: t("passports.error.checks"),
  generic: t("passports.error.generic")
};
