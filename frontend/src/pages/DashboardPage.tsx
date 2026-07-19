import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { accountsApi } from "../api/accounts";
import { AppShell } from "../components/common/AppShell";

function StatusPill({ account }: { account: { is_active: boolean; state?: { last_error: string | null } | null } }) {
  const { t } = useTranslation();
  if (!account.is_active) return <span className="status-pill status-paused">{t("dashboard.statusPaused")}</span>;
  if (account.state?.last_error) return <span className="status-pill status-error">{t("dashboard.statusError")}</span>;
  return <span className="status-pill status-active">{t("dashboard.statusActive")}</span>;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list, refetchInterval: 15000 });

  return (
    <AppShell title={t("nav.dashboard")}>
      <table>
        <thead>
          <tr>
            <th>{t("dashboard.account")}</th>
            <th>{t("dashboard.unread")}</th>
            <th>{t("dashboard.lastCheck")}</th>
            <th>{t("dashboard.activeChains")}</th>
            <th>{t("dashboard.status")}</th>
          </tr>
        </thead>
        <tbody>
          {accounts?.map((account) => (
            <tr key={account.id}>
              <td>{account.name}</td>
              <td>{account.state?.last_unread_count ?? "–"}</td>
              <td>
                {account.state?.last_checked_at ? new Date(account.state.last_checked_at).toLocaleString() : t("dashboard.notCheckedYet")}
              </td>
              <td>{account.active_chain_count}</td>
              <td>
                <StatusPill account={account} />
                {account.state?.last_error && <span className="hint"> — {account.state.last_error}</span>}
              </td>
            </tr>
          ))}
          {accounts?.length === 0 && (
            <tr>
              <td colSpan={5} className="hint">
                {t("dashboard.noAccounts")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </AppShell>
  );
}
