# Sentinel Mail

Selbst gehostete, Docker-basierte Web-App zur Überwachung mehrerer IMAP-Postfächer mit
konfigurierbaren Aktionsketten (REST-API-Aufruf, Webhook, E-Mail senden, Drucken, Pause,
Loop), ausgelöst durch die Trigger "neue ungelesene Mail" und "alle Mails gelesen"
(Inbox Zero). Alle Ausführungen werden sowohl auf stdout/Docker-Logs als auch strukturiert
in der Datenbank protokolliert und lassen sich in der Web-Oberfläche filtern.

## Features

- **Mehrere IMAP-Postfächer** parallel überwachen, mit konfigurierbarem Poll-Intervall
  pro Konto (oder global über `DEFAULT_POLL_INTERVAL_SECONDS`)
- **Aktionsketten** pro Konto und Trigger-Typ (`unread_new` / `inbox_zero`), mit
  beliebig vielen Schritten in frei sortierbarer Reihenfolge (Drag & Drop):
  - **REST-API-Aufruf / Webhook**: beliebige HTTP-Methode, Header, drei Body-Modi
    (JSON-Rohtext, JSON aus Name/Value-Paaren, `x-www-form-urlencoded`), Platzhalter
    (`{account_name}`, `{unread_count}`, `{subject}`, `{sender}`) mit Autocomplete und
    "Test senden"-Funktion direkt im Editor
  - **E-Mail senden** über den konfigurierten SMTP-Server
  - **Drucken** über einen eingerichteten Drucker (Mailtext und/oder Anhänge, mit
    Dateityp-Filter)
  - **Pause** (konfigurierbare Wartezeit zwischen Schritten)
  - **Loop**: die gesamte Kette wiederholen, mit Pause zwischen Durchläufen, entweder
    mit einer festen Obergrenze (max. 1000 Wiederholungen) oder **unendlich**, bis die
    Kette/das Konto deaktiviert wird oder das Postfach 0 ungelesene Mails erreicht
  - Pro Schritt konfigurierbares Fehlerverhalten (Kette abbrechen oder mit dem nächsten
    Schritt fortfahren)
- **Drucker-Verwaltung**: eigener CUPS-Container, Einrichtungsassistent mit
  Netzwerk-Discovery (via CUPS: mDNS + SNMP), einfacher IP-Eingabe mit
  Protokollwahl (IPP/Raw-Socket/LPD) oder manueller Geräte-URI, Anzeige der
  Drucker-Fähigkeiten (Duplex, Farbe), Testdruck
- **Ausführungs-Logs**: durchsuchbar/filterbar nach Konto und Status, mit Paginierung
- **Benutzerverwaltung**: mehrere Admin-/Benutzer-Konten, Argon2-Passwort-Hashing,
  JWT-Session in httpOnly-Cookie
