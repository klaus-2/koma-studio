import { HardDrive } from "lucide-react";

import { useI18n } from "../../i18n";
import { useThemeStore } from "@koma/ui/stores/theme-store";
import type { AioStageModelOption } from "./types";
import { MANAGE_BUTTON_NOIR, STAGE_SELECT_NOIR } from "./noirClasses";
import styles from "./styles.module.css";

interface RecognizeTextModelControlProps {
  value: string;
  options: AioStageModelOption[];
  selectedModel: AioStageModelOption | null;
  statusText: string | null;
  formatOptionLabel: (option: AioStageModelOption) => string;
  onSelectModel: (modelKey: string) => void;
  onOpenManager: () => void;
}

export const RecognizeTextModelControl = ({
  value,
  options,
  selectedModel,
  statusText,
  formatOptionLabel,
  onSelectModel,
  onOpenManager,
}: RecognizeTextModelControlProps) => {
  const { t } = useI18n();
  const noir = useThemeStore((s) => s.family === "noir");
  const selectedValue = options.some((option) => option.key === value) ? value : "";

  return (
    <div className="koma-stage-config">
      <div className={styles.headerRow}>
        <label className="koma-field__label">{t("aio.stage.recognizeText")}</label>
        <button
          type="button"
          className={noir ? MANAGE_BUTTON_NOIR : styles.manageButton}
          onClick={onOpenManager}
        >
          <HardDrive size={12} /> {t("aio.model.manage")}
        </button>
      </div>

      <select
        value={selectedValue}
        onChange={(event) => onSelectModel(event.target.value)}
        className={noir ? STAGE_SELECT_NOIR : "koma-select"}
        disabled={options.length === 0}
      >
        {options.length === 0 ? (
          <option value="" disabled>{t("aio.model.noneAvailable")}</option>
        ) : (
          options.map((option) => (
            <option key={option.key} value={option.key}>
              {formatOptionLabel(option)}
            </option>
          ))
        )}
      </select>

      <p className="koma-field__hint">
        {t("aio.model.device")}: {selectedModel?.device ?? "-"}
      </p>
      <p className="koma-field__hint">
        {t("aio.model.languages")}:{" "}
        {(selectedModel?.languages ?? []).join(", ") || t("aio.model.languages.multi")}
      </p>
      <p className="koma-field__hint">{selectedModel?.use_case ?? t("aio.model.noDescription")}</p>
      {statusText ? (
        <p className="koma-field__hint">{t("aio.model.localStatus", { value: statusText })}</p>
      ) : null}
    </div>
  );
};

export default RecognizeTextModelControl;