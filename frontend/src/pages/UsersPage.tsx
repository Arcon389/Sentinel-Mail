import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { usersApi } from "../api/users";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/common/AppShell";

export function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEmail("");
      setPassword("");
      setRole("user");
      setError(null);
      setShowForm(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("users.createFailed")),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "admin" | "user" }) => usersApi.update(id, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <AppShell title={t("users.title")}>
      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)}>
          {t("users.newUserButton")}
        </button>
      )}
      {showForm && (
      <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({ email, password, role });
          }}
        >
          <h2>{t("users.newUser")}</h2>
          <label>
            {t("users.email")}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            {t("users.password")}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </label>
          <label>
            {t("users.role")}
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "user")}>
              <option value="user">{t("users.roleUser")}</option>
              <option value="admin">{t("users.roleAdmin")}</option>
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button type="submit">{t("common.create")}</button>
            <button type="button" onClick={() => { setShowForm(false); setError(null); }}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

        <h2>{t("users.usersHeading")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("users.email")}</th>
              <th>{t("users.role")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value as "admin" | "user" })}
                  >
                    <option value="user">{t("users.roleUser")}</option>
                    <option value="admin">{t("users.roleAdmin")}</option>
                  </select>
                </td>
                <td>
                  {u.id !== currentUser?.id && <button onClick={() => deleteMutation.mutate(u.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </AppShell>
  );
}
