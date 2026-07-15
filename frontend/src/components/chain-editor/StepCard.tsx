import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import type { ChainStep, HttpStepConfig, OnError, PauseStepConfig, PrintStepConfig, SendEmailStepConfig } from "../../api/actionChains";
import { RestStepForm } from "../rest-wizard/RestStepForm";
import { STEP_TYPE_DESCRIPTIONS, STEP_TYPE_LABELS } from "./defaultConfigs";
import { PauseStepForm } from "./PauseStepForm";
import { PrintStepForm } from "./PrintStepForm";
import { SendEmailStepForm } from "./SendEmailStepForm";

interface Props {
  step: ChainStep;
  accountId: string;
  onChange: (config: unknown) => void;
  onErrorChange: (onError: OnError) => void;
  onDelete: () => void;
}

export function StepCard({ step, accountId, onChange, onErrorChange, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div className="step-card" ref={setNodeRef} style={style}>
      <div className="step-card-header">
        <span className="drag-handle" {...attributes} {...listeners}>
          ⠿
        </span>
        <strong>
          {step.position + 1}. {STEP_TYPE_LABELS[step.step_type]}
        </strong>
        <button type="button" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "Aufklappen" : "Zuklappen"}
        </button>
        <select value={step.on_error} onChange={(e) => onErrorChange(e.target.value as OnError)}>
          <option value="abort_chain">Bei Fehler: Kette abbrechen</option>
          <option value="continue">Bei Fehler: fortfahren</option>
        </select>
        <button type="button" onClick={onDelete}>
          Löschen
        </button>
      </div>

      {!collapsed && (
        <div className="step-card-body">
          <p className="hint step-description">{STEP_TYPE_DESCRIPTIONS[step.step_type]}</p>
          {(step.step_type === "rest_call" || step.step_type === "webhook") && (
            <RestStepForm
              stepType={step.step_type}
              config={step.config as HttpStepConfig}
              onChange={onChange}
              accountId={accountId}
            />
          )}
          {step.step_type === "send_email" && (
            <SendEmailStepForm config={step.config as SendEmailStepConfig} onChange={onChange} />
          )}
          {step.step_type === "print" && <PrintStepForm config={step.config as PrintStepConfig} onChange={onChange} />}
          {step.step_type === "pause" && <PauseStepForm config={step.config as PauseStepConfig} onChange={onChange} />}
        </div>
      )}
    </div>
  );
}
