import { useTranslation } from "react-i18next";
import type { PauseStepConfig } from "../../api/actionChains";

interface Props {
  config: PauseStepConfig;
  onChange: (config: PauseStepConfig) => void;
}

export function PauseStepForm({ config, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <label>
      {t("pauseForm.waitTime")}
      <input
        type="number"
        min={0}
        value={config.seconds}
        onChange={(e) => onChange({ seconds: Number(e.target.value) })}
      />
    </label>
  );
}
