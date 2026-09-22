import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../../../i18n';
import {
  analyzeSplitterRequest,
  applyPresetToRecipe,
  buildProcessedCanvasForImage,
  canUseDirectoryPicker,
  createDefaultSplitterRecipe,
  cropSegmentsFromCanvas,
  resolveRecipeForImage,
  removeCut,
  toggleCutLock,
  addManualCut,
  moveCut,
  mergeSegmentsAtIndex,
} from './splitterUtils';
import type {
  SplitterAnalysisResult,
  SplitterImageInput,
  SplitterImageState,
  SplitterRecipe,
  SplitterWorkspaceState,
} from './types';
import { useSplitterStore } from '../../../pages/dashboard/stores/splitter-store';
import { useStatusStore } from '../../../pages/dashboard/stores/status-store';
import { useUiShellStore } from '../../../pages/dashboard/stores/ui-shell-store';

interface SplitterControllerOptions {
  images: SplitterImageInput[];
  activeImageId: string | null;
  setActiveImageId: (value: string | null) => void;
  initialWorkspaceState?: SplitterWorkspaceState | null;
  restoreToken?: string | number | null;
  onWorkspaceStateChange?: (state: SplitterWorkspaceState) => void;
  isDesktopRuntime: boolean;
  localApiBase: string;
  registerDownloads: (items: Array<{ fileName: string; blob: Blob; sourceImageId: string }>, scope: 'split') => void;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  ensureVerifiedEmailOrNotify: () => boolean;
  recordProcessedPages: (count: number) => void;
}

const buildFormData = (blob: Blob, recipe: SplitterRecipe): FormData => {
  const formData = new FormData();
  formData.append('file', blob, 'splitter.png');
  formData.append('recipe', JSON.stringify(recipe));
  return formData;
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { detail?: string; error?: string };
    return payload.detail || payload.error || `HTTP error ${response.status}`;
  } catch {
    return `HTTP error ${response.status}`;
  }
};

const buildZipBlob = async (entries: Array<{ fileName: string; blob: Blob }>): Promise<Blob> => {
  const { zipSync } = await import('fflate');
  const files = Object.fromEntries(await Promise.all(
    entries.map(async (entry) => [entry.fileName, new Uint8Array(await entry.blob.arrayBuffer())] as const),
  ));
  const zipped = zipSync(files, { level: 6 });
  const zippedCopy = new Uint8Array(zipped.byteLength);
  zippedCopy.set(zipped);
  return new Blob([zippedCopy.buffer], { type: 'application/zip' });
};

const runWorkerAnalysis = async (
  image: SplitterImageInput,
  recipe: SplitterRecipe,
  processedBlob: Blob,
  width: number,
  height: number,
): Promise<SplitterAnalysisResult> => {
  if (typeof Worker === 'undefined') {
    const bitmap = await createImageBitmap(processedBlob);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to start the local Splitter canvas.');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, width, height);
    return analyzeSplitterRequest({
      imageId: image.id,
      file: processedBlob,
      width,
      height,
      recipe,
    }, imageData, 'worker');
  }

  const worker = new Worker(new URL('./splitterWorker.ts', import.meta.url), { type: 'module' });
  return new Promise<SplitterAnalysisResult>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<
      | { type: 'analyze:success'; imageId: string; analysis: SplitterAnalysisResult }
      | { type: 'analyze:error'; imageId: string; message: string }
    >) => {
      if (event.data.imageId !== image.id) return;
      worker.terminate();
      if (event.data.type === 'analyze:error') {
        reject(new Error(event.data.message));
        return;
      }
      resolve(event.data.analysis);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('Failed to run the Splitter worker.'));
    };
    worker.postMessage({
      type: 'analyze',
      request: {
        imageId: image.id,
        file: processedBlob,
        width,
        height,
        recipe,
      },
    });
  });
};

