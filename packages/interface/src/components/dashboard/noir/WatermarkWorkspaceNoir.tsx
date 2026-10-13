import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Download,
  Eye,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Minus,
  Plus,
  Save,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Stamp,
  Type,
  Upload,
  X,
  Zap,
  Copy,
  Trash2,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';

import {
  buildBuiltinPresets,
  createDefaultWatermarkDraft,
  deserializeWatermarkPresets,
  duplicatePreset,
  sanitizePresetName,
  serializeWatermarkPresets,
  suggestSmartPlacement,
} from '../watermark/watermark-core.js';
import { renderWatermarkAsset } from '../watermark/watermarkRenderer';
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
} from '../watermark/watermarkTypes';
import type { DetectApiResponse } from '../../../types/dashboard.types';
import { AioSection } from '@/pages/AioSection.js';
import { useI18n } from '../../../i18n';
import { FontFamilySelect } from '../../fonts/FontFamilySelect';
import { useFontCatalogOptions } from '../../../hooks/useFontCatalogOptions';
import {
  Field, Hint, LayerToggle, RangeField, ColorInput, NumberField, ToolBtn, EASE,
} from '../../noir-panels/NoirPrimitives';
import { useHorizontalDragScroll } from '../../../hooks/useHorizontalDragScroll';

