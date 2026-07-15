import type { SendEmailStepConfig } from "../../api/actionChains";
import { PlaceholderAutocomplete } from "../rest-wizard/PlaceholderAutocomplete";

interface Props {
  config: SendEmailStepConfig;
  onChange: (config: SendEmailStepConfig) => void;
}

export function SendEmailStepForm({ config, onChange }: Props) {
  return (
    <div className="send-email-step-form">
      <label>
        Von
        <input value={config.from} onChange={(e) => onChange({ ...config, from: e.target.value })} required />
      </label>
      <label>
        An
        <input value={config.to} onChange={(e) => onChange({ ...config, to: e.target.value })} required />
      </label>
      <label>
        Betreff
        <input
          value={config.subject_template}
          onChange={(e) => onChange({ ...config, subject_template: e.target.value })}
        />
      </label>
      <label>
        Text
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
