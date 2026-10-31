import { notFound, redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { assertWithinLimit, requireFeature, requirePermission } from "../auth/permissions";
import { isUuid } from "../validation.mjs";
import { ENTITIES } from "./entities.mjs";
import { parseEntity } from "./parse.mjs";

function entityOf(key) {
  if (!Object.prototype.hasOwnProperty.call(ENTITIES, key)) notFound();
  return ENTITIES[key];
}

export async function saveEntity(key, formData) {
  const e = entityOf(key);
  const ctx = await requireFeature(e.feature, e.writePerm);
  const orgId = ctx.membership.orgId;
  const id = String(formData.get("id") || "");
  if (id && !isUuid(id)) notFound();
  const back = id ? `${e.base}/${id}` : `${e.base}/new`;

  const parsed = parseEntity(e, Object.fromEntries(e.fields.map((f) => [f.name, formData.get(f.name)])));
  if (parsed.error) redirect(`${back}?error=${parsed.error}`);
  const values = parsed.values;
  const supabase = createClient();

  // every referenced record must exist, be undeleted and belong to the same organization
  for (const f of e.fields) {
    if (f.type !== "ref" || !values[f.name]) continue;
    const { data } = await supabase.from(ENTITIES[f.refTable].table).select("id")
      .eq("id", values[f.name]).eq("org_id", orgId).is("deleted_at", null).maybeSingle();
    if (!data) redirect(`${back}?error=ref`);
  }

  if (!id && e.limitKey) {
    const { count } = await supabase.from(e.table).select("id", { count: "exact", head: true }).eq("org_id", orgId).is("deleted_at", null);
    assertWithinLimit(ctx, e.limitKey, count ?? 0); // also enforced by RLS in the database
  }

  const result = id
    ? await supabase.from(e.table).update(values).eq("id", id).eq("org_id", orgId).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from(e.table).insert({ ...values, org_id: orgId }).select("id").maybeSingle();

  if (result.error) {
    const code = result.error.code;
    redirect(`${back}?error=${code === "23505" ? "duplicate" : code === "23503" ? "ref" : code === "42501" && !id && e.limitKey ? "limit" : "generic"}`);
  }
  if (id && !result.data) notFound();
  redirect(`${e.base}?saved=1`);
}

export async function deleteEntity(key, formData) {
  const e = entityOf(key);
  const ctx = await requirePermission(e.writePerm);
  const id = String(formData.get("id") || "");
  if (!isUuid(id)) notFound();
  const { error } = await createClient().from(e.table).update({ deleted_at: new Date().toISOString() })
    .eq("id", id).eq("org_id", ctx.membership.orgId).is("deleted_at", null);
  if (error) redirect(`${e.base}/${id}?error=generic`);
  redirect(`${e.base}?deleted=1`);
}
