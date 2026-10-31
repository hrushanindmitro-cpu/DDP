import { t } from "../../lib/i18n";

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4 py-10">
      <div className="flex items-center gap-2 text-lg font-bold text-forest">
        <span className="inline-block h-8 w-8 rounded-lg bg-teal-300" aria-hidden="true" />{t("app.name")}
      </div>
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}
