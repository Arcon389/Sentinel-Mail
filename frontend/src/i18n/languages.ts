// Central registry of available languages.
// To add a language: add an entry here and create a matching
// `locales/<code>/translation.json` file — nothing else is required.
export interface Language {
  code: string;
  label: string;
}

export const LANGUAGES: Language[] = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

export const DEFAULT_LOCALE = "de";

export const SUPPORTED_LOCALES = LANGUAGES.map((l) => l.code);
