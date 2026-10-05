import { type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { AioPipelineChipNoir } from './aio-noir/AioPipelineChipNoir';

interface AioPipelineChipProps {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

const AioPipelineChipClassic = ({
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
      'koma-aio-chip',
      enabled && 'koma-aio-chip--active',
      disabled && 'koma-aio-chip--disabled',
    )}
    onClick={onToggle}
    title={subtitle}
    disabled={disabled}
    aria-pressed={enabled}
  >
    <div className="koma-aio-chip__icon" aria-hidden="true">
      <Icon size={14} />
    </div>
    <span className="koma-aio-chip__label">{label}</span>
    <span className="koma-aio-chip__toggle" aria-hidden="true" />
  </button>
);

export const AioPipelineChip = (props: AioPipelineChipProps) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <AioPipelineChipNoir {...props} /> : <AioPipelineChipClassic {...props} />;
};
