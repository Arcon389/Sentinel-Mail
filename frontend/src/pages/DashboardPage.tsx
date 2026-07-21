import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { accountsApi } from "../api/accounts";
import { settingsApi } from "../api/settings";
import { statsApi, type StatsWindow } from "../api/stats";
import { AppShell } from "../components/common/AppShell";
import { useAuth } from "../auth/AuthContext";

const WINDOWS: StatsWindow[] = ["1h", "24h", "7d", "1m"];

function StatusPill({
  account,
}: {
  account: { is_active: boolean; maintenance_mode: boolean; state?: { last_error: string | null } | null };
}) {
  const { t } = useTranslation();
  if (account.maintenance_mode) return <span className="status-pill status-paused">{t("dashboard.statusMaintenance")}</span>;
  if (!account.is_active) return <span className="status-pill status-paused">{t("dashboard.statusPaused")}</span>;
  if (account.state?.last_error) return <span className="status-pill status-error">{t("dashboard.statusError")}</span>;
  return <span className="status-pill status-active">{t("dashboard.statusActive")}</span>;
}

function GlobalMaintenanceCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["app-settings"], queryFn: settingsApi.get });
  const mutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });

  return (
    <section className="stats-charts">
      <label>
        <input
          type="checkbox"
          checked={settings?.maintenance_mode ?? false}
          onChange={(e) => mutation.mutate({ maintenance_mode: e.target.checked })}
        />
        {t("dashboard.globalMaintenance")}
      </label>
      <p className="hint">{t("dashboard.globalMaintenanceHint")}</p>
    </section>
  );
}

function formatTick(iso: string, window: StatsWindow): string {
  const date = new Date(iso);
  if (window === "1h" || window === "24h") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

function StatsCharts() {
  const { t } = useTranslation();
  const [window, setWindow] = useState<StatsWindow>("24h");
  const { data } = useQuery({
    queryKey: ["stats", window],
    queryFn: () => statsApi.timeseries(window),
    refetchInterval: 15000,
  });

  const chartData = (data?.points ?? []).map((point) => ({
    label: formatTick(point.bucket, window),
    triggers: point.triggers,
    chains: point.chains,
  }));

  return (
    <section className="stats-charts">
      <div className="stats-charts-header">
        <h2>{t("dashboard.charts")}</h2>
        <div className="stats-window-switch">
          {WINDOWS.map((value) => (
            <button
              key={value}
              type="button"
              className={value === window ? "active" : ""}
              onClick={() => setWindow(value)}
            >
              {t(`dashboard.window${value}`)}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="triggers" name={t("dashboard.triggers")} stroke="#2563eb" dot={false} />
          <Line type="monotone" dataKey="chains" name={t("dashboard.chains")} stroke="#16a34a" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list, refetchInterval: 15000 });
  const failingAccounts = accounts?.filter((account) => account.state?.last_error && !account.maintenance_mode) ?? [];

  return (
    <AppShell title={t("nav.dashboard")}>
      {user?.role === "admin" && <GlobalMaintenanceCard />}
      {failingAccounts.length > 0 && (
        <section className="stats-charts">
          <h2>{t("dashboard.connectionIssues")}</h2>
          <ul>
            {failingAccounts.map((account) => (
              <li key={account.id}>
                {account.name} — {account.state?.last_error}
              </li>
            ))}
          </ul>
        </section>
      )}
      <StatsCharts />
      <table>
        <thead>
          <tr>
            <th>{t("dashboard.account")}</th>
            <th>{t("dashboard.unread")}</th>
            <th>{t("dashboard.lastCheck")}</th>
            <th>{t("dashboard.activeChains")}</th>
            <th>{t("dashboard.lastTriggered")}</th>
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
                {account.last_triggered_at ? new Date(account.last_triggered_at).toLocaleString() : t("dashboard.neverTriggered")}
              </td>
              <td>
                <StatusPill account={account} />
                {account.state?.last_error && <span className="hint"> — {account.state.last_error}</span>}
              </td>
            </tr>
          ))}
          {accounts?.length === 0 && (
            <tr>
              <td colSpan={6} className="hint">
                {t("dashboard.noAccounts")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </AppShell>
  );
}
