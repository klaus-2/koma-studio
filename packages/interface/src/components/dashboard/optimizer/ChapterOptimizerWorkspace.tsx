import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zipSync } from 'fflate';

import type {
  OptimizationPreset,
  OptimizationRecipe,
  OptimizationResult,
  RawOutputFormat,
} from '../../../types';
import './ChapterOptimizerWorkspace.css';
import { useI18n } from '../../../i18n';
import { useHorizontalDragScroll } from '../../../hooks/useHorizontalDragScroll';
import ChapterOptimizerControlPanel from './ChapterOptimizerControlPanel';
import ChapterOptimizerHero from './ChapterOptimizerHero';
import ChapterOptimizerPreviewPanel from './ChapterOptimizerPreviewPanel';
import ChapterOptimizerResultsPanel from './ChapterOptimizerResultsPanel';
import type {
  ChapterOptimizerWorkspaceState,
  OptimizerImageInput,
  OptimizerPreviewStats,
  OptimizerSourceVariant,
} from './ChapterOptimizerWorkspace.types';
import {
  ROTATION_OPTIONS,
  savingsPercent,
  ZOOM_LEVELS,
} from './ChapterOptimizerWorkspace.utils';

export type { ChapterOptimizerWorkspaceState } from './ChapterOptimizerWorkspace.types';

type TranslateFn = ReturnType<typeof useI18n>['t'];

interface ChapterOptimizerWorkspaceProps {
  workspaceState?: ChapterOptimizerWorkspaceState | null;
  restoreToken?: string | number | null;
  onWorkspaceStateChange?: (state: ChapterOptimizerWorkspaceState) => void;
  images: OptimizerImageInput[];
  sourceVariants: OptimizerSourceVariant[];
  registerDownloads: (
    items: Array<{ fileName: string; blob: Blob; sourceImageId: string }>,
    scope: 'optimizer',
  ) => void;
  triggerBlobDownload: (blob: Blob, fileName: string) => void;
  setStatusMessage: (message: string) => void;
}

const STORAGE_KEY = 'koma-studio.chapter-optimizer.recipe.v2';
type OptimizerPersistedRecipe = Omit<Partial<OptimizationRecipe>, 'preset' | 'sharpen'> & {
  preset?: OptimizationPreset | 'manga';
  sharpen?: boolean | number;
};

const DEFAULT_NEW_FIELDS = {
  brightness: 0,
  contrast: 0,
  noiseReduction: false,
  noiseReductionStrength: 0.5,
  rotation: 0 as const,
  renamePattern: '{name}',
};

const PRESET_RECIPES: Record<OptimizationPreset, OptimizationRecipe> = {
  'web-light': {
    preset: 'web-light',
    outputFormat: 'webp',
    quality: 0.78,
    resizeEnabled: true,
    maxWidth: 1600,
    maxHeight: 2400,
    trimBorders: true,
    trimTolerance: 18,
    sharpen: false,
    sharpenStrength: 0.5,
    grayscale: false,
    autoLevels: false,
    ...DEFAULT_NEW_FIELDS,
  },
  reading: {
    preset: 'reading',
    outputFormat: 'webp',
    quality: 0.9,
    resizeEnabled: true,
    maxWidth: 2200,
    maxHeight: 3200,
    trimBorders: false,
    trimTolerance: 16,
    sharpen: false,
    sharpenStrength: 0.3,
    grayscale: false,
    autoLevels: false,
    ...DEFAULT_NEW_FIELDS,
  },
  archive: {
    preset: 'archive',
    outputFormat: 'png',
    quality: 1,
    resizeEnabled: false,
    maxWidth: 2600,
    maxHeight: 3600,
    trimBorders: false,
    trimTolerance: 10,
    sharpen: false,
    sharpenStrength: 0,
    grayscale: false,
    autoLevels: false,
    ...DEFAULT_NEW_FIELDS,
  },
  social: {
    preset: 'social',
    outputFormat: 'jpeg',
    quality: 0.85,
    resizeEnabled: true,
    maxWidth: 1080,
    maxHeight: 1350,
    trimBorders: true,
    trimTolerance: 14,
    sharpen: true,
    sharpenStrength: 0.4,
    grayscale: false,
    autoLevels: true,
    ...DEFAULT_NEW_FIELDS,
    brightness: 5,
    contrast: 8,
  },
  custom: {
    preset: 'custom',
    outputFormat: 'webp',
    quality: 0.85,
    resizeEnabled: false,
    maxWidth: 2000,
    maxHeight: 3000,
    trimBorders: false,
    trimTolerance: 16,
    sharpen: false,
    sharpenStrength: 0.5,
    grayscale: false,
    autoLevels: false,
    ...DEFAULT_NEW_FIELDS,
  },
};

