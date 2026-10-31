import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import { getSessionContext } from "../../lib/auth/session";
import { t } from "../../lib/i18n";
import { ROLE_LABEL_KEYS } from "../../lib/roles";

export default async function AppLayout({ children }) {
  const ctx = await getSessionContext();
  if (!ctx.user) redirect("/login");
  if (!ctx.membership) redirect("/onboarding");
  const { orgName, roleKey } = ctx.membership;
  return (
    <AppShell orgName={orgName} userName={ctx.user.name} roleLabel={t(ROLE_LABEL_KEYS[roleKey] || "role.employee")}>
      {children}
    </AppShell>
  );
}