- **Mehrsprachige Oberfläche** (i18n): aktuell Deutsch und Englisch, umschaltbar im Profil
  sowie auf den Login-/Setup-Seiten; die Wahl wird pro Nutzer gespeichert. Weitere Sprachen
  lassen sich einfach ergänzen (siehe [Projektstruktur](#projektstruktur))
- Keine Mandantentrennung über die Auth hinaus: Konten, Ketten, Logs und Drucker sind
  global sichtbar für alle angemeldeten Benutzer

## Architektur

- **backend/** — FastAPI-App (REST-API, Auth, DB-Zugriff über SQLAlchemy + Alembic)
- **worker/** — separater Prozess; pollt IMAP-Konten per `asyncio`-Loop und führt
  Aktionsketten aus (lange laufende bzw. unendliche Ketten laufen in einem
  entkoppelten Hintergrund-Thread, damit sie das Polling anderer Konten nicht blockieren)
- **frontend/** — React-SPA (Vite, TypeScript, TanStack Query, react-router, dnd-kit)
- **cups/** — eigener CUPS-Container für die Druckerintegration (IPP)
- **db** — PostgreSQL 16

IMAP-Passwörter werden mit Fernet (Schlüssel aus `ENCRYPTION_KEY`) verschlüsselt in der
Datenbank gespeichert, nie im Klartext.

## Setup

1. `.env` aus `.env.example` erstellen und Secrets setzen:
   ```bash
   cp .env.example .env
   ```
   `ENCRYPTION_KEY` und `JWT_SECRET` mit echten, zufälligen Werten befüllen (Befehle
   dazu stehen als Kommentar in `.env.example`).

2. Stack starten:
   ```bash
   docker compose up --build
   ```
   Der `web`-Container führt beim Start automatisch `alembic upgrade head` aus.

3. Frontend: http://localhost:3000
   Beim ersten Aufruf führt ein Setup-Assistent durch die Anlage des ersten
   Admin-Accounts (alternativ `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` in `.env`
   setzen, dann existiert der Admin bereits beim ersten Start). Direkt nach der ersten
   Anmeldung führt ein einmaliger, überspringbarer Onboarding-Assistent durch die
   Grundeinrichtung (IMAP-Konto → SMTP-Prüfung → Drucker → erste Aktionskette).

   Backend-API direkt: http://localhost:8000/api/health

Ausführliche Anleitung inkl. erster Schritte in der Oberfläche, Entwicklung ohne vollen
Compose-Stack und Architekturhinweisen (CUPS-Netzwerkzugriff, Verschlüsselungs-Key-Rotation):
siehe [`docs/setup.md`](docs/setup.md).

### Drucker im Netzwerk finden (Discovery & Einschränkungen)

Die Netzwerk-Discovery (mDNS + SNMP) läuft **im `cups`-Container**, nicht im `web`-Container.
Damit CUPS die Drucker im LAN überhaupt sehen kann, ist der `cups`-Service in
`docker-compose.yml` auf **`network_mode: host`** gesetzt (kein `ports:`-Mapping — Port 631
wird dann direkt auf dem Host veröffentlicht). Grund: Am Docker-Bridge-Netz bleiben
mDNS-Multicast und SNMP-Broadcasts im internen Container-Subnetz hängen und erreichen die
LAN-Adressen der Drucker (z.B. `192.168.x.x`) nie.

**Einschränkungen:**

- **Docker Desktop (Windows/macOS):** `network_mode: host` bindet dort an die interne
  Linux-VM (WSL2 bzw. HyperKit), **nicht** an dein physisches LAN. Die automatische Suche
  findet Drucker im WLAN/LAN daher meist **trotzdem nicht**. Das ist eine bekannte
  Docker-Desktop-Limitierung, kein Fehler von Sentinel Mail. → Nutze „**Per IP hinzufügen**".
- **Linux-Host:** `network_mode: host` funktioniert wie erwartet; Discovery und Druck sehen
  das LAN direkt.
- **Nur-mDNS-Drucker / gefiltertes SNMP:** Manche Drucker annoncieren ausschließlich per mDNS
  oder haben SNMP deaktiviert. In segmentierten Netzen (VLANs, WLAN-Client-Isolation,
  „AP Isolation") wird Multicast oft geblockt — auch dann findet die Suche nichts.
- **Fallback (immer verfügbar):** Ist die IP bekannt (z.B. `192.168.103.6`), führt „**Per IP
  hinzufügen**" im Assistenten am zuverlässigsten zum Ziel — CUPS muss den Drucker nur zum
  **Drucken** per IP erreichen, nicht per Broadcast auffinden. Beispiel-URIs:
  `ipp://192.168.103.6/ipp/print` (IPP Everywhere), `socket://192.168.103.6:9100`
  (Raw/JetDirect) oder `lpd://192.168.103.6/queue` (LPD).

## Entwicklung

- Backend: `cd backend && pip install -e ".[dev]"`, dann z.B.
  `uvicorn app.main:app --reload` (benötigt eine erreichbare Postgres-Instanz, z.B. via
  `docker compose up -d db`)
- Tests: `cd backend && pytest ../tests`
- Frontend: `cd frontend && npm install && npm run dev` (proxied `/api` per
  `vite.config.ts` auf `localhost:8000`)

## Projektstruktur

Jedes Feature-Modul im Backend folgt dem Muster `models/` (SQLAlchemy) → `schemas/`
(Pydantic) → `api/` (FastAPI-Router, keine Business-Logik) → `services/` (eigentliche
Logik). Der Worker (`worker/worker/`) installiert `backend/app` als editable Package
und teilt sich Models, Schemas und Services mit dem Backend statt sie zu duplizieren.

### Sprache hinzufügen (i18n)

Die Oberfläche nutzt `react-i18next`. Die Übersetzungen liegen als JSON-Kataloge unter
`frontend/src/i18n/locales/<code>/translation.json`, die verfügbaren Sprachen in der
Registry `frontend/src/i18n/languages.ts`. Eine neue Sprache hinzufügen:

1. `frontend/src/i18n/locales/<code>/translation.json` anlegen (Struktur aus `de` kopieren
   und übersetzen — `de` ist die Referenz mit dem vollständigen Schlüsselsatz).
2. In `languages.ts` einen Eintrag `{ code: "<code>", label: "…" }` ergänzen und den Katalog
   in `frontend/src/i18n/index.ts` als `resources` registrieren.

Die pro Nutzer gespeicherte Sprache (`users.locale`) validiert das Backend gegen die
erlaubten Codes in `backend/app/schemas/auth.py` — dort den neuen Code ebenfalls ergänzen.
Serverseitige Meldungen (z.B. Verbindungstest-Ergebnisse) sind derzeit nicht übersetzt.

## Changelog

Siehe [`CHANGELOG.md`](CHANGELOG.md).
