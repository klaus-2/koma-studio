import {
  useCallback,
  useEffect,
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
  createDefaultWatermarkDraft,
  deserializeWatermarkPresets,
  duplicatePreset,
  sanitizePresetName,
  serializeWatermarkPresets,
  suggestSmartPlacement,
} from './watermark-core.js';
import { renderWatermarkAsset } from './watermarkRenderer';
import { getApiConfig } from '../../../config/api';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';

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

const USER_PRESETS_STORAGE_KEY = 'koma-studio.watermark.user-presets.v1';

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

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load the image for the smart suggestion.'));
    };
    image.src = objectUrl;
  });
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
  setProcessing,
  progress: _progress,
  setProgress,
  setStatusMessage,
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
  const [draft, setDraft] = useState<WatermarkDraft>(() =>
    workspaceState?.draft ?? createDefaultWatermarkDraft(),
  );
  const [activeImageId, setActiveImageId] = useState<string | null>(
    workspaceState?.activeImageId ?? images[0]?.id ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] =
    useState<WatermarkAnchor>('bottom-right');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [watermarkImageFile, setWatermarkImageFile] = useState<File | null>(
    workspaceState?.watermarkImageFile ?? null,
  );
  const [watermarkImagePreview, setWatermarkImagePreview] = useState<
    string | null
  >(null);
  const [userPresets, setUserPresets] = useState<WatermarkPresetV1[]>(() => {
    if (workspaceState?.userPresets) return workspaceState.userPresets;
    if (typeof window === 'undefined') return [];
    return deserializeWatermarkPresets(
      window.localStorage.getItem(USER_PRESETS_STORAGE_KEY),
    );
  });
  const [selectedPresetId, setSelectedPresetId] = useState(
    workspaceState?.selectedPresetId ?? builtins[0]?.id ?? '',
  );
  const [results, setResults] = useState<WatermarkResultEntry[]>(
    () => workspaceState?.results ?? [],
  );
  const [autoSuggestion, setAutoSuggestion] = useState(
    workspaceState?.autoSuggestion ??
      t('watermark.autoSuggestionHint'),
  );
  const [compareMode, setCompareMode] = useState<'split' | 'preview'>(
    workspaceState?.compareMode ?? 'split',
  );
  const [compareValue, setCompareValue] = useState(
    workspaceState?.compareValue ?? 58,
  );
  const [toolboxHost, setToolboxHost] = useState<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [textZoneCache, setTextZoneCache] = useState<Record<string, WatermarkTextAvoidanceZone[]>>(
    () => workspaceState?.textZoneCache ?? {},
  );
  const [detectingTextZones, setDetectingTextZones] = useState(false);
  const [showTextZoneOverlay, setShowTextZoneOverlay] = useState(false);

  const previewTimeoutRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestCounterRef = useRef(0);
  const cancelBatchRef = useRef(false);
  const resultsRef = useRef<WatermarkResultEntry[]>([]);
  const previewRequestRef = useRef(0);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const thumbsStripRef = useHorizontalDragScroll<HTMLDivElement>();

  // ── Stable refs for breaking dependency loops ──
  const onWorkspaceStateChangeRef = useRef(onWorkspaceStateChange);
  onWorkspaceStateChangeRef.current = onWorkspaceStateChange;
  const setStatusMessageRef = useRef(setStatusMessage);
  setStatusMessageRef.current = setStatusMessage;
  const registerDownloadsRef = useRef(registerDownloads);
  registerDownloadsRef.current = registerDownloads;
  const wsChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Restore from workspace state only on explicit restoreToken change
  useEffect(() => {
    if (!workspaceState) return;
    if (lastRestoreTokenRef.current === restoreToken) return;
    lastRestoreTokenRef.current = restoreToken;
    revokeEntries(resultsRef.current);
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
  }, [restoreToken]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    workerRef.current = createWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      if (previewTimeoutRef.current !== null)
        window.clearTimeout(previewTimeoutRef.current);
      revokeEntries(resultsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!toolboxHostId || typeof document === 'undefined') {
      setToolboxHost(null);
      return;
    }
    setToolboxHost(document.getElementById(toolboxHostId));
  }, [toolboxHostId]);

  // Unmount-only cleanup for blob URLs (per-change cleanup is in setters)
  const previewUrlCleanupRef = useRef(previewUrl);
  previewUrlCleanupRef.current = previewUrl;
  const wmImagePreviewCleanupRef = useRef(watermarkImagePreview);
  wmImagePreviewCleanupRef.current = watermarkImagePreview;
  useEffect(() => {
    return () => {
      if (previewUrlCleanupRef.current) URL.revokeObjectURL(previewUrlCleanupRef.current);
      if (wmImagePreviewCleanupRef.current) URL.revokeObjectURL(wmImagePreviewCleanupRef.current);
    };
  }, []);

  useEffect(() => {
    setWatermarkImagePreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return watermarkImageFile ? URL.createObjectURL(watermarkImageFile) : null;
    });
  }, [watermarkImageFile]);

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

  // Stable refs to avoid recreating buildAsset on every draft change
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const textZoneCacheRef = useRef(textZoneCache);
  textZoneCacheRef.current = textZoneCache;
  const outputTypeRef = useRef(outputType);
  outputTypeRef.current = outputType;
  const outputQualityRef = useRef(outputQuality);
  outputQualityRef.current = outputQuality;
  const watermarkImageFileRef = useRef(watermarkImageFile);
  watermarkImageFileRef.current = watermarkImageFile;

  const buildAsset = useCallback(
    (img: WatermarkLoadedImage): WatermarkRenderAsset => ({
      sourceFile: img.file,
      watermarkFile: watermarkImageFileRef.current,
      image: {
        id: img.id,
        width: img.width,
        height: img.height,
        rotation: img.rotation,
        filters: img.filters,
      },
      outputType: outputTypeRef.current,
      outputQuality: outputQualityRef.current,
      settings: draftRef.current,
      textAvoidanceZones: draftRef.current.avoidTextRegions ? (textZoneCacheRef.current[img.id] ?? []) : undefined,
    }),
    [],
  );

  const updateDraft = useCallback(
    (fn: (c: WatermarkDraft) => WatermarkDraft) => setDraft(fn),
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
      setStatusMessageRef.current(
        t('watermark.textAvoidance.detected', { count: zones.length }),
      );
    } catch (err) {
      setStatusMessageRef.current(
        err instanceof Error ? err.message : t('watermark.textAvoidance.failed'),
      );
    } finally {
      setDetectingTextZones(false);
    }
  }, [t]);

  const detectAllTextZones = useCallback(async () => {
    setDetectingTextZones(true);
    const apiConfig = getApiConfig();
    let total = 0;
    try {
      for (const img of images) {
        if (textZoneCache[img.id]) continue;
        const formData = new FormData();
        formData.append('file', img.file);
        const response = await fetchWithTimeoutAndRetry(
          `${apiConfig.localUrl}/detect`,
          { method: 'POST', body: formData },
          { timeoutMs: 30_000, retryCount: 1 },
        );
        if (!response.ok) continue;
        const payload = (await response.json()) as DetectApiResponse;
        const zones: WatermarkTextAvoidanceZone[] = payload.detections.map((d) => ({
          id: d.id,
          bbox: d.bbox,
          score: d.score,
          label: d.label,
        }));
        setTextZoneCache((prev) => ({ ...prev, [img.id]: zones }));
        total += zones.length;
      }
      setStatusMessageRef.current(
        t('watermark.textAvoidance.detectedAll', { count: total }),
      );
    } catch (err) {
      setStatusMessageRef.current(
        err instanceof Error ? err.message : t('watermark.textAvoidance.failed'),
      );
    } finally {
      setDetectingTextZones(false);
    }
  }, [images, textZoneCache, t]);

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
      setPreviewUrl((c) => {
        if (c) URL.revokeObjectURL(c);
        return null;
      });
      return;
    }
    previewTimeoutRef.current = window.setTimeout(() => {
      const rid = ++previewRequestRef.current;
      setPreviewBusy(true);
      void runRender(buildAsset(activeImage))
        .then((r) => {
          if (previewRequestRef.current !== rid) return;
          setPreviewAnchor(r.resolvedAnchor);
          setPreviewUrl((c) => {
            if (c) URL.revokeObjectURL(c);
            return URL.createObjectURL(r.blob);
          });
        })
        .catch((e) => {
          if (previewRequestRef.current === rid)
            setStatusMessageRef.current(
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
  ]);

  // ── Preset handlers ──
  const applyPreset = useCallback(
    (p: WatermarkPresetV1) => {
      setSelectedPresetId(p.id);
      setDraft(p.settings);
      setStatusMessageRef.current(`${t('renderPreview.preset')}: ${p.name}`);
    },
    [t],
  );
  const saveCurrentPreset = useCallback(() => {
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
    setStatusMessageRef.current(`${t('common.saved')}: ${n}`);
  }, [draft, t]);
  const duplicateSelectedPreset = useCallback(() => {
    const p = allPresets.find((e) => e.id === selectedPresetId);
    if (!p) return;
    const np = duplicatePreset(
      p,
      allPresets.map((e) => e.name),
    ) as WatermarkPresetV1;
    setUserPresets((c) => [np, ...c]);
    setSelectedPresetId(np.id);
    setStatusMessageRef.current(`${t('common.duplicated')}: ${np.name}`);
  }, [allPresets, selectedPresetId, t]);
  const renameSelectedPreset = useCallback(() => {
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
    setStatusMessageRef.current(`${t('common.renamed')}: ${nn}`);
  }, [draft, selectedPresetId, t, userPresets]);
  const deleteSelectedPreset = useCallback(() => {
    const p = userPresets.find((e) => e.id === selectedPresetId);
    if (!p) return;
    setUserPresets((c) => c.filter((e) => e.id !== p.id));
    setSelectedPresetId(builtins[0]?.id ?? '');
    setStatusMessageRef.current(`${t('common.removed')}: ${p.name}`);
  }, [builtins, selectedPresetId, t, userPresets]);

  const handleWatermarkImageChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      const f = ev.target.files?.[0] ?? null;
      setWatermarkImageFile(f);
      setWatermarkImagePreview((c) => {
        if (c) URL.revokeObjectURL(c);
        return f ? URL.createObjectURL(f) : null;
      });
      updateDraft((c) => ({
        ...c,
        imageLayer: {
          ...c.imageLayer,
          enabled: Boolean(f) || c.imageLayer.enabled,
        },
      }));
    },
    [updateDraft],
  );

  const applySmartSuggestion = useCallback(async () => {
    if (!activeImage) return;
    const s = await analyzeSmartSuggestion(activeImage);
    updateDraft((c) => ({
      ...c,
      placementMode: 'smart',
      anchor: s.anchor,
      avoidTextRegions: true,
      textLayer: { ...c.textLayer, color: s.textColor },
    }));
    setAutoSuggestion(s.reason);
    setStatusMessageRef.current(s.reason);
    // Auto-detect text zones for the active image if not cached
    if (!textZoneCache[activeImage.id]) {
      void detectTextZones(activeImage);
    }
  }, [activeImage, updateDraft, textZoneCache, detectTextZones]);

  const processBatch = useCallback(async () => {
    if (
      !ensureVerifiedEmailOrNotify() ||
      !images.length ||
      !hasRenderableLayer
    ) {
      setStatusMessageRef.current(t('watermark.status.configureLayer'));
      return;
    }
    cancelBatchRef.current = false;
    setProcessing(true);
    setProgress(0);
    setStatusMessageRef.current(t('watermark.action.applying'));
    setResults((c) => {
      revokeEntries(c);
      return [];
    });
    const nr: WatermarkResultEntry[] = [];
    try {
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
      setStatusMessageRef.current(t('watermark.status.appliedCount', { count: nr.length }));
    } catch (e) {
      revokeEntries(nr);
      setStatusMessageRef.current(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [
    buildAsset,
    draft,
    ensureVerifiedEmailOrNotify,
    hasRenderableLayer,
    images,
    outputType,
    runRender,
    setProcessing,
    setProgress,
    recordProcessedPages,
    t,
  ]);

  const downloadZip = useCallback(() => {
    if (!results.length) {
      setStatusMessageRef.current(t('watermark.status.noResults'));
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
        setStatusMessageRef.current(e instanceof Error ? e.message : 'ZIP failed.'),
      );
  }, [
    draft.baseName,
    draft.placementMode,
    results,
    selectedPresetId,
    triggerBlobDownload,
    t,
  ]);

  const saveToFolder = useCallback(async () => {
    if (!supportsDirectorySave() || !results.length) return;
    const picker = (
      window as Window & {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) return;
    const dir = await picker();
    for (const e of results) {
      const fh = await dir.getFileHandle(e.name, { create: true });
      const w = await fh.createWritable();
      await w.write(e.blob);
      await w.close();
    }
    setStatusMessageRef.current(t('common.exportedCount', { count: results.length }));
  }, [results, supportsDirectorySave, t]);

  const onCancelBatch = useCallback(() => {
    cancelBatchRef.current = true;
    setStatusMessageRef.current(t('watermark.status.cancelRequested'));
  }, [t]);

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
