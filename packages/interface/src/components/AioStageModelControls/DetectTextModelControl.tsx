import { HardDrive } from "lucide-react";

import { useI18n } from "../../i18n";
import type { AioStageModelOption } from "./types";
import styles from "./styles.module.css";

interface DetectTextModelControlProps {
  value: string;
  options: AioStageModelOption[];
  selectedModel: AioStageModelOption | null;
  statusText: string | null;
  formatOptionLabel: (option: AioStageModelOption) => string;
  onSelectModel: (modelKey: string) => void;
  onOpenManager: () => void;
}

export const DetectTextModelControl = ({
  value,
  options,
  selectedModel,
  statusText,
  formatOptionLabel,
  onSelectModel,
  onOpenManager,
}: DetectTextModelControlProps) => {
  const { t } = useI18n();
  const selectedValue = options.some((option) => option.key === value) ? value : "";

  return (
    <div className="koma-stage-config">
      <div className={styles.headerRow}>
        <label className="koma-field__label">{t("aio.stage.detectText")}</label>
        <button type="button" className={styles.manageButton} onClick={onOpenManager}>
          <HardDrive size={12} /> {t("aio.model.manage")}
        </button>
      </div>

      <select
        value={selectedValue}
        onChange={(event) => onSelectModel(event.target.value)}
        className="koma-select"
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
      <p className="koma-field__hint">{selectedModel?.use_case ?? t("aio.model.noDescription")}</p>
      {statusText ? (
        <p className="koma-field__hint">{t("aio.model.localStatus", { value: statusText })}</p>
      ) : null}
    </div>
  );
};

export default DetectTextModelControl;
