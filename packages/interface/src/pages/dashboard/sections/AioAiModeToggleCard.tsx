import { Wand2 } from 'lucide-react';

import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/messages';
import type { AioAiExecutionMode } from '@/utils/imageEditModelConfig';
import styles from './AioAiModeToggleCard.module.css';

interface AioAiModeToggleCardProps {
  readonly enabled: boolean;
  readonly executionMode: AioAiExecutionMode;
  readonly disabled?: boolean;
  readonly noir: boolean;
  readonly onToggle: () => void;
}

const HINT_BY_MODE: Record<AioAiExecutionMode, TranslationKey> = {
  direct: 'dashboard.aio.ai.toggleHintDirect',
  hybrid_guided: 'dashboard.aio.ai.toggleHintHybrid',
  script_guided: 'dashboard.aio.ai.toggleHintScript',
};

export default function AioAiModeToggleCard({
  enabled,
  executionMode,
  disabled = false,
  noir,
  onToggle,
}: AioAiModeToggleCardProps) {
  const { t } = useI18n();
  const hintKey = enabled ? HINT_BY_MODE[executionMode] : 'dashboard.aio.ai.toggleHintOff';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={t('dashboard.aio.ai.toggleLabel')}
      disabled={disabled}
      onClick={onToggle}
      className={`${styles.card}${enabled ? ` ${styles.cardActive}` : ''}${noir ? ` ${styles.noir}` : ''}`}
    >
      <div className={styles.headerRow}>
        <span className={styles.titleGroup}>
          <Wand2 size={13} className={styles.icon} aria-hidden="true" />
          <span className={styles.title}>{t('dashboard.aio.ai.toggleLabel')}</span>
        </span>
        <span
          aria-hidden="true"
          className={`${styles.switchTrack}${enabled ? ` ${styles.switchTrackActive}` : ''}`}
        >
          <span className={styles.switchThumb} />
        </span>
      </div>
      <p className={styles.hint}>{t(hintKey)}</p>
    </button>
  );
}
