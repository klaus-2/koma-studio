import { type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AioManualStageStatus } from '../types/dashboard.types';
import { useI18n } from '../i18n';

interface AioTimelineStepProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  status: AioManualStageStatus;
  locked: boolean;
  onSelect: () => void;
}

export const AioTimelineStep = ({
  icon: Icon,
  label,
  active,
  status,
  locked,
  onSelect,
}: AioTimelineStepProps) => {
  const { t } = useI18n();

  const getStatusLabel = (s: AioManualStageStatus) => {
    switch (s) {
      case 'pending': return t('dashboard.aio.manualStatus.pending');
      case 'done': return t('dashboard.aio.manualStatus.done');
      case 'skipped': return t('dashboard.aio.manualStatus.skipped');
      case 'locked': return t('dashboard.aio.manualStatus.locked');
      default: return s;
    }
  };

  return (
    <button
      type="button"
      className={cn(
        'koma-aio-timeline__step',
        active && 'koma-aio-timeline__step--active',
        locked && 'koma-aio-timeline__step--locked',
        `koma-aio-timeline__step--${status}`,
      )}
      onClick={onSelect}
      disabled={locked}
      aria-current={active ? 'step' : undefined}
    >
      <span className="koma-aio-timeline__node" aria-hidden="true" />
      <span className="koma-aio-timeline__icon" aria-hidden="true">
        <Icon size={13} />
      </span>
      <span className="koma-aio-timeline__label">{label}</span>
      <span
        className={cn(
          'koma-aio-timeline__badge',
          `koma-aio-timeline__badge--${status}`,
        )}
      >
        {getStatusLabel(status)}
      </span>
    </button>
  );
};

