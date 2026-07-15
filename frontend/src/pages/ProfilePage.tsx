import { useState } from "react";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/common/AppShell";

export function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMessage("Passwort geändert");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ändern fehlgeschlagen");
    }
  };

  return (
    <AppShell title="Profil">
      <p>
          Angemeldet als <strong>{user?.email}</strong> ({user?.role})
        </p>
        <form className="account-form" onSubmit={onSubmit}>
          <h2>Passwort ändern</h2>
          <label>
            Aktuelles Passwort
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label>
            Neues Passwort
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
          </label>
          <label>
            Neues Passwort bestätigen
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          {message && <p>{message}</p>}
          <button type="submit">Passwort ändern</button>
        </form>
    </AppShell>
  );
}
