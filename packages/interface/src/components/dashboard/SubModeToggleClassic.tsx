import { Paintbrush, Sparkles } from "lucide-react";
import { useI18n } from "../../i18n";
import { memo } from "react";
import type { SubMode } from "../../types/dashboard.types";

export interface SubModeToggleProps {
  value: SubMode;
  onChange: (value: SubMode) => void;
}

export default memo(function SubModeToggleClassic({ value, onChange }: SubModeToggleProps) {
  const { t } = useI18n();
  return (
    <div className="koma-submode-toggle" role="tablist" aria-label="Sub-mode" data-tour="dashboard-submode-toggle">
      <button
        type="button"
        role="tab"
        aria-selected={value === "auto"}
        className={`koma-submode-toggle__btn${value === "auto" ? " koma-submode-toggle__btn--active" : ""}`}
        onClick={() => onChange("auto")}
        title={t('dashboard.aio.autoScopeTitle')}
      >
        <Sparkles size={12} />
        <span>{t('dashboard.aio.autoScope')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "manual"}
        className={`koma-submode-toggle__btn${value === "manual" ? " koma-submode-toggle__btn--active" : ""}`}
        onClick={() => onChange("manual")}
        title={t('dashboard.aio.manualScopeTitle')}
      >
        <Paintbrush size={12} />
        <span>{t('dashboard.aio.manualScope')}</span>
      </button>
    </div>
  );
});
