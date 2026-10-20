import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import type { StageTabKey } from "../AioStageTabBar.types";

interface AioPipelineChipProps {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  enabled: boolean;
  disabled?: boolean;
  stageKey: StageTabKey;
  onToggle: (stageKey: StageTabKey) => void;
}

export const AioPipelineChipNoir = memo(function AioPipelineChipNoir({
  icon: Icon,
  label,
  subtitle,
  enabled,
  disabled = false,
  stageKey,
  onToggle,
}: AioPipelineChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "koma-aio-chip",
        enabled && "koma-aio-chip--active",
        disabled && "koma-aio-chip--disabled",
      )}
      onClick={() => onToggle(stageKey)}
      title={subtitle}
      disabled={disabled}
      aria-pressed={enabled}
    >
      <span className="koma-aio-chip__toggle" aria-hidden="true">
        {enabled ? "▣" : "▢"}
      </span>

      <span className="koma-aio-chip__icon" aria-hidden="true">
        <Icon size={14} strokeWidth={2.25} />
      </span>

      <span className="koma-aio-chip__label">{label}</span>

      <span className="koma-aio-chip__ink" aria-hidden="true" />
    </button>
  );
});
