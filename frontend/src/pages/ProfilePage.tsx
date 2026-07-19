import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/common/AppShell";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";

export function ProfilePage() {
  const { t } = useTranslation();
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
      setError(t("profile.passwordsMismatch"));
      return;
    }
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMessage(t("profile.changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.changeFailed"));
    }
  };

  return (
    <AppShell title={t("profile.title")}>
      <p>
          {t("profile.loggedInAs")} <strong>{user?.email}</strong> ({user?.role})
        </p>
        <form className="account-form">
          <h2>{t("profile.language")}</h2>
          <LanguageSwitcher />
          <p className="hint">{t("profile.languageHint")}</p>
        </form>
        <form className="account-form" onSubmit={onSubmit}>
          <h2>{t("profile.changePassword")}</h2>
          <label>
            {t("profile.currentPassword")}
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label>
            {t("profile.newPassword")}
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
          </label>
          <label>
            {t("profile.confirmNewPassword")}
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
          <button type="submit">{t("profile.changePassword")}</button>
        </form>
    </AppShell>
  );
}
