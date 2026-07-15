import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { accountsApi } from "../api/accounts";
import { logsApi } from "../api/logs";
import { AppShell } from "../components/common/AppShell";

export function LogsPage() {
  const [accountId, setAccountId] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);

  const { data: accounts } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list });
  const { data } = useQuery({
    queryKey: ["logs", accountId, level, page],
    queryFn: () => logsApi.list({ account_id: accountId || undefined, level: level || undefined, page }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <AppShell title="Logs">
        <div className="log-filters">
          <label>
            Konto
            <select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Alle</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Alle</option>
              <option value="info">Info</option>
              <option value="warning">Warnung</option>
              <option value="error">Fehler</option>
            </select>
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Status</th>
              <th>Ereignis</th>
              <th>Nachricht</th>
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
            Zurück
          </button>
          <span>
            Seite {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Weiter
          </button>
        </div>
    </AppShell>
  );
}
