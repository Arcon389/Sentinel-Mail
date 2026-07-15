# Prompt für Claude Code

Baue eine Docker-basierte Web-App namens **Sentinel Mail** zur Überwachung
mehrerer IMAP-Postfächer mit konfigurierbaren Aktionsketten. Details unten.

## Ziel

Eine selbst gehostete Web-App, die mehrere IMAP-Konten überwacht. Pro Konto
können beliebige Aktionsketten (Action Chains) definiert werden, die bei
bestimmten Ereignissen ausgelöst werden:

- **Trigger "neue ungelesene Mail"**: sobald mindestens eine neue ungelesene
  Mail im Postfach erscheint.
- **Trigger "alle Mails gelesen"**: sobald das Postfach wieder auf 0
  ungelesene Mails steht (Inbox-Zero-Ereignis).

Jede Aktionskette besteht aus einer geordneten Liste von Schritten. Mögliche
Schritt-Typen:

1. **REST-API-Aufruf** (Methode, URL, Header, JSON-Body-Template mit
   Platzhaltern wie `{account_name}`, `{unread_count}`, `{subject}`,
   `{sender}`)
2. **Webhook absetzen** (im Grunde ein REST-Call, aber als eigener Typ mit
   Signatur-Header o.ä., falls sinnvoll)
3. **E-Mail versenden** (SMTP, konfigurierbarer Absender/Empfänger/Betreff/
   Body-Template)
4. **Drucken** (Mailtext und/oder Anhänge). In der Aktionskette wird dazu
   nur noch ein bereits eingerichteter Drucker samt Druckoptionen
   ausgewählt (siehe Abschnitt "Druckerverwaltung" unten) — die technische
   Einrichtung des Druckers selbst passiert getrennt davon. Konfigurierbar
   pro Schritt:
   - Drucker (Auswahl aus den zentral eingerichteten Druckern)
   - Was gedruckt werden soll: Mailtext, Anhänge, oder beides
   - Anhang-Filter (z.B. nur bestimmte Dateitypen wie PDF/Bilder drucken,
     andere ignorieren)
   - Druckoptionen: Anzahl Kopien, Simplex/Duplex, Farbe/Schwarz-Weiß,
     Papierformat — als Override der Drucker-Standardoptionen, sofern der
     Drucker das unterstützt
5. **Pause** (konfigurierbare Wartezeit in Sekunden zwischen zwei Schritten)
6. **Loop**: die gesamte Kette (oder ein Teil davon) soll wiederholbar sein,
   bis eine Bedingung erfüllt ist (z.B. "bis keine ungelesenen Mails mehr da
   sind") oder eine maximale Anzahl Wiederholungen erreicht ist (Sicherheitsnetz
   gegen Endlosschleifen).

Alle Ausführungen (jeder Trigger, jeder Schritt, jeder Fehler) müssen
geloggt werden — sowohl in einer Log-Datei/stdout (für Docker-Logs) als auch
strukturiert in der Datenbank, damit sie in der Web-Oberfläche einsehbar sind.

## Tech-Stack (Vorschlag, bitte so umsetzen sofern nicht dagegen spricht)

- **Backend**: Python mit FastAPI
- **Datenbank**: PostgreSQL (via SQLAlchemy + Alembic für Migrationen)
- **Hintergrund-Worker**: separater Prozess/Container, der die IMAP-Konten
  pollt und die Action Chains ausführt (z.B. mit `apscheduler` oder eigener
  Poll-Loop), getrennt vom Web-Prozess
- **Frontend**: einfache, aber sauber gestaltete Weboberfläche (React oder
  serverseitig gerenderte Templates mit FastAPI + Jinja2 + htmx — bitte
  die pragmatischste Lösung wählen, kein Overengineering)
- **Auth**: Benutzeranmeldung mit Passwort-Hashing (bcrypt/argon2) und
  Session- oder JWT-basierter Authentifizierung. Reiner Zugriffsschutz für
  die Web-Oberfläche — **kein Multi-Tenant-Konzept**. IMAP-Konten,
  Aktionsketten und Logs gehören nicht einzelnen Benutzern, sondern sind
  global für alle angemeldeten Benutzer sichtbar und bearbeitbar. Mehrere
  Benutzer-Accounts sollen möglich sein (einfaches Rollenmodell reicht:
  Admin / Benutzer), aber es gibt keine pro-Benutzer-Trennung der
  Konfigurationsdaten
