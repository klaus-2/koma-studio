import type { ReactNode } from "react";
import { HardDrive } from "lucide-react";

import { useI18n } from "../../i18n";
import { useThemeStore } from "@koma/ui/stores/theme-store";
import FieldInfoTooltip from "../dashboard/FieldInfoTooltip";
import type { AioStageModelOption } from "./types";
import { MANAGE_BUTTON_NOIR, STAGE_SELECT_NOIR } from "./noirClasses";
import styles from "./styles.module.css";

interface CleanImageModelControlProps {
  value: string;
  options: AioStageModelOption[];
  selectedModel: AioStageModelOption | null;
  statusText: string | null;
  formatOptionLabel: (option: AioStageModelOption) => string;
  onSelectModel: (modelKey: string) => void;
  onOpenManager: () => void;
  children?: ReactNode;
}

export const CleanImageModelControl = ({
  value,
  options,
  selectedModel,
  statusText,
  formatOptionLabel,
  onSelectModel,
  onOpenManager,
  children,
}: CleanImageModelControlProps) => {
  const { t } = useI18n();
  const noir = useThemeStore((s) => s.family === "noir");
  const selectedValue = options.some((option) => option.key === value) ? value : "";
  const cleanImageTooltip = (() => {
    const key = 'dashboard.aio.cleanImage.tooltip';
    const value = t(key as any) as string;
    return value === key
      ? 'Clean Image is the cleanup and inpainting stage. It removes text and selected artifacts before the final render/edit pass.'
      : value;
  })();
  const cleanImageTooltipAria = (() => {
    const key = 'dashboard.aio.cleanImage.tooltipAria';
    const value = t(key as any) as string;
    return value === key ? 'What Clean Image is used for' : value;
  })();

  return (
    <div className="koma-stage-config">
      <div className={styles.headerRow}>
        <label className="koma-field__label">
          <span className="koma-inline-label-with-info">
            {t("aio.stage.cleanImage")}
            <FieldInfoTooltip
              content={cleanImageTooltip}
              ariaLabel={cleanImageTooltipAria}
            />
          </span>
        </label>
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

      <p className="koma-field__hint">{selectedModel?.use_case ?? t("aio.model.noDescription")}</p>
      {statusText ? (
        <p className="koma-field__hint">{t("aio.model.localStatus", { value: statusText })}</p>
      ) : null}
      {children}
    </div>
  );
};

export default CleanImageModelControl;
