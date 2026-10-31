import { expiryState } from "../documents/rules.mjs";
import { runChecks } from "./checks.mjs";

// Loads one passport with everything the wizard and the checks need. Authoritative for submit as well as for display.
export async function loadBundle(supabase, orgId, id) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: passport } = await supabase.from("passports").select("*").eq("id", id).eq("org_id", orgId).is("deleted_at", null).maybeSingle();
  if (!passport) return null;

  const [{ data: product }, { data: composition }, { data: stages }, { data: passportLinks }, { data: productLinks }] = await Promise.all([
    supabase.from("products").select("*").eq("id", passport.product_id).maybeSingle(),
    supabase.from("passport_composition").select("*").eq("passport_id", id).order("created_at"),
    supabase.from("passport_stages").select("*").eq("passport_id", id).order("created_at"),
    supabase.from("document_links").select("document_id").eq("org_id", orgId).eq("entity_type", "passport").eq("entity_id", id),
    supabase.from("document_links").select("document_id").eq("org_id", orgId).eq("entity_type", "product").eq("entity_id", passport.product_id)
  ]);
  const comp = composition || [];
  const st = stages || [];
  const lotIds = [...new Set([...comp.map((r) => r.lot_id), ...st.map((r) => r.lot_id)].filter(Boolean))];
  const materialIds = [...new Set(comp.map((r) => r.material_id).filter(Boolean))];

  const [lotsRes, lotLinks, materialLinks] = await Promise.all([
    lotIds.length ? supabase.from("lots").select("id, lot_number, origin_basis").in("id", lotIds) : { data: [] },
    lotIds.length ? supabase.from("document_links").select("entity_id, document_id").eq("org_id", orgId).eq("entity_type", "lot").in("entity_id", lotIds) : { data: [] },
    materialIds.length ? supabase.from("document_links").select("entity_id, document_id").eq("org_id", orgId).eq("entity_type", "material").in("entity_id", materialIds) : { data: [] }
  ]);

  const passportDocIds = new Set((passportLinks || []).map((l) => l.document_id));
  const related = new Set([...passportDocIds, ...(productLinks || []).map((l) => l.document_id),
    ...(lotLinks.data || []).map((l) => l.document_id), ...(materialLinks.data || []).map((l) => l.document_id)]);
  const { data: docRows } = related.size
    ? await supabase.from("documents").select("id, title, doc_type, review_status, valid_until").in("id", [...related]).is("deleted_at", null)
    : { data: [] };
  const docs = Object.fromEntries((docRows || []).map((d) => [d.id, d]));

  // a composition row counts as backed up only if its lot or material has a verified, unexpired document
  const good = (docId) => docs[docId] && docs[docId].review_status === "verified" && expiryState(docs[docId].valid_until, today) !== "expired";
  const supportedRowIds = new Set(comp.filter((r) =>
    (lotLinks.data || []).some((l) => l.entity_id === r.lot_id && good(l.document_id)) ||
    (materialLinks.data || []).some((l) => l.entity_id === r.material_id && good(l.document_id))).map((r) => r.id));

  const lots = Object.fromEntries((lotsRes.data || []).map((l) => [l.id, l]));
  const compLots = [...new Set(comp.map((r) => r.lot_id).filter(Boolean))];
  const declaredLots = compLots.filter((lid) => lots[lid] && lots[lid].origin_basis !== "verified").length;

  const checks = runChecks({ product: product || {}, composition: comp, stages: st, documents: Object.values(docs), supportedRowIds, declaredLots, today });
  return { passport, product: product || {}, composition: comp, stages: st, docs, passportDocIds, supportedRowIds, lots, checks };
}
