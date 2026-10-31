import { t } from "../../../../lib/i18n";
import { getSessionContext } from "../../../../lib/auth/session";
import { can } from "../../../../lib/auth/permissions";
import { Field, Notice } from "../../../../components/AuthForm";
import { Card, PageHeader, btnPrimary } from "../../../../components/ui";
import { updateOrganization } from "../actions";

export const metadata = { title: t("settings.org") };

const ERRORS = { company: t("settings.error.company"), generic: t("settings.error.generic") };

export default async function OrganizationPage({ searchParams }) {
  const ctx = await getSessionContext();
  const editable = can(ctx, "org.manage");
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("settings.org")} subtitle={t("settings.orgText")} />
      <Card>
        {searchParams?.error && <Notice>{ERRORS[searchParams.error] || ERRORS.generic}</Notice>}
        {searchParams?.saved && <Notice tone="info">{t("common.saved")}</Notice>}
        {!editable && <Notice tone="info">{t("settings.readOnly")}</Notice>}
        <form action={updateOrganization} className="flex flex-col gap-4">
          <Field id="name" type="text" label={t("settings.field.company")} hint={t("settings.field.companyHint")}
            defaultValue={ctx.membership.orgName} minLength={2} maxLength={120} required disabled={!editable} />
          {editable && <button type="submit" className={btnPrimary}>{t("common.save")}</button>}
        </form>
      </Card>
    </div>
  );
}
