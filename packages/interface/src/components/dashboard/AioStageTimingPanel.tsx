import { memo, useEffect, useRef, useState } from 'react';
import { ChevronDown, Timer } from 'lucide-react';

import { useI18n } from '../../i18n';
import { buildAioTimingDigest } from '../../pages/dashboard/lib/aio-timing-digest';
import { useAioStageTimingStore } from '../../pages/dashboard/stores/aio-stage-timing-store';
import { useStatusStore } from '../../pages/dashboard/stores/status-store';
import { copyTextToClipboardSafe } from '../../utils/clipboard';
import { cn } from '../../utils/dashboard.utils';

type AioStageTimingVariant = 'classic' | 'noir';

interface AioStageTimingPanelProps {
  className?: string;
  variant?: AioStageTimingVariant;
}

const STAGE_ORDER = ['detect', 'ocr', 'translation', 'segment', 'clean'] as const;

const SKIN: Record<
  AioStageTimingVariant,
  Record<
    'trigger' | 'label' | 'panel' | 'kicker' | 'muted' | 'accent' | 'track' | 'fill' | 'fillHot' | 'action' | 'divider',
    string
  >
> = {
  classic: {
    trigger: 'koma-footerbar__workspace aio-stage-timing__trigger',
    label: 'koma-footerbar__workspaceLabel',
    panel: 'aio-stage-timing__panel',
    kicker: 'aio-stage-timing__kicker',
    muted: 'aio-stage-timing__muted',
    accent: 'aio-stage-timing__accent',
    track: 'aio-stage-timing__track',
    fill: 'aio-stage-timing__fill',
    fillHot: 'aio-stage-timing__fill aio-stage-timing__fill--hot',
    action: 'aio-stage-timing__action',
    divider: 'aio-stage-timing__divider',
  },
  noir: {
    trigger:
      'panel-cut-sm border border-paper/20 bg-ink-3/60 px-2 py-1 text-paper-dim transition-colors hover:border-azure/50 hover:text-paper aria-expanded:border-azure/60 aria-expanded:text-azure',
    label: 'font-mono text-[10px] font-semibold uppercase tracking-wider',
    panel:
      'panel-cut-sm border border-paper/15 bg-ink-2/[0.97] backdrop-blur-xl drop-shadow-[5px_5px_0_rgba(255,200,87,0.75)]',
    kicker: 'kicker !text-azure',
    muted: 'text-paper-dim',
    accent: 'text-gold',
    track: 'bg-ink-3',
    fill: 'bg-azure/70',
    fillHot: 'bg-crimson',
    action:
      'panel-cut-sm border border-paper/20 bg-ink-3/60 px-2 py-0.5 text-paper-dim transition-colors hover:border-azure/50 hover:text-paper',
    divider: 'border-paper/10',
  },
};

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
  variant = 'classic',
}: AioStageTimingPanelProps) {
  const { t } = useI18n();
  const skin = SKIN[variant];
  const rootRef = useRef<HTMLSpanElement>(null);
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
  const title = t('dashboard.footer.timing.title');
  const badgeText =
    bottleneck !== null
      ? `${bottleneck} ${formatStageSeconds(totals[bottleneck] ?? 0)}`
      : title;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

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
    <span ref={rootRef} className={cn('relative inline-flex shrink-0', className)}>
      <button
        type="button"
        className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', skin.trigger)}
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        title={title}
      >
        <Timer size={11} aria-hidden="true" />
        <span className={skin.label}>{badgeText}</span>
        <ChevronDown
          size={10}
          aria-hidden="true"
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={cn(
            'absolute bottom-full right-0 z-[230] mb-2 flex max-h-[60vh] w-72 flex-col gap-2 overflow-y-auto whitespace-normal p-3 text-left font-mono text-[11px] font-normal normal-case tracking-normal',
            skin.panel,
          )}
        >
          <div className="flex flex-col gap-0.5">
            <span className={skin.kicker}>{title}</span>
            {hasTiming && (
              <span className={cn('text-[10px]', skin.muted)}>
                {t('dashboard.footer.timing.accumulated')}
              </span>
            )}
          </div>
          {!hasTiming ? (
            <span className={skin.muted}>{t('dashboard.footer.timing.empty')}</span>
          ) : (
            <>
              {chapterOrder.map((chapterKey) => {
                const chapter = chapters[chapterKey];
                if (!chapter) {
                  return null;
                }
                const stages = STAGE_ORDER.filter(
                  (stage) => (chapter.stageSeconds[stage] ?? 0) > 0,
                );
                const peak = Math.max(
                  ...stages.map((stage) => chapter.stageSeconds[stage] ?? 0),
                  0,
                );
                return (
                  <div key={chapterKey} className="flex flex-col gap-1">
                    <span className={cn('text-[10px] uppercase tracking-wider', skin.muted)}>
                      {t('dashboard.footer.timing.chapter', { label: chapter.label })}
                    </span>
                    {stages.map((stage) => {
                      const seconds = chapter.stageSeconds[stage] ?? 0;
                      const hot = stage === bottleneck;
                      return (
                        <div
                          key={stage}
                          data-testid={`aio-stage-timing-row-${stage}`}
                          className="grid grid-cols-[72px_1fr_auto] items-center gap-2"
                        >
                          <span className={hot ? skin.accent : undefined}>{stage}</span>
                          <span className={cn('h-1 overflow-hidden', skin.track)}>
                            <span
                              className={cn('block h-full', hot ? skin.fillHot : skin.fill)}
                              style={{ width: `${peak > 0 ? (seconds / peak) * 100 : 0}%` }}
                            />
                          </span>
                          <span className={cn('tabular-nums', hot && skin.accent)}>
                            {formatStageSeconds(seconds)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div className={cn('flex flex-col gap-0.5 border-t pt-2 text-[10px]', skin.divider)}>
                {bottleneck !== null && (
                  <span className={skin.accent}>
                    {t('dashboard.footer.timing.bottleneck', { stage: bottleneck })}{' '}
                    {formatStageSeconds(totals[bottleneck] ?? 0)}
                  </span>
                )}
                {providerLabel !== null && providerKind !== null && (
                  <span className={skin.muted}>
                    {providerKind === 'local'
                      ? t('dashboard.footer.timing.providerLocal', { provider: providerLabel })
                      : t('dashboard.footer.timing.providerCloud', { provider: providerLabel })}
                  </span>
                )}
                {cacheHitDetected && (
                  <span className={skin.muted}>{t('dashboard.footer.timing.cacheHit')}</span>
                )}
              </div>
              {pages.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className={cn('text-[10px]', skin.action)}
                      onClick={() => setPagesOpen((previous) => !previous)}
                      aria-expanded={pagesOpen}
                    >
                      {t('dashboard.footer.timing.pages')}
                      {pagesOpen ? ' ▾' : ' ▸'}
                    </button>
                    <button
                      type="button"
                      className={cn('text-[10px]', skin.action)}
                      onClick={handleCopyReport}
                    >
                      {t('dashboard.footer.timing.copyReport')}
                    </button>
                  </div>
                  {pagesOpen && (
                    <div className={cn('flex max-h-32 min-w-0 flex-col gap-0.5 overflow-y-auto text-[10px]', skin.muted)}>
                      {pages.map((page) => {
                        const stageSummary = formatStageSummary(page.stageSeconds);
                        return (
                          <span key={page.key} className="break-all">
                            {`${page.index + 1}. ${page.filename}`}
                            {stageSummary.length > 0 ? ` — ${stageSummary}` : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </span>
  );
});
