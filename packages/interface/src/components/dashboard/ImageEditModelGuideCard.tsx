import { useState } from 'react';
import { CheckCircle2, ChevronDown, HardDrive, HelpCircle, XCircle } from 'lucide-react';

import { useI18n } from '../../i18n';
import styles from './ImageEditModelGuideCard.module.css';

interface ImageEditModelGuideCardProps {
  mode: 'clean' | 'aio_ai';
  noir?: boolean;
  defaultOpen?: boolean;
  compact?: boolean;
}

export default function ImageEditModelGuideCard({
  mode,
  noir = false,
  defaultOpen = false,
  compact = false,
}: ImageEditModelGuideCardProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`${styles.card} ${noir ? styles.noir : ''} ${compact ? styles.compact : ''}`}
      data-testid="image-edit-model-guide"
    >
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.triggerLeft}>
          <HelpCircle size={13} className={styles.triggerIcon} aria-hidden="true" />
          <span className={styles.triggerTitle}>{t('dashboard.imageEdit.guide.title')}</span>
        </span>
        <ChevronDown
          size={13}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.row}>
            <div className={styles.rowHead}>
              <CheckCircle2 size={12} className={styles.okIcon} aria-hidden="true" />
              <span className={styles.rowLabel}>
                {mode === 'aio_ai'
                  ? t('dashboard.imageEdit.guide.worksAioAiTitle')
                  : t('dashboard.imageEdit.guide.worksCleanTitle')}
              </span>
            </div>
            <p className={styles.rowDesc}>
              {mode === 'aio_ai'
                ? t('dashboard.imageEdit.guide.worksAioAiDesc')
                : t('dashboard.imageEdit.guide.worksCleanDesc')}
            </p>
            <p className={styles.examples}>
              {t('dashboard.imageEdit.guide.worksBothExamples')}
            </p>
          </div>

          <div className={styles.row}>
            <div className={styles.rowHead}>
              <HardDrive size={12} className={styles.okIcon} aria-hidden="true" />
              <span className={styles.rowLabel}>
                {t('dashboard.imageEdit.guide.localTitle')}
              </span>
            </div>
            <p className={styles.rowDesc}>
              {t('dashboard.imageEdit.guide.localDesc')}
            </p>
            <p className={styles.examples}>
              {t('dashboard.imageEdit.guide.localExamples')}
            </p>
          </div>

          <div className={styles.row}>
            <div className={styles.rowHead}>
              <span className={styles.cleanOnlyBadge}>
                {t('freeProviderCard.capability.cleanOnly')}
              </span>
              <span className={styles.rowLabel}>
                {t('dashboard.imageEdit.guide.cleanOnlyTitle')}
              </span>
            </div>
            <p className={styles.rowDesc}>
              {t('dashboard.imageEdit.guide.cleanOnlyDesc')}
            </p>
          </div>

          <div className={styles.row}>
            <div className={styles.rowHead}>
              <XCircle size={12} className={styles.badIcon} aria-hidden="true" />
              <span className={styles.rowLabel}>
                {t('dashboard.imageEdit.guide.doesNotWorkTitle')}
              </span>
            </div>
            <p className={styles.rowDesc}>
              {t('dashboard.imageEdit.guide.doesNotWorkDesc')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
