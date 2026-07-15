import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../api/client";
import { usersApi } from "../api/users";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/common/AppShell";

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

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
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Anlegen fehlgeschlagen"),
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
    <AppShell title="Benutzerverwaltung">
      <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({ email, password, role });
          }}
        >
          <h2>Neuer Benutzer</h2>
          <label>
            E-Mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Passwort
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </label>
          <label>
            Rolle
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "user")}>
              <option value="user">Benutzer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Anlegen</button>
        </form>

        <h2>Benutzer</h2>
        <table>
          <thead>
            <tr>
              <th>E-Mail</th>
              <th>Rolle</th>
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
                    <option value="user">Benutzer</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  {u.id !== currentUser?.id && <button onClick={() => deleteMutation.mutate(u.id)}>Löschen</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </AppShell>
  );
}
