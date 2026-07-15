import { useQuery } from "@tanstack/react-query";
import { accountsApi } from "../api/accounts";
import { AppShell } from "../components/common/AppShell";

function statusPill(account: { is_active: boolean; state?: { last_error: string | null } | null }) {
  if (!account.is_active) return <span className="status-pill status-paused">Pausiert</span>;
  if (account.state?.last_error) return <span className="status-pill status-error">Fehler</span>;
  return <span className="status-pill status-active">Aktiv</span>;
}

export function DashboardPage() {
  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list, refetchInterval: 15000 });

  return (
    <AppShell title="Dashboard">
      <table>
        <thead>
          <tr>
            <th>Konto</th>
            <th>Ungelesen</th>
            <th>Letzter Check</th>
            <th>Aktive Ketten</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {accounts?.map((account) => (
            <tr key={account.id}>
              <td>{account.name}</td>
              <td>{account.state?.last_unread_count ?? "–"}</td>
              <td>
                {account.state?.last_checked_at ? new Date(account.state.last_checked_at).toLocaleString() : "noch nicht geprüft"}
              </td>
              <td>{account.active_chain_count}</td>
              <td>
                {statusPill(account)}
                {account.state?.last_error && <span className="hint"> — {account.state.last_error}</span>}
              </td>
            </tr>
          ))}
          {accounts?.length === 0 && (
            <tr>
              <td colSpan={5} className="hint">
                Noch keine IMAP-Konten angelegt.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </AppShell>
  );
}