export const useSplitterController = ({
  images,
  activeImageId,
  setActiveImageId,
  initialWorkspaceState,
  restoreToken,
  onWorkspaceStateChange,
  isDesktopRuntime,
  localApiBase,
  registerDownloads,
  triggerBlobDownload,
  ensureVerifiedEmailOrNotify,
  recordProcessedPages,
}: SplitterControllerOptions) => {
  const { t } = useI18n();
  /* ── Splitter domain state (store) ──
     recipe/imageStates live in the Zustand store; actions are stable and read
     the latest state via get()/getState(), so callbacks never depend on them. */
  const recipe = useSplitterStore((s) => s.recipe);
  const imageStates = useSplitterStore((s) => s.imageStates);
  const setRecipe = useSplitterStore((s) => s.setRecipe);
  const setImageStates = useSplitterStore((s) => s.setImageStates);
  const updateImageState = useSplitterStore((s) => s.updateImageState);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const directorySaveSupported = useMemo(() => canUseDirectoryPicker(), []);
  const latestAnalyzeTokenRef = useRef<Record<string, number>>({});
  const analyzePromisesRef = useRef<Record<string, Promise<SplitterAnalysisResult> | undefined>>({});

  /* Latest refs for values that arrive as props (cross-domain callbacks and
     the image list, which may be recreated by the parent). Written in an
     effect — never during render — so they always hold the last committed
     value without tripping no-ref-current-in-render. */
  const imagesRef = useRef(images);
  const registerDownloadsRef = useRef(registerDownloads);
  const triggerBlobDownloadRef = useRef(triggerBlobDownload);
  const ensureVerifiedEmailOrNotifyRef = useRef(ensureVerifiedEmailOrNotify);
  const recordProcessedPagesRef = useRef(recordProcessedPages);
  useEffect(() => {
    imagesRef.current = images;
    registerDownloadsRef.current = registerDownloads;
    triggerBlobDownloadRef.current = triggerBlobDownload;
    ensureVerifiedEmailOrNotifyRef.current = ensureVerifiedEmailOrNotify;
    recordProcessedPagesRef.current = recordProcessedPages;
  });

  /* ── Restore workspace state ONLY on explicit restoreToken change ──
     Previously this depended on initialWorkspaceState which created a loop:
     state change → onWorkspaceStateChange → parent updates initialWorkspaceState →
     restore effect fires → sets state → loop. Now it only fires when restoreToken changes. */
  const lastRestoreTokenRef = useRef(restoreToken);
  useEffect(() => {
    if (!initialWorkspaceState) return;
    if (lastRestoreTokenRef.current === restoreToken) return;
    lastRestoreTokenRef.current = restoreToken;
    setRecipe(initialWorkspaceState.recipe);
    setImageStates(initialWorkspaceState.imageStates);
    if (initialWorkspaceState.activeImageId !== activeImageId) {
      setActiveImageId(initialWorkspaceState.activeImageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreToken]);

  /* Auto-select first image */
  useEffect(() => {
    if (!activeImageId && images[0]) {
      setActiveImageId(images[0].id);
    }
  }, [activeImageId, images, setActiveImageId]);

  /* Prune stale image states when images array changes */
  useEffect(() => {
    const validIds = new Set(images.map((image) => image.id));
    setImageStates((current) => {
      const next: Record<string, SplitterImageState> = {};
      let changed = false;
      Object.entries(current).forEach(([imageId, state]) => {
        if (validIds.has(imageId)) {
          next[imageId] = state;
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [images]);

  /* ── Derived state ── */
  const activeImage = useMemo(
    () => images.find((image) => image.id === activeImageId) ?? images[0] ?? null,
    [activeImageId, images],
  );

  /* Memoize activeImageState properly to avoid cascade recomputes.
     Only changes when the actual state object for this image changes. */
  const activeImageState = useMemo(() => {
    if (!activeImage) return null;
    return imageStates[activeImage.id] ?? null;
  }, [activeImage, imageStates]);

  /* Memoize activeRecipe — only recompute when recipe or override changes */
  const activeRecipe = useMemo(
    () => resolveRecipeForImage(recipe, activeImageState),
    [activeImageState, recipe],
  );

  /* ── Analyze (stable — reads current state from the store) ── */
  const analyzeImage = useCallback(async (image: SplitterImageInput, force = false): Promise<SplitterAnalysisResult> => {
    const store = useSplitterStore.getState();
    const currentState = store.imageStates[image.id] ?? null;
    const effectiveRecipe = resolveRecipeForImage(store.recipe, currentState);
    if (!force && effectiveRecipe.strategy === 'manual' && currentState?.analysis) {
      return currentState.analysis;
    }
    if (!force && currentState?.analysis) {
      return currentState.analysis;
    }
    const inFlightPromise = analyzePromisesRef.current[image.id];
    if (!force && currentState?.status === 'analyzing' && inFlightPromise) {
      return inFlightPromise;
    }

    const requestIndex = (latestAnalyzeTokenRef.current[image.id] ?? 0) + 1;
    latestAnalyzeTokenRef.current[image.id] = requestIndex;
    updateImageState(image.id, (state) => ({ ...state, status: 'analyzing', error: null }));
    const analysisPromise = (async () => {
      const processedCanvas = await buildProcessedCanvasForImage(image);
      const processedBlob = await new Promise<Blob>((resolve, reject) => {
        processedCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Failed to prepare the Splitter image.')), 'image/png');
      });

      try {
        let analysis: SplitterAnalysisResult;
        if (effectiveRecipe.strategy === 'advanced_desktop' && isDesktopRuntime) {
          const response = await fetch(`${localApiBase}/splitter/analyze`, {
            method: 'POST',
            body: buildFormData(processedBlob, effectiveRecipe),
          });
          if (!response.ok) {
            throw new Error(await parseApiError(response));
          }
          analysis = {
            ...(await response.json() as SplitterAnalysisResult),
            imageId: image.id,
          };
        } else {
          analysis = await runWorkerAnalysis(image, effectiveRecipe, processedBlob, processedCanvas.width, processedCanvas.height);
        }

        const isLatest = latestAnalyzeTokenRef.current[image.id] === requestIndex;
        if (isLatest) {
          updateImageState(image.id, (state) => ({ ...state, status: 'ready', error: null, analysis }));
        }
        return analysis;
      } catch (error) {
        const isLatest = latestAnalyzeTokenRef.current[image.id] === requestIndex;
        if (isLatest) {
          updateImageState(image.id, (state) => ({
            ...state,
            status: 'error',
            error: error instanceof Error ? error.message : 'Failed to analyze the Splitter image.',
          }));
        }
        throw error;
      } finally {
        if (latestAnalyzeTokenRef.current[image.id] === requestIndex) {
          delete analyzePromisesRef.current[image.id];
        }
      }
    })();

    analyzePromisesRef.current[image.id] = analysisPromise;
    return analysisPromise;
  }, [isDesktopRuntime, localApiBase, updateImageState]);

  const analyzeActiveImage = useCallback(async (force = true) => {
    if (!activeImage) return null;
    const analysis = await analyzeImage(activeImage, force);
    setStatusMessage(`Splitter: ${analysis.segments.length} segmento(s) sugerido(s) para ${activeImage.file.name}.`);
    return analysis;
  }, [activeImage, analyzeImage, setStatusMessage]);

  const applyRecipeToSelected = useCallback(() => {
    if (!activeImage) return;
    updateImageState(activeImage.id, (state) => ({
      ...state,
      recipeOverride: { ...useSplitterStore.getState().recipe },
    }));
    setStatusMessage(t('splitter.status.recipeApplied'));
  }, [activeImage, setStatusMessage, t, updateImageState]);

  const applyRecipeToAll = useCallback(() => {
    const currentRecipe = useSplitterStore.getState().recipe;
    setImageStates((current) => {
      const next = { ...current };
      imagesRef.current.forEach((image) => {
        next[image.id] = {
          ...(current[image.id] ?? { imageId: image.id, status: 'idle', error: null, analysis: null }),
          recipeOverride: { ...currentRecipe },
        };
      });
      return next;
    });
    setStatusMessage('Global recipe applied to every Splitter image.');
  }, [setImageStates, setStatusMessage]);

  const resetRecipe = useCallback(() => {
    setRecipe(createDefaultSplitterRecipe());
    setStatusMessage(t('splitter.status.recipeRestored'));
  }, [setRecipe, setStatusMessage, t]);

  const patchAnalysis = useCallback((imageId: string, updater: (analysis: SplitterAnalysisResult) => SplitterAnalysisResult) => {
    updateImageState(imageId, (state) => ({
      ...state,
      analysis: state.analysis ? updater(state.analysis) : state.analysis,
      status: state.analysis ? 'ready' : state.status,
      error: null,
    }));
  }, [updateImageState]);

  const addCutToActive = useCallback(async (position: number) => {
    if (!activeImage) return;
    let analysis = useSplitterStore.getState().imageStates[activeImage.id]?.analysis ?? null;
    if (!analysis) {
      analysis = await analyzeImage(activeImage, false);
    }
    updateImageState(activeImage.id, (state) => ({
      ...state,
      analysis: addManualCut(analysis!, position, useSplitterStore.getState().recipe),
      status: 'ready',
      error: null,
    }));
  }, [activeImage, analyzeImage, updateImageState]);

  const moveActiveCut = useCallback((cutId: string, position: number) => {
    if (!activeImage) return;
    const state = useSplitterStore.getState().imageStates[activeImage.id];
    if (!state?.analysis) return;
    patchAnalysis(activeImage.id, (analysis) => moveCut(analysis, cutId, position, useSplitterStore.getState().recipe));
  }, [activeImage, patchAnalysis]);

  const removeActiveCut = useCallback((cutId: string) => {
    if (!activeImage) return;
    const state = useSplitterStore.getState().imageStates[activeImage.id];
    if (!state?.analysis) return;
    patchAnalysis(activeImage.id, (analysis) => removeCut(analysis, cutId, useSplitterStore.getState().recipe));
  }, [activeImage, patchAnalysis]);

  const toggleActiveCutLock = useCallback((cutId: string) => {
    if (!activeImage) return;
    const state = useSplitterStore.getState().imageStates[activeImage.id];
    if (!state?.analysis) return;
    patchAnalysis(activeImage.id, (analysis) => toggleCutLock(analysis, cutId));
  }, [activeImage, patchAnalysis]);

  const mergeActiveSegments = useCallback((mergeIndex: number) => {
    if (!activeImage) return;
    const state = useSplitterStore.getState().imageStates[activeImage.id];
    if (!state?.analysis) return;
    patchAnalysis(activeImage.id, (analysis) => mergeSegmentsAtIndex(analysis, mergeIndex, useSplitterStore.getState().recipe));
  }, [activeImage, patchAnalysis]);

  const clearActiveAnalysis = useCallback(() => {
    if (!activeImage) return;
    updateImageState(activeImage.id, (state) => ({
      ...state,
      analysis: null,
      status: 'idle',
      error: null,
    }));
    setStatusMessage('Manual Splitter cuts removed from the active image.');
  }, [activeImage, setStatusMessage, updateImageState]);

  const exportCurrentSelection = useCallback(async () => {
    if (!activeImage) return;
    if (!ensureVerifiedEmailOrNotifyRef.current()) return;
    setProcessing(true);
    setProgress(0);
    try {
      const currentRecipe = useSplitterStore.getState().recipe;
      const effectiveRecipe = resolveRecipeForImage(currentRecipe, useSplitterStore.getState().imageStates[activeImage.id] ?? null);
      const analysis = await analyzeImage(activeImage, false);
      const canvas = await buildProcessedCanvasForImage(activeImage);
      const outputs = await cropSegmentsFromCanvas(canvas, activeImage, effectiveRecipe, analysis);
      if (outputs.length === 0) {
        throw new Error(t('splitter.error.noSegmentsActive'));
      }
      registerDownloadsRef.current(outputs, 'split');
      if (outputs.length === 1) {
        const onlyOutput = outputs[0];
        if (!onlyOutput) throw new Error(t('splitter.error.noSegmentsActive'));
        triggerBlobDownloadRef.current(onlyOutput.blob, onlyOutput.fileName);
      } else {
        const zipBlob = await buildZipBlob(outputs);
        triggerBlobDownloadRef.current(zipBlob, `${effectiveRecipe.baseName}-active.zip`);
      }
      recordProcessedPagesRef.current(1);
      setStatusMessage(`Splitter: ${outputs.length} segment(s) generated for the active image.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to export the active Splitter image.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [activeImage, analyzeImage, setProcessing, setProgress, setStatusMessage, t]);

  const exportBatch = useCallback(async () => {
    const currentImages = imagesRef.current;
    if (currentImages.length === 0) return;
    if (!ensureVerifiedEmailOrNotifyRef.current()) return;
    setProcessing(true);
    setProgress(0);
    try {
      const outputs: Array<{ fileName: string; blob: Blob; sourceImageId: string }> = [];
      // ponytail: sequential by design — per-image canvas analysis/processing is memory-heavy and progress is per-image
      for (let index = 0; index < currentImages.length; index += 1) {
        const image = currentImages[index];
        if (!image) continue;
        const state = useSplitterStore.getState().imageStates[image.id] ?? null;
        const recipeForImage = resolveRecipeForImage(useSplitterStore.getState().recipe, state);
        const analysis = await analyzeImage(image, false);
        const canvas = await buildProcessedCanvasForImage(image);
        const imageOutputs = await cropSegmentsFromCanvas(canvas, image, recipeForImage, analysis);
        outputs.push(...imageOutputs);
        setProgress(((index + 1) / currentImages.length) * 100);
      }
      if (outputs.length === 0) {
        throw new Error(t('splitter.error.noSegmentsBatch'));
      }
      registerDownloadsRef.current(outputs, 'split');
      const zipBlob = await buildZipBlob(outputs);
      triggerBlobDownloadRef.current(zipBlob, `${useSplitterStore.getState().recipe.baseName}-batch.zip`);
      recordProcessedPagesRef.current(currentImages.length);
      setStatusMessage(`Splitter: ${outputs.length} segmento(s) gerado(s) em lote.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to export the Splitter batch.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [analyzeImage, setProcessing, setProgress, setStatusMessage, t]);

  const exportBatchToDirectory = useCallback(async () => {
    const currentImages = imagesRef.current;
    if (!directorySaveSupported || currentImages.length === 0) return;
    if (!ensureVerifiedEmailOrNotifyRef.current()) return;
    const showDirectoryPicker = (window as unknown as {
      showDirectoryPicker: (options: { id: string; mode: string }) => Promise<any>;
    }).showDirectoryPicker;
    let directory: any;
    try {
      directory = await showDirectoryPicker({ id: 'koma-splitter-export', mode: 'readwrite' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatusMessage(t('splitter.status.exportCancelled'));
        return;
      }
      throw error;
    }
    setProcessing(true);
    setProgress(0);
    try {
      // ponytail: sequential by design — per-image canvas pipeline is memory-heavy and progress is per-image
      for (let index = 0; index < currentImages.length; index += 1) {
        const image = currentImages[index];
        if (!image) continue;
        const state = useSplitterStore.getState().imageStates[image.id] ?? null;
        const recipeForImage = resolveRecipeForImage(useSplitterStore.getState().recipe, state);
        const analysis = await analyzeImage(image, false);
        const canvas = await buildProcessedCanvasForImage(image);
        const imageOutputs = await cropSegmentsFromCanvas(canvas, image, recipeForImage, analysis);
        // ponytail: sequential by design — the first failed write stops the batch (preserved error semantics)
        for (const output of imageOutputs) {
          const handle = await directory.getFileHandle(output.fileName, { create: true });
          const writable = await handle.createWritable();
          await writable.write(output.blob);
          await writable.close();
        }
        setProgress(((index + 1) / currentImages.length) * 100);
      }
      recordProcessedPagesRef.current(currentImages.length);
      setStatusMessage('Splitter: segments exported to the selected folder.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to export the Splitter output to the folder.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [analyzeImage, directorySaveSupported, setProcessing, setProgress, setStatusMessage, t]);

  const setPreset = useCallback((presetKey: SplitterRecipe['preset']) => {
    setRecipe((current) => applyPresetToRecipe(current, presetKey));
  }, []);

  /* ── Sync workspace state to parent (debounced to avoid tight loops) ── */
  const wsChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onWorkspaceStateChangeRef = useRef(onWorkspaceStateChange);
  useEffect(() => {
    onWorkspaceStateChangeRef.current = onWorkspaceStateChange;
  });

  useEffect(() => {
    if (!onWorkspaceStateChangeRef.current) return;
    if (wsChangeTimerRef.current) clearTimeout(wsChangeTimerRef.current);
    wsChangeTimerRef.current = setTimeout(() => {
      onWorkspaceStateChangeRef.current?.({
        recipe,
        imageStates,
        activeImageId,
      });
    }, 300);
    return () => {
      if (wsChangeTimerRef.current) clearTimeout(wsChangeTimerRef.current);
    };
  }, [activeImageId, imageStates, recipe]);

  return useMemo(
    () => ({
      recipe,
      setRecipe,
      setPreset,
      resetRecipe,
      imageStates,
      setImageStates,
      activeImage,
      activeImageState,
      activeRecipe,
      directorySaveSupported,
      analyzeActiveImage,
      applyRecipeToSelected,
      applyRecipeToAll,
      addCutToActive,
      moveActiveCut,
      removeActiveCut,
      toggleActiveCutLock,
      mergeActiveSegments,
      clearActiveAnalysis,
      exportCurrentSelection,
      exportBatch,
      exportBatchToDirectory,
    }),
    [
      recipe,
      setRecipe,
      setPreset,
      resetRecipe,
      imageStates,
      setImageStates,
      activeImage,
      activeImageState,
      activeRecipe,
      directorySaveSupported,
      analyzeActiveImage,
      applyRecipeToSelected,
      applyRecipeToAll,
      addCutToActive,
      moveActiveCut,
      removeActiveCut,
      toggleActiveCutLock,
      mergeActiveSegments,
      clearActiveAnalysis,
      exportCurrentSelection,
      exportBatch,
      exportBatchToDirectory,
    ],
  );
};

export type SplitterController = ReturnType<typeof useSplitterController>;
