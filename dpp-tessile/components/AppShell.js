"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { t } from "../lib/i18n";
import { signOut } from "../app/(auth)/actions";

const ICONS = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  passports: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h8M8 12h8M8 16h5",
  suppliers: "M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4",
  documents: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  reviews: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  reports: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
};

export const NAV = [
  { href: "/", key: "nav.home", icon: "home" },
  { href: "/passports", key: "nav.passports", icon: "passports" },
  { href: "/suppliers", key: "nav.suppliers", icon: "suppliers" },
  { href: "/documents", key: "nav.documents", icon: "documents" },
  { href: "/reviews", key: "nav.reviews", icon: "reviews" },
  { href: "/reports", key: "nav.reports", icon: "reports" },
  { href: "/settings", key: "nav.settings", icon: "settings" }
];

function Icon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
  );
}

export default function AppShell({ children, orgName, userName, roleLabel }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="flex min-h-screen bg-surface">
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-forest p-4 transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-6 flex items-center justify-between px-2 pt-2 text-lg font-bold text-white">
          <span className="flex items-center gap-2"><span className="inline-block h-8 w-8 rounded-lg bg-teal-300" aria-hidden="true" />{t("app.name")}</span>
          <button type="button" className="rounded-lg p-2 text-white md:hidden" onClick={() => setOpen(false)} aria-label={t("shell.closeMenu")}>✕</button>
        </div>
        <nav aria-label={t("nav.main")} className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-teal-300 ${isActive(n.href) ? "bg-forest2 font-semibold text-white" : "text-emerald-100 hover:bg-forest2/60"}`}>
              <Icon name={n.icon} />{t(n.key)}
            </Link>
          ))}
        </nav>
        <p className="rounded-xl bg-forest2 p-3 text-xs text-emerald-100">{t("shell.billing")}</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 md:px-8">
          <button type="button" className="min-h-[44px] min-w-[44px] rounded-xl border border-line md:hidden" onClick={() => setOpen(true)} aria-label={t("shell.openMenu")}>☰</button>
          <input type="search" disabled aria-label={t("shell.search")} placeholder={t("shell.search")} title={t("shell.searchSoon")}
            className="min-h-[44px] min-w-0 flex-1 cursor-not-allowed rounded-xl bg-surface px-4 text-sm text-muted placeholder:text-muted" />
          <span className="rounded-xl border border-line px-3 py-2 text-sm font-semibold text-forest" title={t("shell.language")}>EN</span>
          <div className="hidden min-w-0 text-right text-sm leading-tight sm:block">
            <b className="block truncate">{userName}</b>
            <span className="block truncate text-xs text-muted">{roleLabel} · {orgName}</span>
          </div>
          <form action={signOut}>
            <button type="submit" className="min-h-[44px] rounded-xl border border-line px-3 text-sm font-semibold text-forest hover:bg-surface">{t("shell.signOut")}</button>
          </form>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
