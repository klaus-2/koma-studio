import { Paintbrush, Sparkles } from "lucide-react";
import { useI18n } from "../../i18n";

export interface SubModeToggleProps {
  value: "auto" | "manual";
  onChange: (value: "auto" | "manual") => void;
}

export default function SubModeToggle({ value, onChange }: SubModeToggleProps) {
  const { t } = useI18n();
  return (
    <div className="koma-submode-toggle" data-tour="dashboard-submode-toggle">
      <button
        type="button"
        className={`koma-submode-toggle__btn${value === "auto" ? " koma-submode-toggle__btn--active" : ""}`}
        onClick={() => onChange("auto")}
        title={t('dashboard.aio.autoScopeTitle')}
      >
        <Sparkles size={12} />
        <span>{t('dashboard.aio.autoScope')}</span>
      </button>
      <button
        type="button"
        className={`koma-submode-toggle__btn${value === "manual" ? " koma-submode-toggle__btn--active" : ""}`}
        onClick={() => onChange("manual")}
        title={t('dashboard.aio.manualScopeTitle')}
      >
        <Paintbrush size={12} />
        <span>{t('dashboard.aio.manualScope')}</span>
      </button>
    </div>
  );
}
