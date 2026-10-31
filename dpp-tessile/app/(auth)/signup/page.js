import Link from "next/link";
import { t } from "../../../lib/i18n";
import { isSupabaseConfigured } from "../../../lib/supabase/server";
import { Field, Notice, NotConfigured } from "../../../components/AuthForm";
import { btnPrimary } from "../../../components/ui";
import { signup } from "../actions";

export const metadata = { title: t("auth.signup.title") };

const ERRORS = {
  exists: t("auth.error.exists"),
  name: t("auth.error.name"),
  password: t("auth.error.password"),
  generic: t("auth.error.generic")
};

export default function SignupPage({ searchParams }) {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t("auth.signup.title")}</h1>
      {searchParams?.error && <Notice>{ERRORS[searchParams.error] || ERRORS.generic}</Notice>}
      <form action={signup} className="flex flex-col gap-4">
        <Field id="full_name" type="text" label={`${t("auth.fullName")} *`} hint={t("auth.fullNameHint")} autoComplete="name" minLength={2} maxLength={120} required />
        <Field id="company" type="text" label={t("auth.company")} hint={t("auth.companyHint")} autoComplete="organization" maxLength={120} />
        <Field id="email" type="email" label={t("auth.email")} autoComplete="email" required />
        <Field id="password" type="password" label={t("auth.password")} hint={t("auth.passwordHint")}
          autoComplete="new-password" minLength={10} required />
        <button type="submit" className={btnPrimary}>{t("auth.signup.submit")}</button>
      </form>
      <p className="mt-4 text-center text-sm"><Link href="/login" className="font-semibold text-brand underline">{t("auth.toLogin")}</Link></p>
    </div>
  );
}
