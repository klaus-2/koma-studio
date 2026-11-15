import { memo, useState } from 'react';

import { useI18n } from '../../i18n';
import { useAioStageTimingStore } from '../../pages/dashboard/stores/aio-stage-timing-store';

interface AioStageTimingPanelProps {
  className?: string;
}

const STAGE_ORDER = ['detect', 'ocr', 'translation', 'segment', 'clean'] as const;

function formatStageSeconds(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10;
  if (rounded >= 60) {
    return `${Math.floor(rounded / 60)}m ${Math.round(rounded % 60)}s`;
  }
  return `${rounded}s`;
}

export default memo(function AioStageTimingPanel({
  className,
}: AioStageTimingPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const chapterOrder = useAioStageTimingStore((s) => s.chapterOrder);
  const chapters = useAioStageTimingStore((s) => s.chapters);
  const totals = useAioStageTimingStore((s) => s.totals);
  const bottleneck = useAioStageTimingStore((s) => s.bottleneck);
  const providerLabel = useAioStageTimingStore((s) => s.providerLabel);
  const providerKind = useAioStageTimingStore((s) => s.providerKind);
  const cacheHitDetected = useAioStageTimingStore((s) => s.cacheHitDetected);

  const hasTiming = chapterOrder.length > 0;

  return (
    <span className={className}>
      <button
        type="button"
        className="aio-stage-timing__toggle"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
      >
        {t('dashboard.footer.timing.title')}
        {open ? ' ▾' : ' ▸'}
      </button>
      {open && (
        <span className="aio-stage-timing__body">
          {!hasTiming ? (
            <span>{t('dashboard.footer.timing.empty')}</span>
          ) : (
            <>
              <span>{t('dashboard.footer.timing.accumulated')}</span>
              {chapterOrder.map((chapterKey) => {
                const chapter = chapters[chapterKey];
                if (!chapter) {
                  return null;
                }
                const stageSummary = STAGE_ORDER.filter(
                  (stage) => (chapter.stageSeconds[stage] ?? 0) > 0,
                )
                  .map(
                    (stage) =>
                      `${stage} ${formatStageSeconds(chapter.stageSeconds[stage] ?? 0)}`,
                  )
                  .join(' · ');
                return (
                  <span key={chapterKey}>
                    {t('dashboard.footer.timing.chapter', {
                      label: chapter.label,
                    })}
                    {stageSummary.length > 0 ? ` ${stageSummary}` : ''}
                  </span>
                );
              })}
              {bottleneck !== null && (
                <span>
                  {t('dashboard.footer.timing.bottleneck', {
                    stage: bottleneck,
                  })}{' '}
                  {formatStageSeconds(totals[bottleneck] ?? 0)}
                </span>
              )}
              {providerLabel !== null &&
                providerKind !== null &&
                (providerKind === 'local'
                  ? t('dashboard.footer.timing.providerLocal', {
                      provider: providerLabel,
                    })
                  : t('dashboard.footer.timing.providerCloud', {
                      provider: providerLabel,
                    }))}
              {cacheHitDetected && (
                <span>{t('dashboard.footer.timing.cacheHit')}</span>
              )}
            </>
          )}
        </span>
      )}
    </span>
  );
});
