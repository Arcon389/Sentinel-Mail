import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";

export function LoginPage() {
  const { t } = useTranslation();
  const { user, setupRequired, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (setupRequired) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await authApi.login(email, password);
      await refresh();
      navigate(loggedIn.role === "admin" && !loggedIn.onboarding_completed_at ? "/onboarding" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form onSubmit={onSubmit} className="auth-form">
        <h1>{t("login.title")}</h1>
        <label>
          {t("login.email")}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          {t("login.password")}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {t("login.submit")}
        </button>
        <div className="auth-language">
          <LanguageSwitcher compact />
        </div>
      </form>
    </div>
  );
}
