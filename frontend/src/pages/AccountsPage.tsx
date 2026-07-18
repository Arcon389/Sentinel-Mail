import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Account, type AccountInput, accountsApi } from "../api/accounts";
import { ApiError } from "../api/client";
import { AppShell } from "../components/common/AppShell";

const emptyForm: AccountInput = {
  name: "",
  imap_host: "",
  imap_port: 993,
  use_ssl: true,
  username: "",
  password: "",
  folder: "INBOX",
  poll_interval_seconds: null,
  use_idle: null,
  is_active: true,
};

// Tri-state <select> value <-> use_idle (null = global default).
const useIdleToSelect = (value: boolean | null): string =>
  value === null ? "default" : value ? "on" : "off";
const selectToUseIdle = (value: string): boolean | null =>
  value === "default" ? null : value === "on";

export function AccountsPage() {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list });
  const { data: defaults } = useQuery({ queryKey: ["account-defaults"], queryFn: accountsApi.defaults });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountInput>(emptyForm);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setForm(emptyForm);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AccountInput> }) => accountsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen"),
  });

  const deleteMutation = useMutation({
    mutationFn: accountsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (editingId) {
      const { password, ...rest } = form;
      updateMutation.mutate({ id: editingId, input: password ? form : rest });
    } else {
      createMutation.mutate(form);
    }
  };

  const onEdit = (account: Account) => {
    setEditingId(account.id);
    setForm({
      name: account.name,
      imap_host: account.imap_host,
      imap_port: account.imap_port,
      use_ssl: account.use_ssl,
      username: account.username,
      password: "",
      folder: account.folder,
      poll_interval_seconds: account.poll_interval_seconds,
      use_idle: account.use_idle,
      is_active: account.is_active,
    });
  };

  const onTest = async () => {
    setTestResult("Teste Verbindung...");
    try {
      const result = editingId ? await accountsApi.testExisting(editingId) : await accountsApi.testNew(form);
      setTestResult(result.success ? `✓ ${result.message}` : `✗ ${result.message}`);
    } catch (err) {
      setTestResult(err instanceof ApiError ? `✗ ${err.message}` : "✗ Test fehlgeschlagen");
    }
  };

  return (
    <AppShell title="IMAP-Konten">
      <form onSubmit={onSubmit} className="account-form">
          <h2>{editingId ? "Konto bearbeiten" : "Neues Konto"}</h2>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            IMAP-Host
            <input
              value={form.imap_host}
              onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
              required
            />
          </label>
          <label>
            Port
            <input
              type="number"
              value={form.imap_port}
              onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) })}
              required
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.use_ssl}
              onChange={(e) => setForm({ ...form, use_ssl: e.target.checked })}
            />
            SSL/TLS
          </label>
          <label>
            Benutzername
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </label>
          <label>
            Passwort {editingId && "(leer lassen = unverändert)"}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingId}
            />
          </label>
          <label>
            Ordner
            <input value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} required />
          </label>
          <label>
            Poll-Intervall (Sekunden)
            <input
              type="number"
              min={5}
              placeholder={defaults ? `${defaults.default_poll_interval_seconds} (global, Standard)` : "global"}
              value={form.poll_interval_seconds ?? ""}
              onChange={(e) =>
                setForm({ ...form, poll_interval_seconds: e.target.value ? Number(e.target.value) : null })
              }
            />
          </label>
          <p className="hint">
            Leer lassen, um das globale Standard-Intervall zu verwenden
            {defaults ? ` (aktuell ${defaults.default_poll_interval_seconds} Sekunden, per DEFAULT_POLL_INTERVAL_SECONDS in .env einstellbar)` : ""}.
          </p>
          <label>
            Live-Push (IMAP IDLE)
            <select
              value={useIdleToSelect(form.use_idle)}
              onChange={(e) => setForm({ ...form, use_idle: selectToUseIdle(e.target.value) })}
            >
              <option value="default">
                Standard{defaults ? ` (${defaults.default_use_idle ? "an" : "aus"})` : ""}
              </option>
              <option value="on">An – sofort auf neue Mails reagieren</option>
              <option value="off">Aus – nur zeitgesteuertes Polling</option>
            </select>
          </label>
          <p className="hint">
            Bei „An" hält der Worker eine Verbindung offen und reagiert live auf eingehende
            Nachrichten (IMAP IDLE), statt im Poll-Intervall abzufragen. Ein seltener
            Sicherheits-Poll läuft weiterhin. Server ohne IDLE-Unterstützung fallen automatisch
            auf Polling zurück.
          </p>
          <label>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Aktiv (Überwachung läuft)
          </label>
          {formError && <p className="error">{formError}</p>}
          {testResult && <p>{testResult}</p>}
          <div className="button-row">
            <button type="button" onClick={onTest}>
              Verbindung testen
            </button>
            <button type="submit">{editingId ? "Speichern" : "Anlegen"}</button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Abbrechen
              </button>
            )}
          </div>
        </form>

        <h2>Konten</h2>
        {isLoading && <p>Lädt...</p>}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Host</th>
              <th>Aktiv</th>
              <th>Ungelesen</th>
              <th>Letzter Check</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts?.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>
                  {account.imap_host}:{account.imap_port}
                </td>
                <td>{account.is_active ? "ja" : "nein"}</td>
                <td>{account.state?.last_unread_count ?? "–"}</td>
                <td>{account.state?.last_checked_at ? new Date(account.state.last_checked_at).toLocaleString() : "–"}</td>
                <td>
                  <button onClick={() => onEdit(account)}>Bearbeiten</button>
                  <button onClick={() => deleteMutation.mutate(account.id)}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </AppShell>
  );
}
