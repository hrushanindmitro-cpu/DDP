import { t } from "../../../lib/i18n";
import { EmptyState, PageHeader } from "../../../components/ui";

export const metadata = { title: t("reviews.title") };

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("reviews.title")} subtitle={t("reviews.subtitle")} />
      <EmptyState title={t("common.inDevelopment")} text={t("common.inDevelopmentText")} />
    </div>
  );
}
