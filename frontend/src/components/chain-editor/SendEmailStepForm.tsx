import { useTranslation } from "react-i18next";
import type { SendEmailStepConfig } from "../../api/actionChains";
import { PlaceholderAutocomplete } from "../rest-wizard/PlaceholderAutocomplete";

interface Props {
  config: SendEmailStepConfig;
  onChange: (config: SendEmailStepConfig) => void;
}

export function SendEmailStepForm({ config, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="send-email-step-form">
      <label>
        {t("sendEmailForm.from")}
        <input value={config.from} onChange={(e) => onChange({ ...config, from: e.target.value })} required />
      </label>
      <label>
        {t("sendEmailForm.to")}
        <input value={config.to} onChange={(e) => onChange({ ...config, to: e.target.value })} required />
      </label>
      <label>
        {t("sendEmailForm.subject")}
        <input
          value={config.subject_template}
          onChange={(e) => onChange({ ...config, subject_template: e.target.value })}
        />
      </label>
      <label>
        {t("sendEmailForm.text")}
        <textarea
          rows={5}
          value={config.body_template}
          onChange={(e) => onChange({ ...config, body_template: e.target.value })}
        />
      </label>
      <PlaceholderAutocomplete
        onInsert={(placeholder) => onChange({ ...config, body_template: config.body_template + placeholder })}
      />
    </div>
  );
}
