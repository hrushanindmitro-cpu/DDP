import Link from "next/link";
import { t } from "../../../lib/i18n";
import { isSupabaseConfigured } from "../../../lib/supabase/server";
import { Field, Notice, NotConfigured } from "../../../components/AuthForm";
import { btnPrimary, btnSecondary } from "../../../components/ui";
import { safeNext } from "../../../lib/invitations.mjs";
import { login, resendConfirmation } from "../actions";

export const metadata = { title: t("auth.login.title") };

const ERRORS = {
  invalid: t("auth.error.invalid"), generic: t("auth.error.generic"),
  unconfirmed: t("auth.error.unconfirmed"), link: t("auth.error.link")
};

export default function LoginPage({ searchParams }) {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  const next = safeNext(searchParams?.next);
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t("auth.login.title")}</h1>
      {searchParams?.error && <Notice>{ERRORS[searchParams.error] || ERRORS.generic}</Notice>}
      {searchParams?.info === "confirm" && <Notice tone="info">{t("auth.info.confirm")}</Notice>}
      {searchParams?.info === "resent" && <Notice tone="info">{t("auth.info.resent")}</Notice>}
      {searchParams?.info === "reset" && <Notice tone="info">{t("auth.info.reset")}</Notice>}
      <form action={login} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Field id="email" type="email" label={t("auth.email")} autoComplete="email" required />
        <Field id="password" type="password" label={t("auth.password")} autoComplete="current-password" required />
        <button type="submit" className={btnPrimary}>{t("auth.login.submit")}</button>
      </form>
      <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="font-semibold text-brand underline">{t("auth.forgot.link")}</Link></p>
      <p className="mt-2 text-center text-sm"><Link href={`/signup${nextQuery}`} className="font-semibold text-brand underline">{t("auth.toSignup")}</Link></p>
      {searchParams?.error === "unconfirmed" && (
        <form action={resendConfirmation} className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <Field id="email" type="email" label={t("auth.email")} autoComplete="email" required />
          <button type="submit" className={btnSecondary}>{t("auth.resend")}</button>
        </form>
      )}
    </div>
  );
}
