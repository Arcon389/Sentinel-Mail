import { useState } from "react";
import { useTranslation } from "react-i18next";
import { printersApi, buildDeviceUri, type DiscoveredPrinter, type PrinterProtocol } from "../../api/printers";
import { ApiError } from "../../api/client";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

type WizardStep = "connect" | "capabilities" | "defaults" | "done";
type ConnectMode = "search" | "byIp" | "advanced";

export function SetupWizard({ onCreated, onCancel }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<WizardStep>("connect");
  const [mode, setMode] = useState<ConnectMode>("search");
  const [name, setName] = useState("");
  const [connectionUri, setConnectionUri] = useState("");
  const [ipHost, setIpHost] = useState("");
  const [ipPort, setIpPort] = useState("");
  const [protocol, setProtocol] = useState<PrinterProtocol>("ipp");
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredPrinter[]>([]);
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
        setError(t("printerWizard.noPrintersFound"));
      }
    } catch {
      setError(t("printerWizard.discoveryFailed"));
    } finally {
      setDiscovering(false);
    }
  };

  const resolvedUri = () =>
    mode === "byIp" ? buildDeviceUri(protocol, ipHost, ipPort ? Number(ipPort) : undefined) : connectionUri;

  const connect = async () => {
    setError(null);
    setCreating(true);
    const uri = resolvedUri();
    try {
      const printer = await printersApi.create({
        name: name || ipHost || uri,
        connection_uri: uri,
        is_active: true,
        default_options: options,
      });
      setCreatedPrinter(printer);
      setOptions(printer.default_options);
      setStep("capabilities");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("printerWizard.connectionFailed"));
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
    setTestResult(t("printerWizard.printingTestPage"));
    try {
      const result = await printersApi.testPrint(createdPrinter.id);
      setTestResult(result.success ? `✓ ${result.message}` : `✗ ${result.message}`);
    } catch {
      setTestResult(`✗ ${t("printerWizard.testPrintFailed")}`);
    }
  };

  return (
    <div className="printer-wizard">
      <h2>{t("printerWizard.title")}</h2>

      {step === "connect" && (
        <div className="wizard-step">
          <h3>{t("printerWizard.step1")}</h3>

          <div className="mode-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "search"} onClick={() => setMode("search")}>
              {t("printerWizard.modeSearch")}
            </button>
            <button type="button" role="tab" aria-selected={mode === "byIp"} onClick={() => setMode("byIp")}>
              {t("printerWizard.modeByIp")}
            </button>
            <button type="button" role="tab" aria-selected={mode === "advanced"} onClick={() => setMode("advanced")}>
              {t("printerWizard.modeAdvanced")}
            </button>
          </div>

          {mode === "search" && (
            <div className="mode-panel">
              <button type="button" onClick={runDiscovery} disabled={discovering}>
                {discovering
                  ? t("printerWizard.searching")
                  : discovered.length > 0
                    ? t("printerWizard.searchAgain")
                    : t("printerWizard.searchNetwork")}
              </button>
              {discovered.length > 0 && (
                <ul className="discovered-list">
                  {discovered.map((d) => (
                    <li key={d.uri}>
                      <button
                        type="button"
                        className={connectionUri === d.uri ? "selected" : undefined}
                        onClick={() => {
                          setName(d.name);
                          setConnectionUri(d.uri);
                        }}
                      >
                        <span className="discovered-name">
                          {d.name}
                          {d.make_and_model ? ` — ${d.make_and_model}` : ""}
                        </span>
                        <span className="discovered-uri">{d.uri}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mode === "byIp" && (
            <div className="mode-panel">
              <label>
                {t("printerWizard.protocol")}
                <select value={protocol} onChange={(e) => setProtocol(e.target.value as PrinterProtocol)}>
                  <option value="ipp">{t("printerWizard.protocolIpp")}</option>
                  <option value="socket">{t("printerWizard.protocolSocket")}</option>
                  <option value="lpd">{t("printerWizard.protocolLpd")}</option>
                </select>
              </label>
              <label>
                {t("printerWizard.ipAddress")}
                <input value={ipHost} onChange={(e) => setIpHost(e.target.value)} placeholder="192.168.1.50" />
              </label>
              <label>
                {t("printerWizard.port")}
                <input
                  type="number"
                  min={1}
                  value={ipPort}
                  onChange={(e) => setIpPort(e.target.value)}
                  placeholder={String({ ipp: 631, socket: 9100, lpd: 515 }[protocol])}
                />
              </label>
              {ipHost.trim() && <p className="hint">{resolvedUri()}</p>}
            </div>
          )}

          {mode === "advanced" && (
            <div className="mode-panel">
              <label>
                {t("printerWizard.ippUri")}
                <input value={connectionUri} onChange={(e) => setConnectionUri(e.target.value)} required />
              </label>
            </div>
          )}

          <label>
            {t("printerWizard.name")}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="button-row">
            <button type="button" onClick={connect} disabled={creating || !resolvedUri()}>
              {creating ? t("printerWizard.connecting") : t("printerWizard.connect")}
            </button>
            <button type="button" onClick={onCancel}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {step === "capabilities" && createdPrinter && (
        <div className="wizard-step">
          <h3>{t("printerWizard.step2")}</h3>
          <ul>
            <li>{t("printerWizard.capDuplex", { state: createdPrinter.capabilities.duplex_supported ? t("printerWizard.supported") : t("printerWizard.notSupported") })}</li>
            <li>{t("printerWizard.capColor", { state: createdPrinter.capabilities.color_supported ? t("printerWizard.supported") : t("printerWizard.notSupported") })}</li>
            <li>{t("printerWizard.capPaper", { sizes: createdPrinter.capabilities.paper_sizes.join(", ") || t("printerWizard.paperUnknown") })}</li>
          </ul>
          <button type="button" onClick={() => setStep("defaults")}>
            {t("common.next")}
          </button>
        </div>
      )}

      {step === "defaults" && createdPrinter && (
        <div className="wizard-step">
          <h3>{t("printerWizard.step3")}</h3>
          <label>
            {t("printerWizard.copies")}
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
              {t("printerWizard.duplexBoth")}
            </label>
          )}
          {createdPrinter.capabilities.color_supported && (
            <label>
              <input type="checkbox" checked={options.color} onChange={(e) => setOptions({ ...options, color: e.target.checked })} />
              {t("printerWizard.color")}
            </label>
          )}
          <label>
            {t("printerWizard.paperFormat")}
            <select value={options.paper_size} onChange={(e) => setOptions({ ...options, paper_size: e.target.value })}>
              {(createdPrinter.capabilities.paper_sizes.length ? createdPrinter.capabilities.paper_sizes : ["A4"]).map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={saveDefaults}>
            {t("printerWizard.saveAndNext")}
          </button>
        </div>
      )}

      {step === "done" && createdPrinter && (
        <div className="wizard-step">
          <h3>{t("printerWizard.step4")}</h3>
          <button type="button" onClick={testPrint}>
            {t("printerWizard.printTestPage")}
          </button>
          {testResult && <p>{testResult}</p>}
          <button type="button" onClick={onCreated}>
            {t("printerWizard.finish")}
          </button>
        </div>
      )}
    </div>
  );
}