interface OptimizerWritableFile {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}

interface OptimizerFileHandle {
  createWritable: () => Promise<OptimizerWritableFile>;
}

interface OptimizerDirectoryHandle {
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<OptimizerFileHandle>;
}

type OptimizerDirectoryPicker = () => Promise<OptimizerDirectoryHandle>;

const getDirectoryPicker = (): OptimizerDirectoryPicker | null => {
  if (typeof window === 'undefined') return null;
  const picker = (window as unknown as { showDirectoryPicker?: unknown })
    .showDirectoryPicker;
  return typeof picker === 'function'
    ? (picker as OptimizerDirectoryPicker)
    : null;
};

const canUseDirectoryPicker = (): boolean => getDirectoryPicker() !== null;

const normalizeRecipe = (
  input?: OptimizerPersistedRecipe | null,
): OptimizationRecipe => {
  const preset =
    input?.preset && input.preset in PRESET_RECIPES && input.preset !== 'manga'
      ? input.preset
      : 'web-light';
  const base = PRESET_RECIPES[preset];
  return {
    ...base,
    ...input,
    preset,
    sharpen: typeof input?.sharpen === 'number'
      ? input.sharpen > 0
      : input?.sharpen ?? base.sharpen,
    sharpenStrength:
      typeof input?.sharpen === 'number'
        ? input.sharpen
        : input?.sharpenStrength ?? base.sharpenStrength,
  };
};

const getExtension = (format: RawOutputFormat): string =>
  format === 'jpeg' ? 'jpg' : format;

const sanitizeStem = (fileName: string): string =>
  fileName
    .replace(/\.[^.]+$/u, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]+/g, '-');

const buildOutputName = (
  fileName: string,
  format: RawOutputFormat,
  pattern: string,
  index: number,
): string => {
  const stem = sanitizeStem(fileName);
  const ext = getExtension(format);
  const padIdx = String(index + 1).padStart(3, '0');
  const resolved = pattern
    .replace(/\{name\}/g, stem)
    .replace(/\{index\}/g, padIdx)
    .replace(/\{ext\}/g, ext);
  // If pattern produced something meaningful, use it; otherwise fallback
  const finalStem = resolved.trim() || stem;
  return `${finalStem}.${ext}`;
};

type WorkerSuccess = { blob: Blob; width: number; height: number };

