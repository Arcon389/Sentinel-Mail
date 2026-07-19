import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";

export function SetupWizardPage() {
  const { t } = useTranslation();
  const { setupRequired, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!setupRequired) return <Navigate to="/login" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t("setup.passwordsMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await authApi.setup(email, password);
      await refresh();
      navigate("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("setup.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form onSubmit={onSubmit} className="auth-form">
        <h1>{t("setup.title")}</h1>
        <p>{t("setup.subtitle")}</p>
        <label>
          {t("setup.email")}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          {t("setup.password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label>
          {t("setup.confirmPassword")}
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {t("setup.submit")}
        </button>
        <div className="auth-language">
          <LanguageSwitcher compact />
        </div>
      </form>
    </div>
  );
}
