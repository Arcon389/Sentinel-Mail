import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChainStep, HttpStepConfig, OnError, PauseStepConfig, PrintStepConfig, SendEmailStepConfig } from "../../api/actionChains";
import { RestStepForm } from "../rest-wizard/RestStepForm";
import { stepTypeDescriptionKey, stepTypeLabelKey } from "./defaultConfigs";
import { PauseStepForm } from "./PauseStepForm";
import { PrintStepForm } from "./PrintStepForm";
import { SendEmailStepForm } from "./SendEmailStepForm";

interface Props {
  step: ChainStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  accountId: string;
  onChange: (config: unknown) => void;
  onErrorChange: (onError: OnError) => void;
  onTitleChange: (title: string | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function StepCard({
  step,
  index,
  isFirst,
  isLast,
  accountId,
  onChange,
  onErrorChange,
  onTitleChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [titleDraft, setTitleDraft] = useState(step.title ?? "");
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const typeLabel = t(stepTypeLabelKey(step.step_type));

  return (
    <div className="step-card" ref={setNodeRef} style={style}>
      <div className="step-card-header">
        <span className="drag-handle" {...attributes} {...listeners}>
          ⠿
        </span>
        <strong>
          {index + 1}. {step.title || typeLabel}
        </strong>
        <button type="button" aria-label={t("stepCard.moveUp")} disabled={isFirst} onClick={onMoveUp}>
          ▲
        </button>
        <button type="button" aria-label={t("stepCard.moveDown")} disabled={isLast} onClick={onMoveDown}>
          ▼
        </button>
        <button type="button" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? t("stepCard.expand") : t("stepCard.collapse")}
        </button>
        <select value={step.on_error} onChange={(e) => onErrorChange(e.target.value as OnError)}>
          <option value="abort_chain">{t("stepCard.onErrorAbort")}</option>
          <option value="continue">{t("stepCard.onErrorContinue")}</option>
        </select>
        <button type="button" onClick={onDelete}>
          {t("common.delete")}
        </button>
      </div>

      {!collapsed && (
        <div className="step-card-body">
          <label>
            {t("stepCard.titleLabel")}
            <input
              value={titleDraft}
              placeholder={typeLabel}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                const next = titleDraft.trim();
                if (next !== (step.title ?? "")) onTitleChange(next || null);
              }}
            />
          </label>
          <p className="hint step-description">{t(stepTypeDescriptionKey(step.step_type))}</p>
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
