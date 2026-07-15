import { useQuery } from "@tanstack/react-query";
import type { PrintStepConfig } from "../../api/actionChains";
import { printersApi } from "../../api/printers";

interface Props {
  config: PrintStepConfig;
  onChange: (config: PrintStepConfig) => void;
}

export function PrintStepForm({ config, onChange }: Props) {
  const { data: printers } = useQuery({ queryKey: ["printers"], queryFn: printersApi.list });
  const selectedPrinter = printers?.find((p) => p.id === config.printer_id);

  return (
    <div className="print-step-form">
      <label>
        Drucker
        <select value={config.printer_id} onChange={(e) => onChange({ ...config, printer_id: e.target.value })}>
          <option value="">– auswählen –</option>
          {printers?.filter((p) => p.is_active).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {!printers?.length && (
        <p className="hint">Keine Drucker eingerichtet. Bitte zuerst unter "Druckerverwaltung" einen Drucker anlegen.</p>
      )}
      <label>
        Was drucken
        <select
          value={config.content}
          onChange={(e) => onChange({ ...config, content: e.target.value as PrintStepConfig["content"] })}
        >
          <option value="body">Mailtext</option>
          <option value="attachments">Anhänge</option>
          <option value="both">Beides</option>
        </select>
      </label>
      {(config.content === "attachments" || config.content === "both") && (
        <label>
          Anhang-Filter (Dateiendungen, kommagetrennt, leer = alle)
          <input
            value={config.attachment_filter.join(", ")}
            onChange={(e) =>
              onChange({
                ...config,
                attachment_filter: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="pdf, jpg, png"
          />
        </label>
      )}
      <fieldset>
        <legend>Druckoptionen (Override der Drucker-Standards)</legend>
        <label>
          Kopien
          <input
            type="number"
            min={1}
            value={(config.options_override.copies as number) ?? selectedPrinter?.default_options.copies ?? 1}
            onChange={(e) => onChange({ ...config, options_override: { ...config.options_override, copies: Number(e.target.value) } })}
          />
        </label>
        {selectedPrinter?.capabilities.duplex_supported && (
          <label>
            <input
              type="checkbox"
              checked={(config.options_override.duplex as boolean) ?? selectedPrinter.default_options.duplex}
              onChange={(e) => onChange({ ...config, options_override: { ...config.options_override, duplex: e.target.checked } })}
            />
            Duplex
          </label>
        )}
        {selectedPrinter?.capabilities.color_supported && (
          <label>
            <input
              type="checkbox"
              checked={(config.options_override.color as boolean) ?? selectedPrinter.default_options.color}
              onChange={(e) => onChange({ ...config, options_override: { ...config.options_override, color: e.target.checked } })}
            />
            Farbe
          </label>
        )}
      </fieldset>
    </div>
  );
}
