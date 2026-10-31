import { t } from "../../../../lib/i18n";
import { PLANS } from "../../../../lib/plans";
import { Card, PageHeader, SoonButton, StatusBadge } from "../../../../components/ui";

export const metadata = { title: t("plan.title") };

export default function PlanPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("plan.title")} subtitle={t("plan.subtitle")} />
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.id} as="div" className={`flex flex-col gap-3 ${p.popular ? "border-brand ring-1 ring-brand" : ""}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t(`plan.${p.id}.name`)}</h2>
              {p.popular && <StatusBadge tone="info">{t("plan.popular")}</StatusBadge>}
            </div>
            <p className="text-sm text-muted">{t(`plan.${p.id}.desc`)}</p>
            <p><b className="text-3xl">€{p.priceMonthly}</b> <span className="text-sm text-muted">{t("plan.perMonth")}</span></p>
            <SoonButton reason={t("plan.billingOff")}>{t("plan.billingOff")}</SoonButton>
          </Card>
        ))}
      </div>
    </div>
  );
}
