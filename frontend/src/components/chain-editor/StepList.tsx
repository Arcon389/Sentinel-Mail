import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import type { ChainStep, OnError } from "../../api/actionChains";
import { StepCard } from "./StepCard";

interface Props {
  steps: ChainStep[];
  accountId: string;
  onReorder: (stepIds: string[]) => void;
  onStepChange: (stepId: string, config: unknown) => void;
  onStepErrorChange: (stepId: string, onError: OnError) => void;
  onStepTitleChange: (stepId: string, title: string | null) => void;
  onStepDelete: (stepId: string) => void;
}

export function StepList({
  steps,
  accountId,
  onReorder,
  onStepChange,
  onStepErrorChange,
  onStepTitleChange,
  onStepDelete,
}: Props) {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = steps.map((s) => s.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const reordered = [...ids];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, active.id as string);
    onReorder(reordered);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const ids = steps.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onReorder(ids);
  };

  if (steps.length === 0) {
    return <p>{t("stepList.empty")}</p>;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="step-list">
          {steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              index={index}
              isFirst={index === 0}
              isLast={index === steps.length - 1}
              accountId={accountId}
              onChange={(config) => onStepChange(step.id, config)}
              onErrorChange={(onError) => onStepErrorChange(step.id, onError)}
              onTitleChange={(title) => onStepTitleChange(step.id, title)}
              onMoveUp={() => moveStep(index, -1)}
              onMoveDown={() => moveStep(index, 1)}
              onDelete={() => onStepDelete(step.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
