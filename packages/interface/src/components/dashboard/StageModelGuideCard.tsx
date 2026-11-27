import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/messages';
import styles from './ImageEditModelGuideCard.module.css';

export type GuideStage = 'detectText' | 'segmentText' | 'cleanImage';

interface GuideRowSpec {
  id: string;
  titleKey: TranslationKey;
  badgeKey: TranslationKey;
  descKey: TranslationKey;
}

const STAGE_GUIDE_ROWS: Record<GuideStage, readonly GuideRowSpec[]> = {
  detectText: [
    {
      id: 'font_rtdetr_v2',
      titleKey: 'dashboard.stageModelGuide.detectText.rtdetr.title',
      badgeKey: 'dashboard.stageModelGuide.badge.recommended',
      descKey: 'dashboard.stageModelGuide.detectText.rtdetr.desc',
    },
    {
      id: 'comic_text_detector',
      titleKey: 'dashboard.stageModelGuide.detectText.ctd.title',
      badgeKey: 'dashboard.stageModelGuide.badge.fastCpu',
      descKey: 'dashboard.stageModelGuide.detectText.ctd.desc',
    },
    {
      id: 'yolo_bubble',
      titleKey: 'dashboard.stageModelGuide.detectText.yoloBubble.title',
      badgeKey: 'dashboard.stageModelGuide.badge.pixelMasks',
      descKey: 'dashboard.stageModelGuide.detectText.yoloBubble.desc',
    },
    {
      id: 'pp_doclayout_v3',
      titleKey: 'dashboard.stageModelGuide.detectText.ppDoc.title',
      badgeKey: 'dashboard.stageModelGuide.badge.complexLayout',
      descKey: 'dashboard.stageModelGuide.detectText.ppDoc.desc',
    },
  ],
  segmentText: [
    {
      id: 'ctd_text_seg',
      titleKey: 'dashboard.stageModelGuide.segmentText.ctd.title',
      badgeKey: 'dashboard.stageModelGuide.badge.recommended',
      descKey: 'dashboard.stageModelGuide.segmentText.ctd.desc',
    },
    {
      id: 'comic_text_mask',
      titleKey: 'dashboard.stageModelGuide.segmentText.comicMask.title',
      badgeKey: 'dashboard.stageModelGuide.badge.pixelMasks',
      descKey: 'dashboard.stageModelGuide.segmentText.comicMask.desc',
    },
    {
      id: 'baka_content_cc',
      titleKey: 'dashboard.stageModelGuide.segmentText.baka.title',
      badgeKey: 'dashboard.stageModelGuide.badge.zeroDownload',
      descKey: 'dashboard.stageModelGuide.segmentText.baka.desc',
    },
  ],
  cleanImage: [
    {
      id: 'lama_manga',
      titleKey: 'dashboard.stageModelGuide.cleanImage.lamaManga.title',
      badgeKey: 'dashboard.stageModelGuide.badge.recommended',
      descKey: 'dashboard.stageModelGuide.cleanImage.lamaManga.desc',
    },
    {
      id: 'lama_fp32',
      titleKey: 'dashboard.stageModelGuide.cleanImage.lamaFp32.title',
      badgeKey: 'dashboard.stageModelGuide.badge.fastCpu',
      descKey: 'dashboard.stageModelGuide.cleanImage.lamaFp32.desc',
    },
    {
      id: 'aot',
      titleKey: 'dashboard.stageModelGuide.cleanImage.aot.title',
      badgeKey: 'dashboard.stageModelGuide.badge.lightweight',
      descKey: 'dashboard.stageModelGuide.cleanImage.aot.desc',
    },
    {
      id: 'opencv_and_ai',
      titleKey: 'dashboard.stageModelGuide.cleanImage.other.title',
      badgeKey: 'dashboard.stageModelGuide.badge.legacyOrAi',
      descKey: 'dashboard.stageModelGuide.cleanImage.other.desc',
    },
  ],
};

export function isGuideStage(stage: string | null | undefined): stage is GuideStage {
  return stage === 'detectText' || stage === 'segmentText' || stage === 'cleanImage';
}

interface StageModelGuideCardProps {
  stage: GuideStage;
  noir?: boolean;
  defaultOpen?: boolean;
  compact?: boolean;
  className?: string;
}

export default function StageModelGuideCard({
  stage,
  noir = false,
  defaultOpen = false,
  compact = false,
  className = '',
}: StageModelGuideCardProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const rows = STAGE_GUIDE_ROWS[stage];

  return (
    <div
      className={`${styles.card} ${noir ? styles.noir : ''} ${compact ? styles.compact : ''} ${className}`.trim()}
      data-testid={`stage-model-guide-${stage}`}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.triggerLeft}>
          <HelpCircle size={13} className={styles.triggerIcon} aria-hidden="true" />
          <span className={styles.triggerTitle}>{t('dashboard.stageModelGuide.title')}</span>
        </span>
        <ChevronDown
          size={13}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.body}>
          {rows.map((row) => (
            <div key={row.id} className={styles.row}>
              <div className={styles.rowHead}>
                <span className={styles.cleanOnlyBadge}>{t(row.badgeKey)}</span>
                <span className={styles.rowLabel}>{t(row.titleKey)}</span>
              </div>
              <p className={styles.rowDesc}>{t(row.descKey)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