- **Containerisierung**: Dockerfile(s) + `docker-compose.yml` mit Services für
  Web-App, Worker, Datenbank (und optional Reverse Proxy). `.env`-Datei für
  Konfiguration/Secrets, keine Zugangsdaten hart codieren

## Funktionale Anforderungen im Detail

### Benutzerverwaltung
- Login-Seite, Logout, Passwort ändern
- Erster Start: initialer Admin-Benutzer wird über Umgebungsvariablen oder
  ein Setup-Assistenten beim ersten Aufruf angelegt

### IMAP-Konten verwalten
- CRUD-Oberfläche: Host, Port, SSL/TLS, Benutzername, Passwort, Ordner
- IMAP-Zugangsdaten **verschlüsselt** in der Datenbank speichern (z.B. mit
  `cryptography.fernet`, Schlüssel aus Umgebungsvariable)
- "Verbindung testen"-Button pro Konto
- Konten können aktiviert/deaktiviert werden (pausiert die Überwachung)

### Aktionsketten verwalten
- Pro Konto eine oder mehrere Aktionsketten definierbar
- Jede Kette: Name, zugehöriger Trigger-Typ ("neue ungelesene Mail" /
  "alle Mails gelesen"), geordnete Liste von Schritten (siehe Schritt-Typen
  oben)
- Pro Kette konfigurierbar: Loop ja/nein, Pause zwischen Wiederholungen,
  maximale Anzahl Wiederholungen
- Aktionsketten können aktiviert/deaktiviert werden, ohne sie zu löschen

### Druckerverwaltung (separat von Aktionsketten)
- Eigener Bereich in der Weboberfläche, unabhängig von Konten/Aktionsketten,
  in dem Drucker zentral eingerichtet werden — die Aktionskette selbst wählt
  später nur noch einen fertig eingerichteten Drucker aus
- Einrichtung soll **stark unterstützt** sein, d.h.:
  - Netzwerk-Drucker-Erkennung/Discovery, sofern technisch machbar (z.B.
    per IPP/mDNS/Bonjour im lokalen Netz), alternativ manuelle Eingabe von
    IP-Adresse/Hostname
  - Geführter Einrichtungs-Dialog (Schritt für Schritt: Verbindung
    herstellen, Fähigkeiten/PPD auslesen, Standardoptionen setzen)
  - "Testseite drucken"-Button direkt in der Einrichtung, um die
    Konfiguration sofort zu verifizieren
  - Anzeige der vom Drucker unterstützten Fähigkeiten (Duplex, Farbe,
    Papierformate), damit in der Aktionskette später nur gültige Optionen
    wählbar sind
  - Drucker können umbenannt, bearbeitet, deaktiviert oder gelöscht werden
- Technischer Ansatz: CUPS (Common Unix Printing System) als Backend
  verwenden — entweder Anbindung an einen bestehenden CUPS-Server im
  Netzwerk, oder ein eigener CUPS-Container/-Service, der Druckjobs via IPP
  an die tatsächlichen Netzwerkdrucker weiterreicht. Bitte zu Beginn kurz
  Vor-/Nachteile beider Varianten skizzieren und eine Empfehlung geben (siehe
  auch Abschnitt "Bitte am Anfang klären" unten)

### Ausführungs-Engine (Worker)
- Pollt alle aktiven IMAP-Konten in konfigurierbarem Intervall (pro Konto
  oder global einstellbar)
- Erkennt Übergänge (neue ungelesene Mail seit letztem Check / Übergang von
  "ungelesene Mails vorhanden" zu "keine ungelesenen Mails mehr") anhand des
  zuletzt bekannten Zustands pro Konto (in der DB gespeichert), nicht nur
  anhand des aktuellen Snapshots
- Führt die passenden Aktionsketten aus, inklusive Pausen und Loop-Logik
- Robuste Fehlerbehandlung: ein fehlgeschlagener Schritt darf die restliche
  Kette/den restlichen Worker nicht crashen; Fehler werden geloggt und die
  Kette läuft (je nach Konfiguration) weiter oder bricht ab

