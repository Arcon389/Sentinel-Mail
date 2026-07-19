import { useTranslation } from "react-i18next";
import type { StepType } from "../../api/actionChains";
import { stepTypeDescriptionKey, stepTypeLabelKey } from "./defaultConfigs";

interface Props {
  onAdd: (stepType: StepType) => void;
}

const STEP_TYPES: StepType[] = ["rest_call", "webhook", "send_email", "print", "pause"];

export function StepTypeSelector({ onAdd }: Props) {
  const { t } = useTranslation();
  return (
    <div className="step-type-selector">
      {STEP_TYPES.map((stepType) => (
        <button key={stepType} type="button" title={t(stepTypeDescriptionKey(stepType))} onClick={() => onAdd(stepType)}>
          + {t(stepTypeLabelKey(stepType))}
        </button>
      ))}
    </div>
  );
}
