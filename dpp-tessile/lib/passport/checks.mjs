// Readiness checks for a passport. Three levels, kept apart on purpose:
//  error = must be fixed before the passport can go to review
//  warning = allowed, but the claim is not backed up or something is doubtful
//  recommendation = would make the passport better
// A clean result is NOT a statement of legal compliance and does not replace the approver.
import { compositionComplete } from "./rules.mjs";
import { expiryState } from "../documents/rules.mjs";

export const SEVERITIES = ["error", "warning", "recommendation"];

export function runChecks({ product, composition, stages, documents, supportedRowIds, declaredLots, today }) {
  const items = [];
  const add = (severity, code, step, detail) => items.push({ severity, code, step, detail: detail || null });

  // required fields
  if (!product.country_of_origin) add("error", "no_country", 1);
  if (!product.manufacturer) add("error", "no_manufacturer", 1);

  // composition
  if (composition.length === 0) add("error", "composition_empty", 2);
  else if (!compositionComplete(composition)) add("error", "composition_sum", 2);
  const unsupported = composition.filter((r) => !supportedRowIds.has(r.id));
  if (composition.length > 0 && unsupported.length > 0) add("warning", "composition_unsupported", 2, unsupported.map((r) => r.fiber).join(", "));
  if (declaredLots > 0) add("warning", "origin_declared", 3, String(declaredLots));

  // production
  if (stages.length === 0) add("warning", "no_stages", 3);

  // documents
  if (documents.length === 0) add("warning", "no_documents", 3);
  for (const d of documents) {
    const state = expiryState(d.valid_until, today);
    if (state === "expired") add("error", "doc_expired", 3, d.title);
    else if (state === "soon") add("warning", "doc_expiring", 3, d.title);
    if (d.review_status === "rejected") add("error", "doc_rejected", 3, d.title);
    else if (d.review_status === "unverified") add("warning", "doc_unverified", 3, d.title);
  }

  // recommendations
  if (!product.category) add("recommendation", "no_category", 1);
  if (!product.gtin) add("recommendation", "no_gtin", 1);
  if (!product.hs_code) add("recommendation", "no_hs", 1);
  else if (product.hs_status !== "verified") add("recommendation", "hs_unverified", 1);

  return items;
}

export const hasErrors = (items) => items.some((i) => i.severity === "error");
