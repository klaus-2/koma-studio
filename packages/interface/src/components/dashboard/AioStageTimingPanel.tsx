import { memo, useState } from 'react';

import { useI18n } from '../../i18n';
import { buildAioTimingDigest } from '../../pages/dashboard/lib/aio-timing-digest';
import { useAioStageTimingStore } from '../../pages/dashboard/stores/aio-stage-timing-store';
import { useStatusStore } from '../../pages/dashboard/stores/status-store';
import { copyTextToClipboardSafe } from '../../utils/clipboard';

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

const formatStageSummary = (stageSeconds: Record<string, number>): string =>
  STAGE_ORDER.filter((stage) => (stageSeconds[stage] ?? 0) > 0)
    .map(
      (stage) =>
        `${stage} ${formatStageSeconds(stageSeconds[stage] ?? 0)}`,
    )
    .join(' · ');

export default memo(function AioStageTimingPanel({
  className,
}: AioStageTimingPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const chapterOrder = useAioStageTimingStore((s) => s.chapterOrder);
  const chapters = useAioStageTimingStore((s) => s.chapters);
  const totals = useAioStageTimingStore((s) => s.totals);
  const bottleneck = useAioStageTimingStore((s) => s.bottleneck);
  const providerLabel = useAioStageTimingStore((s) => s.providerLabel);
  const providerKind = useAioStageTimingStore((s) => s.providerKind);
  const cacheHitDetected = useAioStageTimingStore((s) => s.cacheHitDetected);
  const pages = useAioStageTimingStore((s) => s.pages);
  const reportBatchId = useAioStageTimingStore((s) => s.reportBatchId);
  const reportCapturedAt = useAioStageTimingStore((s) => s.reportCapturedAt);

  const hasTiming = chapterOrder.length > 0;

  const handleCopyReport = (): void => {
    const digest = buildAioTimingDigest({
      pages,
      totals,
      batchId: reportBatchId,
      capturedAt: reportCapturedAt,
    });
    copyTextToClipboardSafe(digest)
      .then(() => {
        useStatusStore
          .getState()
          .setTonedStatus(t('dashboard.footer.timing.copied'), 'success');
      })
      .catch(() => {
        useStatusStore
          .getState()
          .setTonedStatus(t('dashboard.footer.timing.copyFailed'), 'error');
      });
  };

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
                const stageSummary = formatStageSummary(chapter.stageSeconds);
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
              {pages.length > 0 && (
                <>
                  <button
                    type="button"
                    className="aio-stage-timing__toggle"
                    onClick={() => setPagesOpen((previous) => !previous)}
                    aria-expanded={pagesOpen}
                  >
                    {t('dashboard.footer.timing.pages')}
                    {pagesOpen ? ' ▾' : ' ▸'}
                  </button>
                  {pagesOpen && (
                    <span className="aio-stage-timing__body max-h-32 min-w-0 overflow-y-auto">
                      {pages.map((page) => {
                        const stageSummary = formatStageSummary(
                          page.stageSeconds,
                        );
                        return (
                          <span key={page.key}>
                            {`${page.index + 1}. ${page.filename}`}
                            {stageSummary.length > 0
                              ? ` — ${stageSummary}`
                              : ''}
                          </span>
                        );
                      })}
                    </span>
                  )}
                  <button
                    type="button"
                    className="aio-stage-timing__toggle"
                    onClick={handleCopyReport}
                  >
                    {t('dashboard.footer.timing.copyReport')}
                  </button>
                </>
              )}
            </>
          )}
        </span>
      )}
    </span>
  );
});
