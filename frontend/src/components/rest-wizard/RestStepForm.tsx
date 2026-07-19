import { useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { BodyType, HttpStepConfig, KeyValue, StepType } from "../../api/actionChains";
import { KeyValueEditor } from "./KeyValueEditor";
import { PlaceholderAutocomplete } from "./PlaceholderAutocomplete";
import { TestSendPanel } from "./TestSendPanel";

interface Props {
  stepType: StepType;
  config: HttpStepConfig;
  onChange: (config: HttpStepConfig) => void;
  accountId?: string;
}

type FocusTarget = { kind: "url" } | { kind: "body_template" } | { kind: "header_value"; index: number } | { kind: "field_value"; index: number };

const BODY_TYPE_OPTIONS: { value: BodyType; labelKey: string }[] = [
  { value: "json_raw", labelKey: "restForm.bodyTypeJsonRaw" },
  { value: "json_keyvalue", labelKey: "restForm.bodyTypeJsonKeyValue" },
  { value: "form_urlencoded", labelKey: "restForm.bodyTypeFormUrlencoded" },
];

export function RestStepForm({ stepType, config, onChange, accountId }: Props) {
  const { t } = useTranslation();
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const bodyTemplateRef = useRef<HTMLTextAreaElement>(null);

  const headers = config.headers ?? [];
  const bodyFields = config.body_fields ?? [];

  const onBodyTypeChange = (newType: BodyType) => {
    if (newType === config.body_type) return;
    const hasExistingData =
      (config.body_type === "json_raw" && config.body_template) ||
      (config.body_type !== "json_raw" && (config.body_fields?.length ?? 0) > 0);
    if (hasExistingData && !window.confirm(t("restForm.confirmBodyTypeChange"))) {
      return;
    }
    if (newType === "json_raw") {
      onChange({ ...config, body_type: newType, body_template: "", body_fields: null });
    } else {
      onChange({ ...config, body_type: newType, body_template: null, body_fields: [] });
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    if (!focusTarget) return;

    if (focusTarget.kind === "url") {
      const el = urlRef.current;
      const pos = el?.selectionStart ?? config.url.length;
      const next = config.url.slice(0, pos) + placeholder + config.url.slice(pos);
      onChange({ ...config, url: next });
      requestAnimationFrame(() => el?.setSelectionRange(pos + placeholder.length, pos + placeholder.length));
    } else if (focusTarget.kind === "body_template") {
      const el = bodyTemplateRef.current;
      const template = config.body_template ?? "";
      const pos = el?.selectionStart ?? template.length;
      const next = template.slice(0, pos) + placeholder + template.slice(pos);
      onChange({ ...config, body_template: next });
      requestAnimationFrame(() => el?.setSelectionRange(pos + placeholder.length, pos + placeholder.length));
    } else if (focusTarget.kind === "header_value") {
      const next = headers.map((h, i) => (i === focusTarget.index ? { ...h, value: h.value + placeholder } : h));
      onChange({ ...config, headers: next });
    } else if (focusTarget.kind === "field_value") {
      const next = bodyFields.map((f, i) => (i === focusTarget.index ? { ...f, value: f.value + placeholder } : f));
      onChange({ ...config, body_fields: next });
    }
  };

  return (
    <div className="rest-step-form">
      <div className="rest-step-basic">
        <select value={config.method} onChange={(e) => onChange({ ...config, method: e.target.value as HttpStepConfig["method"] })}>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          ref={urlRef}
          className="rest-step-url"
          placeholder="https://example.com/webhook"
          value={config.url}
          onFocus={() => setFocusTarget({ kind: "url" })}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
        />
      </div>

      <details className="rest-step-section">
        <summary>{t("restForm.headersSummary")}</summary>
        {stepType === "webhook" && headers.length === 0 && (
          <p className="hint">
            <Trans i18nKey="restForm.webhookHint" components={{ code: <code /> }} />
          </p>
        )}
        <KeyValueEditor
          rows={headers}
          onChange={(rows) => onChange({ ...config, headers: rows })}
          keyPlaceholder={t("restForm.headerNamePlaceholder")}
          valuePlaceholder={t("restForm.valuePlaceholder")}
          onValueFocus={(index) => setFocusTarget({ kind: "header_value", index })}
        />
      </details>

      <details className="rest-step-section">
        <summary>{t("restForm.bodySummary")}</summary>
        <label>{t("restForm.bodyType")}</label>
        <div className="body-type-selector">
          {BODY_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="radio-option">
              <input
                type="radio"
                name={`body-type-${stepType}`}
                checked={config.body_type === opt.value}
                onChange={() => onBodyTypeChange(opt.value)}
              />
              {t(opt.labelKey)}
            </label>
          ))}
        </div>

        {config.body_type === "json_raw" ? (
          <textarea
            ref={bodyTemplateRef}
            className="body-template-editor"
            rows={6}
            placeholder='{"account": "{account_name}", "unread": {unread_count}}'
            value={config.body_template ?? ""}
            onFocus={() => setFocusTarget({ kind: "body_template" })}
            onChange={(e) => onChange({ ...config, body_template: e.target.value })}
          />
        ) : (
          <KeyValueEditor
            rows={bodyFields}
            onChange={(rows: KeyValue[]) => onChange({ ...config, body_fields: rows })}
            onValueFocus={(index) => setFocusTarget({ kind: "field_value", index })}
          />
        )}
      </details>

      <PlaceholderAutocomplete onInsert={insertPlaceholder} />

      <TestSendPanel stepType={stepType} config={config} accountId={accountId} />
    </div>
  );
}
