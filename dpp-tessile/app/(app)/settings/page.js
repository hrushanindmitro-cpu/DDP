import Link from "next/link";
import { t } from "../../../lib/i18n";
import { Card, PageHeader } from "../../../components/ui";

const ITEMS = [
  { href: "/settings/profile", title: t("settings.profile"), text: t("settings.profileText") },
  { href: "/settings/organization", title: t("settings.org"), text: t("settings.orgText") },
  { href: "/settings/plan", title: t("settings.plan"), text: t("settings.planText") }
];

export default function Settings() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="grid gap-4 md:grid-cols-3">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/40">
            <Card as="div" className="h-full hover:border-brand"><h2 className="text-base font-semibold">{i.title}</h2><p className="mt-1 text-sm text-muted">{i.text}</p></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
