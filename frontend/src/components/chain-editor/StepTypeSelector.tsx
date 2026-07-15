import type { StepType } from "../../api/actionChains";
import { STEP_TYPE_DESCRIPTIONS, STEP_TYPE_LABELS } from "./defaultConfigs";

interface Props {
  onAdd: (stepType: StepType) => void;
}

const STEP_TYPES: StepType[] = ["rest_call", "webhook", "send_email", "print", "pause"];

export function StepTypeSelector({ onAdd }: Props) {
  return (
    <div className="step-type-selector">
      {STEP_TYPES.map((stepType) => (
        <button key={stepType} type="button" title={STEP_TYPE_DESCRIPTIONS[stepType]} onClick={() => onAdd(stepType)}>
          + {STEP_TYPE_LABELS[stepType]}
        </button>
      ))}
    </div>
  );
}
