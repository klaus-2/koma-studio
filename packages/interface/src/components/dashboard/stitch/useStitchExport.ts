import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';

import { useI18n } from '../../../i18n';
import { getExtensionFromMimeType, getMimeTypeFromExportFormat } from './stitchUtils';
import { buildRequestId, canUseDirectoryPicker, runRenderJob, type ActiveTask } from './stitchRender';
import type {
  StitchAlignMode,
  StitchBatchPlan,
  StitchExportFormat,
  StitchImageInput,
  StitchLayoutMode,
  StitchRenderJob,
} from './types';


export interface UseStitchExportArgs {
  images: StitchImageInput[];
  batchPlans: StitchBatchPlan[];
  selectedBatchIndex: number;
  layoutMode: StitchLayoutMode;
  gap: number;
  alignMode: StitchAlignMode;
  background: string;
  singleExportFormat: Exclude<StitchExportFormat, 'zip'>;
  outQuality: number;
  safeFileStem: string;
  processing: boolean;
  setProcessing: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (message: string) => void;
  registerDownloads: (items: Array<{ fileName: string; blob: Blob; sourceImageId: string }>, scope: 'stitch') => void;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  recordProcessedPages: (pages: number) => void;
  ensureVerifiedEmailOrNotify: () => boolean;
  hasQuotaForCurrentBatch?: boolean;
  ensureQuotaBeforeProcessing?: (pages: number, processMode?: string) => boolean;
  quotaLimitButtonTitle?: string;
}

