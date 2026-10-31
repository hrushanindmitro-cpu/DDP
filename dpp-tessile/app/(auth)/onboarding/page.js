import { redirect } from "next/navigation";
import { t } from "../../../lib/i18n";
import { getSessionContext } from "../../../lib/auth/session";
import { Field, Notice } from "../../../components/AuthForm";
import { btnPrimary } from "../../../components/ui";
import { createOrganization } from "../actions";

export const metadata = { title: t("onboarding.title") };

const ERRORS = { name: t("onboarding.error.name"), generic: t("onboarding.error.generic") };

export default async function Onboarding({ searchParams }) {
  const ctx = await getSessionContext();
  if (!ctx.user) redirect("/login");
  if (ctx.membership) redirect("/");
  return (
    <div>
      <h1 className="text-xl font-bold">{t("onboarding.title")}</h1>
      <p className="mb-4 mt-1 text-sm text-muted">{t("onboarding.subtitle")}</p>
      {searchParams?.error && <Notice>{ERRORS[searchParams.error] || ERRORS.generic}</Notice>}
      <form action={createOrganization} className="flex flex-col gap-4">
        <Field id="name" type="text" label={t("onboarding.name")} hint={t("onboarding.nameHint")} defaultValue={ctx.user.company} maxLength={120} />
        <button type="submit" className={btnPrimary}>{t("onboarding.submit")}</button>
      </form>
    </div>
  );
}
