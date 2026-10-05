import { type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface AioPipelineChipProps {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export const AioPipelineChipNoir = ({
  icon: Icon,
  label,
  subtitle,
  enabled,
  disabled = false,
  onToggle,
}: AioPipelineChipProps) => (
  <button
    type="button"
    className={cn(
      "koma-aio-chip",
      enabled && "koma-aio-chip--active",
      disabled && "koma-aio-chip--disabled",
    )}
    onClick={onToggle}
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
