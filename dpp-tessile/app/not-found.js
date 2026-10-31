import Link from "next/link";
import { t } from "../lib/i18n";
import { btnPrimary } from "../components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
      <p className="text-sm text-muted">{t("notFound.text")}</p>
      <Link href="/" className={btnPrimary}>{t("notFound.home")}</Link>
    </div>
  );
}
