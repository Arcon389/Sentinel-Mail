import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { accountsApi } from "../api/accounts";
import { logsApi } from "../api/logs";
import { AppShell } from "../components/common/AppShell";

export function LogsPage() {
  const { t } = useTranslation();
  const [accountId, setAccountId] = useState("");
  const [level, setLevel] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [page, setPage] = useState(1);

  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list });
  const { data } = useQuery({
    queryKey: ["logs", accountId, level, showDebug, page],
    queryFn: () =>
      logsApi.list({ account_id: accountId || undefined, level: level || undefined, include_debug: showDebug, page }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <AppShell title={t("nav.logs")}>
        <div className="log-filters">
          <label>
            {t("logs.account")}
            <select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("common.all")}</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("logs.status")}
            <select
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("common.all")}</option>
              <option value="debug">{t("logs.debug")}</option>
              <option value="info">{t("logs.info")}</option>
              <option value="warning">{t("logs.warning")}</option>
              <option value="error">{t("logs.error")}</option>
            </select>
          </label>
          <label className="log-show-details">
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => {
                setShowDebug(e.target.checked);
                setPage(1);
              }}
            />
            {t("logs.showDetails")}
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>{t("logs.time")}</th>
              <th>{t("logs.status")}</th>
              <th>{t("logs.event")}</th>
              <th>{t("logs.message")}</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((log) => (
              <tr key={log.id} className={`log-row-${log.level}`}>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.level}</td>
                <td>{log.event_type}</td>
                <td>{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("common.back")}
          </button>
          <span>{t("logs.page", { page, total: totalPages })}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {t("common.next")}
          </button>
        </div>
    </AppShell>
  );
}
