import { useTranslation } from "react-i18next";
import type { KeyValue } from "../../api/actionChains";

interface Props {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  onValueFocus?: (index: number) => void;
}

export function KeyValueEditor({ rows, onChange, keyPlaceholder, valuePlaceholder, onValueFocus }: Props) {
  const { t } = useTranslation();
  const keyPh = keyPlaceholder ?? t("keyValueEditor.namePlaceholder");
  const valuePh = valuePlaceholder ?? t("keyValueEditor.valuePlaceholder");
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
            placeholder={keyPh}
            value={row.key}
            onChange={(e) => updateRow(index, { key: e.target.value })}
          />
          <input
            placeholder={valuePh}
            value={row.value}
            onFocus={() => onValueFocus?.(index)}
            onChange={(e) => updateRow(index, { value: e.target.value })}
          />
          <button type="button" onClick={() => removeRow(index)} aria-label={t("keyValueEditor.removeRow")}>
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow}>
        {t("keyValueEditor.addRow")}
      </button>
    </div>
  );
}
