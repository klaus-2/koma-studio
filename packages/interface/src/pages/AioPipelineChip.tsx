import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { AioPipelineChipNoir } from './aio-noir/AioPipelineChipNoir';
import type { StageTabKey } from './AioStageTabBar.types';

interface AioPipelineChipProps {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  enabled: boolean;
  disabled?: boolean;
  stageKey: StageTabKey;
  onToggle: (stageKey: StageTabKey) => void;
}

const AioPipelineChipClassic = memo(function AioPipelineChipClassic({
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
        'koma-aio-chip',
        enabled && 'koma-aio-chip--active',
        disabled && 'koma-aio-chip--disabled',
      )}
      onClick={() => onToggle(stageKey)}
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
});

export const AioPipelineChip = memo(
  createFamilyComponent(AioPipelineChipClassic, AioPipelineChipNoir),
);