const USER_PRESETS_STORAGE_KEY = 'koma-studio.watermark.user-presets.v1';
const BLEND_OPTIONS = [
  { value: 'source-over', labelKey: 'watermark.blend.normal' },
  { value: 'multiply', labelKey: 'watermark.blend.multiply' },
  { value: 'screen', labelKey: 'watermark.blend.screen' },
  { value: 'overlay', labelKey: 'watermark.blend.overlay' },
  { value: 'soft-light', labelKey: 'watermark.blend.softLight' },
  { value: 'hard-light', labelKey: 'watermark.blend.hardLight' },
  { value: 'color-dodge', labelKey: 'watermark.blend.colorDodge' },
  { value: 'color-burn', labelKey: 'watermark.blend.colorBurn' },
] as const;
const ANCHOR_OPTIONS: Array<{ value: WatermarkAnchor; label: string }> = [
  { value: 'top-left', label: '\u2196' },
  { value: 'top-center', label: '\u2191' },
  { value: 'top-right', label: '\u2197' },
  { value: 'center-left', label: '\u2190' },
  { value: 'center', label: '\u2022' },
  { value: 'center-right', label: '\u2192' },
  { value: 'bottom-left', label: '\u2199' },
  { value: 'bottom-center', label: '\u2193' },
  { value: 'bottom-right', label: '\u2198' },
];
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const ZOOM_DEFAULT = 1;

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
    return new Worker(new URL('../watermark/watermarkWorker.ts', import.meta.url), {
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
      reject(new Error('Falha ao carregar imagem para sugestao inteligente.'));
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
    throw new Error('Falha ao preparar analise inteligente de watermark.');
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

const WatermarkWorkspaceNoir = ({
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
  ensureQuotaBeforeProcessing = () => true,
  hasQuotaForCurrentBatch = true,
  quotaLimitButtonTitle = '',
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
  ensureQuotaBeforeProcessing?: (count: number, toolName: string) => boolean;
  hasQuotaForCurrentBatch?: boolean;
  quotaLimitButtonTitle?: string;
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
  const fontFamilies = useFontCatalogOptions();

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
  const hasRenderableLayer =
    (draft.textLayer.enabled && draft.textLayer.text.trim().length > 0) ||
    (draft.imageLayer.enabled && watermarkImageFile);

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
    if (!ensureQuotaBeforeProcessing(images.length, t('watermark.header.title'))) return;
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
    ensureQuotaBeforeProcessing,
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

  const selectedResult = activeImage
    ? (resultsById.get(activeImage.id) ?? null)
    : null;
  const isUserPreset = userPresets.some((p) => p.id === selectedPresetId);

  // =======================================
  // Toolbox (portaled into sidebar) — V2 NOIR
  // =======================================
  const toolbox = (
    <div className="font-display text-paper">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="kicker">// {t('watermark.header.eyebrow')}</span>
          <h2 className="mt-1 font-display text-base font-black uppercase tracking-tight text-paper">
            {t('watermark.header.title')}
          </h2>
        </div>
        <span className="stamp"><Stamp size={10} /> {t('watermark.header.badge')}</span>
      </div>

      {/* ── PRESETS ── */}
      <AioSection icon={Layers} title={t('watermark.panel.presets')} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          {allPresets.map((p) => {
            const active = selectedPresetId === p.id;
            return (
              <button key={p.id} type="button" onClick={() => applyPreset(p)}
                className={`panel-cut-sm flex flex-col gap-0.5 border p-2 text-left transition-all duration-150 ${active ? 'border-crimson/60 bg-crimson/10 -translate-x-0.5 -translate-y-0.5 shadow-[3px_3px_0_rgba(255,46,99,0.3)]' : 'border-paper/10 bg-ink hover:border-paper/25'
                  }`}>
                <span className="truncate font-display text-[11px] font-bold uppercase tracking-tight">{p.name}</span>
                <span className={`font-mono text-[8px] uppercase tracking-wider ${p.kind === 'builtin' ? 'text-azure' : 'text-mint'}`}>
                  {p.kind === 'builtin' ? t('watermark.presets.builtin') : t('watermark.presets.user')}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <button type="button" className="btn-ghost panel-cut-sm !col-span-2" onClick={saveCurrentPreset}><Save size={10} /> {t('watermark.action.save')}</button>
          <button type="button" className="btn-ghost panel-cut-sm !px-2" onClick={duplicateSelectedPreset} title={t('watermark.action.duplicate')}><Copy size={10} /></button>
          <div className="flex gap-1.5">
            <button type="button" className="btn-ghost panel-cut-sm !px-2 flex-1" onClick={renameSelectedPreset} disabled={!isUserPreset}><Pencil size={10} /></button>
            <button type="button" className="btn-ghost panel-cut-sm !px-2 flex-1 !border-crimson/30 !text-crimson" onClick={deleteSelectedPreset} disabled={!isUserPreset}><Trash2 size={10} /></button>
          </div>
        </div>
      </AioSection>

      {/* ── TEXT ── */}
      <AioSection icon={Type} title={t('watermark.panel.text')}>
        <LayerToggle label={t('watermark.text.enable')} checked={draft.textLayer.enabled} onChange={(v: boolean) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, enabled: v } }))} />
        <Field label={t('watermark.text.content')}>
          <input type="text" className="noir-input panel-cut-sm" value={draft.textLayer.text} onChange={(e) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, text: e.target.value } }))} placeholder={t('watermark.text.placeholder')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('watermark.text.font')}>
            <FontFamilySelect className="noir-select panel-cut-sm" value={draft.textLayer.fontFamily} onChange={(family) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, fontFamily: family } }))} families={fontFamilies} ariaLabel={t('watermark.text.font')} />
          </Field>
          <NumberField label={t('watermark.text.size')} value={draft.textLayer.fontSize} min={12} max={160} onChange={(v: number) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, fontSize: v || c.textLayer.fontSize } }))} />
          <ColorInput label={t('watermark.text.color')} value={draft.textLayer.color} onChange={(v: string) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, color: v } }))} />
          <NumberField label={t('watermark.text.outline')} value={draft.textLayer.outlineWidth} min={0} max={12} onChange={(v: number) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, outlineWidth: v || 0 } }))} />
          <ColorInput label={t('watermark.text.outlineColor')} value={draft.textLayer.outlineColor} onChange={(v: string) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, outlineColor: v } }))} />
          <ColorInput label={t('watermark.text.shadowColor')} value={draft.textLayer.shadowColor} onChange={(v: string) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, shadowColor: v } }))} />
        </div>
        <RangeField label={t('watermark.text.opacity')} value={draft.textLayer.opacity} min={0.05} max={1} step={0.01} onChange={(v: number) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, opacity: v } }))} />
        <RangeField label={t('watermark.text.shadowBlur')} value={draft.textLayer.shadowBlur} min={0} max={40} step={1} onChange={(v: number) => updateDraft((c) => ({ ...c, textLayer: { ...c.textLayer, shadowBlur: v } }))} />
      </AioSection>

      {/* ── LOGO ── */}
      <AioSection icon={ImageIcon} title={t('watermark.panel.logo')} defaultOpen={false}>
        <LayerToggle label={t('watermark.logo.enable')} checked={draft.imageLayer.enabled} onChange={(v: boolean) => updateDraft((c) => ({ ...c, imageLayer: { ...c.imageLayer, enabled: v } }))} />
        <div className="flex items-center gap-2">
          <label className="btn-ghost panel-cut-sm flex-1 cursor-pointer">
            <Upload size={10} /> <span>{watermarkImageFile ? t('watermark.logo.change') : t('watermark.logo.upload')}</span>
            <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={handleWatermarkImageChange} />
          </label>
          {watermarkImagePreview && (
            <div className="relative h-12 w-12 shrink-0 panel-cut-sm border border-paper/15 bg-ink">
              <img src={watermarkImagePreview} alt={t('watermark.logo.alt')} className="h-full w-full object-contain p-1" />
              <button type="button" onClick={() => { setWatermarkImageFile(null); setWatermarkImagePreview((c) => { if (c) URL.revokeObjectURL(c); return null; }); updateDraft((c) => ({ ...c, imageLayer: { ...c.imageLayer, enabled: false } })); }}
                aria-label={t('watermark.logo.remove')} className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center panel-cut-sm bg-crimson text-ink"><X size={8} /></button>
            </div>
          )}
        </div>
        <RangeField label={t('watermark.logo.scale')} value={draft.imageLayer.scalePercent} min={4} max={48} step={1} onChange={(v: number) => updateDraft((c) => ({ ...c, imageLayer: { ...c.imageLayer, scalePercent: v } }))} suffix="%" />
        <RangeField label={t('watermark.logo.opacity')} value={draft.imageLayer.opacity} min={0.05} max={1} step={0.01} onChange={(v: number) => updateDraft((c) => ({ ...c, imageLayer: { ...c.imageLayer, opacity: v } }))} />
        <RangeField label={t('watermark.logo.brightness')} value={draft.imageLayer.brightness} min={40} max={160} step={1} onChange={(v: number) => updateDraft((c) => ({ ...c, imageLayer: { ...c.imageLayer, brightness: v } }))} />
        <RangeField label={t('watermark.logo.saturation')} value={draft.imageLayer.saturation} min={0} max={160} step={1} onChange={(v: number) => updateDraft((c) => ({ ...c, imageLayer: { ...c.imageLayer, saturation: v } }))} />
      </AioSection>

      {/* ── SHADOW ── */}
      <AioSection icon={Sparkles} title={t('watermark.panel.shadow')} defaultOpen={false}>
        <LayerToggle label={t('watermark.shadow.enable')} checked={draft.shadowLayer?.enabled ?? false} onChange={(v: boolean) => updateDraft((c) => ({ ...c, shadowLayer: { ...(c.shadowLayer ?? createDefaultWatermarkDraft().shadowLayer), enabled: v } }))} />
        <RangeField label={t('watermark.shadow.blur')} value={draft.shadowLayer?.blur ?? 12} min={0} max={40} step={1} onChange={(v: number) => updateDraft((c) => ({ ...c, shadowLayer: { ...(c.shadowLayer ?? createDefaultWatermarkDraft().shadowLayer), blur: v } }))} />
        <RangeField label={t('watermark.shadow.opacity')} value={draft.shadowLayer?.opacity ?? 0.4} min={0.05} max={1} step={0.01} onChange={(v: number) => updateDraft((c) => ({ ...c, shadowLayer: { ...(c.shadowLayer ?? createDefaultWatermarkDraft().shadowLayer), opacity: v } }))} />
        <RangeField label={t('watermark.shadow.offsetY')} value={draft.shadowLayer?.offsetY ?? 4} min={-20} max={20} step={1} onChange={(v: number) => updateDraft((c) => ({ ...c, shadowLayer: { ...(c.shadowLayer ?? createDefaultWatermarkDraft().shadowLayer), offsetY: v } }))} />
        <ColorInput label={t('watermark.shadow.color')} value={draft.shadowLayer?.color ?? '#000000'} onChange={(v: string) => updateDraft((c) => ({ ...c, shadowLayer: { ...(c.shadowLayer ?? createDefaultWatermarkDraft().shadowLayer), color: v } }))} />
      </AioSection>

      {/* ── DISTRIBUTION ── */}
      <AioSection icon={Zap} title={t('watermark.panel.distribution')}>
        {/* Anchor grid (3×3 tic-tac-toe) */}
        <Field label={t('watermark.distribution.position')}>
          <div className="grid w-fit grid-cols-3 gap-1 panel-cut-sm bg-ink p-1.5" role="group" aria-label={t('watermark.distribution.position')}>
            {ANCHOR_OPTIONS.map((a) => {
              const isMulti = draft.placementMode === 'multi';
              const isActive = isMulti ? (draft.multiAnchors ?? []).includes(a.value) : draft.anchor === a.value;
              return (
                <button key={a.value} type="button" aria-pressed={isActive}
                  onClick={() => updateDraft((c) => {
                    if (c.placementMode === 'multi') {
                      const prev = c.multiAnchors ?? [];
                      const next = prev.includes(a.value) ? prev.filter((v) => v !== a.value) : [...prev, a.value];
                      return { ...c, multiAnchors: next, anchor: next[0] ?? c.anchor };
                    }
                    const nextMode = c.placementMode === 'smart' ? 'single' : c.placementMode;
                    return { ...c, anchor: a.value, placementMode: nextMode };
                  })}
                  className={`flex h-8 w-8 items-center justify-center panel-cut-sm text-sm transition-colors duration-150 ${isActive ? 'bg-crimson text-ink' : 'bg-paper/5 text-paper-dim hover:bg-paper/10 hover:text-paper'}`}>
                  {a.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Placement chips */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PLACEMENT_LABELS) as Array<WatermarkDraft['placementMode']>).map((m) => {
            const active = draft.placementMode === m;
            return (
              <button key={m} type="button" onClick={() => updateDraft((c) => ({ ...c, placementMode: m }))}
                className={`panel-cut-sm px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 ${active ? 'bg-crimson text-ink' : 'bg-ink text-paper-dim border border-paper/12 hover:text-paper'}`}>
                {PLACEMENT_LABELS[m]}
              </button>
            );
          })}
        </div>

        <RangeField label={t('watermark.distribution.rotation')} value={draft.rotation} min={-180} max={180} step={1} onChange={(v: number) => updateDraft((c) => ({ ...c, rotation: v }))} suffix="°" />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('watermark.distribution.blend')}>
            <select className="noir-select panel-cut-sm" value={draft.blendMode} onChange={(e) => updateDraft((c) => ({ ...c, blendMode: e.target.value as WatermarkDraft['blendMode'] }))}>
              {BLEND_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{t(o.labelKey)}</option>))}
            </select>
          </Field>
          <Field label={t('watermark.distribution.baseName')}>
            <input type="text" className="noir-input panel-cut-sm" value={draft.baseName} onChange={(e) => updateDraft((c) => ({ ...c, baseName: e.target.value }))} />
          </Field>
          <NumberField label={t('watermark.distribution.gapX')} value={draft.gapX} min={40} max={640} onChange={(v: number) => updateDraft((c) => ({ ...c, gapX: v || c.gapX }))} />
          <NumberField label={t('watermark.distribution.gapY')} value={draft.gapY} min={40} max={640} onChange={(v: number) => updateDraft((c) => ({ ...c, gapY: v || c.gapY }))} />
          <NumberField label={t('watermark.distribution.padding')} value={draft.padding} min={0} max={160} onChange={(v: number) => updateDraft((c) => ({ ...c, padding: v || c.padding }))} />
          <NumberField label={t('watermark.distribution.offsetX')} value={draft.offsetX} min={-500} max={500} onChange={(v: number) => updateDraft((c) => ({ ...c, offsetX: v || 0 }))} />
          <NumberField label={t('watermark.distribution.offsetY')} value={draft.offsetY} min={-500} max={500} onChange={(v: number) => updateDraft((c) => ({ ...c, offsetY: v || 0 }))} />
        </div>
        <RangeField label={t('watermark.distribution.density')} value={draft.density} min={2} max={8} step={1} onChange={(v: number) => updateDraft((c) => ({ ...c, density: v }))} />

        <button type="button" className="btn-primary panel-cut-sm w-full" onClick={() => void applySmartSuggestion()} disabled={!activeImage}>
          <Sparkles size={11} /> {t('watermark.distribution.smartPlacement')}
        </button>
      </AioSection>

      {/* ── TEXT AVOIDANCE ── */}
      <AioSection icon={ShieldCheck} title={t('watermark.panel.textAvoidance')} defaultOpen={false}>
        <LayerToggle label={t('watermark.textAvoidance.enable')} checked={draft.avoidTextRegions} onChange={(v: boolean) => updateDraft((c) => ({ ...c, avoidTextRegions: v }))} />
        <Hint>{t('watermark.textAvoidance.desc')}</Hint>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost panel-cut-sm" onClick={() => activeImage && void detectTextZones(activeImage)} disabled={!activeImage || detectingTextZones}>
            <ScanSearch size={11} /> {detectingTextZones ? t('watermark.textAvoidance.detecting') : t('watermark.textAvoidance.detectCurrent')}
          </button>
          <button type="button" className="btn-ghost panel-cut-sm" onClick={() => void detectAllTextZones()} disabled={detectingTextZones || !images.length}>
            <ScanSearch size={11} /> {t('watermark.textAvoidance.detectAll')}
          </button>
        </div>
        {activeTextZones.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="stamp !text-mint !border-mint/50 !bg-mint/10">{activeTextZones.length} {t('watermark.textAvoidance.zonesFound')}</span>
            <LayerToggle label={t('watermark.textAvoidance.showOverlay')} checked={showTextZoneOverlay} onChange={setShowTextZoneOverlay} />
          </div>
        )}
      </AioSection>

      {/* ── EXECUTE ── */}
      <div className="sticky bottom-0 z-10 space-y-2 border-t border-paper/8 bg-ink/90 py-3 backdrop-blur-md">
        <button type="button"
          className={`btn-primary panel-cut-sm w-full !py-3.5 !text-sm ${processing ? 'animate-pulse' : ''}`}
          disabled={processing || !images.length || !hasQuotaForCurrentBatch || !hasRenderableLayer}
          title={quotaLimitButtonTitle} onClick={() => void processBatch()} aria-busy={processing}>
          {processing ? (<><span className="auth-spinner" style={{ width: 13, height: 13 }} aria-hidden="true" /> {t('watermark.action.applying')}</>) : (<><Stamp size={13} /> {t('watermark.action.applyBatch')}</>)}
        </button>
        {processing && (
          <button type="button" className="btn-ghost panel-cut-sm w-full !border-crimson !text-crimson"
            onClick={() => { cancelBatchRef.current = true; setStatusMessageRef.current(t('watermark.status.cancelRequested')); }}>
            {t('watermark.action.cancel')}
          </button>
        )}
      </div>
    </div>
  );

  // =======================================
  // Main workspace — V2 NOIR
  // =======================================
  return (
    <>
      {toolboxHost ? createPortal(toolbox, toolboxHost) : null}

      <div className="grid gap-4 font-display text-paper xl:grid-cols-[1.7fr_1fr]">
        {/* ═══════════ PREVIEW ═══════════ */}
        <div className="glass panel-cut border-l-2 border-l-crimson flex flex-col">
          {/* Head */}
          <div className="flex items-center justify-between gap-3 border-b border-paper/8 p-4">
            <span className="kicker flex items-center gap-1.5"><Eye size={12} /> // {t('watermark.panel.preview')}</span>
            <div className="flex items-center gap-2">
              {activeImage && hasRenderableLayer && (
                <div className="relative flex gap-0.5 panel-cut-sm bg-ink p-0.5">
                  {(['split', 'preview'] as const).map((m) => {
                    const active = compareMode === m;
                    return (
                      <button key={m} type="button" onClick={() => setCompareMode(m)}
                        className={`relative px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${active ? 'text-ink' : 'text-paper-dim hover:text-paper'}`}>
                        {active && <motion.span layoutId="wm-compare" className="absolute inset-0 panel-cut-sm bg-crimson" transition={{ duration: 0.25, ease: EASE }} />}
                        <span className="relative z-10">{m === 'split' ? t('watermark.preview.compare') : t('watermark.preview.mode')}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-1">
                <ToolBtn onClick={() => setZoom((z) => { const idx = ZOOM_STEPS.findIndex((s) => s >= z); return ZOOM_STEPS[Math.max((idx === -1 ? 0 : idx) - 1, 0)] ?? z; })} ariaLabel="Zoom out"><Minus size={12} /></ToolBtn>
                <span className="min-w-[42px] text-center font-mono text-[10px] text-paper-dim">{Math.round(zoom * 100)}%</span>
                <ToolBtn onClick={() => setZoom((z) => { const idx = ZOOM_STEPS.findIndex((s) => s >= z); return ZOOM_STEPS[Math.min((idx === -1 ? ZOOM_STEPS.length - 1 : idx) + 1, ZOOM_STEPS.length - 1)] ?? z; })} ariaLabel="Zoom in"><Plus size={12} /></ToolBtn>
                {zoom !== ZOOM_DEFAULT && <ToolBtn onClick={() => setZoom(ZOOM_DEFAULT)} ariaLabel="Reset zoom"><RotateCcw size={10} /></ToolBtn>}
              </div>
            </div>
          </div>

          {/* Empty states */}
          {images.length === 0 ? (
            <EmptyStage icon={ImageIcon} title={t('watermark.preview.empty.title')} desc={t('watermark.preview.empty.desc')} />
          ) : !hasRenderableLayer ? (
            <EmptyStage icon={Stamp} title={t('watermark.preview.noLayer.title')} desc={t('watermark.preview.noLayer.desc')} />
          ) : (
            <>
              {/* Thumbs */}
              <div ref={thumbsStripRef} className="flex gap-2 overflow-x-auto border-b border-paper/8 p-3" style={{ scrollbarWidth: 'thin' }}>
                {images.map((img, i) => {
                  const active = activeImage?.id === img.id;
                  return (
                    <button key={img.id} type="button" data-thumb-id={img.id} onClick={() => setActiveImageId(img.id)}
                      className={`relative h-16 w-14 shrink-0 overflow-hidden panel-cut-sm border transition-all duration-150 ${active ? 'border-crimson -translate-y-0.5 shadow-[3px_3px_0_rgba(255,46,99,0.3)]' : 'border-paper/12 hover:border-paper/30'}`}>
                      <img src={resultsById.get(img.id)?.previewUrl ?? img.url} alt={img.file.name} className="h-full w-full object-cover" />
                      <span className="absolute bottom-0 left-0 bg-ink/80 px-1 py-0.5 font-mono text-[8px] font-bold text-crimson">{i + 1}</span>
                      {textZoneCache[img.id] && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-mint animate-blink" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              {/* Stage */}
              <div ref={previewStageRef} className="halftone relative flex min-h-[420px] flex-1 items-center justify-center overflow-auto bg-ink/50 p-6">
                <div style={{ zoom }}>
                  {activeImage && (
                    compareMode === 'split' && previewUrl ? (
                      <div className="relative inline-block">
                        <img src={activeImage.url} alt={t('watermark.preview.original')} className="block panel-cut-sm border border-paper/10 shadow-[6px_6px_0_rgba(0,0,0,0.4)]" />
                        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - compareValue}% 0 0)` }}>
                          <img src={previewUrl} alt={t('watermark.preview.watermark')} className="block panel-cut-sm" />
                        </div>
                        {showTextZoneOverlay && activeTextZones.length > 0 && (
                          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${activeImage.width} ${activeImage.height}`} preserveAspectRatio="xMidYMid meet">
                            {activeTextZones.map((zone) => (<rect key={zone.id} x={zone.bbox[0]} y={zone.bbox[1]} width={zone.bbox[2] - zone.bbox[0]} height={zone.bbox[3] - zone.bbox[1]} fill="rgba(62,242,176,0.12)" stroke="#3ef2b0" strokeWidth={2} strokeDasharray="6 4" />))}
                          </svg>
                        )}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-crimson shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" style={{ left: `${compareValue}%` }} aria-hidden="true">
                          <span className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center panel-cut-sm bg-crimson text-ink"><Zap size={11} /></span>
                        </div>
                        <input type="range" min={0} max={100} value={compareValue} onChange={(e) => setCompareValue(Number(e.target.value))} className="absolute inset-x-0 bottom-2 mx-auto w-[90%] cursor-ew-resize opacity-0" aria-label={t('watermark.preview.compareAria')} />
                      </div>
                    ) : (
                      <div className="relative inline-block">
                        <img src={previewUrl ?? activeImage.url} alt={t('watermark.panel.preview')} className="block panel-cut-sm border border-paper/10 shadow-[6px_6px_0_rgba(0,0,0,0.4)]" />
                        {showTextZoneOverlay && activeTextZones.length > 0 && (
                          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${activeImage.width} ${activeImage.height}`} preserveAspectRatio="xMidYMid meet">
                            {activeTextZones.map((zone) => (<rect key={zone.id} x={zone.bbox[0]} y={zone.bbox[1]} width={zone.bbox[2] - zone.bbox[0]} height={zone.bbox[3] - zone.bbox[1]} fill="rgba(62,242,176,0.12)" stroke="#3ef2b0" strokeWidth={2} strokeDasharray="6 4" />))}
                          </svg>
                        )}
                      </div>
                    )
                  )}
                </div>
                {previewBusy && (
                  <div className="absolute right-4 top-4 flex items-center gap-2 glass panel-cut-sm border-l-2 border-l-crimson px-3 py-2">
                    <span className="auth-spinner" style={{ width: 14, height: 14 }} />
                    <span className="font-mono text-[10px] text-crimson">{t('watermark.preview.generating')}</span>
                  </div>
                )}
              </div>

              {/* File bar */}
              {activeImage && (
                <div className="flex items-center justify-between gap-3 border-t border-paper/8 px-4 py-2.5">
                  <span className="truncate font-mono text-[11px] text-paper">{activeImage.file.name}</span>
                  <div className="flex items-center gap-2 font-mono text-[9.5px] text-paper-dim">
                    <span>{activeImage.width} × {activeImage.height}</span>
                    <span className="h-1 w-1 rounded-full bg-crimson/50" />
                    <span className="text-crimson">{previewBusy ? t('watermark.preview.generating') : previewAnchor}</span>
                    {activeTextZones.length > 0 && (<span className="flex items-center gap-1 text-mint"><ShieldCheck size={9} /> {activeTextZones.length}</span>)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══════════ OUTPUT ═══════════ */}
        <div className="glass panel-cut border-l-2 border-l-mint flex flex-col">
          <div className="border-b border-paper/8 p-4">
            <span className="kicker !text-mint flex items-center gap-1.5"><Download size={11} /> // {t('watermark.panel.output')}</span>
          </div>

          <div className="space-y-3 p-3">
            {/* Smart suggestion */}
            <div className="glass panel-cut-sm flex items-start gap-2 border-l-2 border-l-gold p-2.5">
              <Sparkles size={12} className="mt-0.5 shrink-0 text-gold" />
              <span className="font-mono text-[10.5px] leading-relaxed text-paper">{autoSuggestion}</span>
            </div>

            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center panel-cut bg-mint/8 text-mint"><Download size={24} /></span>
                <p className="font-display text-sm font-bold uppercase tracking-tight">{t('watermark.output.empty.title')}</p>
                <p className="max-w-xs font-mono text-[10px] text-paper-dim">{t('watermark.output.empty.desc')}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn-ghost panel-cut-sm" onClick={downloadZip}><Download size={11} /> {t('watermark.action.zip')}</button>
                  <button type="button" className="btn-ghost panel-cut-sm" onClick={() => void saveToFolder()} disabled={!supportsDirectorySave()}><FolderOpen size={11} /> {t('watermark.action.folder')}</button>
                  <button type="button" className="btn-primary panel-cut-sm !col-span-2" onClick={() => { if (selectedResult) triggerBlobDownload(selectedResult.blob, selectedResult.name); }} disabled={!selectedResult}>
                    <Download size={11} /> {t('watermark.action.download')}
                  </button>
                </div>

                <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 360, scrollbarWidth: 'thin' }}>
                  {results.map((e) => (
                    <div key={e.sourceImageId} className="flex items-center gap-2.5 panel-cut-sm border border-paper/10 bg-ink p-2 transition-colors hover:border-mint/40">
                      <img src={e.previewUrl} alt={e.name} className="h-11 w-9 shrink-0 object-cover panel-cut-sm border border-paper/10" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[10.5px] text-paper">{e.name}</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-mint">{e.resolvedAnchor}</span>
                      </div>
                      <button type="button" onClick={() => triggerBlobDownload(e.blob, e.name)} aria-label={`${t('watermark.action.download')} ${e.name}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center panel-cut-sm bg-mint/12 text-mint transition-colors hover:bg-mint hover:text-ink"><Download size={11} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

/* ── Empty stage helper ── */
function EmptyStage({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="halftone flex min-h-[420px] flex-1 items-center justify-center bg-ink/50 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center panel-cut bg-crimson/8 text-crimson"><Icon size={28} /></span>
        <p className="font-display text-sm font-bold uppercase tracking-tight text-paper">{title}</p>
        <p className="max-w-xs font-mono text-[10.5px] text-paper-dim">{desc}</p>
      </div>
    </div>
  );
}

export default WatermarkWorkspaceNoir;
