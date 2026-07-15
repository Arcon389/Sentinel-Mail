import type { PauseStepConfig } from "../../api/actionChains";

interface Props {
  config: PauseStepConfig;
  onChange: (config: PauseStepConfig) => void;
}

export function PauseStepForm({ config, onChange }: Props) {
  return (
    <label>
      Wartezeit (Sekunden)
      <input
        type="number"
        min={0}
        value={config.seconds}
        onChange={(e) => onChange({ seconds: Number(e.target.value) })}
      />
    </label>
  );
}
