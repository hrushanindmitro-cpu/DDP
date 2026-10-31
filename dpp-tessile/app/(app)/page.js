"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "../../lib/i18n";
import { Card, EmptyState, PageHeader, SoonButton, btnPrimary, btnSecondary } from "../../components/ui";

function readCount() {
  try { return JSON.parse(localStorage.getItem("dpp:list") || "[]").length; } catch { return 0; }
}

export default function Home() {
  const [total, setTotal] = useState(null);
  useEffect(() => setTotal(readCount()), []);
  const soon = t("common.soon");

  const stats = [
    { label: t("home.stat.total"), value: total ?? "…", note: t("home.stat.localNote") },
    { label: t("home.stat.attention"), value: "—", note: t("home.stat.pending") },
    { label: t("home.stat.review"), value: "—", note: t("home.stat.pending") },
    { label: t("home.stat.published"), value: "—", note: t("home.stat.pending") }
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title={t("home.title")} subtitle={t("home.subtitle")}
        action={<Link href="/passports/new" className={btnPrimary}>+ {t("home.action.create")}</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} as="div" className="flex flex-col gap-1">
            <span className="text-sm text-muted">{s.label}</span>
            <b className="text-3xl text-ink">{s.value}</b>
            <span className="text-xs text-muted">{s.note}</span>
          </Card>
        ))}
      </div>
      <Card aria-label={t("home.quick")}>
        <h2 className="mb-3 text-base font-semibold">{t("home.quick")}</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/passports/new" className={btnSecondary}>{t("home.action.create")}</Link>
          <SoonButton reason={soon}>{t("home.action.import")}</SoonButton>
          <SoonButton reason={soon}>{t("home.action.supplier")}</SoonButton>
          <SoonButton reason={soon}>{t("home.action.tasks")}</SoonButton>
          <SoonButton reason={soon}>{t("home.action.report")}</SoonButton>
        </div>
      </Card>
      <section aria-label={t("home.attention.title")}>
        <h2 className="mb-3 text-base font-semibold">{t("home.attention.title")}</h2>
        <EmptyState title={t("home.attention.empty")} text={t("home.attention.emptyText")} />
      </section>
    </div>
  );
}
