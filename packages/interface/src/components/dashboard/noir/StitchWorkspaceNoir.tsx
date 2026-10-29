import { m } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FolderOutput, Layers3, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import type { StitchAlignMode, StitchBatchPlan, StitchExportFormat, StitchImageInput, StitchLayoutMode } from '../stitch/types';
import { formatBytes } from '../stitch/stitchUtils';
import { useI18n } from '../../../i18n';
import { canUseDirectoryPicker } from '../stitch/stitchRender';
import { useStitchExport } from '../stitch/useStitchExport';
import { WsPanel, WsHead, ToolBtn, StatCard, EASE } from '../../noir-panels/NoirPrimitives';

interface StitchWorkspaceProps {
  images: StitchImageInput[];
  batchPlans: StitchBatchPlan[];
  selectedBatchIndex: number;
  onSelectBatchIndex: (value: number) => void;
  layoutMode: StitchLayoutMode;
  gap: number;
  alignMode: StitchAlignMode;
  background: string;
  singleExportFormat: Exclude<StitchExportFormat, 'zip'>;
  safeFileStem: string;
  processing: boolean;
  outQuality: number;
  ensureVerifiedEmailOrNotify: () => boolean;
  ensureQuotaBeforeProcessing?: (pages: number, processMode?: string) => boolean;
  hasQuotaForCurrentBatch?: boolean;
  quotaLimitButtonTitle?: string;
  isDesktopRuntime: boolean;
  registerDownloads: (items: Array<{ fileName: string; blob: Blob; sourceImageId: string }>, scope: 'stitch') => void;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  setProcessing: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (message: string) => void;
  recordProcessedPages: (pages: number) => void;
}



