import { memo, type ReactNode } from "react";
import { HardDrive } from "lucide-react";

import { useI18n } from "../../i18n";
import FieldInfoTooltip from "../dashboard/FieldInfoTooltip";
import type { AioStageModelOption } from "./types";
import { useStageControlTokens } from "./stageControlTokens";
import styles from "./styles.module.css";

export type StageModelHint = "device" | "languages" | "useCase" | "status";

export interface StageModelSelectProps {
  label: string;
  labelTooltip?: { content: string; ariaLabel: string };
  value: string;
  options: AioStageModelOption[];
  selectedModel: AioStageModelOption | null;
  statusText: string | null;
  formatOptionLabel: (option: AioStageModelOption) => string;
  onSelectModel: (modelKey: string) => void;
  onOpenManager: () => void;
  hints?: readonly StageModelHint[];
  children?: ReactNode;
}

const DEFAULT_HINTS: readonly StageModelHint[] = ["device", "useCase", "status"];

export const STAGE_HINTS_RECOGNIZE: readonly StageModelHint[] = [
  "device",
  "languages",
  "useCase",
  "status",
];

export const STAGE_HINTS_CLEAN: readonly StageModelHint[] = ["useCase", "status"];

/**
 * One select + manage + meta-hints for an AIO stage model.
 * Theme family tokens stay inside `useStageControlTokens` — callers never branch on family.
 */
const StageModelSelectBase = ({
  label,
  labelTooltip,
  value,
  options,
  selectedModel,
  statusText,
  formatOptionLabel,
  onSelectModel,
  onOpenManager,
  hints = DEFAULT_HINTS,
  children,
}: StageModelSelectProps) => {
  const { t } = useI18n();
  const tokens = useStageControlTokens();
  const selectedValue = options.some((option) => option.key === value) ? value : "";

  return (
    <div className="koma-stage-config">
      <div className={styles.headerRow}>
        <label className="koma-field__label">
          {labelTooltip ? (
            <span className="koma-inline-label-with-info">
              {label}
              <FieldInfoTooltip
                content={labelTooltip.content}
                ariaLabel={labelTooltip.ariaLabel}
              />
            </span>
          ) : (
            label
          )}
        </label>
        <button
          type="button"
          className={tokens.manageButton}
          onClick={onOpenManager}
        >
          <HardDrive size={12} /> {t("aio.model.manage")}
        </button>
      </div>

      <select
        value={selectedValue}
        onChange={(event) => onSelectModel(event.target.value)}
        className={tokens.select}
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

      {hints.includes("device") ? (
        <p className="koma-field__hint">
          {t("aio.model.device")}: {selectedModel?.device ?? "-"}
        </p>
      ) : null}
      {hints.includes("languages") ? (
        <p className="koma-field__hint">
          {t("aio.model.languages")}:{" "}
          {(selectedModel?.languages ?? []).join(", ") || t("aio.model.languages.multi")}
        </p>
      ) : null}
      {hints.includes("useCase") ? (
        <p className="koma-field__hint">
          {selectedModel?.use_case ?? t("aio.model.noDescription")}
        </p>
      ) : null}
      {hints.includes("status") && statusText ? (
        <p className="koma-field__hint">
          {t("aio.model.localStatus", { value: statusText })}
        </p>
      ) : null}
      {children}
    </div>
  );
};

export const StageModelSelect = memo(StageModelSelectBase);

export default StageModelSelect;
