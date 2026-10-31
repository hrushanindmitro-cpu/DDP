// Plan prices, features and limits live in the database (plans, plan_features, plan_limits, addon_packs).
// This file only holds the UI side: label keys and the limit-state helper.
export const BILLING_CONNECTED = false;

// k() only marks a string as an i18n key so scripts/check-i18n.js can see it.
const k = (key) => key;

export const PLAN_NAME_KEYS = {
  free: k("plan.free.name"),
  lite: k("plan.lite.name"),
  base: k("plan.base.name"),
  factory: k("plan.factory.name"),
  export: k("plan.export.name")
};
export const PLAN_DESC_KEYS = {
  free: k("plan.free.desc"),
  lite: k("plan.lite.desc"),
  base: k("plan.base.desc"),
  factory: k("plan.factory.desc"),
  export: k("plan.export.desc")
};

export const FEATURE_LABEL_KEYS = {
  view_only: k("plan.feature.view_only"),
  example_watermark: k("plan.feature.example_watermark"),
  manual_entry: k("plan.feature.manual_entry"),
  document_upload: k("plan.feature.document_upload"),
  qr_public_page: k("plan.feature.qr_public_page"),
  pdf_internal: k("plan.feature.pdf_internal"),
  public_pdf: k("plan.feature.public_pdf"),
  trust_page_basic: k("plan.feature.trust_page_basic"),
  custom_fields: k("plan.feature.custom_fields"),
  ai_create_from_photo_invoice: k("plan.feature.ai_create_from_photo_invoice"),
  excel_import: k("plan.feature.excel_import"),
  readiness_checklist: k("plan.feature.readiness_checklist"),
  blockchain_proof: k("plan.feature.blockchain_proof"),
  supplier_portal: k("plan.feature.supplier_portal"),
  co2_calculator: k("plan.feature.co2_calculator"),
  white_label: k("plan.feature.white_label"),
  shopify_erp_import: k("plan.feature.shopify_erp_import"),
  auto_translate: k("plan.feature.auto_translate"),
  qr_analytics: k("plan.feature.qr_analytics"),
  espr_updates: k("plan.feature.espr_updates"),
  custom_domain: k("plan.feature.custom_domain"),
  ai_repair_disposal: k("plan.feature.ai_repair_disposal")
};

export const ADDON_LABEL_KEYS = {
  qr_analytics: k("plan.addon.qr_analytics"),
  co2_calculator: k("plan.addon.co2_calculator"),
  ai_repair: k("plan.addon.ai_repair"),
  api_marketplaces: k("plan.addon.api_marketplaces"),
  qr_scans_10k: k("plan.addon.qr_scans_10k")
};

export const FEATURE_ORDER = Object.keys(FEATURE_LABEL_KEYS);

export const LIMIT_KEYS = ["passports", "custom_fields", "portal_suppliers", "qr_scans_month", "users", "suppliers", "storage_mb", "ai_ops_month"];
export const LIMIT_LABEL_KEYS = {
  passports: k("plan.limit.passports"),
  users: k("plan.limit.users"),
  suppliers: k("plan.limit.suppliers"),
  storage_mb: k("plan.limit.storage_mb"),
  ai_ops_month: k("plan.limit.ai_ops_month"),
  custom_fields: k("plan.limit.custom_fields"),
  portal_suppliers: k("plan.limit.portal_suppliers"),
  qr_scans_month: k("plan.limit.qr_scans_month")
};

export const STATUS_LABEL_KEYS = {
  manual: k("plan.status.manual"),
  trial: k("plan.status.trial"),
  active: k("plan.status.active"),
  past_due: k("plan.status.past_due"),
  canceled: k("plan.status.canceled")
};

// limit null = unlimited. "near" from 80%, "over" when no more items can be added.
export function limitState(used, limit) {
  if (limit == null) return "ok";
  if (used >= limit) return "over";
  if (used >= Math.ceil(limit * 0.8)) return "near";
  return "ok";
}
