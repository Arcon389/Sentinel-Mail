import type { HttpStepConfig, PauseStepConfig, PrintStepConfig, SendEmailStepConfig, StepType } from "../../api/actionChains";

export function defaultConfigFor(stepType: StepType): unknown {
  switch (stepType) {
    case "rest_call":
    case "webhook":
      return {
        method: "POST",
        url: "",
        headers: [],
        body_type: "json_raw",
        body_template: "",
        body_fields: null,
      } satisfies HttpStepConfig;
    case "send_email":
      return { from: "", to: "", subject_template: "", body_template: "" } satisfies SendEmailStepConfig;
    case "print":
      return { printer_id: "", content: "body", attachment_filter: [], options_override: {} } satisfies PrintStepConfig;
    case "pause":
      return { seconds: 5 } satisfies PauseStepConfig;
  }
}

// Translation keys for step-type labels/descriptions live in the i18n catalog
// under `stepTypes.label.<type>` and `stepTypes.description.<type>`. Consumers
// resolve them via `t()` so they react to the active language.
export const stepTypeLabelKey = (stepType: StepType): string => `stepTypes.label.${stepType}`;
export const stepTypeDescriptionKey = (stepType: StepType): string => `stepTypes.description.${stepType}`;
