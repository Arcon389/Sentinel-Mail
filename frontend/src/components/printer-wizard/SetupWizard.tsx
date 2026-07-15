import { useState } from "react";
import { printersApi } from "../../api/printers";
import { ApiError } from "../../api/client";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

type WizardStep = "connect" | "capabilities" | "defaults" | "done";

export function SetupWizard({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState<WizardStep>("connect");
  const [name, setName] = useState("");
  const [connectionUri, setConnectionUri] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<{ name: string; uri: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdPrinter, setCreatedPrinter] = useState<Awaited<ReturnType<typeof printersApi.create>> | null>(null);
  const [options, setOptions] = useState({ copies: 1, duplex: false, color: false, paper_size: "A4" });
  const [testResult, setTestResult] = useState<string | null>(null);

  const runDiscovery = async () => {
    setDiscovering(true);
    setError(null);
    try {
      const found = await printersApi.discover();
      setDiscovered(found);
      if (found.length === 0) {
        setError("Keine Drucker per mDNS/Bonjour gefunden. Bitte IP-Adresse/Hostname manuell eingeben.");
      }
    } catch {
      setError("Discovery fehlgeschlagen. Bitte IP-Adresse/Hostname manuell eingeben.");
    } finally {
      setDiscovering(false);
    }
  };

  const connect = async () => {
    setError(null);
    setCreating(true);
    try {
      const printer = await printersApi.create({
        name: name || connectionUri,
        connection_uri: connectionUri,
        is_active: true,
        default_options: options,
      });
      setCreatedPrinter(printer);
      setOptions(printer.default_options);
      setStep("capabilities");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verbindung fehlgeschlagen");
    } finally {
      setCreating(false);
    }
  };

  const saveDefaults = async () => {
    if (!createdPrinter) return;
    await printersApi.update(createdPrinter.id, { default_options: options });
    setStep("done");
  };

  const testPrint = async () => {
    if (!createdPrinter) return;
    setTestResult("Drucke Testseite...");
    try {
      const result = await printersApi.testPrint(createdPrinter.id);
      setTestResult(result.success ? `✓ ${result.message}` : `✗ ${result.message}`);
    } catch {
      setTestResult("✗ Testdruck fehlgeschlagen");
    }
  };

  return (
    <div className="printer-wizard">
      <h2>Drucker einrichten</h2>

      {step === "connect" && (
        <div className="wizard-step">
          <h3>1. Verbindung herstellen</h3>
          <button type="button" onClick={runDiscovery} disabled={discovering}>
            {discovering ? "Suche..." : "Netzwerk nach Druckern durchsuchen"}
          </button>
          {discovered.length > 0 && (
            <ul>
              {discovered.map((d) => (
                <li key={d.uri}>
                  <button
                    type="button"
                    onClick={() => {
                      setName(d.name);
                      setConnectionUri(d.uri);
                    }}
                  >
                    {d.name} ({d.uri})
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            IPP-URI (z.B. ipp://192.168.1.50:631/ipp/print)
            <input value={connectionUri} onChange={(e) => setConnectionUri(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button type="button" onClick={connect} disabled={creating || !connectionUri}>
              {creating ? "Verbinde..." : "Verbinden"}
            </button>
            <button type="button" onClick={onCancel}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {step === "capabilities" && createdPrinter && (
        <div className="wizard-step">
          <h3>2. Fähigkeiten</h3>
          <ul>
            <li>Duplex: {createdPrinter.capabilities.duplex_supported ? "unterstützt" : "nicht unterstützt"}</li>
            <li>Farbe: {createdPrinter.capabilities.color_supported ? "unterstützt" : "nicht unterstützt"}</li>
            <li>Papierformate: {createdPrinter.capabilities.paper_sizes.join(", ") || "unbekannt"}</li>
          </ul>
          <button type="button" onClick={() => setStep("defaults")}>
            Weiter
          </button>
        </div>
      )}

      {step === "defaults" && createdPrinter && (
        <div className="wizard-step">
          <h3>3. Standardoptionen</h3>
          <label>
            Kopien
            <input
              type="number"
              min={1}
              value={options.copies}
              onChange={(e) => setOptions({ ...options, copies: Number(e.target.value) })}
            />
          </label>
          {createdPrinter.capabilities.duplex_supported && (
            <label>
              <input type="checkbox" checked={options.duplex} onChange={(e) => setOptions({ ...options, duplex: e.target.checked })} />
              Duplex (beidseitig)
            </label>
          )}
          {createdPrinter.capabilities.color_supported && (
            <label>
              <input type="checkbox" checked={options.color} onChange={(e) => setOptions({ ...options, color: e.target.checked })} />
              Farbe
            </label>
          )}
          <label>
            Papierformat
            <select value={options.paper_size} onChange={(e) => setOptions({ ...options, paper_size: e.target.value })}>
              {(createdPrinter.capabilities.paper_sizes.length ? createdPrinter.capabilities.paper_sizes : ["A4"]).map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={saveDefaults}>
            Speichern &amp; weiter
          </button>
        </div>
      )}

      {step === "done" && createdPrinter && (
        <div className="wizard-step">
          <h3>4. Testseite drucken</h3>
          <button type="button" onClick={testPrint}>
            Testseite drucken
          </button>
          {testResult && <p>{testResult}</p>}
          <button type="button" onClick={onCreated}>
            Fertig
          </button>
        </div>
      )}
    </div>
  );
}
