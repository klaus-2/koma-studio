import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { zipSync, strToU8 } from 'fflate';

import './WatermarkWorkspace.css';
import '../../../pages/WatermarkToolbox.css';
import {
  buildBuiltinPresets,
  duplicatePreset,
  sanitizePresetName,
  serializeWatermarkPresets,
  suggestSmartPlacement,
} from './watermark-core.js';
import { renderWatermarkAsset } from './watermarkRenderer';
import { getApiConfig } from '../../../config/api';
import { loadImageFromSource } from '../../../utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  USER_PRESETS_STORAGE_KEY,
  useWatermarkStore,
} from '../../../pages/dashboard/stores/watermark-store';
import { useStatusStore } from '../../../pages/dashboard/stores/status-store';
import { useUiShellStore } from '../../../pages/dashboard/stores/ui-shell-store';

import type {
  WatermarkAnchor,
  WatermarkDraft,
  WatermarkLoadedImage,
  WatermarkPresetV1,
  WatermarkRenderAsset,
  WatermarkResultEntry,
  WatermarkTextAvoidanceZone,
  WatermarkWorkspaceState,
} from './watermarkTypes';
import type { DetectApiResponse } from '../../../types/dashboard.types';
import { useI18n } from '../../../i18n';
import { useHorizontalDragScroll } from '../../../hooks/useHorizontalDragScroll';
import WatermarkOutputPanel from './WatermarkOutputPanel';
import WatermarkPreviewPanel from './WatermarkPreviewPanel';
import WatermarkToolbox from './WatermarkToolbox';
import {
  ZOOM_DEFAULT,
  ZOOM_STEPS,
} from './watermark-ui-constants';

const sanitizeFileStem = (value: string): string =>
  value
    .replace(/\.[^.]+$/u, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'watermark';

const getOutputExtension = (outputType: string): string => {
  if (outputType === 'image/jpeg' || outputType === 'jpeg') return 'jpg';
  if (outputType === 'image/png' || outputType === 'png') return 'png';
  if (outputType === 'image/webp' || outputType === 'webp') return 'webp';
  return 'png';
};

const defaultBuildOutputName = (
  originalName: string,
  draft: WatermarkDraft,
  outputType: string,
): string =>
  `${sanitizeFileStem(originalName)}-${sanitizeFileStem(draft.baseName || 'watermark')}.${getOutputExtension(outputType)}`;

const defaultSupportsDirectorySave = (): boolean =>
  typeof window !== 'undefined' &&
  typeof (
    window as Window & {
      showDirectoryPicker?: unknown;
    }
  ).showDirectoryPicker === 'function';

const defaultCreateWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./watermarkWorker.ts', import.meta.url), {
      type: 'module',
    });
  } catch {
    return null;
  }
};

const defaultRevokeEntries = (entries: WatermarkResultEntry[]): void => {
  entries.forEach((entry) => {
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  });
};

const loadImageBitmapSource = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await loadImageFromSource(objectUrl);
  } catch {
    throw new Error('Failed to load the image for the smart suggestion.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const defaultAnalyzeSmartSuggestion = async (
  image: WatermarkLoadedImage,
): Promise<{
  anchor: WatermarkAnchor;
  textColor: string;
  reason: string;
}> => {
  const source = await loadImageBitmapSource(image.file);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, image.width);
  canvas.height = Math.max(1, image.height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to prepare the smart watermark analysis.');
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const suggestion = suggestSmartPlacement({
    width: canvas.width,
    height: canvas.height,
    pixels: data,
  });
  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }
  return {
    anchor: suggestion.position as WatermarkAnchor,
    textColor: suggestion.textColor,
    reason: suggestion.reason,
  };
};

