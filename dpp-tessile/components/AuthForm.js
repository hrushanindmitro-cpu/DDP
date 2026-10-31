import { t } from "../lib/i18n";

export const fieldClass =
  "min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Field({ id, label, hint, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={id} name={id} className={fieldClass} {...props} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "error", children }) {
  const cls = tone === "error" ? "bg-red-50 text-red-900" : "bg-mint text-forest";
  return <p role={tone === "error" ? "alert" : "status"} className={`mb-4 rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</p>;
}

export function NotConfigured() {
  return (
    <div>
      <h1 className="text-xl font-bold">{t("auth.notConfigured.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("auth.notConfigured.text")}</p>
    </div>
  );
}
