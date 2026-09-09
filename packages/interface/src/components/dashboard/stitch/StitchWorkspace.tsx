import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FolderOutput, Layers3, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import type { StitchAlignMode, StitchBatchPlan, StitchExportFormat, StitchImageInput, StitchLayoutMode, StitchRenderJob, StitchRenderResult } from './types';
import { applyImageFiltersToContext, calculateAxisOffset, formatBytes, getExtensionFromMimeType, getMimeTypeFromExportFormat, getRotatedDimensions, resolveStitchOutputMetrics } from './stitchUtils';
import './StitchWorkspace.css';
import { useI18n } from '../../../i18n';

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

type ActiveTask = { cancel: () => void };
type WorkerSuccess = { blob: Blob; width: number; height: number };
type DirectoryPicker = (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

const buildRequestId = (): string => `stitch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const getDirectoryPicker = (): DirectoryPicker | null => {
  if (typeof window === 'undefined') return null;
  const picker = (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  return typeof picker === 'function' ? picker as DirectoryPicker : null;
};
const canUseDirectoryPicker = (): boolean => getDirectoryPicker() !== null;

const loadImageWithDecode = async (file: File): Promise<HTMLImageElement> => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  try {
    const decodeImage = (image as HTMLImageElement & { decode?: () => Promise<void> }).decode;
    if (typeof decodeImage === 'function') await decodeImage.call(image);
    else await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('stitch.error.loadImage')); });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const renderJobOnMainThread = async (job: StitchRenderJob, onProgress?: (progress: number) => void): Promise<WorkerSuccess> => {
  const outputMetrics = resolveStitchOutputMetrics(job.images, job.layoutMode, job.gap);
  const canvas = document.createElement('canvas');
  canvas.width = outputMetrics.width;
  canvas.height = outputMetrics.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('stitch.error.initCanvas');
  ctx.fillStyle = job.background;
  ctx.fillRect(0, 0, outputMetrics.width, outputMetrics.height);

  let cursorX = 0;
  let cursorY = 0;
  for (let index = 0; index < job.images.length; index += 1) {
    const input = job.images[index];
    if (!input) continue;
    const image = await loadImageWithDecode(input.file);
    const dims = getRotatedDimensions(input);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dims.width;
    tempCanvas.height = dims.height;
    const tempContext = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempContext) throw new Error('stitch.error.initTempCanvas');
    tempContext.save();
    tempContext.translate(dims.width / 2, dims.height / 2);
    tempContext.rotate((input.rotation * Math.PI) / 180);
    if (input.rotation % 180 !== 0) tempContext.drawImage(image, -dims.height / 2, -dims.width / 2, dims.height, dims.width);
    else tempContext.drawImage(image, -dims.width / 2, -dims.height / 2, dims.width, dims.height);
    tempContext.restore();
    applyImageFiltersToContext(tempContext, dims.width, dims.height, input.filters);
    if (job.layoutMode === 'webtoon') {
      const drawX = calculateAxisOffset(outputMetrics.width, dims.width, job.alignMode);
      ctx.drawImage(tempCanvas, drawX, cursorY);
      cursorY += dims.height + job.gap;
    } else {
      const drawY = calculateAxisOffset(outputMetrics.height, dims.height, job.alignMode);
      ctx.drawImage(tempCanvas, cursorX, drawY);
      cursorX += dims.width + job.gap;
    }
    onProgress?.(((index + 1) / job.images.length) * 100);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => nextBlob ? resolve(nextBlob) : reject(new Error('stitch.error.generateBlob')), job.mimeType, job.mimeType === 'image/png' ? undefined : job.quality);
  });
  return { blob, width: outputMetrics.width, height: outputMetrics.height };
};

const runRenderJob = (job: StitchRenderJob, onProgress?: (progress: number) => void): ActiveTask & { promise: Promise<WorkerSuccess> } => {
  if (typeof Worker === 'undefined') {
    let cancelled = false;
    return {
      cancel: () => { cancelled = true; },
      promise: renderJobOnMainThread(job, (progress) => { if (!cancelled) onProgress?.(progress); }).then((result) => {
        if (cancelled) throw new Error('stitch.error.cancelled');
        return result;
      }),
    };
  }

  const worker = new Worker(new URL('./stitchWorker.ts', import.meta.url), { type: 'module' });
  let settled = false;
  const promise = new Promise<WorkerSuccess>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<
      | { type: 'progress'; requestId: string; progress: number }
      | { type: 'result'; result: StitchRenderResult }
      | { type: 'error'; requestId: string; message: string }
    >) => {
      if (settled) return;
      if (event.data.type === 'progress') {
        onProgress?.(event.data.progress);
        return;
      }
      if (event.data.type === 'error') {
        settled = true;
        worker.terminate();
        reject(new Error(event.data.message));
        return;
      }
      settled = true;
      worker.terminate();
      resolve({ blob: event.data.result.blob, width: event.data.result.width, height: event.data.result.height });
    };
    worker.onerror = (error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(error instanceof ErrorEvent ? new Error(error.message) : new Error('stitch.error.workerFailed'));
    };
    worker.postMessage({ type: 'render', job });
  });

  return { cancel: () => { if (!settled) { settled = true; worker.terminate(); } }, promise };
};

export const StitchWorkspace = ({
  images, batchPlans, selectedBatchIndex, onSelectBatchIndex, layoutMode, gap, alignMode, background, singleExportFormat, safeFileStem,
  processing, outQuality, ensureVerifiedEmailOrNotify,
  isDesktopRuntime, registerDownloads, triggerBlobDownload, setProcessing, setProgress, setStatusMessage, recordProcessedPages,
}: StitchWorkspaceProps) => {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const resolveStitchError = useCallback((error: unknown, fallbackKey: 'stitch.error.generatePreview' | 'stitch.error.exportBatch' | 'stitch.error.generateZip' | 'stitch.error.saveFolder'): string => {
    const knownKeys = new Set(['stitch.error.loadImage', 'stitch.error.initCanvas', 'stitch.error.initTempCanvas', 'stitch.error.generateBlob', 'stitch.error.workerFailed', 'stitch.error.generatePreview', 'stitch.error.exportBatch', 'stitch.error.generateZip', 'stitch.error.saveFolder']);
    if (error instanceof Error && knownKeys.has(error.message)) return tRef.current(error.message as Parameters<typeof tRef.current>[0]);
    if (error instanceof Error) return error.message;
    return tRef.current(fallbackKey);
  }, []);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number; height: number } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const previewTaskRef = useRef<ActiveTask | null>(null);
  const exportTaskRef = useRef<ActiveTask | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const handleStageWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setPreviewZoom((c) => Math.min(5, Math.max(0.1, Number((c + delta).toFixed(2)))));
  }, []);

  const selectedBatch = batchPlans[selectedBatchIndex] ?? null;
  const selectedBatchImageIndexesKey = selectedBatch?.imageIndexes.join(',') ?? '';
  const selectedBatchImages = useMemo<StitchImageInput[]>(() => selectedBatch?.imageIndexes
    .map((imageIndex) => images[imageIndex])
    .filter((image): image is StitchImageInput => Boolean(image)) ?? [], [images, selectedBatchImageIndexesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelPreviewTask = useCallback(() => {
    previewTaskRef.current?.cancel();
    previewTaskRef.current = null;
  }, []);

  const cancelExportTask = useCallback(() => {
    exportTaskRef.current?.cancel();
    exportTaskRef.current = null;
    setProcessing(false);
    setProgress(0);
    setStatusMessage(tRef.current('stitch.workspace.cancelled'));
  }, [setProcessing, setProgress, setStatusMessage]);

  useEffect(() => {
    setPreviewZoom(1);
  }, [selectedBatchIndex]);

  useEffect(() => {
    if (selectedBatchImages.length === 0) {
      cancelPreviewTask();
      setPreviewBusy(false);
      setPreviewProgress(0);
      setPreviewDimensions(null);
      setRenderError(null);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      return;
    }

    cancelPreviewTask();
    setPreviewBusy(true);
    setPreviewProgress(0);
    setRenderError(null);
    const task = runRenderJob({
      requestId: buildRequestId(),
      images: selectedBatchImages.map((image) => ({ file: image.file, width: image.width, height: image.height, rotation: image.rotation, filters: image.filters })),
      layoutMode,
      gap,
      mimeType: 'image/png',
      quality: 1,
      background,
      alignMode,
    }, (progress) => setPreviewProgress(progress));
    previewTaskRef.current = task;
    task.promise.then((result) => {
      const objectUrl = URL.createObjectURL(result.blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return objectUrl;
      });
      setPreviewDimensions({ width: result.width, height: result.height });
    }).catch((error) => {
      if (error instanceof Error && error.message === 'stitch.error.cancelled') return;
      setRenderError(resolveStitchError(error, 'stitch.error.generatePreview'));
    }).finally(() => {
      if (previewTaskRef.current === task) previewTaskRef.current = null;
      setPreviewBusy(false);
      setPreviewProgress(0);
    });

    return () => task.cancel();
  }, [alignMode, background, cancelPreviewTask, gap, layoutMode, resolveStitchError, selectedBatchImages]);

  useEffect(() => () => {
    cancelPreviewTask();
    cancelExportTask();
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [cancelExportTask, cancelPreviewTask]);

  const buildRenderJobForBatch = useCallback((batch: StitchBatchPlan, format: Exclude<StitchExportFormat, 'zip'>): StitchRenderJob => ({
    requestId: buildRequestId(),
    images: batch.imageIndexes.flatMap((imageIndex) => {
      const image = images[imageIndex];
      if (!image) return [];
      return { file: image.file, width: image.width, height: image.height, rotation: image.rotation, filters: image.filters };
    }),
    layoutMode,
    gap,
    mimeType: getMimeTypeFromExportFormat(format),
    quality: outQuality,
    background,
    alignMode,
  }), [alignMode, background, gap, images, layoutMode, outQuality]);

  const exportCurrentBatch = useCallback(async () => {
    if (!selectedBatch || !selectedBatchImages.length) return;
    if (!ensureVerifiedEmailOrNotify()) return;
    setProcessing(true);
    setProgress(0);
    setStatusMessage(t('stitch.workspace.renderingBatch', { current: selectedBatchIndex + 1, total: batchPlans.length }));
    setRenderError(null);

    const task = runRenderJob(buildRenderJobForBatch(selectedBatch, singleExportFormat), (progress) => setProgress(progress));
    exportTaskRef.current = task;
    try {
      const result = await task.promise;
      const extension = getExtensionFromMimeType(result.blob.type);
      const fileName = `${safeFileStem}_${String(selectedBatchIndex + 1).padStart(3, '0')}.${extension}`;
      const firstImage = selectedBatchImages[0];
      if (!firstImage) return;
      registerDownloads([{ fileName, blob: result.blob, sourceImageId: firstImage.id }], 'stitch');
      recordProcessedPages(selectedBatchImages.length);
      setStatusMessage(t('stitch.workspace.batchReady', { current: selectedBatchIndex + 1 }));
    } catch (error) {
      if (error instanceof Error && error.message === 'stitch.error.cancelled') return;
      setRenderError(resolveStitchError(error, 'stitch.error.exportBatch'));
      setStatusMessage(resolveStitchError(error, 'stitch.error.exportBatch'));
    } finally {
      if (exportTaskRef.current === task) exportTaskRef.current = null;
      setProcessing(false);
      setProgress(0);
    }
  }, [batchPlans.length, buildRenderJobForBatch, ensureVerifiedEmailOrNotify, recordProcessedPages, registerDownloads, resolveStitchError, safeFileStem, selectedBatch, selectedBatchImages, selectedBatchIndex, setProcessing, setProgress, setStatusMessage, singleExportFormat, t]);

  const exportAllBatchesAsZip = useCallback(async () => {
    if (batchPlans.length === 0) return;
    if (!ensureVerifiedEmailOrNotify()) return;
    const totalPages = batchPlans.reduce((sum, batch) => sum + batch.count, 0);
    setProcessing(true);
    setProgress(0);
    setStatusMessage(t('stitch.workspace.generatingZip', { count: batchPlans.length }));
    setRenderError(null);

    try {
      const { zipSync } = await import('fflate');
      const zipFiles: Record<string, Uint8Array> = {};
      for (let batchIndex = 0; batchIndex < batchPlans.length; batchIndex += 1) {
        const batch = batchPlans[batchIndex];
        if (!batch) continue;
        const task = runRenderJob(buildRenderJobForBatch(batch, singleExportFormat), (progress) => setProgress(((batchIndex + progress / 100) / batchPlans.length) * 100));
        exportTaskRef.current = task;
        const result = await task.promise;
        const extension = getExtensionFromMimeType(result.blob.type);
        zipFiles[`${safeFileStem}_${String(batchIndex + 1).padStart(3, '0')}.${extension}`] = new Uint8Array(await result.blob.arrayBuffer());
      }
      triggerBlobDownload(new Blob([zipSync(zipFiles, { level: 6 })], { type: 'application/zip' }), `${safeFileStem}.zip`);
      recordProcessedPages(totalPages);
      setStatusMessage(t('stitch.workspace.zipReady', { count: batchPlans.length }));
    } catch (error) {
      if (error instanceof Error && error.message === 'stitch.error.cancelled') return;
      setRenderError(resolveStitchError(error, 'stitch.error.generateZip'));
      setStatusMessage(resolveStitchError(error, 'stitch.error.generateZip'));
    } finally {
      exportTaskRef.current = null;
      setProcessing(false);
      setProgress(0);
    }
  }, [batchPlans, buildRenderJobForBatch, ensureVerifiedEmailOrNotify, recordProcessedPages, resolveStitchError, safeFileStem, setProcessing, setProgress, setStatusMessage, singleExportFormat, t, triggerBlobDownload]);

  const exportAllBatchesToDirectory = useCallback(async () => {
    const showDirectoryPicker = getDirectoryPicker();
    if (!showDirectoryPicker || batchPlans.length === 0) return;
    if (!ensureVerifiedEmailOrNotify()) return;
    const totalPages = batchPlans.reduce((sum, batch) => sum + batch.count, 0);
    try {
      const directory = await showDirectoryPicker({ id: 'koma-stitch-export', mode: 'readwrite' });
      setProcessing(true);
      setProgress(0);
      setStatusMessage(t('stitch.workspace.savingToFolder', { count: batchPlans.length }));
      for (let batchIndex = 0; batchIndex < batchPlans.length; batchIndex += 1) {
        const batch = batchPlans[batchIndex];
        if (!batch) continue;
        const task = runRenderJob(buildRenderJobForBatch(batch, singleExportFormat), (progress) => setProgress(((batchIndex + progress / 100) / batchPlans.length) * 100));
        exportTaskRef.current = task;
        const result = await task.promise;
        const extension = getExtensionFromMimeType(result.blob.type);
        const handle = await directory.getFileHandle(`${safeFileStem}_${String(batchIndex + 1).padStart(3, '0')}.${extension}`, { create: true });
        const writable = await handle.createWritable();
        await writable.write(result.blob);
        await writable.close();
      }
      recordProcessedPages(totalPages);
      setStatusMessage(t('stitch.workspace.folderReady'));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatusMessage(t('stitch.workspace.folderCancelled'));
        return;
      }
      if (error instanceof Error && error.message === 'stitch.error.cancelled') return;
      setRenderError(resolveStitchError(error, 'stitch.error.saveFolder'));
      setStatusMessage(resolveStitchError(error, 'stitch.error.saveFolder'));
    } finally {
      exportTaskRef.current = null;
      setProcessing(false);
      setProgress(0);
    }
  }, [batchPlans, buildRenderJobForBatch, ensureVerifiedEmailOrNotify, recordProcessedPages, resolveStitchError, safeFileStem, setProcessing, setProgress, setStatusMessage, singleExportFormat, t]);

  const selectedBatchHasPrevious = selectedBatchIndex > 0;
  const selectedBatchHasNext = selectedBatchIndex < batchPlans.length - 1;
  const selectedBatchMetrics = selectedBatch ? `${selectedBatch.outputWidth} × ${selectedBatch.outputHeight}px` : t('stitch.workspace.noBatchSelected');
  const exportDisabled = processing || !selectedBatch || selectedBatchImages.length < 1;

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

export default StitchWorkspace;
