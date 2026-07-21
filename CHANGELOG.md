# Changelog

Alle nennenswerten Änderungen an Sentinel Mail werden hier dokumentiert.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [Unreleased]

### Hinzugefügt

- **Logeintrag „Kette gestartet"**: Zu Beginn jeder Kettenausführung wird jetzt ein
  `CHAIN_STARTED`-Eintrag geschrieben (`worker/worker/chain_executor.py`), sodass der Übergang von
  Auslösung zu Ausführung in den Logs sichtbar ist (Migration `0009` ergänzt den Enum-Wert).
- **Detail-Logs ein-/ausblendbar**: Die Log-Ansicht (`/logs`) blendet Schritt-Detaileinträge
  (`STEP_EXECUTED`) standardmäßig aus; eine Checkbox „Detail-Logs anzeigen" bzw. die Statusauswahl
  „Detail" blendet sie bei Bedarf ein (`frontend/src/pages/LogsPage.tsx`, Query-Param
  `include_debug` in `backend/app/api/logs.py`).
- **Anlege-Formulare hinter „Neu"-Button**: Auf der Konten- und der Benutzer-Seite ist das
  Anlege-Formular standardmäßig ausgeblendet und öffnet sich erst per Button „+ Neues Konto" bzw.
  „+ Neuer Benutzer" (`frontend/src/pages/AccountsPage.tsx`, `frontend/src/pages/UsersPage.tsx`);
  „Bearbeiten" öffnet es vorbefüllt, „Abbrechen"/Speichern schließt es wieder.
- **Kontoweiter Absender-Filter (Whitelist/Blacklist)**: Pro IMAP-Konto lässt sich eine
  Absenderliste mit Modus Whitelist oder Blacklist hinterlegen (neue Spalten `sender_list`/
  `sender_list_mode`, Migration `0007`). Der Filter greift kontoweit im Worker, bevor eine Kette
  startet (`account_allows_sender` in `worker/worker/chain_matcher.py`, Hook in
  `worker/worker/poller.py`).
- **Anpassbare Schritt-Überschrift**: Kettenschritte können eine eigene Überschrift erhalten
  (neue Spalte `chain_steps.title`, Migration `0008`). Die vorangestellte Nummer wird aus der
  Listenposition abgeleitet und bleibt so unabhängig von der Überschrift immer korrekt fortlaufend
  (`frontend/src/components/chain-editor/StepCard.tsx`, `.../StepList.tsx`).
- **Schritte per Auf/Ab-Button verschieben**: Zusätzlich zum Drag&Drop lassen sich Schritte über
  ▲/▼-Buttons in der Reihenfolge verschieben; nutzt den bestehenden Reorder-Endpunkt
  (`frontend/src/components/chain-editor/StepCard.tsx`, `.../StepList.tsx`).

- **Dashboard – Spalte „Zuletzt ausgelöst"**: Die Konten-Tabelle auf dem Dashboard
  (`frontend/src/pages/DashboardPage.tsx`) zeigt pro Konto den Zeitpunkt der letzten Auslösung
  (jüngster `TRIGGER_DETECTED`-Eintrag). Der Wert wird on-the-fly aus `execution_logs` aggregiert
  (`_attach_last_triggered` in `backend/app/api/accounts.py`, Feld `last_triggered_at` in
  `AccountWithState`), ohne neue DB-Spalte.
- **Dashboard – Aktivitäts-Charts (live)**: Neuer Chart-Bereich mit Zeitreihen für „Auslösungen"
  (`TRIGGER_DETECTED`) und „Ketten" (`CHAIN_COMPLETED`) und Fensterauswahl 1h/24h/7d/1m
  (Recharts, Auto-Refresh alle 15 s). Datenquelle ist der neue Endpunkt
  `GET /api/stats/timeseries` (`backend/app/api/stats.py`, `backend/app/services/stats.py`), der
  die Ereignisse in gleichmäßige Zeit-Buckets aggregiert und Lücken mit 0 füllt.

