"use server";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "../../lib/supabase/server";
import { t } from "../../lib/i18n";
import { COUNTRY_CODES } from "../../lib/validation.mjs";
import { parsePolicy } from "../../lib/org-policy.mjs";
import { cookies } from "next/headers";
import { hashToken, isInviteToken, safeNext } from "../../lib/invitations.mjs";
import { getOrigin } from "../../lib/origin";
import { sendMail } from "../../lib/mail";
import { buildOperatorEmail } from "../../lib/mail-templates.mjs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (fd, k) => String(fd.get(k) || "").trim();

export async function login(formData) {
  if (!isSupabaseConfigured()) redirect("/login");
  const email = text(formData, "email");
  const password = String(formData.get("password") || "");
  if (!EMAIL.test(email) || !password) redirect("/login?error=invalid");
  const next = safeNext(formData.get("next"));
  const { error } = await createClient().auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${/not confirmed/i.test(error.message) ? "unconfirmed" : "invalid"}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  redirect(next || "/");
}

export async function signup(formData) {
  if (!isSupabaseConfigured()) redirect("/login");
  const fullName = text(formData, "full_name");
  const company = text(formData, "company").slice(0, 120);
  const email = text(formData, "email");
  const password = String(formData.get("password") || "");
  if (fullName.length < 2 || fullName.length > 120) redirect("/signup?error=name");
  if (!EMAIL.test(email)) redirect("/signup?error=generic");
  if (password.length < 10) redirect("/signup?error=password");
  const { data, error } = await createClient().auth.signUp({
    email, password, options: { data: { full_name: fullName, company_name: company }, emailRedirectTo: `${getOrigin()}/auth/callback?next=/onboarding` }
  });
  if (error) redirect(/registered|exists/i.test(error.message) ? "/signup?error=exists" : "/signup?error=generic");
  const next = safeNext(formData.get("next"));
  redirect(data.session ? next || "/onboarding" : `/login?info=confirm${next ? `&next=${encodeURIComponent(next)}` : ""}`);
}

export async function signOut() {
  if (isSupabaseConfigured()) await createClient().auth.signOut();
  redirect("/login");
}

export async function createOrganization(formData) {
  if (!isSupabaseConfigured()) redirect("/login");
  const name = text(formData, "name");
  // Company is optional: with no name the organization gets a default one, editable later in Settings.
  if (name && (name.length < 2 || name.length > 120)) redirect("/onboarding?error=name");
  const country = text(formData, "country").toUpperCase();
  if (country && !COUNTRY_CODES.includes(country)) redirect("/onboarding?error=generic");
  const policy = parsePolicy(Object.fromEntries(["approval_mode", "responsible_name", "compiler_name", "approver_name"].map((k) => [k, formData.get(k)])));
  if (policy.error) redirect(`/onboarding?error=policy_${policy.error}`);
  const pv = policy.values;
  const supabase = createClient();
  const orgName = name || t("onboarding.defaultName");
  const { data: orgId, error } = await supabase.rpc("create_organization", {
    org_name: orgName, org_country: country || null,
    p_mode: pv.approval_mode, p_responsible: pv.responsible_name, p_compiler: pv.compiler_name, p_approver: pv.approver_name
  });
  if (error) redirect("/onboarding?error=generic");

  // Tell the operator about the new organization. A failed or unconfigured mailer never blocks registration.
  if (process.env.OPERATOR_EMAIL) {
    const { data: { user } } = await supabase.auth.getUser();
    const mail = buildOperatorEmail({
      orgId, orgName, country: country || null, ownerName: user?.user_metadata?.full_name, ownerEmail: user?.email, promoPending: country === "UA"
    });
    await sendMail({ to: process.env.OPERATOR_EMAIL, ...mail });
  }
  redirect("/");
}

// Accepts an invitation. The database checks the token and that the signed-in e-mail matches the invited one.
export async function acceptInvite(formData) {
  const token = String(formData.get("token") || "");
  if (!isInviteToken(token)) redirect("/");
  const { data, error } = await createClient().rpc("accept_invitation", { p_token_hash: hashToken(token) });
  if (error) redirect(`/invite/${token}?error=${error.code === "DPP03" ? "email" : error.code === "DPP02" ? "invalid" : "generic"}`);
  cookies().set("dpp_org", data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}

// ---- password reset and confirmation e-mail (sent by Supabase through the configured SMTP) ----

export async function forgotPassword(formData) {
  if (!isSupabaseConfigured()) redirect("/login");
  const email = text(formData, "email");
  if (!EMAIL.test(email)) redirect("/forgot-password?error=email");
  await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${getOrigin()}/auth/callback?next=/reset-password` });
  redirect("/forgot-password?sent=1"); // the same answer whether the address exists or not
}

export async function updatePassword(formData) {
  if (!isSupabaseConfigured()) redirect("/login");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 10) redirect("/reset-password?error=password");
  if (password !== confirm) redirect("/reset-password?error=mismatch");
  const { error } = await createClient().auth.updateUser({ password });
  if (error) redirect("/reset-password?error=generic");
  redirect("/?password=changed");
}

export async function resendConfirmation(formData) {
  if (!isSupabaseConfigured()) redirect("/login");
  const email = text(formData, "email");
  if (EMAIL.test(email)) {
    await createClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${getOrigin()}/auth/callback?next=/onboarding` } });
  }
  redirect("/login?info=resent");
}
