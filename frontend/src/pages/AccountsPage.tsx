import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Account, type AccountInput, accountsApi, formatTestResult } from "../api/accounts";
import { ApiError } from "../api/client";
import { AppShell } from "../components/common/AppShell";
import { useConfirm } from "../components/common/ConfirmDialog";

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
  sender_list: null,
  sender_list_mode: "off",
};

// Tri-state <select> value <-> use_idle (null = global default).
const useIdleToSelect = (value: boolean | null): string =>
  value === null ? "default" : value ? "on" : "off";
const selectToUseIdle = (value: string): boolean | null =>
  value === "default" ? null : value === "on";

export function AccountsPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list });
  const { data: defaults } = useQuery({ queryKey: ["account-defaults"], queryFn: accountsApi.defaults });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AccountInput>(emptyForm);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setTestResult(null);
  };

  const createMutation = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      closeForm();
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : t("accounts.saveFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AccountInput> }) => accountsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      closeForm();
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : t("accounts.saveFailed")),
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
    setShowForm(true);
    setFormError(null);
    setTestResult(null);
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
      sender_list: account.sender_list,
      sender_list_mode: account.sender_list_mode,
    });
  };

  const onTest = async () => {
    // A new account is tested with the form's password (required by the API);
    // an existing account reuses its stored password server-side. Guard the
    // new-account case so an empty password shows a hint instead of a raw 422.
    if (!editingId && !form.password) {
      setTestResult(`✗ ${t("accounts.testEnterPassword")}`);
      return;
    }
    setTestResult(t("accounts.testing"));
    try {
      const result = editingId ? await accountsApi.testExisting(editingId) : await accountsApi.testNew(form);
      setTestResult(formatTestResult(result, t));
    } catch (err) {
      setTestResult(err instanceof ApiError ? `✗ ${err.message}` : `✗ ${t("accounts.testFailed")}`);
    }
  };

  return (
    <AppShell title={t("nav.accounts")}>
      {!showForm && !editingId && (
        <button type="button" onClick={() => { setForm(emptyForm); setShowForm(true); }}>
          {t("accounts.newAccountButton")}
        </button>
      )}
      {(showForm || editingId) && (
      <form onSubmit={onSubmit} className="account-form">
          <h2>{editingId ? t("accounts.editAccount") : t("accounts.newAccount")}</h2>
          <label>
            {t("accounts.name")}
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            {t("accounts.imapHost")}
            <input
              value={form.imap_host}
              onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
              required
            />
          </label>
          <label>
            {t("accounts.port")}
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
            {t("accounts.ssl")}
          </label>
          <label>
            {t("accounts.username")}
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </label>
          <label>
            {t("accounts.password")} {editingId && t("accounts.passwordUnchangedHint")}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingId}
            />
          </label>
          <label>
            {t("accounts.folder")}
            <input value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} required />
          </label>
          <label>
            {t("accounts.pollInterval")}
            <input
              type="number"
              min={5}
              placeholder={
                defaults
                  ? t("accounts.pollPlaceholderDefault", { seconds: defaults.default_poll_interval_seconds })
                  : t("accounts.pollPlaceholderGlobal")
              }
              value={form.poll_interval_seconds ?? ""}
              onChange={(e) =>
                setForm({ ...form, poll_interval_seconds: e.target.value ? Number(e.target.value) : null })
              }
            />
          </label>
          <p className="hint">
            {t("accounts.pollHint", {
              suffix: defaults
                ? t("accounts.pollHintDefaultSuffix", { seconds: defaults.default_poll_interval_seconds })
                : "",
            })}
          </p>
          <label>
            {t("accounts.livePush")}
            <select
              value={useIdleToSelect(form.use_idle)}
              onChange={(e) => setForm({ ...form, use_idle: selectToUseIdle(e.target.value) })}
            >
              <option value="default">
                {defaults
                  ? t("accounts.livePushDefaultWith", {
                      state: defaults.default_use_idle ? t("accounts.on") : t("accounts.off"),
                    })
                  : t("accounts.livePushDefault")}
              </option>
              <option value="on">{t("accounts.livePushOn")}</option>
              <option value="off">{t("accounts.livePushOff")}</option>
            </select>
          </label>
          <p className="hint">{t("accounts.livePushHint")}</p>
          <label>
            {t("accounts.senderListMode")}
            <select
              value={form.sender_list_mode}
              onChange={(e) => setForm({ ...form, sender_list_mode: e.target.value as AccountInput["sender_list_mode"] })}
            >
              <option value="off">{t("accounts.senderListModeOff")}</option>
              <option value="whitelist">{t("accounts.senderListModeWhitelist")}</option>
              <option value="blacklist">{t("accounts.senderListModeBlacklist")}</option>
            </select>
          </label>
          {form.sender_list_mode !== "off" && (
            <label>
              {t("accounts.senderList")}
              <textarea
                rows={4}
                value={form.sender_list ?? ""}
                onChange={(e) => setForm({ ...form, sender_list: e.target.value || null })}
              />
            </label>
          )}
          <p className="hint">{t("accounts.senderListHint")}</p>
          <label>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            {t("accounts.activeMonitoring")}
          </label>
          {formError && <p className="error">{formError}</p>}
          {testResult && <p>{testResult}</p>}
          <div className="button-row">
            <button type="button" onClick={onTest}>
              {t("accounts.testConnection")}
            </button>
            <button type="submit">{editingId ? t("common.save") : t("common.create")}</button>
            <button type="button" onClick={closeForm}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

        <h2>{t("accounts.accountsHeading")}</h2>
        {isLoading && <p>{t("common.loading")}</p>}
        <table>
          <thead>
            <tr>
              <th>{t("accounts.name")}</th>
              <th>{t("accounts.host")}</th>
              <th>{t("accounts.active")}</th>
              <th>{t("accounts.unread")}</th>
              <th>{t("accounts.lastCheck")}</th>
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
                <td>{account.is_active ? t("common.yes") : t("common.no")}</td>
                <td>{account.state?.last_unread_count ?? "–"}</td>
                <td>{account.state?.last_checked_at ? new Date(account.state.last_checked_at).toLocaleString() : "–"}</td>
                <td>
                  <button onClick={() => onEdit(account)}>{t("common.edit")}</button>
                  <button
                    className="danger-button"
                    onClick={async () => {
                      if (
                        await confirm({
                          message: t("accounts.deleteAccountConfirm", { name: account.name }),
                          danger: true,
                        })
                      ) {
                        deleteMutation.mutate(account.id);
                      }
                    }}
                  >
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </AppShell>
  );
}
