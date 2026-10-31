"use server";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { getSessionContext } from "../../../lib/auth/session";
import { requirePermission } from "../../../lib/auth/permissions";

const clean = (fd, k) => String(fd.get(k) || "").trim();

export async function updateProfile(formData) {
  const ctx = await getSessionContext();
  if (!ctx.user) redirect("/login");
  const name = clean(formData, "full_name");
  if (name.length < 2 || name.length > 120) redirect("/settings/profile?error=name");
  const { error } = await createClient().from("profiles").update({ full_name: name }).eq("id", ctx.user.id);
  if (error) redirect("/settings/profile?error=generic");
  redirect("/settings/profile?saved=1");
}

export async function updateOrganization(formData) {
  const ctx = await requirePermission("org.manage");
  const name = clean(formData, "name");
  if (name.length < 2 || name.length > 120) redirect("/settings/organization?error=company");
  const supabase = createClient();
  const { error } = await supabase.from("organizations").update({ name }).eq("id", ctx.membership.orgId);
  if (error) redirect("/settings/organization?error=generic");
  await supabase.rpc("log_audit", {
    p_org: ctx.membership.orgId, p_action: "organization.renamed",
    p_entity_type: "organization", p_entity_id: ctx.membership.orgId
  });
  redirect("/settings/organization?saved=1");
}
