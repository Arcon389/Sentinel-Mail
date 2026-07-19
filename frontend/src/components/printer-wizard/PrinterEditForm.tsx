import { useState } from "react";
import { useTranslation } from "react-i18next";
import { printersApi, type Printer } from "../../api/printers";
import { ApiError } from "../../api/client";

interface Props {
  printer: Printer;
  onSaved: () => void;
  onCancel: () => void;
}

export function PrinterEditForm({ printer, onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(printer.name);
  const [connectionUri, setConnectionUri] = useState(printer.connection_uri);
  const [options, setOptions] = useState(printer.default_options);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paperSizes = printer.capabilities.paper_sizes.length ? printer.capabilities.paper_sizes : ["A4"];

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await printersApi.update(printer.id, {
        name,
        connection_uri: connectionUri,
        default_options: options,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("printerWizard.connectionFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="printer-wizard">
      <h2>{t("printers.editHeading")}</h2>
      <div className="wizard-step">
        <label>
          {t("printerWizard.name")}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {t("printerWizard.ippUri")}
          <input value={connectionUri} onChange={(e) => setConnectionUri(e.target.value)} required />
        </label>
        <label>
          {t("printerWizard.copies")}
          <input
            type="number"
            min={1}
            value={options.copies}
            onChange={(e) => setOptions({ ...options, copies: Number(e.target.value) })}
          />
        </label>
        {printer.capabilities.duplex_supported && (
          <label>
            <input type="checkbox" checked={options.duplex} onChange={(e) => setOptions({ ...options, duplex: e.target.checked })} />
            {t("printerWizard.duplexBoth")}
          </label>
        )}
        {printer.capabilities.color_supported && (
          <label>
            <input type="checkbox" checked={options.color} onChange={(e) => setOptions({ ...options, color: e.target.checked })} />
            {t("printerWizard.color")}
          </label>
        )}
        <label>
          {t("printerWizard.paperFormat")}
          <select value={options.paper_size} onChange={(e) => setOptions({ ...options, paper_size: e.target.value })}>
            {paperSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="button-row">
          <button type="button" onClick={save} disabled={saving || !name.trim() || !connectionUri.trim()}>
            {t("common.save")}
          </button>
          <button type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
