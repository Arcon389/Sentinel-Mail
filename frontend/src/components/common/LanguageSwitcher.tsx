import { useTranslation } from "react-i18next";
import { authApi } from "../../api/auth";
import { useAuth } from "../../auth/AuthContext";
import { LANGUAGES } from "../../i18n/languages";

interface Props {
  // Compact variant renders just the <select> (e.g. on the auth pages),
  // without the surrounding label block used on the profile page.
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const current = i18n.resolvedLanguage ?? i18n.language;

  const onChange = async (locale: string) => {
    // changeLanguage also caches the choice to localStorage via the detector.
    await i18n.changeLanguage(locale);
    // Persist per-user when signed in; the auth pages have no user yet.
    if (user) {
      try {
        await authApi.updateLocale(locale);
      } catch {
        // Non-fatal: the language still applies locally for this session.
      }
    }
  };

  const select = (
    <select
      className="language-select"
      value={current}
      onChange={(e) => void onChange(e.target.value)}
      aria-label={t("language.label")}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );

  if (compact) return select;

  return (
    <label>
      {t("language.label")}
      {select}
    </label>
  );
}
