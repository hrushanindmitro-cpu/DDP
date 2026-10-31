import { t } from "../../../lib/i18n";
import { isSupabaseConfigured } from "../../../lib/supabase/server";
import { Field, Notice, NotConfigured } from "../../../components/AuthForm";
import { btnPrimary } from "../../../components/ui";
import { updatePassword } from "../actions";

export const metadata = { title: t("auth.reset.title") };

const ERRORS = { password: t("auth.error.password"), mismatch: t("auth.reset.mismatch"), generic: t("auth.error.generic") };

// Reached from the e-mail link; the middleware sends visitors without a session to the login page.
export default function ResetPassword({ searchParams }) {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t("auth.reset.title")}</h1>
      {searchParams?.error && <Notice>{ERRORS[searchParams.error] || ERRORS.generic}</Notice>}
      <form action={updatePassword} className="flex flex-col gap-4">
        <Field id="password" type="password" label={t("auth.reset.new")} hint={t("auth.passwordHint")} autoComplete="new-password" minLength={10} required />
        <Field id="confirm" type="password" label={t("auth.reset.confirm")} autoComplete="new-password" minLength={10} required />
        <button type="submit" className={btnPrimary}>{t("auth.reset.submit")}</button>
      </form>
    </div>
  );
}
