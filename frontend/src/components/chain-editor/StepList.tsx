import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ChainStep, OnError } from "../../api/actionChains";
import { StepCard } from "./StepCard";

interface Props {
  steps: ChainStep[];
  accountId: string;
  onReorder: (stepIds: string[]) => void;
  onStepChange: (stepId: string, config: unknown) => void;
  onStepErrorChange: (stepId: string, onError: OnError) => void;
  onStepDelete: (stepId: string) => void;
}

export function StepList({ steps, accountId, onReorder, onStepChange, onStepErrorChange, onStepDelete }: Props) {
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

  if (steps.length === 0) {
    return <p>Noch keine Schritte. Füge unten einen Schritt hinzu.</p>;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="step-list">
          {steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              accountId={accountId}
              onChange={(config) => onStepChange(step.id, config)}
              onErrorChange={(onError) => onStepErrorChange(step.id, onError)}
              onDelete={() => onStepDelete(step.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