- **Drucker nachträglich bearbeiten**: Auf der Drucker-Seite (`/printers`) gibt es pro Drucker
  jetzt einen „Bearbeiten"-Button, über den sich Name, Standardoptionen (Kopien, Duplex, Farbe,
  Papierformat) und die Verbindungs-URI ändern lassen
  (`frontend/src/components/printer-wizard/PrinterEditForm.tsx`). Wird die Verbindungs-URI
  geändert, wird die CUPS-Queue entsprechend angepasst und die Fähigkeiten neu abgefragt
  (`PATCH /api/printers/{id}` in `backend/app/api/printers.py`, `PrinterUpdate` um
  `connection_uri` erweitert).

### Geändert

- **`STEP_EXECUTED` auf neuen Loglevel `debug`**: Erfolgreiche Einzelschritte laufen nicht mehr
  auf `INFO`, sondern auf dem neuen, niedrigsten Loglevel `debug` und sind damit standardmäßig
  ausgeblendet (`backend/app/models/execution_log.py`, `worker/worker/chain_executor.py`,
  Migration `0009`).
- **Webhook-/REST-Editor aufgeräumt**: Da Header und Body optional sind, sind ihre Rubriken im
  Schritt-Editor (`frontend/src/components/rest-wizard/RestStepForm.tsx`) jetzt standardmäßig
  eingeklappt (native `<details>`/`<summary>`, Summary mit „(optional)"-Hinweis) und werden nur
  bei Bedarf ausgeklappt. Die Grundfelder Methode und URL bleiben direkt sichtbar.
- **Schutz vor versehentlichem Löschen**: Die Lösch-Buttons auf der Ketten-Seite
  (`/chains`, „Kette löschen") und der Konten-Seite (`/accounts`, „Löschen") sind jetzt rot
  (danger) dargestellt und fragen vor dem Löschen nach. Die Rückfrage läuft über einen
  in die App integrierten Bestätigungsdialog (`ConfirmProvider`/`useConfirm` in
  `frontend/src/components/common/ConfirmDialog.tsx`) statt über das native
  Browser-`window.confirm`; er ist wiederverwendbar (promise-basiert) und per Escape/Enter
  bedienbar.

### Behoben

- **Worker-Fehler `relation "accounts" does not exist` beim Start**: `web` und `worker`
  starteten beide gleichzeitig, sobald Postgres gesund war — die DB-Migrationen
  (`alembic upgrade head`) laufen aber erst danach im `web`-Container. Der `worker` fragte die
  `accounts`-Tabelle ab, bevor sie existierte, und protokollierte einen Traceback (er erholte
  sich zwar per Retry, das Log-Rauschen war aber irreführend). `web` hat jetzt einen Healthcheck
  gegen `/api/health`; `worker` und `frontend` warten via `depends_on: condition: service_healthy`
  darauf, dass `web` (und damit die Migrationen) fertig ist. Das behebt zusätzlich das
  `nginx: host not found in upstream "web"` beim Frontend-Start.
- **Stack startet nicht bei CRLF-Zeilenenden**: Gelangten die Quelldateien nicht per frischem
  `git clone`, sondern kopiert/gezippt aus einem Windows-Arbeitsbaum auf den Server, hatten die
  Entrypoint-Skripte CRLF-Zeilenenden. Die Shebang-Zeile endete dann auf `\r`, der Kernel suchte
  den Interpreter `/bin/sh\r` und `web`/`cups` brachen mit `exec ./docker-entrypoint.sh: no such
  file or directory` ab. Da `web` nie startete, lief `alembic upgrade head` nicht, wodurch
  Folgefehler wie `relation "accounts" does not exist` (db/worker) und `host not found in
  upstream "web"` (frontend) entstanden. `backend/Dockerfile` und `cups/Dockerfile` strippen ein
  evtl. vorhandenes `\r` jetzt beim Build (`sed -i 's/\r$//'`), sodass der Build unabhängig von
  den Zeilenenden der Quelldateien funktioniert.
- **debconf-Warnungen beim Docker-Build**: Beim `docker build` (v.a. des `cups`-Images)
  erschienen Meldungen wie `debconf: unable to initialize frontend: Dialog`/`Readline` und
  `Can't locate Term/ReadLine.pm in @INC`. Das war nur Log-Rauschen (der Build lief durch),
  weil `apt-get` in einem Container ohne interaktives Terminal die debconf-Frontends
  durchprobierte. Die Dockerfiles (`cups/`, `backend/`, `worker/`) setzen jetzt
  `ARG DEBIAN_FRONTEND=noninteractive` vor dem `apt-get`-Aufruf, wodurch debconf direkt
  nicht-interaktiv läuft und keine Frontend-Warnungen mehr ausgibt.
- **Netzwerkdrucker werden nicht erkannt**: Der `cups`-Container lief am Docker-Bridge-Netz
  (`ports: "631:631"`), wodurch mDNS-Multicast und SNMP-Broadcasts im Container-Subnetz
  hängenblieben und Drucker im LAN (z.B. `192.168.103.6`) nicht gefunden wurden. Der Service
  nutzt jetzt `network_mode: host` (in `docker-compose.yml`), sodass CUPS-Discovery und
  Druck direkten Zugriff auf das Host-LAN haben. Hinweis: Unter Docker Desktop
  (Windows/macOS) ist der „Host" die Linux-VM — dort Drucker weiterhin per URI manuell anlegen.
- **Webhook-/REST-Steps ohne Body**: Ein `webhook`-/`rest_call`-Step schlug mit „Format string
  contains positional fields" fehl, sobald nur eine URL (ohne Body) konfiguriert war — der
  leere Default-Body `{}` wurde durch `str.format_map` geschickt und scheiterte an den
  positionalen Klammern. Dasselbe traf jeden echten JSON-Body mit literalen geschweiften
  Klammern (z.B. `{"foo": "bar"}`). Die Platzhalter-Ersetzung (`render_template` in
  `backend/app/services/template_engine.py`) ersetzt jetzt nur noch bekannte
  `{platzhalter}`-Tokens und lässt alle übrigen Klammern literal stehen. Header und Body sind
  damit wie vorgesehen optional.

### Hinzugefügt

- **Drucker einfacher hinzufügen**: Der Einrichtungs-Assistent bietet jetzt drei Wege im ersten
  Schritt — „Netzwerk durchsuchen", „Per IP hinzufügen" und „Erweitert (URI)". Bei der IP-Eingabe
  tippt man nur IP/Hostname (+ optional Port) und wählt das **Protokoll** (IPP, Raw/Socket 9100
  bzw. JetDirect, LPD 515); die passende Geräte-URI wird automatisch gebaut
  (`buildDeviceUri` in `frontend/src/api/printers.ts`). Damit lassen sich auch Drucker anbinden,
  die kein IPP sprechen. Die vollständige URI-Eingabe bleibt als „Erweitert" erhalten.
- **Zuverlässigere Drucker-Suche über CUPS**: Die Netzwerk-Discovery läuft jetzt primär über den
  CUPS-Server (`pycups getDevices()` → CUPS-Backends `dnssd`/mDNS und `snmp`) statt über eine
  `zeroconf`-Suche im `web`-Container. Sie wird damit im Netzwerk-Namespace des `cups`-Containers
  ausgeführt und findet Drucker auch dann, wenn der `web`-Container das LAN im Docker-Bridge-Netz
  nicht sieht. Die bisherige mDNS-Suche bleibt als Fallback erhalten. Endpunkt
  `GET /api/printers/discover` liefert zusätzlich `make_and_model`/`device_class`.

### Dokumentation

- Hinweis in `docker-compose.yml`/Setup ergänzt, dass `network_mode: host` für den `cups`-Dienst
  jetzt auch für die **Drucker-Discovery** (nicht nur den Druck) empfohlen ist, wenn Drucker aus
  dem Docker-Bridge-Netz nicht erreichbar sind.
- **README/`docs/setup.md`**: Neuer Abschnitt „Drucker im Netzwerk finden (Discovery &
  Einschränkungen)" — erklärt, dass mDNS/SNMP im `cups`-Container laufen, warum `network_mode: host`
  jetzt Standard ist, und dokumentiert die Grenzen (Docker Desktop bindet an die Linux-VM statt ans
  physische LAN; VLAN-/WLAN-Client-Isolation blockt Multicast; Nur-mDNS-Drucker) samt Fallback
  „Per IP hinzufügen".

- **Mehrsprachigkeit (i18n)**: Die Oberfläche ist jetzt mehrsprachig und wird zusätzlich zu
  Deutsch in **Englisch** ausgeliefert. Basierend auf `react-i18next` mit JSON-Katalogen pro
  Sprache (`frontend/src/i18n/locales/<code>/translation.json`) und einer zentralen
  Sprach-Registry (`frontend/src/i18n/languages.ts`) — eine weitere Sprache hinzuzufügen
  bedeutet: einen Eintrag in der Registry ergänzen und eine neue JSON-Datei anlegen. Die
  Sprachwahl ist über einen Umschalter in `Profil` sowie kompakt auf den Login-/Setup-Seiten
  möglich; sie wird **pro Nutzer in der DB** gespeichert (neue Spalte `users.locale`, Migration
  `0006`, Endpunkt `PATCH /api/auth/me/locale`) und beim Login angewendet, mit `localStorage`
  als Fallback für die Vor-Login-Seiten und automatischer Browser-Spracherkennung. Hinweis:
  Serverseitige Meldungen (z.B. Verbindungstest-Ergebnisse) bleiben vorerst unübersetzt.
- **Onboarding-Assistent nach dem ersten Login**: Nach der ersten Anmeldung wird ein Admin
  einmalig durch einen mehrstufigen Assistenten (`/onboarding`) geführt — IMAP-Konto anlegen
  (inkl. „Verbindung testen"), SMTP-Prüfung (Status + optionale Testmail), optional Drucker
  einrichten und eine erste Aktionskette anlegen. Jeder Schritt ist überspringbar. Der
  Assistent erscheint nur beim allerersten Login; ein persistentes Flag
  (`users.onboarding_completed_at`) verhindert erneutes Anzeigen. Damit
  greift der Flow auch, wenn der Admin per `INITIAL_ADMIN_*` angelegt wurde und der bisherige
  Setup-Assistent (Admin-Anlage) übersprungen wird (Flag via Migration `0005`). Neue Endpunkte
  `POST /api/auth/complete-onboarding`, `GET /api/system/smtp-status` und
  `POST /api/system/smtp-test`.
- **Live-Push (IMAP IDLE)**: Konten können jetzt per IMAP IDLE (RFC 2177) sofort auf
  eingehende Nachrichten reagieren, statt im festen Intervall abgefragt zu werden. Neu pro
  Konto umschaltbar (Feld `use_idle`: Standard/An/Aus) mit globalem Fallback
  (`DEFAULT_USE_IDLE`). Der Worker hält je aktivem IDLE-Konto eine Push-Verbindung offen
  (`worker/worker/idle_watcher.py`); bei Server-Aktivität ruft er den bestehenden
  `poll_account`-Pfad auf, sodass Trigger-, Logging- und Ketten-Logik unverändert bleiben.
  Ein seltener Sicherheits-Poll (`IDLE_SAFETY_POLL_SECONDS`, Standard 900s) läuft weiter,
  und Server ohne IDLE-Unterstützung fallen automatisch auf zeitgesteuertes Polling zurück.
  IDLE wird vor dem ~29-Min-Server-Timeout neu ausgehandelt (`IDLE_REFRESH_SECONDS`),
  Verbindungsabbrüche werden mit exponentiellem Backoff neu aufgebaut. Neue Abhängigkeit
  `imapclient`; Migration `0003` fügt die Spalte `accounts.use_idle` hinzu.
- **Zeitsteuerung für Aktionsketten**: pro Kette optional ein Zeitfenster (Von/Bis),
  in dem die Kette ausgeführt werden darf; Fenster über Mitternacht (z.B. 22:00–06:00)
  werden unterstützt. Ausgewertet gegen eine konfigurierbare Zeitzone (`APP_TIMEZONE`,
  Standard `UTC`).
- **Bedingungen für Aktionsketten**: pro Kette optionale Filter auf die auslösende
  Mail – Absender (Modus „enthält“ oder REGEX), Betreff-REGEX und Body-REGEX – wahlweise
  per UND (alle) oder ODER (eine) verknüpft; leere Felder werden ignoriert. Der Mailtext
  wird nur bei gesetzter Body-Bedingung zusätzlich per IMAP geladen. Durch Zeitfenster
  oder Bedingungen übersprungene Ketten werden im Log als `chain_skipped` vermerkt.
  Migration `0004` fügt die Spalten auf `action_chains` hinzu.

### Dokumentation

- `README.md` um die mehrsprachige Oberfläche und einen Abschnitt „Sprache hinzufügen (i18n)"
  ergänzt. Neue `CLAUDE.md` mit projektspezifischen Hinweisen (Architektur-/Migrationsmuster,
  Docker-basierter Frontend-Build und Backend-Integrationstests inkl. der `COOKIE_SECURE=false`-
  Eigenheit des TestClients, i18n-Workflow).

### Behoben

- Bereits angelegte Ketten im Aktionsketten-Editor werden jetzt als klar abgegrenzte,
  anklickbare Einträge (Karten-Optik mit Rahmen und Hover) dargestellt. Zuvor wirkten
  sie durch die transparente Fläche wie bloßer Text und waren kaum von der Überschrift
  „Ketten" zu unterscheiden.
- Verbindungstest für ein **neues** Konto ohne Passwort lieferte einen rohen
  `422`-Fehler; der Test-Button prüft jetzt vorab und zeigt einen klaren Hinweis
  („Bitte zuerst ein Passwort eingeben"). Zusätzlich werden FastAPI-Validierungs-
  fehler (`detail`-Array) im Frontend jetzt als lesbarer Text statt als
  `[object Object]` angezeigt.
- `.gitattributes` ergänzt, das `*.sh` auf LF-Zeilenenden festlegt. Ohne diese Datei
  checkte Git auf Windows (mit `core.autocrlf=true`) die Container-Entrypoints
  `cups/docker-entrypoint.sh` und `backend/docker-entrypoint.sh` mit CRLF aus. Das `\r`
  in der Shebang-Zeile ließ die Container mit
  `exec /usr/local/bin/docker-entrypoint.sh: no such file or directory` sterben
  (CUPS Exit 255); zudem lief `alembic upgrade head` nie, sodass die Tabelle `accounts`
  fehlte (`relation "accounts" does not exist`).

## [0.1.0] - 2026-07-15

Erste lauffähige Version.

### Hinzugefügt

- **Auth & Benutzerverwaltung**: Login/Logout, Argon2-Passwort-Hashing, JWT-Session in
  httpOnly-Cookie, Setup-Assistent für den ersten Admin-Account (alternativ über
  `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD`), Benutzerverwaltung für Admins
  (inkl. Schutz gegen Löschen/Herabstufen des letzten Admins bzw. des eigenen Kontos)
- **IMAP-Konten**: CRUD, Verbindungstest, Fernet-verschlüsselte Passwortspeicherung,
  konfigurierbares Poll-Intervall pro Konto mit globalem Fallback
  (`DEFAULT_POLL_INTERVAL_SECONDS`)
- **Worker**: `asyncio`-Poll-Loop, UID-basiertes IMAP-Polling, Erkennung der Trigger
  "neue ungelesene Mail" (`unread_new`) und "Inbox Zero" (`inbox_zero`) über
  Unread-Count-Übergänge
- **Aktionsketten**: pro Konto und Trigger-Typ, beliebig viele Schritte in
  sortierbarer Reihenfolge (Drag & Drop), pro Schritt konfigurierbares
  Fehlerverhalten (Kette abbrechen / fortfahren)
  - Schritt-Typen: REST-API-Aufruf, Webhook, E-Mail senden, Drucken, Pause
  - REST-API-Aufruf/Webhook: Methode, Header, drei Body-Modi (JSON-Rohtext, JSON aus
    Name/Value-Paaren, `x-www-form-urlencoded`), Platzhalter-Autocomplete, "Test
    senden"-Funktion, die exakt denselben Code-Pfad wie die echte Ausführung nutzt
  - Loop: Kette mit Pause zwischen Durchläufen wiederholen, wahlweise mit fester
    Obergrenze (max. 1000) oder **unendlich** bis die Kette/das Konto deaktiviert wird
    (zusätzlich bricht der Loop immer vorzeitig ab, sobald das Postfach 0 ungelesene
    Mails erreicht); lang laufende bzw. unendliche Ketten werden in einem
    entkoppelten Hintergrund-Thread ausgeführt, damit sie das Polling anderer Konten
    nicht blockieren
- **Drucken**: eigener CUPS-Container, Einrichtungsassistent mit mDNS/Bonjour-Discovery
  oder manueller IPP-URI, Anzeige der Drucker-Fähigkeiten, Testdruck, Print-Schritt mit
  Filter auf Mailtext/Anhänge/Dateityp
- **Logs**: strukturierte Ausführungs-Logs (DB + stdout), filterbar nach Konto und
  Status, mit Paginierung in der UI
- **Frontend**: React-SPA mit App-Shell-Layout (Sidebar-Navigation), durchgängiges
  helles/dunkles Design über CSS Custom Properties
- **Docker Compose**: Services `db`, `web`, `worker`, `cups`, `frontend`;
  automatische Migrationen beim Start von `web`

### Behoben

- Enum-Spalten verwendeten standardmäßig den Python-Enum-Namen statt des Werts, was zu
  `invalid input value for enum`-Fehlern führte (`values_callable` ergänzt)
- Fehlende SQLAlchemy-`relationship()`-Deklarationen führten dazu, dass `state` und
  `steps` in API-Antworten leer blieben
- CUPS lehnte Requests mit `Host: cups:631` ab (`ServerAlias *` ergänzt) und verweigerte
  Druckaufträge ohne explizite `<Policy>`-Freigabe
- CUPS-Konfiguration wurde durch das persistente Volume dauerhaft überschrieben;
  Entrypoint kopiert `cupsd.conf` jetzt bei jedem Start neu aus dem Image
- Healthcheck der Datenbank verursachte `FATAL: database "sentinel" does not exist`
  (fehlendes `-d`-Flag bei `pg_isready`)
- Worker stürzte in einer Race Condition ab, wenn er vor Abschluss der
  Alembic-Migration von `web` pollte (`relation "accounts" does not exist`); Anfrage
  wird jetzt abgefangen und im nächsten Tick wiederholt
- Neu hinzugefügte Aktionsschritte lieferten `422 Unprocessable Entity`, weil leere
  Standardwerte (URL, Absender/Empfänger) von der Validierung abgelehnt wurden
- `nginx` im `frontend`-Container cachte die IP-Adresse des `web`-Containers und
  lieferte nach einem Neubau von `web` `502 Bad Gateway`, bis `frontend` neu gestartet
  wurde

### Dokumentation

- `README.md` und `docs/setup.md` mit Setup-Anleitung, Architekturübersicht und
  bekannten Betriebs-Hinweisen (CUPS-Netzwerkzugriff, Verschlüsselungs-Key-Rotation)