const runOptimizerJob = (
  payload: {
    sourceBuffer: ArrayBuffer;
    sourceMimeType: string;
  } & OptimizationRecipe,
  t: TranslateFn,
): Promise<WorkerSuccess> => {
  if (typeof Worker === 'undefined') {
    return Promise.reject(
      new Error(t('optimizer.error.worker')),
    );
  }
  const worker = new Worker(new URL('./optimizerWorker.ts', import.meta.url), {
    type: 'module',
  });
  const requestId = `optimizer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    worker.onmessage = (
      event: MessageEvent<{
        id: string;
        ok: boolean;
        blob?: Blob;
        width?: number;
        height?: number;
        error?: string;
      }>,
    ) => {
      if (event.data.id !== requestId) return;
      worker.terminate();
      if (
        !event.data.ok ||
        !event.data.blob ||
        !event.data.width ||
        !event.data.height
      ) {
        reject(new Error(event.data.error || t('optimizer.error.failed')));
        return;
      }
      resolve({
        blob: event.data.blob,
        width: event.data.width,
        height: event.data.height,
      });
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error(t('optimizer.error.worker')));
    };
    worker.postMessage({
      id: requestId,
      ...payload,
    });
  });
};

export default function ChapterOptimizerWorkspace({
  workspaceState,
  restoreToken,
  onWorkspaceStateChange,
  images,
  sourceVariants,
  registerDownloads,
  triggerBlobDownload,
  setStatusMessage,
}: ChapterOptimizerWorkspaceProps) {
  const { t } = useI18n();
  const formatBytes = useCallback((value: number): string => {
    if (value < 1024) return `${value} ${t("update.units.bytes")}`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} ${t("update.units.kilobytes")}`;
    return `${(value / (1024 * 1024)).toFixed(2)} ${t("update.units.megabytes")}`;
  }, [t]);

  const [recipe, setRecipe] = useState<OptimizationRecipe>(() => {
    if (workspaceState?.recipe) return normalizeRecipe(workspaceState.recipe);
    if (typeof window === 'undefined') return PRESET_RECIPES['web-light'];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeRecipe(JSON.parse(raw) as OptimizerPersistedRecipe) : PRESET_RECIPES['web-light'];
    } catch {
      return PRESET_RECIPES['web-light'];
    }
  });
  const [selectedPreset, setSelectedPreset] = useState<OptimizationPreset>(
    workspaceState?.selectedPreset ?? recipe.preset,
  );
  const [activeImageId, setActiveImageId] = useState<string | null>(
    workspaceState?.activeImageId ?? images[0]?.id ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [previewStats, setPreviewStats] = useState<OptimizerPreviewStats | null>(null);
  const [results, setResults] = useState<OptimizationResult[]>(
    () => workspaceState?.results ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const previewTicketRef = useRef(0);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const thumbStripRef = useHorizontalDragScroll<HTMLDivElement>();

  const variantsByImage = useMemo(() => {
    const map = new Map<string, OptimizerSourceVariant[]>();
    images.forEach((image) => {
      const entries = sourceVariants.filter(
        (variant) => variant.imageId === image.id,
      );
      map.set(image.id, entries);
    });
    return map;
  }, [images, sourceVariants]);

  const activeImage = useMemo(
    () =>
      images.find((image) => image.id === activeImageId) ?? images[0] ?? null,
    [activeImageId, images],
  );

  const resolveSourceVariant = useCallback(
    (imageId: string): OptimizerSourceVariant | null => {
      const entries = variantsByImage.get(imageId) ?? [];
      const byPriority = [...entries].sort((left, right) => {
        const priority = (scope: string): number => {
          if (scope === 'typesetter') return 0;
          if (scope === 'cleaner') return 1;
          if (scope === 'aio') return 2;
          if (scope === 'enhance') return 3;
          return 10;
        };
        return priority(left.scope) - priority(right.scope);
      });
      return byPriority[0] ?? null;
    },
    [variantsByImage],
  );

  useEffect(() => {
    if (!activeImageId && images[0]) setActiveImageId(images[0].id);
  }, [activeImageId, images]);

  useEffect(() => {
    if (!workspaceState) return;
    setRecipe(normalizeRecipe(workspaceState.recipe));
    setSelectedPreset(workspaceState.selectedPreset);
    setActiveImageId(workspaceState.activeImageId);
    setResults(workspaceState.results);
  }, [restoreToken, workspaceState]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recipe));
  }, [recipe]);

  useEffect(() => {
    if (!onWorkspaceStateChange) return;
    onWorkspaceStateChange({
      recipe,
      selectedPreset,
      activeImageId,
      results,
    });
  }, [activeImageId, onWorkspaceStateChange, recipe, results, selectedPreset]);

  // Generate preview — debounced to avoid thrashing during rapid slider changes
  useEffect(() => {
    if (!activeImage) return;

    // Show loading immediately
    setPreviewLoading(true);

    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }

    // Set original preview URL immediately (no debounce needed)
    const source = resolveSourceVariant(activeImage.id);
    const sourceBlob = source?.blob ?? activeImage.file;
    const origUrl = URL.createObjectURL(sourceBlob);
    setOriginalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return origUrl;
    });

    const currentTicket = ++previewTicketRef.current;
    let jobCancelled = false;

    // Debounce the actual job by 300ms
    previewDebounceRef.current = setTimeout(() => {
      void sourceBlob
        .arrayBuffer()
        .then((buffer) =>
          runOptimizerJob({
            sourceBuffer: buffer,
            sourceMimeType:
              sourceBlob.type || activeImage.file.type || 'image/png',
            ...recipe,
          }, t),
        )
        .then((result) => {
          if (jobCancelled || currentTicket !== previewTicketRef.current) return;
          const nextUrl = URL.createObjectURL(result.blob);
          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return nextUrl;
          });
          setPreviewStats({
            originalBytes: sourceBlob.size,
            optimizedBytes: result.blob.size,
            width: result.width,
            height: result.height,
          });
          setPreviewLoading(false);
        })
        .catch((error) => {
          if (!jobCancelled) {
            setPreviewLoading(false);
            setStatusMessage(
              error instanceof Error
                ? error.message
                : t('optimizer.error.preview'),
            );
          }
        });
    }, 300);

    return () => {
      jobCancelled = true;
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
        previewDebounceRef.current = null;
      }
    };
  }, [activeImage, recipe, resolveSourceVariant, setStatusMessage, t]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
    },
    [previewUrl, originalPreviewUrl],
  );

  const updatePreset = useCallback((preset: OptimizationPreset) => {
    setSelectedPreset(preset);
    setRecipe(PRESET_RECIPES[preset]);
  }, []);

  const updateRecipe = useCallback(
    <K extends keyof OptimizationRecipe>(
      key: K,
      value: OptimizationRecipe[K],
    ) => {
      setRecipe((current) => {
        const next = { ...current, [key]: value };
        if (current.preset !== 'custom' && key !== 'preset') {
          next.preset = 'custom';
          setSelectedPreset('custom');
        }
        return next;
      });
    },
    [],
  );

  const handleOptimizeAll = useCallback(
    async (saveToDirectory: boolean) => {
      if (images.length === 0) return;
      setBusy(true);
      setBatchProgress({ current: 0, total: images.length });
      try {
        const outputs: OptimizationResult[] = [];
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          if (!image) continue;
          const source = resolveSourceVariant(image.id);
          const sourceBlob = source?.blob ?? image.file;
          const result = await runOptimizerJob({
            sourceBuffer: await sourceBlob.arrayBuffer(),
            sourceMimeType: sourceBlob.type || image.file.type || 'image/png',
            ...recipe,
          }, t);
          outputs.push({
            sourceImageId: image.id,
            fileName: buildOutputName(image.file.name, recipe.outputFormat, recipe.renamePattern, i),
            blob: result.blob,
            originalBytes: sourceBlob.size,
            optimizedBytes: result.blob.size,
            width: result.width,
            height: result.height,
          });
          setBatchProgress({ current: i + 1, total: images.length });
        }

        setResults(outputs);
        registerDownloads(
          outputs.map((item) => ({
            fileName: item.fileName,
            blob: item.blob,
            sourceImageId: item.sourceImageId,
          })),
          'optimizer',
        );

        const showDirectoryPicker = getDirectoryPicker();
        if (saveToDirectory && showDirectoryPicker) {
          const directory = await showDirectoryPicker();
          for (const output of outputs) {
            const handle = await directory.getFileHandle(output.fileName, {
              create: true,
            });
            const writable = await handle.createWritable();
            await writable.write(output.blob);
            await writable.close();
          }
          setStatusMessage(t('optimizer.export.folderSuccess'));
          return;
        }

        const files: Record<string, Uint8Array> = {};
        for (const output of outputs) {
          files[output.fileName] = new Uint8Array(
            await output.blob.arrayBuffer(),
          );
        }
        const zipBlob = new Blob([zipSync(files, { level: 6 })], {
          type: 'application/zip',
        });
        triggerBlobDownload(zipBlob, `chapter-optimizer-${recipe.preset}.zip`);
        setStatusMessage(t('optimizer.export.zipSuccess'));
      } catch (error) {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : t('optimizer.error.failed'),
        );
      } finally {
        setBusy(false);
        setBatchProgress(null);
      }
    },
    [
      images,
      recipe,
      registerDownloads,
      resolveSourceVariant,
      setStatusMessage,
      triggerBlobDownload,
      t,
    ],
  );

  const handleDownloadSingle = useCallback(
    (result: OptimizationResult) => {
      triggerBlobDownload(result.blob, result.fileName);
    },
    [triggerBlobDownload],
  );

  const totals = useMemo(() => {
    const original = results.reduce((sum, item) => sum + item.originalBytes, 0);
    const optimized = results.reduce(
      (sum, item) => sum + item.optimizedBytes,
      0,
    );
    return {
      original,
      optimized,
      savings: Math.max(0, original - optimized),
      savingsPercent: savingsPercent(original, optimized),
    };
  }, [results]);

  const handleCompareMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!compareRef.current) return;
      const rect = compareRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX === undefined) return;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setComparePosition(pct);
    },
    [],
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => {
      const idx = ZOOM_LEVELS.findIndex((l) => l >= z);
      const next = idx >= 0 ? ZOOM_LEVELS[idx + 1] : undefined;
      return next ?? z;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => {
      const idx = ZOOM_LEVELS.findIndex((l) => l >= z);
      const next = idx > 0 ? ZOOM_LEVELS[idx - 1] : undefined;
      return next ?? z;
    });
  }, []);

  const handleZoomReset = useCallback(() => setZoomLevel(1), []);

  const cycleRotation = useCallback(() => {
    setRecipe((current) => {
      const nextRot =
        ROTATION_OPTIONS[
          (ROTATION_OPTIONS.indexOf(current.rotation) + 1) %
            ROTATION_OPTIONS.length
        ] ?? 0;
      const next = { ...current, rotation: nextRot };
      if (current.preset !== 'custom') {
        next.preset = 'custom';
        setSelectedPreset('custom');
      }
      return next;
    });
  }, []);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!thumbStripRef.current || !activeImageId) return;
    const el = thumbStripRef.current.querySelector(`[data-thumb-id="${activeImageId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeImageId, thumbStripRef]);

  const presetKeys = Object.keys(PRESET_RECIPES) as OptimizationPreset[];
  const activeIdx = images.findIndex((img) => img.id === activeImageId);
  const canExportToFolder = canUseDirectoryPicker();

  return (
    <div className="koma-optim">
      <ChapterOptimizerHero
        imageCount={images.length}
        resultCount={results.length}
        recipe={recipe}
        totals={totals}
        formatBytes={formatBytes}
      />

      {/* Layout */}
      <div className="koma-optim__layout">
        <ChapterOptimizerControlPanel
          recipe={recipe}
          selectedPreset={selectedPreset}
          presetKeys={presetKeys}
          imageCount={images.length}
          busy={busy}
          batchProgress={batchProgress}
          filtersExpanded={filtersExpanded}
          advancedExpanded={advancedExpanded}
          canExportToFolder={canExportToFolder}
          onPresetChange={updatePreset}
          onRecipeChange={updateRecipe}
          onToggleFilters={() => setFiltersExpanded((p) => !p)}
          onToggleAdvanced={() => setAdvancedExpanded((p) => !p)}
          onOptimizeAll={handleOptimizeAll}
        />

        <ChapterOptimizerPreviewPanel
          activeImage={activeImage}
          activeIdx={activeIdx}
          images={images}
          previewUrl={previewUrl}
          originalPreviewUrl={originalPreviewUrl}
          previewStats={previewStats}
          previewLoading={previewLoading}
          showCompare={showCompare}
          comparePosition={comparePosition}
          compareRef={compareRef}
          thumbStripRef={thumbStripRef}
          zoomLevel={zoomLevel}
          formatBytes={formatBytes}
          onActiveImageChange={setActiveImageId}
          onCompareMove={handleCompareMove}
          onCompareToggle={() => setShowCompare((p) => !p)}
          onCycleRotation={cycleRotation}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
        />
      </div>

      <ChapterOptimizerResultsPanel
        results={results}
        totals={totals}
        formatBytes={formatBytes}
        onDownloadSingle={handleDownloadSingle}
      />
    </div>
  );
}
