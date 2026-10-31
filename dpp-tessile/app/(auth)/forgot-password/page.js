import Link from "next/link";
import { t } from "../../../lib/i18n";
import { isSupabaseConfigured } from "../../../lib/supabase/server";
import { Field, Notice, NotConfigured } from "../../../components/AuthForm";
import { btnPrimary } from "../../../components/ui";
import { forgotPassword } from "../actions";

export const metadata = { title: t("auth.forgot.title") };

export default function ForgotPassword({ searchParams }) {
  if (!isSupabaseConfigured()) return <NotConfigured />;
  return (
    <div>
      <h1 className="text-xl font-bold">{t("auth.forgot.title")}</h1>
      <p className="mb-4 mt-2 text-sm text-muted">{t("auth.forgot.text")}</p>
      {searchParams?.error && <Notice>{t("auth.error.generic")}</Notice>}
      {searchParams?.sent
        ? <Notice tone="info">{t("auth.forgot.sent")}</Notice>
        : (
          <form action={forgotPassword} className="flex flex-col gap-4">
            <Field id="email" type="email" label={t("auth.email")} autoComplete="email" required />
            <button type="submit" className={btnPrimary}>{t("auth.forgot.submit")}</button>
          </form>
        )}
      <p className="mt-4 text-center text-sm"><Link href="/login" className="font-semibold text-brand underline">{t("auth.toLogin")}</Link></p>
    </div>
  );
}
