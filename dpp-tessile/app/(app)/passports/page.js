"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ACTIVE_LOCALE, t } from "../../../lib/i18n";
import { Card, EmptyState, PageHeader, StatusBadge, btnPrimary } from "../../../components/ui";

export default function Passports() {
  const [list, setList] = useState(null);
  useEffect(() => {
    try { setList(JSON.parse(localStorage.getItem("dpp:list") || "[]")); } catch { setList([]); }
  }, []);
  const create = <Link href="/passports/new" className={btnPrimary}>+ {t("common.createPassport")}</Link>;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("passports.title")} subtitle={t("passports.subtitle")} action={create} />
      {list && list.length === 0 && <EmptyState title={t("passports.emptyTitle")} text={t("passports.emptyText")} action={create} />}
      {list && list.length > 0 && (
        <Card as="div" className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="px-5 py-3 font-medium">{t("passports.col.gtin")}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t("passports.col.batch")}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t("passports.col.created")}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t("passports.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">{r.data?.gtin}</td>
                  <td className="px-5 py-3">{r.data?.batch}</td>
                  <td className="px-5 py-3">{r.createdAt ? new Date(r.createdAt).toLocaleDateString(ACTIVE_LOCALE) : "—"}</td>
                  <td className="px-5 py-3"><StatusBadge tone="warning">{t("passports.status.demo")}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-4 text-xs text-muted">{t("passports.browserOnly")}</p>
    </div>
  );
}