export const StitchWorkspaceNoir = ({
  images, batchPlans, selectedBatchIndex, onSelectBatchIndex, layoutMode, gap, alignMode, background, singleExportFormat, safeFileStem,
  processing, outQuality, ensureVerifiedEmailOrNotify, ensureQuotaBeforeProcessing,
  isDesktopRuntime, registerDownloads, triggerBlobDownload, setProcessing, setProgress, setStatusMessage, recordProcessedPages,
}: StitchWorkspaceProps) => {
  const { t } = useI18n();

  const {
    previewUrl, previewDimensions, previewZoom, setPreviewZoom, previewBusy,
    previewProgress, renderError, stageRef,
    selectedBatch, selectedBatchHasPrevious, selectedBatchHasNext,
    exportDisabled, cancelExportTask, exportCurrentBatch, exportAllBatchesAsZip,
    exportAllBatchesToDirectory, hasQuotaForCurrentBatch, quotaLimitButtonTitle,
  } = useStitchExport({
    images, batchPlans, selectedBatchIndex, layoutMode, gap, alignMode, background,
    singleExportFormat, outQuality, safeFileStem, processing,
    setProcessing, setProgress, setStatusMessage, registerDownloads, triggerBlobDownload,
    recordProcessedPages, ensureVerifiedEmailOrNotify, ensureQuotaBeforeProcessing,
  });

  const selectedBatchMetrics = selectedBatch ? `${selectedBatch.outputWidth} × ${selectedBatch.outputHeight}px` : t('stitch.workspace.noBatchSelected');

  return (
    <div className="grid gap-4 font-display text-paper xl:grid-cols-[1.6fr_1fr]">
      {/* ═══════════ PREVIEW ═══════════ */}
      <WsPanel accent="crimson" className="flex flex-col">
        <WsHead
          icon={Layers3}
          eyebrow={t('stitch.workspace.previewEyebrow')}
          title={selectedBatch ? t('stitch.workspace.batchTitle', { current: selectedBatchIndex + 1, total: batchPlans.length }) : t('stitch.workspace.noBatchAvailable')}
          subtitle={selectedBatch ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span>{t('stitch.workspace.imagesCount', { count: selectedBatch.count })}</span>
              <span className="h-1 w-1 rounded-full bg-crimson/50" />
              <span>{selectedBatchMetrics}</span>
              <span className="h-1 w-1 rounded-full bg-crimson/50" />
              <span>~{formatBytes(selectedBatch.estimatedBytes)}</span>
            </span>
          ) : undefined}
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-paper/8 p-3">
          <ToolBtn disabled={!selectedBatchHasPrevious} onClick={() => onSelectBatchIndex(Math.max(0, selectedBatchIndex - 1))} ariaLabel={t('stitch.workspace.previousBatch')}><ChevronLeft size={14} /></ToolBtn>
          <ToolBtn disabled={!selectedBatchHasNext} onClick={() => onSelectBatchIndex(Math.min(batchPlans.length - 1, selectedBatchIndex + 1))} ariaLabel={t('stitch.workspace.nextBatch')}><ChevronRight size={14} /></ToolBtn>

          <span className="mx-1 h-5 w-px bg-paper/10" aria-hidden="true" />

          <ToolBtn onClick={() => setPreviewZoom((c) => Math.max(0.1, Number((c - 0.1).toFixed(2))))} ariaLabel={t('stitch.workspace.zoomOut')}><ZoomOut size={13} /></ToolBtn>
          <ToolBtn onClick={() => setPreviewZoom(1)} ariaLabel={t('stitch.workspace.resetZoom')}>{Math.round(previewZoom * 100)}%</ToolBtn>
          <ToolBtn onClick={() => setPreviewZoom((c) => Math.min(5, Number((c + 0.1).toFixed(2))))} ariaLabel={t('stitch.workspace.zoomIn')}><ZoomIn size={13} /></ToolBtn>

          <span className="mx-1 h-5 w-px bg-paper/10" aria-hidden="true" />

          <button type="button" className="btn-primary panel-cut-sm !py-2 !text-[11px]" disabled={exportDisabled} title={quotaLimitButtonTitle} onClick={() => void exportCurrentBatch()}>
            {processing ? <><Loader2 size={13} className="animate-spin" /> {t('stitch.workspace.exporting')}</> : <><Download size={13} /> {t('stitch.workspace.exportBatch')}</>}
          </button>
          <ToolBtn onClick={() => void exportAllBatchesAsZip()} disabled={processing || batchPlans.length === 0 || !hasQuotaForCurrentBatch} title={quotaLimitButtonTitle}><Download size={13} /> {t('stitch.workspace.zip')}</ToolBtn>
          {isDesktopRuntime && canUseDirectoryPicker() && (
            <ToolBtn tone="mint" active onClick={() => void exportAllBatchesToDirectory()} disabled={processing || batchPlans.length === 0 || !hasQuotaForCurrentBatch} title={quotaLimitButtonTitle}><FolderOutput size={13} /> {t('stitch.workspace.folder')}</ToolBtn>
          )}
          {processing && (
            <button type="button" className="btn-ghost panel-cut-sm !border-crimson !text-crimson !py-2 !text-[11px]" onClick={cancelExportTask}>{t('stitch.workspace.cancel')}</button>
          )}
        </div>

        {/* Stage */}
        <div ref={stageRef} className="halftone relative flex min-h-[420px] flex-1 items-start justify-center overflow-auto bg-ink/50 p-6">
          {!selectedBatch && (
            <div className="m-auto flex flex-col items-center gap-3 text-center">
              <span className="flex h-16 w-16 items-center justify-center panel-cut bg-crimson/8 text-crimson"><Layers3 size={30} /></span>
              <p className="font-display text-sm font-bold uppercase tracking-tight">{t('stitch.workspace.emptyTitle')}</p>
              <p className="max-w-xs font-mono text-[10.5px] text-paper-dim">{t('stitch.workspace.emptyDescription')}</p>
            </div>
          )}

          {selectedBatch && previewBusy && (
            <div className="absolute left-1/2 top-6 z-10 w-64 -translate-x-1/2 glass panel-cut-sm space-y-2 border-l-2 border-l-crimson p-3">
              <div className="flex items-center gap-2 font-mono text-[10.5px] text-crimson">
                <Loader2 size={12} className="animate-spin" />
                <span>{t('stitch.workspace.generatingPreview', { progress: Math.round(previewProgress) })}</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-ink">
                <m.div className="h-full w-full origin-left bg-crimson" animate={{ scaleX: previewProgress / 100 }} transition={{ ease: EASE }} />
              </div>
            </div>
          )}

          {previewUrl && (
            <img src={previewUrl} alt={t('stitch.workspace.previewAlt')} className="panel-cut-sm border border-paper/10 shadow-[6px_6px_0_rgba(0,0,0,0.4)]"
              style={{ zoom: previewZoom, maxWidth: layoutMode === 'webtoon' ? 720 : undefined }} />
          )}
        </div>

        {renderError && (
          <div className="m-3 glass panel-cut-sm space-y-1 border-l-2 border-l-crimson p-3">
            <div className="flex items-center gap-2 font-display text-[11px] font-bold uppercase text-crimson"><AlertTriangle size={13} /> {t('stitch.workspace.errorTitle')}</div>
            <p className="font-mono text-[10.5px] text-paper-dim">{renderError}</p>
          </div>
        )}
      </WsPanel>

      {/* ═══════════ PLANNING ═══════════ */}
      <WsPanel accent="azure" className="flex flex-col">
        <WsHead
          icon={Layers3}
          eyebrow={t('stitch.workspace.planningEyebrow')}
          title={t('stitch.workspace.planningTitle', { count: batchPlans.length })}
          subtitle={t('stitch.workspace.planningSubtitle')}
          right={<span className="stamp !text-[8px]">{safeFileStem}</span>}
        />

        <div className="flex-1 space-y-3 overflow-auto p-3">
          {/* Batch cards */}
          <div className="space-y-2">
            {batchPlans.map((batch, idx) => {
              const active = selectedBatchIndex === idx;
              return (
                <button key={batch.id} type="button" onClick={() => onSelectBatchIndex(idx)}
                  className={`panel-cut-sm block w-full space-y-2 border p-3 text-left transition-all duration-200 ${active ? 'border-crimson/60 bg-crimson/8 -translate-x-0.5 -translate-y-0.5 shadow-[4px_4px_0_rgba(255,46,99,0.25)]' : 'border-paper/10 bg-ink hover:border-paper/25'
                    }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-[12px] font-bold uppercase tracking-tight text-paper">{t('stitch.workspace.batchCardTitle', { index: idx + 1 })}</div>
                      <div className="font-mono text-[9.5px] text-paper-dim">{t('stitch.workspace.batchCardDims', { count: batch.count, width: batch.outputWidth, height: batch.outputHeight })}</div>
                    </div>
                    <span className="stamp shrink-0 !py-0.5 !text-[8px] !text-gold !border-gold/50 !bg-gold/10">{batch.megapixels.toFixed(1)} MP</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {batch.imageIndexes.map((imgIdx) => {
                      const img = images[imgIdx];
                      if (!img) return null;
                      return (
                        <span key={`${batch.id}-${img.id}`} className="inline-flex items-center gap-1 panel-cut-sm bg-paper/5 px-1.5 py-0.5 font-mono text-[8.5px] text-paper-dim">
                          <span className="text-crimson">{imgIdx + 1}</span>
                          <span className="max-w-[72px] truncate">{img.file.name}</span>
                        </span>
                      );
                    })}
                  </div>
                  {batch.warnings.length > 0 && batch.warnings.map((w) => (
                    <div key={w} className="flex items-center gap-1.5 font-mono text-[9px] text-gold"><AlertTriangle size={11} className="shrink-0" /><span>{t(w as any)}</span></div>
                  ))}
                </button>
              );
            })}
          </div>

          {/* Active batch */}
          <div className="glass panel-cut-sm space-y-3 border-l-2 border-l-mint p-3">
            <span className="kicker !text-mint flex items-center gap-1.5"><Layers3 size={11} /> {t('stitch.workspace.activeBatch')}</span>
            {selectedBatch ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard value={selectedBatch.count} label={t('stitch.workspace.stats.images')} />
                  <StatCard value={selectedBatchMetrics} label={t('stitch.workspace.stats.output')} tone="mint" />
                  <StatCard value={formatBytes(selectedBatch.estimatedBytes)} label={t('stitch.workspace.stats.size')} tone="gold" />
                  <StatCard value={previewDimensions ? `${previewDimensions.width}×${previewDimensions.height}` : t('stitch.workspace.awaiting')} label={t('stitch.workspace.stats.preview')} />
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-paper-dim">
                  <strong className="text-paper">{t('stitch.workspace.toolboxTitle')} </strong>{t('stitch.workspace.toolboxDescription')}
                </p>
              </>
            ) : (
              <p className="font-mono text-[11px] text-paper-dim">{t('stitch.workspace.noBatchSelected')}</p>
            )}
          </div>
        </div>
      </WsPanel>
    </div>
  );
};

export default StitchWorkspaceNoir;