### Logging
- Strukturierte Logs (Zeitstempel, Konto, Aktionskette, Schritt, Status,
  Fehlermeldung falls vorhanden) in der Datenbank, abrufbar/filterbar über
  die Weboberfläche (nach Konto, Zeitraum, Status)
- Zusätzlich normales Logging nach stdout/stderr (damit `docker logs`
  funktioniert), z.B. mit Python `logging`-Modul, Log-Level konfigurierbar
  über Umgebungsvariable

### Weboberfläche – Seiten
- Login
- Dashboard: Übersicht aller Konten mit Status (ungelesene Mails, letzter
  Check, aktive Ketten)
- Konto-Verwaltung (CRUD + Verbindungstest)
- Druckerverwaltung (Einrichtungs-Assistent, Testdruck, Fähigkeiten-Übersicht)
- Aktionsketten-Editor pro Konto (Schritte hinzufügen/entfernen/umordnen,
  Trigger wählen, Loop/Pause konfigurieren, im Drucken-Schritt nur Auswahl
  aus bereits eingerichteten Druckern + Druckoptionen)
- Log-/Historien-Ansicht mit Filtern
- Benutzer-/Profileinstellungen

## Nicht-funktionale Anforderungen
- Projektname **Sentinel Mail** — bitte in README, UI-Titel/Header,
  `docker-compose.yml`-Projektnamen und ggf. Docker-Image-Namen verwenden
- Alles läuft über `docker-compose up` startklar (inkl. DB-Migrationen beim
  Start)
- Konfiguration über `.env`-Datei (DB-Zugangsdaten, Verschlüsselungs-Key,
  initiale Admin-Zugangsdaten, Log-Level)
- Code sauber strukturiert (z.B. `app/`, `worker/`, `models/`, `api/`,
  `templates/` bzw. `frontend/`), mit README zur Einrichtung
- Tests zumindest für die Kernlogik (Trigger-Erkennung, Aktionsketten-
  Ausführung, Verschlüsselung der Zugangsdaten)

## Bitte am Anfang klären/vorschlagen
- Hinweis: Es gibt bereits ein Projekt namens **"Formular Manager"**, in dem
  die Einrichtung von REST-API-Verbindungen sehr nutzerfreundlich
  Schritt-für-Schritt umgesetzt wurde. Bitte dort nachschauen (Codebasis,
  falls im selben Repo/Verzeichnis oder anderweitig zugänglich) und diese
  UX als Vorbild für die REST-API-Konfiguration in Sentinel Mail
  verwenden (sowohl für den REST-API-Aktionsschritt als auch ggf. für
  Webhook-Einrichtung). Falls das Projekt nicht auffindbar ist, bitte beim
  Nutzer nachfragen, wo es liegt bzw. sich Details dazu geben lassen, bevor
  mit der REST-API-Einrichtungsoberfläche begonnen wird
- Konkrete Wahl zwischen React-Frontend (separates Build) und
  Server-Side-Rendering mit htmx — kurz Vor-/Nachteile nennen und eine
  Empfehlung geben, dann mit der Empfehlung weitermachen, sofern ich nicht
  widerspreche
- Grobes Datenbankschema (Tabellen: users, accounts, action_chains,
  chain_steps, execution_logs, account_state, printers) vor der
  Implementierung kurz skizzieren. Wichtig: `users` dient ausschließlich der
  Login-Authentifizierung und Rollenverwaltung — `accounts`,
  `action_chains`, `chain_steps`, `execution_logs`, `account_state` und
  `printers` haben **keine** Fremdschlüssel-Bindung an einen bestimmten
  Benutzer, sondern sind global gültig
- Architektur-Entscheidung fürs Drucken: eigener CUPS-Container im
  `docker-compose.yml` vs. Anbindung an vorhandenen CUPS-Server im
  Netzwerk des Nutzers — kurz Vor-/Nachteile nennen (Deployment-Komplexität,
  Netzwerkzugriff auf Drucker aus dem Container heraus, Wartung von
  Treibern/PPDs) und eine Empfehlung geben

Starte mit einer Projektstruktur und einem Setup-Plan, bevor du mit der
vollständigen Implementierung beginnst.