export function useStitchExport(args: UseStitchExportArgs) {
  const {
    images, batchPlans, selectedBatchIndex, layoutMode, gap, alignMode, background,
    singleExportFormat, outQuality, safeFileStem, processing,
    setProcessing, setProgress, setStatusMessage, registerDownloads, triggerBlobDownload,
    recordProcessedPages, ensureVerifiedEmailOrNotify,
    hasQuotaForCurrentBatch = true, ensureQuotaBeforeProcessing = () => true, quotaLimitButtonTitle = '',
  } = args;

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
  const previewUrlCleanupRef = useRef<string | null>(null);

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

  const [prevSelectedBatchIndex, setPrevSelectedBatchIndex] = useState(selectedBatchIndex);
  if (prevSelectedBatchIndex !== selectedBatchIndex) {
    setPrevSelectedBatchIndex(selectedBatchIndex);
    setPreviewZoom(1);
  }

  useEffect(() => {
    previewUrlCleanupRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    if (selectedBatchImages.length === 0) {
      cancelPreviewTask();
      setPreviewBusy(false);
      setPreviewProgress(0);
      setPreviewDimensions(null);
      setRenderError(null);
      const prevUrl = previewUrlCleanupRef.current;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      setPreviewUrl(null);
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
      const prevUrl = previewUrlCleanupRef.current;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      setPreviewUrl(objectUrl);
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
    if (previewUrlCleanupRef.current) URL.revokeObjectURL(previewUrlCleanupRef.current);
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
    if (!ensureQuotaBeforeProcessing(selectedBatchImages.length, tRef.current('stitch.workspace.processMode'))) return;
    setProcessing(true);
    setProgress(0);
    setStatusMessage(tRef.current('stitch.workspace.renderingBatch', { current: selectedBatchIndex + 1, total: batchPlans.length }));
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
      setStatusMessage(tRef.current('stitch.workspace.batchReady', { current: selectedBatchIndex + 1 }));
    } catch (error) {
      if (error instanceof Error && error.message === 'stitch.error.cancelled') return;
      setRenderError(resolveStitchError(error, 'stitch.error.exportBatch'));
      setStatusMessage(resolveStitchError(error, 'stitch.error.exportBatch'));
    } finally {
      if (exportTaskRef.current === task) exportTaskRef.current = null;
      setProcessing(false);
      setProgress(0);
    }
  }, [batchPlans.length, buildRenderJobForBatch, ensureQuotaBeforeProcessing, ensureVerifiedEmailOrNotify, recordProcessedPages, registerDownloads, resolveStitchError, safeFileStem, selectedBatch, selectedBatchImages, selectedBatchIndex, setProcessing, setProgress, setStatusMessage, singleExportFormat]);

  const exportAllBatchesAsZip = useCallback(async () => {
    if (batchPlans.length === 0) return;
    if (!ensureVerifiedEmailOrNotify()) return;
    const totalPages = batchPlans.reduce((sum, batch) => sum + batch.count, 0);
    setProcessing(true);
    setProgress(0);
    setStatusMessage(tRef.current('stitch.workspace.generatingZip', { count: batchPlans.length }));
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
      setStatusMessage(tRef.current('stitch.workspace.zipReady', { count: batchPlans.length }));
    } catch (error) {
      if (error instanceof Error && error.message === 'stitch.error.cancelled') return;
      setRenderError(resolveStitchError(error, 'stitch.error.generateZip'));
      setStatusMessage(resolveStitchError(error, 'stitch.error.generateZip'));
    } finally {
      exportTaskRef.current = null;
      setProcessing(false);
      setProgress(0);
    }
  }, [batchPlans, buildRenderJobForBatch, ensureVerifiedEmailOrNotify, recordProcessedPages, resolveStitchError, safeFileStem, setProcessing, setProgress, setStatusMessage, singleExportFormat, triggerBlobDownload]);

  const exportAllBatchesToDirectory = useCallback(async () => {
    if (!canUseDirectoryPicker() || batchPlans.length === 0) return;
    if (!ensureVerifiedEmailOrNotify()) return;
    const totalPages = batchPlans.reduce((sum, batch) => sum + batch.count, 0);
    if (!ensureQuotaBeforeProcessing(totalPages, tRef.current('stitch.workspace.processMode'))) return;
    setProcessing(true);
    setStatusMessage(tRef.current('stitch.workspace.savingFolder', { count: batchPlans.length }));
    setRenderError(null);

    try {
      const picker = (window as unknown as { showDirectoryPicker: (opts?: { id?: string; mode?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
      const directory = await picker({ id: 'koma-stitch-export', mode: 'readwrite' });

      for (let batchIndex = 0; batchIndex < batchPlans.length; batchIndex += 1) {
        const batch = batchPlans[batchIndex];
        if (!batch) continue;
        const task = runRenderJob(buildRenderJobForBatch(batch, singleExportFormat), (progress) => setProgress(((batchIndex + progress / 100) / batchPlans.length) * 100));
        exportTaskRef.current = task;
        const result = await task.promise;
        const extension = getExtensionFromMimeType(result.blob.type);
        const fileName = `${safeFileStem}_${String(batchIndex + 1).padStart(3, '0')}.${extension}`;
        const fileHandle = await directory.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(result.blob);
        await writable.close();
        recordProcessedPages(batch.count);
        setProgress(((batchIndex + 1) / batchPlans.length) * 100);
      }

      setStatusMessage(tRef.current('stitch.workspace.folderReady', { count: batchPlans.length }));
    } catch (error) {
      if (error instanceof Error && error.message === 'stitch.error.cancelled') return;
      setRenderError(resolveStitchError(error, 'stitch.error.saveFolder'));
      setStatusMessage(resolveStitchError(error, 'stitch.error.saveFolder'));
    } finally {
      exportTaskRef.current = null;
      setProcessing(false);
      setProgress(0);
    }
  }, [batchPlans, buildRenderJobForBatch, ensureQuotaBeforeProcessing, ensureVerifiedEmailOrNotify, recordProcessedPages, resolveStitchError, safeFileStem, setProcessing, setProgress, setStatusMessage, singleExportFormat]);

  const selectedBatchHasPrevious = selectedBatchIndex > 0;
  const selectedBatchHasNext = selectedBatchIndex < batchPlans.length - 1;
  const exportDisabled = processing || !selectedBatch || selectedBatchImages.length < 1;

  return {
    // estado de preview
    previewUrl,
    previewDimensions,
    previewZoom,
    setPreviewZoom,
    previewBusy,
    previewProgress,
    renderError,
    setRenderError,
    stageRef,
    handleStageWheel,
    // derivados de lote
    selectedBatch,
    selectedBatchImages,
    selectedBatchHasPrevious,
    selectedBatchHasNext,
    exportDisabled,
    // handlers
    cancelExportTask,
    exportCurrentBatch,
    exportAllBatchesAsZip,
    exportAllBatchesToDirectory,
    // quota (injetada; koma default pass-through)
    hasQuotaForCurrentBatch,
    quotaLimitButtonTitle,
  };
}
