# CLAUDE.md

Projektspezifische Hinweise für die Arbeit an **Sentinel Mail** (siehe `README.md` für die
Feature-/Setup-Übersicht, `CHANGELOG.md` für die Änderungshistorie).

## Grundregeln

- **CHANGELOG pflegen**: Nach jeder inhaltlichen Änderung einen Eintrag unter
  `## [Unreleased]` in `CHANGELOG.md` ergänzen (Deutsch, Format „Keep a Changelog":
  `Hinzugefügt` / `Behoben` / `Dokumentation`).
- Doku-Sprache im Repo ist **Deutsch** (README, CHANGELOG, docs). UI-Texte laufen über i18n
  (siehe unten), nicht als Literale im Code.

## Architektur

- **backend/** — FastAPI. Feature-Muster strikt einhalten:
  `models/` (SQLAlchemy) → `schemas/` (Pydantic) → `api/` (FastAPI-Router, **keine**
  Business-Logik) → `services/` (Logik).
- **worker/** — separater Prozess, installiert `backend/app` als editable Package und teilt
  sich Models/Schemas/Services mit dem Backend (nicht duplizieren).
- **frontend/** — React-SPA (Vite, TypeScript, TanStack Query, react-router, dnd-kit,
  react-i18next).
- **cups/** — CUPS-Container (Druck via IPP). **db** — PostgreSQL 16.
- Feature-übergreifend: IMAP-Passwörter werden mit Fernet (`ENCRYPTION_KEY`) verschlüsselt
  gespeichert, nie im Klartext.

## DB-Migrationen (Alembic)

- Verzeichnis `backend/alembic/versions/`, Namensschema `NNNN_beschreibung.py`, String-Revs
  (`"0001"`…), verkettet über `down_revision`. Neue Spalte = neue Migration nach dem Muster
  der jeweils letzten Datei; parallel das SQLAlchemy-Model in `backend/app/models/` anpassen.
- Der `web`-Container führt beim Start automatisch `alembic upgrade head` aus.

## Bauen & Testen — läuft über Docker

Auf dieser Maschine ist **kein lokales Node/npm und kein lokales Python** verfügbar. Build
und Tests daher im Container ausführen (Docker Desktop; nach einem Reboot ggf. erst starten).

**Frontend-Typecheck/Build** (validiert u.a. alle `t()`-Keys und JSON-Imports):
```sh
cd frontend
docker run --rm -v "${PWD}:/app" -v "/app/node_modules" -w /app node:20-alpine \
  sh -c "npm install --no-audit --no-fund && npm run build"
```
Das anonyme Volume `-v "/app/node_modules"` verhindert, dass Windows-`node_modules` in den
Linux-Container gemountet werden (esbuild/rollup-Binaries sind plattformabhängig).

**Backend-Integrationstests** (`tests/integration/`) — brauchen ein migriertes Postgres:
```sh
docker network create sm-test-net
docker run -d --name sm-test-db --network sm-test-net \
  -e POSTGRES_DB=sentinel_mail -e POSTGRES_USER=sentinel -e POSTGRES_PASSWORD=sentinel \
  postgres:16-alpine
# backend-Image bauen: (cd backend && docker build -t sentinel-mail-web-test .)
docker run --rm --network sm-test-net \
  -e DATABASE_URL="postgresql+psycopg://sentinel:sentinel@sm-test-db:5432/sentinel_mail" \
  -e ENCRYPTION_KEY="<fernet-key>" -e JWT_SECRET="test-secret" \
  -e COOKIE_SECURE="false" \
  -v "$(pwd)/tests:/app/tests" --entrypoint sh sentinel-mail-web-test \
  -c "pip install --no-cache-dir --quiet pytest && alembic upgrade head && pytest tests/integration -v"
```
Wichtig:
- **`COOKIE_SECURE=false` ist für die Tests nötig**: die Auth setzt ein `Secure`-Cookie; der
  Starlette-`TestClient` läuft über `http://` und würde ein Secure-Cookie sonst nicht
  zurücksenden → alle authentifizierten Requests kämen als `401` zurück.
- Die `authed_client`-Fixture erwartet eine **frische** DB (nimmt dann den Setup-Pfad und legt
  `pytest-admin@example.com` an). Nach einem fehlgeschlagenen Lauf die DB neu aufsetzen, sonst
  greift der Login-Zweig mit fremden Credentials und schlägt fehl.
- `tests/conftest.py` setzt `ENCRYPTION_KEY`/`JWT_SECRET` als Default und hängt `worker/` an
  den `sys.path`.

## i18n-Workflow (Frontend)

- Bibliothek `react-i18next`. Kataloge: `frontend/src/i18n/locales/<code>/translation.json`
  (**`de` ist die Referenz** mit vollständigem Schlüsselsatz). Registry der Sprachen:
  `frontend/src/i18n/languages.ts`; Init/Registrierung der `resources`:
  `frontend/src/i18n/index.ts`.
- **Keine deutschen (oder sonstigen) UI-Literale im Code** — immer `t("bereich.key")`.
  Für Texte mit eingebettetem Markup (`<code>` etc.) `<Trans components={{ code: <code/> }}/>`.
- Neue Sprache: JSON-Katalog anlegen, Eintrag in `languages.ts`, `resources` in `index.ts`
  ergänzen, und den erlaubten Code in `backend/app/schemas/auth.py` (`SUPPORTED_LOCALES` /
  `LocaleUpdate`) hinzufügen. Die Sprachwahl wird pro Nutzer in `users.locale` gespeichert
  (Endpunkt `PATCH /api/auth/me/locale`).
- Bei DE↔EN-Änderungen die **Schlüsselparität** wahren (beide Kataloge müssen denselben
  Schlüsselsatz haben).
