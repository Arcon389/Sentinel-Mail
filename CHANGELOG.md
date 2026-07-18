# Changelog

Alle nennenswerten Änderungen an Sentinel Mail werden hier dokumentiert.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [Unreleased]

### Hinzugefügt

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

### Behoben

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
