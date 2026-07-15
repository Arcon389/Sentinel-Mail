import type { KeyValue } from "../../api/actionChains";

interface Props {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  onValueFocus?: (index: number) => void;
}

export function KeyValueEditor({ rows, onChange, keyPlaceholder = "Name", valuePlaceholder = "Wert", onValueFocus }: Props) {
  const updateRow = (index: number, patch: Partial<KeyValue>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, { key: "", value: "" }]);
  };

  return (
    <div className="keyvalue-editor">
      {rows.map((row, index) => (
        <div className="keyvalue-row" key={index}>
          <input
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(e) => updateRow(index, { key: e.target.value })}
          />
          <input
            placeholder={valuePlaceholder}
            value={row.value}
            onFocus={() => onValueFocus?.(index)}
            onChange={(e) => updateRow(index, { value: e.target.value })}
          />
          <button type="button" onClick={() => removeRow(index)} aria-label="Zeile entfernen">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow}>
        + Zeile hinzufügen
      </button>
    </div>
  );
}
