# Sentinel Mail — Setup-Anleitung

## Voraussetzungen

- Docker + Docker Compose (v2)
- Ein IMAP-Postfach zum Testen (z.B. ein Gmail-Konto mit App-Passwort)
- Optional: ein IPP-fähiger Netzwerkdrucker, falls die Druckfunktion genutzt werden soll

## 1. Konfiguration

```bash
cp .env.example .env
```

Danach in `.env` mindestens folgende Werte setzen:

- `POSTGRES_PASSWORD` — beliebiges sicheres Passwort
- `ENCRYPTION_KEY` — Fernet-Schlüssel, generieren mit:
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```
- `JWT_SECRET` — zufälliger String, generieren mit:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```

Optional:
- `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` — falls gesetzt, wird beim ersten Start automatisch ein Admin angelegt. Andernfalls führt die Web-Oberfläche beim ersten Aufruf durch einen Setup-Assistenten.
- `SMTP_HOST` und zugehörige `SMTP_*`-Variablen — nur nötig, wenn Aktionsketten mit dem Schritt "E-Mail senden" verwendet werden sollen.
- `COOKIE_SECURE=false` — nur für lokale Entwicklung ohne HTTPS setzen.

## 2. Starten

```bash
docker compose up --build
```

Startreihenfolge: `db` (mit Healthcheck) → `web` (führt `alembic upgrade head` aus) → `worker` startet parallel, sobald `db` gesund ist. `frontend` und `cups` sind unabhängig davon startklar.

- Web-Oberfläche: http://localhost:3000
- Backend-API direkt: http://localhost:8000/api/health
- CUPS-Weboberfläche (Debugging): http://localhost:631

## 3. Erste Schritte in der Web-Oberfläche

1. **Setup-Assistent** (falls kein `INITIAL_ADMIN_*` gesetzt wurde): Admin-Account anlegen.
2. **Onboarding-Assistent** (`/onboarding`): erscheint einmalig direkt nach der ersten
   Anmeldung und führt durch IMAP-Konto → SMTP-Prüfung → Drucker (optional) → erste
   Aktionskette. Jeder Schritt ist überspringbar; danach erscheint er nicht wieder. Die
   folgenden Punkte lassen sich auch jederzeit einzeln über die Navigation erledigen.
3. **IMAP-Konten** (`/accounts`): Konto anlegen, "Verbindung testen" nutzen, um Zugangsdaten zu prüfen.
4. **Drucker** (`/printers`, optional): über den Einrichtungsassistenten einen Drucker verbinden, Fähigkeiten prüfen, Standardoptionen setzen, Testseite drucken. Der erste Schritt bietet drei Wege: **Netzwerk durchsuchen** (Discovery via CUPS, mDNS + SNMP), **Per IP hinzufügen** (nur IP/Hostname + Protokoll IPP/Raw-Socket/LPD, URI wird automatisch gebaut) oder **Erweitert** (vollständige Geräte-URI von Hand).
5. **Aktionsketten** (`/chains`): pro Konto eine oder mehrere Ketten anlegen, Trigger wählen, Schritte hinzufügen (REST-Call/Webhook mit Body-Typ-Auswahl und "Test senden", E-Mail, Drucken, Pause), Reihenfolge per Drag&Drop anpassen.
6. **Logs** (`/logs`): Ausführungen nach Konto/Status filtern.
7. **Benutzer** (`/users`, nur Admins): weitere Benutzer-Accounts anlegen/verwalten.

## 4. Entwicklung ohne vollen Compose-Stack

Backend:
```bash
cd backend
pip install -e ".[dev]"
docker compose up -d db   # nur die DB
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev   # proxied /api auf localhost:8000, siehe vite.config.ts
```

Tests:
```bash
cd backend
pytest ../tests
```
(Benötigt eine erreichbare, migrierte Postgres-DB für die Integrationstests in `tests/integration/`.)

## 5. Architekturhinweise

- **CUPS**: Sentinel Mail bringt einen eigenen CUPS-Container mit (`cups/`), der Druckjobs per IPP an echte Netzwerkdrucker weiterleitet. Der Container muss Netzwerkzugriff auf die Zieldrucker haben — deshalb ist der `cups`-Service in `docker-compose.yml` standardmäßig auf `network_mode: host` gesetzt (statt eines `ports:`-Mappings). Auch die **Drucker-Discovery** (mDNS + SNMP) läuft in diesem Container; am Docker-Bridge-Netz bleiben mDNS-Multicast und SNMP-Broadcasts im Container-Subnetz hängen und erreichen LAN-Drucker (z.B. `192.168.x.x`) nicht — mit `network_mode: host` auf einem **Linux-Host** dagegen schon. **Einschränkung Docker Desktop (Windows/macOS):** dort bindet `network_mode: host` an die interne Linux-VM, nicht ans physische LAN — die automatische Suche findet dann meist trotzdem nichts. In allen Fällen ohne funktionierende Discovery (auch bei VLANs/WLAN-Client-Isolation oder Nur-mDNS-Druckern) bleibt „Per IP hinzufügen" der zuverlässige Weg — CUPS muss den Drucker nur zum Drucken per IP erreichen, nicht per Broadcast auffinden.
- **Verschlüsselung**: IMAP-Passwörter werden mit Fernet (symmetrisch, Schlüssel aus `ENCRYPTION_KEY`) verschlüsselt in der DB gespeichert. Ein Schlüsselwechsel macht bestehende gespeicherte Passwörter unlesbar — vorher alle Konten neu anlegen oder Passwörter neu eingeben.
- **Worker vs. Web**: Der Worker-Prozess ist komplett getrennt vom Web-Prozess und pollt IMAP-Konten unabhängig; ein Absturz/Neustart des Workers beeinträchtigt die Web-Oberfläche nicht und umgekehrt.
