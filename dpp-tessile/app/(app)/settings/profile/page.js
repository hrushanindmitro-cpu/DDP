import { t } from "../../../../lib/i18n";
import { getSessionContext } from "../../../../lib/auth/session";
import { Field, Notice } from "../../../../components/AuthForm";
import { Card, PageHeader, btnPrimary } from "../../../../components/ui";
import { updateProfile } from "../actions";

export const metadata = { title: t("settings.profile") };

const ERRORS = { name: t("settings.error.name"), generic: t("settings.error.generic") };

export default async function ProfilePage({ searchParams }) {
  const ctx = await getSessionContext();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("settings.profile")} subtitle={t("settings.profileText")} />
      <Card>
        {searchParams?.error && <Notice>{ERRORS[searchParams.error] || ERRORS.generic}</Notice>}
        {searchParams?.saved && <Notice tone="info">{t("common.saved")}</Notice>}
        <form action={updateProfile} className="flex flex-col gap-4">
          <Field id="full_name" type="text" label={`${t("settings.field.name")} *`} hint={t("settings.field.nameHint")}
            defaultValue={ctx.user.name === ctx.user.email ? "" : ctx.user.name} minLength={2} maxLength={120} required />
          <Field id="email" type="email" label={t("settings.field.email")} defaultValue={ctx.user.email} disabled />
          <button type="submit" className={btnPrimary}>{t("common.save")}</button>
        </form>
      </Card>
    </div>
  );
}