const WatermarkWorkspace = ({
  images,
  outputType,
  outputQuality,
  workspaceState,
  restoreToken,
  toolboxHostId,
  processing,
  progress: _progress,
  ensureVerifiedEmailOrNotify,
  registerDownloads,
  recordProcessedPages,
  buildOutputName = defaultBuildOutputName,
  triggerBlobDownload,
  supportsDirectorySave = defaultSupportsDirectorySave,
  analyzeSmartSuggestion = defaultAnalyzeSmartSuggestion,
  createWorker = defaultCreateWorker,
  revokeEntries = defaultRevokeEntries,
  onWorkspaceStateChange,
}: {
  images: WatermarkLoadedImage[];
  outputType: string;
  outputQuality: number;
  workspaceState?: WatermarkWorkspaceState;
  restoreToken?: string;
  toolboxHostId?: string;
  processing: boolean;
  setProcessing: (processing: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  setStatusMessage: (message: string) => void;
  ensureVerifiedEmailOrNotify: () => boolean;
  registerDownloads: (downloads: { fileName: string; blob: Blob; sourceImageId: string }[], tool: string) => void;
  recordProcessedPages: (count: number) => void;
  buildOutputName?: (originalName: string, draft: WatermarkDraft, outputType: string) => string;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  supportsDirectorySave?: () => boolean;
  analyzeSmartSuggestion?: (image: WatermarkLoadedImage) => Promise<{ anchor: WatermarkAnchor; textColor: string; reason: string }>;
  createWorker?: () => Worker | null;
  revokeEntries?: (entries: WatermarkResultEntry[]) => void;
  onWorkspaceStateChange?: (state: WatermarkWorkspaceState) => void;
}) => {
  const { t } = useI18n();

  const PLACEMENT_LABELS: Record<WatermarkDraft['placementMode'], string> = {
    single: t('common.single'),
    tile: t('common.tile'),
    grid: t('common.grid'),
    smart: t('common.smart'),
    multi: 'Multi',
  };

  const builtins = useMemo(
    () => buildBuiltinPresets() as WatermarkPresetV1[],
    [],
  );
  /* ── Watermark domain state (store) ──
     The draft, presets, logo file, results and zone cache live in the Zustand
     store; actions are stable and callbacks read the latest values via
     getState(), which replaced the render-time ref mirroring
     (React Doctor no-ref-current-in-render). */
  const draft = useWatermarkStore((s) => s.draft);
  const activeImageId = useWatermarkStore((s) => s.activeImageId);
  const watermarkImageFile = useWatermarkStore((s) => s.watermarkImageFile);
  const userPresets = useWatermarkStore((s) => s.userPresets);
  const selectedPresetId = useWatermarkStore((s) => s.selectedPresetId);
  const results = useWatermarkStore((s) => s.results);
  const autoSuggestion = useWatermarkStore((s) => s.autoSuggestion);
  const compareMode = useWatermarkStore((s) => s.compareMode);
  const compareValue = useWatermarkStore((s) => s.compareValue);
  const textZoneCache = useWatermarkStore((s) => s.textZoneCache);
  const setDraft = useWatermarkStore((s) => s.setDraft);
  const setActiveImageId = useWatermarkStore((s) => s.setActiveImageId);
  const setWatermarkImageFile = useWatermarkStore(
    (s) => s.setWatermarkImageFile,
  );
  const setUserPresets = useWatermarkStore((s) => s.setUserPresets);
  const setSelectedPresetId = useWatermarkStore((s) => s.setSelectedPresetId);
  const setResults = useWatermarkStore((s) => s.setResults);
  const setAutoSuggestion = useWatermarkStore((s) => s.setAutoSuggestion);
  const setCompareMode = useWatermarkStore((s) => s.setCompareMode);
  const setCompareValue = useWatermarkStore((s) => s.setCompareValue);
  const setTextZoneCache = useWatermarkStore((s) => s.setTextZoneCache);
  // Shell/status actions come from their stores (the parent still passes the
  // props, but the component no longer needs them).
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  /* ── Transient preview/UI state (not part of the workspace snapshot) ── */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] =
    useState<WatermarkAnchor>('bottom-right');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [watermarkImagePreview, setWatermarkImagePreview] = useState<
    string | null
  >(null);
  const [toolboxHost, setToolboxHost] = useState<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [detectingTextZones, setDetectingTextZones] = useState(false);
  const [showTextZoneOverlay, setShowTextZoneOverlay] = useState(false);

  const previewTimeoutRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestCounterRef = useRef(0);
  const cancelBatchRef = useRef(false);
  const previewRequestRef = useRef(0);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const thumbsStripRef = useHorizontalDragScroll<HTMLDivElement>();

  /* Latest refs for values that arrive as props (cross-domain callbacks and
     the output format). Written in an effect — never during render — so they
     always hold the last committed value without tripping
     no-ref-current-in-render. */
  const onWorkspaceStateChangeRef = useRef(onWorkspaceStateChange);
  const registerDownloadsRef = useRef(registerDownloads);
  const outputTypeRef = useRef(outputType);
  const outputQualityRef = useRef(outputQuality);
  const wsChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    onWorkspaceStateChangeRef.current = onWorkspaceStateChange;
    registerDownloadsRef.current = registerDownloads;
    outputTypeRef.current = outputType;
    outputQualityRef.current = outputQuality;
  });
  const lastRestoreTokenRef = useRef(restoreToken);

  const allPresets = useMemo(
    () => [...builtins, ...userPresets],
    [builtins, userPresets],
  );
  const activeImage = useMemo(
    () => images.find((i) => i.id === activeImageId) ?? images[0] ?? null,
    [activeImageId, images],
  );
  const resultsById = useMemo(
    () => new Map(results.map((e) => [e.sourceImageId, e])),
    [results],
  );
  const hasRenderableLayer = Boolean(
    (draft.textLayer.enabled && draft.textLayer.text.trim().length > 0) ||
    (draft.imageLayer.enabled && watermarkImageFile),
  );

  const activeTextZones = useMemo(
    () => (activeImage ? textZoneCache[activeImage.id] ?? [] : []),
    [activeImage, textZoneCache],
  );

  // ── Effects ──
  useEffect(() => {
    if (!activeImageId && images[0]) {
      setActiveImageId(images[0].id);
    } else if (activeImageId && !images.some((i) => i.id === activeImageId)) {
      setActiveImageId(images[0]?.id ?? null);
    }
  }, [activeImageId, images]);

  useEffect(() => {
    if (typeof window !== 'undefined')
      window.localStorage.setItem(
        USER_PRESETS_STORAGE_KEY,
        serializeWatermarkPresets(userPresets),
      );
  }, [userPresets]);

  // Seed the store once at mount from the synced workspace snapshot — the same
  // values the useState initializers consumed before the store migration.
  // Runs once per mount, so it cannot loop with the debounced
  // onWorkspaceStateChange sync below. useLayoutEffect so the first paint
  // already shows the restored values instead of store defaults.
  useLayoutEffect(() => {
    if (!workspaceState) return;
    setDraft(workspaceState.draft);
    setActiveImageId(workspaceState.activeImageId);
    setWatermarkImageFile(workspaceState.watermarkImageFile);
    setUserPresets(workspaceState.userPresets);
    setSelectedPresetId(workspaceState.selectedPresetId);
    setResults(workspaceState.results);
    setAutoSuggestion(workspaceState.autoSuggestion);
    setCompareMode(workspaceState.compareMode);
    setCompareValue(workspaceState.compareValue);
    setTextZoneCache(workspaceState.textZoneCache ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore from workspace state only on explicit restoreToken change
  useEffect(() => {
    if (!workspaceState) return;
    if (lastRestoreTokenRef.current === restoreToken) return;
    lastRestoreTokenRef.current = restoreToken;
    revokeEntries(useWatermarkStore.getState().results);
    setDraft(workspaceState.draft);
    setActiveImageId(workspaceState.activeImageId);
    setWatermarkImageFile(workspaceState.watermarkImageFile);
    setUserPresets(workspaceState.userPresets);
    setSelectedPresetId(workspaceState.selectedPresetId);
    setResults(workspaceState.results);
    setAutoSuggestion(workspaceState.autoSuggestion);
    setCompareMode(workspaceState.compareMode);
    setCompareValue(workspaceState.compareValue);
    setTextZoneCache(workspaceState.textZoneCache ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreToken]);

  useEffect(() => {
    workerRef.current = createWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      if (previewTimeoutRef.current !== null)
        window.clearTimeout(previewTimeoutRef.current);
      revokeEntries(useWatermarkStore.getState().results);
    };
  }, []);

  // The host id is a static constant and the host element (InfoModesToolsPanel)
  // is committed before this lazy workspace mounts, so a mount-once lookup is
  // behavior-identical to re-querying on prop change.
  // ponytail: if toolboxHostId ever becomes dynamic, re-key this lookup on it.
  useEffect(() => {
    if (!toolboxHostId || typeof document === 'undefined') return;
    setToolboxHost(document.getElementById(toolboxHostId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The watermark logo preview URL is owned by this effect: created per
  // watermarkImageFile change, revoked in the cleanup (replace + unmount).
  useEffect(() => {
    const nextUrl = watermarkImageFile
      ? URL.createObjectURL(watermarkImageFile)
      : null;
    setWatermarkImagePreview(nextUrl);
    return () => {
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [watermarkImageFile]);

  // Latest committed preview URL; swapped-out URLs are revoked at swap time
  // (see the preview effect) and the last one on unmount.
  const previewUrlCleanupRef = useRef<string | null>(null);
  useEffect(() => {
    previewUrlCleanupRef.current = previewUrl;
  });
  useEffect(() => {
    return () => {
      if (previewUrlCleanupRef.current) URL.revokeObjectURL(previewUrlCleanupRef.current);
    };
  }, []);

  // Debounced workspace state sync to parent
  useEffect(() => {
    if (!onWorkspaceStateChangeRef.current) return;
    if (wsChangeTimerRef.current) clearTimeout(wsChangeTimerRef.current);
    wsChangeTimerRef.current = setTimeout(() => {
      onWorkspaceStateChangeRef.current?.({
        draft,
        activeImageId,
        compareMode,
        compareValue,
        selectedPresetId,
        autoSuggestion,
        userPresets,
        watermarkImageFile,
        results,
        textZoneCache,
      });
    }, 300);
    return () => {
      if (wsChangeTimerRef.current) clearTimeout(wsChangeTimerRef.current);
    };
  }, [
    activeImageId,
    autoSuggestion,
    compareMode,
    compareValue,
    draft,
    results,
    selectedPresetId,
    userPresets,
    watermarkImageFile,
    textZoneCache,
  ]);

  // ── Zoom (Ctrl+Wheel) ──
  useEffect(() => {
    const el = previewStageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((prev) => {
        const idx = ZOOM_STEPS.findIndex((z) => z >= prev);
        const next = e.deltaY < 0
          ? ZOOM_STEPS[Math.min((idx === -1 ? ZOOM_STEPS.length - 1 : idx) + 1, ZOOM_STEPS.length - 1)]
          : ZOOM_STEPS[Math.max((idx === -1 ? 0 : idx) - 1, 0)];
        return next ?? prev;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!thumbsStripRef.current || !activeImageId) return;
    const activeThumb = thumbsStripRef.current.querySelector(`[data-thumb-id="${activeImageId}"]`);
    if (activeThumb instanceof HTMLElement) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeImageId, thumbsStripRef]);

  // ── Render helpers ──
  const runRender = useCallback(async (asset: WatermarkRenderAsset) => {
    const worker = workerRef.current;
    if (!worker) return renderWatermarkAsset(asset);
    const rid = `wm-${requestCounterRef.current++}`;
    return new Promise<Awaited<ReturnType<typeof renderWatermarkAsset>>>(
      (resolve, reject) => {
        const h = (
          ev: MessageEvent<{
            id: string;
            ok: boolean;
            blob?: Blob;
            width?: number;
            height?: number;
            resolvedAnchor?: string;
            error?: string;
          }>,
        ) => {
          if (ev.data.id !== rid) return;
          worker.removeEventListener('message', h);
          if (
            !ev.data.ok ||
            !ev.data.blob ||
            !ev.data.width ||
            !ev.data.height ||
            !ev.data.resolvedAnchor
          ) {
            reject(new Error(ev.data.error || 'Worker failed'));
            return;
          }
          resolve({
            blob: ev.data.blob,
            width: ev.data.width,
            height: ev.data.height,
            resolvedAnchor: ev.data.resolvedAnchor as WatermarkAnchor,
          });
        };
        worker.addEventListener('message', h);
        worker.postMessage({ id: rid, asset });
      },
    );
  }, []);

  // Reads the watermark store via getState() so it stays stable across draft
  // changes; output format/quality arrive as props and use the effect-written
  // mirrors above.
  const buildAsset = useCallback(
    (img: WatermarkLoadedImage): WatermarkRenderAsset => {
      const { draft, textZoneCache, watermarkImageFile } =
        useWatermarkStore.getState();
      return {
        sourceFile: img.file,
        watermarkFile: watermarkImageFile,
        image: {
          id: img.id,
          width: img.width,
          height: img.height,
          rotation: img.rotation,
          filters: img.filters,
        },
        outputType: outputTypeRef.current,
        outputQuality: outputQualityRef.current,
        settings: draft,
        textAvoidanceZones: draft.avoidTextRegions
          ? (textZoneCache[img.id] ?? [])
          : undefined,
      };
    },
    [],
  );

  // ── Text zone detection ──
  const detectTextZones = useCallback(async (img: WatermarkLoadedImage) => {
    const apiConfig = getApiConfig();
    const formData = new FormData();
    formData.append('file', img.file);
    try {
      setDetectingTextZones(true);
      const response = await fetchWithTimeoutAndRetry(
        `${apiConfig.localUrl}/detect`,
        { method: 'POST', body: formData },
        { timeoutMs: 30_000, retryCount: 1 },
      );
      if (!response.ok) {
        throw new Error(`Detection failed: ${response.status}`);
      }
      const payload = (await response.json()) as DetectApiResponse;
      const zones: WatermarkTextAvoidanceZone[] = payload.detections.map((d) => ({
        id: d.id,
        bbox: d.bbox,
        score: d.score,
        label: d.label,
      }));
      setTextZoneCache((prev) => ({ ...prev, [img.id]: zones }));
      setStatusMessage(
        t('watermark.textAvoidance.detected', { count: zones.length }),
      );
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : t('watermark.textAvoidance.failed'),
      );
    } finally {
      setDetectingTextZones(false);
    }
  }, [setTextZoneCache, setStatusMessage, t]);

  const detectAllTextZones = useCallback(async () => {
    setDetectingTextZones(true);
    const apiConfig = getApiConfig();
    let total = 0;
    try {
      const pendingImages = images.filter(
        (img) => !useWatermarkStore.getState().textZoneCache[img.id],
      );
      // ponytail: bounded concurrency (4) — independent /detect calls, but don't fire every upload at the local API at once
      for (let chunkStart = 0; chunkStart < pendingImages.length; chunkStart += 4) {
        const chunk = pendingImages.slice(chunkStart, chunkStart + 4);
        await Promise.all(chunk.map(async (img) => {
          const formData = new FormData();
          formData.append('file', img.file);
          const response = await fetchWithTimeoutAndRetry(
            `${apiConfig.localUrl}/detect`,
            { method: 'POST', body: formData },
            { timeoutMs: 30_000, retryCount: 1 },
          );
          if (!response.ok) return null;
          const payload = (await response.json()) as DetectApiResponse;
          const zones = payload.detections.map((d) => ({
            id: d.id,
            bbox: d.bbox,
            score: d.score,
            label: d.label,
          }));
          // Cache per item inside the callback so successes survive a
          // mid-chunk failure (the original sequential loop did the same).
          setTextZoneCache((prev) => ({ ...prev, [img.id]: zones }));
          total += zones.length;
          return zones;
        }));
      }
      setStatusMessage(
        t('watermark.textAvoidance.detectedAll', { count: total }),
      );
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : t('watermark.textAvoidance.failed'),
      );
    } finally {
      setDetectingTextZones(false);
    }
  }, [images, setTextZoneCache, setStatusMessage, t]);

  // Lightweight trigger key — changes whenever the preview should re-render
  const previewTrigger = useMemo(
    () => JSON.stringify([draft, outputType, outputQuality, watermarkImageFile?.name ?? null, textZoneCache]),
    [draft, outputType, outputQuality, watermarkImageFile, textZoneCache],
  );

  // ── Preview effect ──
  useEffect(() => {
    if (previewTimeoutRef.current !== null)
      window.clearTimeout(previewTimeoutRef.current);
    if (!activeImage || !hasRenderableLayer) {
      const prevUrl = previewUrlCleanupRef.current;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      setPreviewUrl(null);
      return;
    }
    previewTimeoutRef.current = window.setTimeout(() => {
      const rid = ++previewRequestRef.current;
      setPreviewBusy(true);
      void runRender(buildAsset(activeImage))
        .then((r) => {
          if (previewRequestRef.current !== rid) return;
          setPreviewAnchor(r.resolvedAnchor);
          const nextUrl = URL.createObjectURL(r.blob);
          const prevUrl = previewUrlCleanupRef.current;
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          setPreviewUrl(nextUrl);
        })
        .catch((e) => {
          if (previewRequestRef.current === rid)
            setStatusMessage(
              e instanceof Error ? e.message : 'Preview failed.',
            );
        })
        .finally(() => {
          if (previewRequestRef.current === rid) setPreviewBusy(false);
        });
    }, 400);
    return () => {
      if (previewTimeoutRef.current !== null)
        window.clearTimeout(previewTimeoutRef.current);
    };
  }, [
    activeImage,
    hasRenderableLayer,
    previewTrigger,
    buildAsset,
    runRender,
    setStatusMessage,
  ]);

  // ── Preset handlers ──
  const applyPreset = useCallback(
    (p: WatermarkPresetV1) => {
      setSelectedPresetId(p.id);
      setDraft(p.settings);
      setStatusMessage(`${t('renderPreview.preset')}: ${p.name}`);
    },
    [setDraft, setSelectedPresetId, setStatusMessage, t],
  );
  const saveCurrentPreset = useCallback(() => {
    const { draft } = useWatermarkStore.getState();
    const n = sanitizePresetName(
      window.prompt(`${t('common.name')}:`, draft.baseName || t('watermark.presets.defaultName')) ?? '',
    );
    const np: WatermarkPresetV1 = {
      id: `preset-user-${Date.now()}`,
      kind: 'user',
      name: n,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: draft,
    };
    setUserPresets((c) => [np, ...c]);
    setSelectedPresetId(np.id);
    setStatusMessage(`${t('common.saved')}: ${n}`);
  }, [setSelectedPresetId, setUserPresets, setStatusMessage, t]);
  const duplicateSelectedPreset = useCallback(() => {
    const { userPresets, selectedPresetId } = useWatermarkStore.getState();
    const allPresets = [...builtins, ...userPresets];
    const p = allPresets.find((e) => e.id === selectedPresetId);
    if (!p) return;
    const np = duplicatePreset(
      p,
      allPresets.map((e) => e.name),
    ) as WatermarkPresetV1;
    setUserPresets((c) => [np, ...c]);
    setSelectedPresetId(np.id);
    setStatusMessage(`${t('common.duplicated')}: ${np.name}`);
  }, [builtins, setSelectedPresetId, setUserPresets, setStatusMessage, t]);
  const renameSelectedPreset = useCallback(() => {
    const { userPresets, selectedPresetId, draft } =
      useWatermarkStore.getState();
    const p = userPresets.find((e) => e.id === selectedPresetId);
    if (!p) return;
    const nn = sanitizePresetName(
      window.prompt(`${t('common.newName')}:`, p.name) ?? p.name,
    );
    setUserPresets((c) =>
      c.map((e) =>
        e.id === p.id
          ? {
              ...e,
              name: nn,
              updatedAt: new Date().toISOString(),
              settings: draft,
            }
          : e,
      ),
    );
    setStatusMessage(`${t('common.renamed')}: ${nn}`);
  }, [setUserPresets, setStatusMessage, t]);
  const deleteSelectedPreset = useCallback(() => {
    const { userPresets, selectedPresetId } = useWatermarkStore.getState();
    const p = userPresets.find((e) => e.id === selectedPresetId);
    if (!p) return;
    setUserPresets((c) => c.filter((e) => e.id !== p.id));
    setSelectedPresetId(builtins[0]?.id ?? '');
    setStatusMessage(`${t('common.removed')}: ${p.name}`);
  }, [builtins, setSelectedPresetId, setUserPresets, setStatusMessage, t]);

  const handleWatermarkImageChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      const f = ev.target.files?.[0] ?? null;
      setWatermarkImageFile(f);
      setDraft((c) => ({
        ...c,
        imageLayer: {
          ...c.imageLayer,
          enabled: Boolean(f) || c.imageLayer.enabled,
        },
      }));
    },
    [setDraft, setWatermarkImageFile],
  );

  const applySmartSuggestion = useCallback(async () => {
    if (!activeImage) return;
    const s = await analyzeSmartSuggestion(activeImage);
    setDraft((c) => ({
      ...c,
      placementMode: 'smart',
      anchor: s.anchor,
      avoidTextRegions: true,
      textLayer: { ...c.textLayer, color: s.textColor },
    }));
    setAutoSuggestion(s.reason);
    setStatusMessage(s.reason);
    // Auto-detect text zones for the active image if not cached
    if (!useWatermarkStore.getState().textZoneCache[activeImage.id]) {
      void detectTextZones(activeImage);
    }
  }, [activeImage, analyzeSmartSuggestion, detectTextZones, setAutoSuggestion, setDraft, setStatusMessage]);

  const processBatch = useCallback(async () => {
    const { draft, watermarkImageFile } = useWatermarkStore.getState();
    const renderable = Boolean(
      (draft.textLayer.enabled && draft.textLayer.text.trim().length > 0) ||
      (draft.imageLayer.enabled && watermarkImageFile),
    );
    if (
      !ensureVerifiedEmailOrNotify() ||
      !images.length ||
      !renderable
    ) {
      setStatusMessage(t('watermark.status.configureLayer'));
      return;
    }
    cancelBatchRef.current = false;
    setProcessing(true);
    setProgress(0);
    setStatusMessage(t('watermark.action.applying'));
    setResults((c) => {
      revokeEntries(c);
      return [];
    });
    const nr: WatermarkResultEntry[] = [];
    try {
      // ponytail: sequential by design — per-image render pipeline with cancelBatchRef checks and per-image progress
      for (let i = 0; i < images.length; i++) {
        if (cancelBatchRef.current) throw new Error(t('common.cancelled'));
        const img = images[i]!;
        const r = await runRender(buildAsset(img));
        nr.push({
          sourceImageId: img.id,
          name: buildOutputName(img.file.name, draft, outputType),
          blob: r.blob,
          previewUrl: URL.createObjectURL(r.blob),
          resolvedAnchor: r.resolvedAnchor,
        });
        setProgress(((i + 1) / images.length) * 100);
      }
      setResults(nr);
      registerDownloadsRef.current(
        nr.map((e) => ({
          fileName: e.name,
          blob: e.blob,
          sourceImageId: e.sourceImageId,
        })),
        'watermark',
      );
      recordProcessedPages(images.length);
      setStatusMessage(t('watermark.status.appliedCount', { count: nr.length }));
    } catch (e) {
      revokeEntries(nr);
      setStatusMessage(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [
    buildAsset,
    buildOutputName,
    ensureVerifiedEmailOrNotify,
    images,
    outputType,
    runRender,
    setProcessing,
    setProgress,
    setResults,
    recordProcessedPages,
    setStatusMessage,
    t,
  ]);

  const downloadZip = useCallback(() => {
    const { draft, results, selectedPresetId } = useWatermarkStore.getState();
    if (!results.length) {
      setStatusMessage(t('watermark.status.noResults'));
      return;
    }
    void Promise.all(
      results.map(
        async (e) =>
          [e.name, new Uint8Array(await e.blob.arrayBuffer())] as const,
      ),
    )
      .then((entries) => {
        const a = zipSync(
          Object.fromEntries([
            [
              'manifest.txt',
              strToU8(
                `Preset: ${selectedPresetId || 'custom'}\nModo: ${PLACEMENT_LABELS[draft.placementMode]}\nItens: ${results.length}\n`,
              ),
            ],
            ...entries,
          ]),
          { level: 0 },
        );
        triggerBlobDownload(
          new Blob([a], { type: 'application/zip' }),
          `${draft.baseName || 'koma-watermark'}-batch.zip`,
        );
      })
      .catch((e) =>
        setStatusMessage(e instanceof Error ? e.message : 'ZIP failed.'),
      );
  }, [setStatusMessage, triggerBlobDownload, t]);

  const saveToFolder = useCallback(async () => {
    const { results } = useWatermarkStore.getState();
    if (!supportsDirectorySave() || !results.length) return;
    const picker = (
      window as Window & {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) return;
    const dir = await picker();
    // ponytail: sequential by design — the first failed write stops the batch (preserved error semantics)
    for (const e of results) {
      const fh = await dir.getFileHandle(e.name, { create: true });
      const w = await fh.createWritable();
      await w.write(e.blob);
      await w.close();
    }
    setStatusMessage(t('common.exportedCount', { count: results.length }));
  }, [setStatusMessage, supportsDirectorySave, t]);

  const onCancelBatch = useCallback(() => {
    cancelBatchRef.current = true;
    setStatusMessage(t('watermark.status.cancelRequested'));
  }, [setStatusMessage, t]);

  const selectedResult = activeImage
    ? (resultsById.get(activeImage.id) ?? null)
    : null;
  const isUserPreset = userPresets.some((p) => p.id === selectedPresetId);

  return (
    <>
      {toolboxHost
        ? createPortal(
          <WatermarkToolbox
            allPresets={allPresets}
            selectedPresetId={selectedPresetId}
            isUserPreset={isUserPreset}
            draft={draft}
            watermarkImageFile={watermarkImageFile}
            watermarkImagePreview={watermarkImagePreview}
            activeImage={activeImage}
            imagesCount={images.length}
            activeTextZonesCount={activeTextZones.length}
            detectingTextZones={detectingTextZones}
            showTextZoneOverlay={showTextZoneOverlay}
            processing={processing}
            hasRenderableLayer={hasRenderableLayer}
            setDraft={setDraft}
            setWatermarkImageFile={setWatermarkImageFile}
            setWatermarkImagePreview={setWatermarkImagePreview}
            onApplyPreset={applyPreset}
            onSaveCurrentPreset={saveCurrentPreset}
            onDuplicateSelectedPreset={duplicateSelectedPreset}
            onRenameSelectedPreset={renameSelectedPreset}
            onDeleteSelectedPreset={deleteSelectedPreset}
            onWatermarkImageChange={handleWatermarkImageChange}
            onApplySmartSuggestion={applySmartSuggestion}
            onDetectTextZones={detectTextZones}
            onDetectAllTextZones={detectAllTextZones}
            setShowTextZoneOverlay={setShowTextZoneOverlay}
            onProcessBatch={processBatch}
            onCancelBatch={onCancelBatch}
          />,
          toolboxHost,
        )
        : null}

      <div className="koma-wm-ws">
        <WatermarkPreviewPanel
          images={images}
          activeImage={activeImage}
          activeTextZones={activeTextZones}
          textZoneCache={textZoneCache}
          resultsById={resultsById}
          hasRenderableLayer={hasRenderableLayer}
          previewUrl={previewUrl}
          previewBusy={previewBusy}
          previewAnchor={previewAnchor}
          compareMode={compareMode}
          compareValue={compareValue}
          zoom={zoom}
          showTextZoneOverlay={showTextZoneOverlay}
          setActiveImageId={setActiveImageId}
          setCompareMode={setCompareMode}
          setCompareValue={setCompareValue}
          setZoom={setZoom}
          thumbsStripRef={thumbsStripRef}
          previewStageRef={previewStageRef}
        />

        <WatermarkOutputPanel
          autoSuggestion={autoSuggestion}
          results={results}
          selectedResult={selectedResult}
          supportsDirectorySave={supportsDirectorySave}
          onDownloadZip={downloadZip}
          onSaveToFolder={saveToFolder}
          onTriggerBlobDownload={triggerBlobDownload}
        />
      </div>
    </>
  );
};

export default WatermarkWorkspace;
