"use client";
import { t } from "../lib/i18n";
import { btnPrimary } from "../components/ui";

export default function GlobalError({ reset }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">{t("error.title")}</h1>
      <p className="text-sm text-muted">{t("error.text")}</p>
      <button type="button" onClick={reset} className={btnPrimary}>{t("error.retry")}</button>
    </div>
  );
}
