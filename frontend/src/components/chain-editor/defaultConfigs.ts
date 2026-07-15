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

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  rest_call: "REST-API-Aufruf",
  webhook: "Webhook",
  send_email: "E-Mail senden",
  print: "Drucken",
  pause: "Pause",
};

// Technisch identisch (beide senden einen HTTP-Request mit Methode/Headern/Body),
// die Beschreibung erklärt nur den typischen Einsatzzweck.
export const STEP_TYPE_DESCRIPTIONS: Record<StepType, string> = {
  rest_call: "Ruft eine externe API auf, z.B. um einen Datensatz anzulegen oder zu aktualisieren.",
  webhook: "Meldet das Ereignis an einen Empfänger (z.B. Zapier, Slack, einen eigenen Listener).",
  send_email: "Versendet eine E-Mail über den konfigurierten SMTP-Server.",
  print: "Druckt den Mailtext und/oder Anhänge über einen eingerichteten Drucker.",
  pause: "Wartet die angegebene Anzahl Sekunden, bevor der nächste Schritt ausgeführt wird.",
};
