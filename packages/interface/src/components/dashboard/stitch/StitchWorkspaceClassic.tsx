import { AlertTriangle, ChevronLeft, ChevronRight, Download, FolderOutput, Layers3, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import type { StitchAlignMode, StitchBatchPlan, StitchExportFormat, StitchImageInput, StitchLayoutMode } from './types';
import { formatBytes } from './stitchUtils';
import './StitchWorkspace.css';
import { useI18n } from '../../../i18n';
import { canUseDirectoryPicker } from './stitchRender';
import { useStitchExport } from './useStitchExport';

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
  isDesktopRuntime: boolean;
  registerDownloads: (items: Array<{ fileName: string; blob: Blob; sourceImageId: string }>, scope: 'stitch') => void;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  setProcessing: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (message: string) => void;
  recordProcessedPages: (pages: number) => void;
}



export const StitchWorkspaceClassic = ({
  images, batchPlans, selectedBatchIndex, onSelectBatchIndex, layoutMode, gap, alignMode, background, singleExportFormat, safeFileStem,
  processing, outQuality, ensureVerifiedEmailOrNotify,
  isDesktopRuntime, registerDownloads, triggerBlobDownload, setProcessing, setProgress, setStatusMessage, recordProcessedPages,
}: StitchWorkspaceProps) => {
  const { t } = useI18n();

  const {
    previewUrl, previewDimensions, previewZoom, setPreviewZoom, previewBusy,
    previewProgress, renderError, stageRef, handleStageWheel,
    selectedBatch, selectedBatchHasPrevious, selectedBatchHasNext,
    exportDisabled, cancelExportTask, exportCurrentBatch, exportAllBatchesAsZip,
    exportAllBatchesToDirectory,
  } = useStitchExport({
    images, batchPlans, selectedBatchIndex, layoutMode, gap, alignMode, background,
    singleExportFormat, outQuality, safeFileStem, processing,
    setProcessing, setProgress, setStatusMessage, registerDownloads, triggerBlobDownload,
    recordProcessedPages, ensureVerifiedEmailOrNotify,
  });

  const selectedBatchMetrics = selectedBatch ? `${selectedBatch.outputWidth} × ${selectedBatch.outputHeight}px` : t('stitch.workspace.noBatchSelected');

  return (
    <div className="koma-stitch-ws">

      {/* ═══ Preview Panel ═══ */}
      <div className="koma-stitch-preview">

        {/* Header */}
        <div className="koma-stitch-preview__head">
          <div className="koma-stitch-preview__info">
            <span className="koma-stitch-preview__eyebrow">{t('stitch.workspace.previewEyebrow')}</span>
            <h2 className="koma-stitch-preview__title">
              {selectedBatch
                ? t('stitch.workspace.batchTitle', { current: selectedBatchIndex + 1, total: batchPlans.length })
                : t('stitch.workspace.noBatchAvailable')}
            </h2>
            {selectedBatch && (
              <div className="koma-stitch-preview__meta">
                <span>{t('stitch.workspace.imagesCount', { count: selectedBatch.count })}</span>
                <span className="koma-stitch-preview__meta-dot" aria-hidden="true" />
                <span>{selectedBatchMetrics}</span>
                <span className="koma-stitch-preview__meta-dot" aria-hidden="true" />
                <span>~{formatBytes(selectedBatch.estimatedBytes)}</span>
              </div>
            )}
          </div>

          <div className="koma-stitch-controls">
            {/* Batch nav */}
            <button
              type="button"
              className="koma-stitch-nav-btn"
              disabled={!selectedBatchHasPrevious}
              onClick={() => onSelectBatchIndex(Math.max(0, selectedBatchIndex - 1))}
              aria-label={t('stitch.workspace.previousBatch')}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="koma-stitch-nav-btn"
              disabled={!selectedBatchHasNext}
              onClick={() => onSelectBatchIndex(Math.min(batchPlans.length - 1, selectedBatchIndex + 1))}
              aria-label={t('stitch.workspace.nextBatch')}
            >
              <ChevronRight size={14} />
            </button>

            <span className="koma-stitch-controls__sep" aria-hidden="true" />

            {/* Zoom */}
            <div className="koma-stitch-zoom">
              <button
                type="button"
                className="koma-stitch-zoom__btn"
                onClick={() => setPreviewZoom((c) => Math.max(0.1, Number((c - 0.1).toFixed(2))))}
                aria-label={t('stitch.workspace.zoomOut')}
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                className="koma-stitch-zoom__pct"
                onClick={() => setPreviewZoom(1)}
                aria-label={t('stitch.workspace.resetZoom')}
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <button
                type="button"
                className="koma-stitch-zoom__btn"
                onClick={() => setPreviewZoom((c) => Math.min(5, Number((c + 0.1).toFixed(2))))}
                aria-label={t('stitch.workspace.zoomIn')}
              >
                <ZoomIn size={13} />
              </button>
            </div>

            <span className="koma-stitch-controls__sep" aria-hidden="true" />

            {/* Export actions */}
            <button
              type="button"
              className="koma-stitch-export-btn"
              disabled={exportDisabled}
              onClick={() => void exportCurrentBatch()}
            >
              {processing
                ? <><Loader2 size={13} className="koma-stitch-spin" /> {t('stitch.workspace.exporting')}</>
                : <><Download size={13} /> {t('stitch.workspace.exportBatch')}</>}
            </button>

            <button
              type="button"
              className="koma-stitch-action-btn"
              disabled={processing || batchPlans.length === 0}
              onClick={() => void exportAllBatchesAsZip()}
            >
              <Download size={13} /> {t('stitch.workspace.zip')}
            </button>

            {isDesktopRuntime && canUseDirectoryPicker() && (
              <button
                type="button"
                className="koma-stitch-action-btn koma-stitch-action-btn--emerald"
                disabled={processing || batchPlans.length === 0}
                onClick={() => void exportAllBatchesToDirectory()}
              >
                <FolderOutput size={13} /> {t('stitch.workspace.folder')}
              </button>
            )}

            {processing && (
              <button
                type="button"
                className="koma-stitch-action-btn koma-stitch-action-btn--danger"
                onClick={cancelExportTask}
              >
                {t('stitch.workspace.cancel')}
              </button>
            )}
          </div>
        </div>

        {/* Stage */}
        <div className="koma-stitch-stage" ref={stageRef} onWheel={handleStageWheel}>
          {!selectedBatch && (
            <div className="koma-stitch-empty">
              <Layers3 size={36} className="koma-stitch-empty__icon" />
              <p className="koma-stitch-empty__title">{t('stitch.workspace.emptyTitle')}</p>
              <p className="koma-stitch-empty__desc">
                {t('stitch.workspace.emptyDescription')}
              </p>
            </div>
          )}

          {selectedBatch && previewBusy && (
            <div className="koma-stitch-progress">
              <div className="koma-stitch-progress__head">
                <Loader2 size={12} className="koma-stitch-spin" />
                <span>{t('stitch.workspace.generatingPreview', { progress: Math.round(previewProgress) })}</span>
              </div>
              <div className="koma-stitch-progress__track">
                <div
                  className="koma-stitch-progress__fill"
                  style={{ width: `${previewProgress}%` }}
                />
              </div>
            </div>
          )}

          {previewUrl && (
            <img
              src={previewUrl}
              alt={t('stitch.workspace.previewAlt')}
              className="koma-stitch-stage__img"
              style={{
                zoom: previewZoom,
                maxWidth: layoutMode === "webtoon" ? 720 : undefined,
              }}
            />
          )}
        </div>

        {/* Error */}
        {renderError && (
          <div className="koma-stitch-error">
            <div className="koma-stitch-error__head">
              <AlertTriangle size={13} /> {t('stitch.workspace.errorTitle')}
            </div>
            <p className="koma-stitch-error__msg">{renderError}</p>
          </div>
        )}
      </div>

      {/* ═══ Planning Panel ═══ */}
      <div className="koma-stitch-planning">

        {/* Header */}
        <div className="koma-stitch-planning__head">
          <div className="koma-stitch-planning__info">
            <span className="koma-stitch-planning__eyebrow">{t('stitch.workspace.planningEyebrow')}</span>
            <h2 className="koma-stitch-planning__title">
              {t('stitch.workspace.planningTitle', { count: batchPlans.length })}
            </h2>
            <span className="koma-stitch-planning__subtitle">
              {t('stitch.workspace.planningSubtitle')}
            </span>
          </div>
          <span className="koma-stitch-planning__stem">
            {t('stitch.workspace.baseLabel')} <strong>{safeFileStem}</strong>
          </span>
        </div>

        {/* Body grid */}
        <div className="koma-stitch-planning__body">

          {/* Batch cards */}
          <div className="koma-stitch-batch-list">
            {batchPlans.map((batch, idx) => (
              <button
                key={batch.id}
                type="button"
                className={`koma-stitch-batch${selectedBatchIndex === idx ? " koma-stitch-batch--active" : ""}`}
                onClick={() => onSelectBatchIndex(idx)}
              >
                <div className="koma-stitch-batch__head">
                  <div>
                    <div className="koma-stitch-batch__name">{t('stitch.workspace.batchCardTitle', { index: idx + 1 })}</div>
                    <div className="koma-stitch-batch__dims">
                      {t('stitch.workspace.batchCardDims', { count: batch.count, width: batch.outputWidth, height: batch.outputHeight })}
                    </div>
                  </div>
                  <span className="koma-stitch-batch__mp">
                    {batch.megapixels.toFixed(1)} MP
                  </span>
                </div>

                <div className="koma-stitch-batch__chips">
                  {batch.imageIndexes.map((imgIdx, localIdx) => {
                    const img = images[imgIdx];
                    if (!img) return null;
                    return (
                      <span key={`${batch.id}-${img.id}`} className="koma-stitch-batch__chip">
                        <span className="koma-stitch-batch__chip-num">{imgIdx + 1}</span>
                        <span className="koma-stitch-batch__chip-name">{img.file.name}</span>
                        {localIdx < batch.imageIndexes.length - 1 && (
                          <span className="koma-stitch-batch__chip-plus">+</span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {batch.warnings.length > 0 && (
                  <div className="koma-stitch-batch__warnings">
                    {batch.warnings.map((w) => (
                      <div key={w} className="koma-stitch-batch__warning">
                        <AlertTriangle size={11} className="koma-stitch-batch__warning-icon" />
                        <span>{t(w as any)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Active batch sidebar */}
          <aside className="koma-stitch-active">
            <div className="koma-stitch-active__head">
              <span className="koma-stitch-active__head-icon" aria-hidden="true">
                <Layers3 size={11} />
              </span>
              {t('stitch.workspace.activeBatch')}
            </div>

            {selectedBatch ? (
              <>
                <div className="koma-stitch-stats">
                  <div className="koma-stitch-stat">
                    <span className="koma-stitch-stat__key">{t('stitch.workspace.stats.images')}</span>
                    <span className="koma-stitch-stat__val">{selectedBatch.count}</span>
                  </div>
                  <div className="koma-stitch-stat">
                    <span className="koma-stitch-stat__key">{t('stitch.workspace.stats.output')}</span>
                    <span className="koma-stitch-stat__val">{selectedBatchMetrics}</span>
                  </div>
                  <div className="koma-stitch-stat">
                    <span className="koma-stitch-stat__key">{t('stitch.workspace.stats.size')}</span>
                    <span className="koma-stitch-stat__val">{formatBytes(selectedBatch.estimatedBytes)}</span>
                  </div>
                  <div className="koma-stitch-stat">
                    <span className="koma-stitch-stat__key">{t('stitch.workspace.stats.preview')}</span>
                    <span className="koma-stitch-stat__val">
                      {previewDimensions
                        ? `${previewDimensions.width}×${previewDimensions.height}`
                        : t('stitch.workspace.awaiting')}
                    </span>
                  </div>
                </div>

                <div className="koma-stitch-active__note">
                  <strong>{t('stitch.workspace.toolboxTitle')}</strong>
                  {t('stitch.workspace.toolboxDescription')}
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: "var(--auth-text-muted)" }}>
                {t('stitch.workspace.noBatchSelected')}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default StitchWorkspaceClassic;
