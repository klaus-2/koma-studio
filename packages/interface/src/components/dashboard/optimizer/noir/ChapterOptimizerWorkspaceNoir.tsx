'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine,
  Contrast,
  Download,
  Eye,
  FileImage,
  FolderOutput,
  Gauge,
  Globe,
  Image as ImageIcon,
  Layers3,
  MonitorSmartphone,
  Palette,
  RefreshCw,
  RotateCw,
  Scissors,
  Settings2,
  Sparkles,
  SunMedium,
  TrendingDown,
  Type,
  Wand2,
  ZoomIn,
  Minus,
  Plus,
} from 'lucide-react';
import { zipSync } from 'fflate';

import type {
  OptimizationPreset,
  OptimizationRecipe,
  OptimizationResult,
  RawOutputFormat,
} from '../../../../types';
import { useI18n } from '../../../../i18n';
import { useHorizontalDragScroll } from '../../../../hooks/useHorizontalDragScroll';
import {
  NoirSection,
  NoirField,
  NoirInput,
  NoirSlider,
  NoirToggle,
  Segmented,
  Stamp,
  useNoirMotion,
} from '../../../noir-panels/NoirPrimitives';

interface OptimizerImageInput {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
}

interface OptimizerSourceVariant {
  id: string;
  imageId: string;
  label: string;
  scope: string;
  blob: Blob;
  previewUrl: string;
}

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

export interface ChapterOptimizerWorkspaceState {
  recipe: OptimizationRecipe;
  selectedPreset: OptimizationPreset;
  activeImageId: string | null;
  results: OptimizationResult[];
}

const STORAGE_KEY = 'koma-studio.chapter-optimizer.recipe.v2';

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

const PRESET_META: Record<OptimizationPreset, { icon: typeof Globe; descKey: string }> = {
  'web-light': { icon: Globe, descKey: 'optimizer.presets.webLight.desc' },
  reading: { icon: Eye, descKey: 'optimizer.presets.reading.desc' },
  archive: { icon: Layers3, descKey: 'optimizer.presets.archive.desc' },
  social: { icon: MonitorSmartphone, descKey: 'optimizer.presets.social.desc' },
  custom: { icon: Settings2, descKey: 'optimizer.presets.custom.desc' },
};

const ROTATION_OPTIONS = [0, 90, 180, 270] as const;

const canUseDirectoryPicker = (): boolean =>
  typeof window !== 'undefined' && typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

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
  const finalStem = resolved.trim() || stem;
  return `${finalStem}.${ext}`;
};

type WorkerSuccess = { blob: Blob; width: number; height: number };

const runOptimizerJob = (
  payload: { sourceBuffer: ArrayBuffer; sourceMimeType: string } & OptimizationRecipe,
  t: (key: any) => string,
): Promise<WorkerSuccess> => {
  if (typeof Worker === 'undefined') {
    return Promise.reject(new Error(t('optimizer.error.worker')));
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
      if (!event.data.ok || !event.data.blob || !event.data.width || !event.data.height) {
        reject(new Error(event.data.error || t('optimizer.error.failed')));
        return;
      }
      resolve({ blob: event.data.blob, width: event.data.width, height: event.data.height });
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error(t('optimizer.error.worker')));
    };
    worker.postMessage({ id: requestId, ...payload });
  });
};

const savingsPercent = (original: number, optimized: number): number => {
  if (original <= 0) return 0;
  return Math.round(((original - optimized) / original) * 100);
};

/* Paleta noir para savings: mint → azure → gold */
const savingsColor = (pct: number): string => {
  if (pct >= 60) return '#3ef2b0';
  if (pct >= 30) return '#4dc9ff';
  if (pct > 0) return '#ffc857';
  return 'rgba(242, 237, 227, 0.4)';
};

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/* ══════════════════ Component ══════════════════ */

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
  const m = useNoirMotion();

  const formatBytes = useCallback(
    (value: number): string => {
      if (value < 1024) return `${value} ${t('update.units.bytes')}`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} ${t('update.units.kilobytes')}`;
      return `${(value / (1024 * 1024)).toFixed(2)} ${t('update.units.megabytes')}`;
    },
    [t],
  );

  const [recipe, setRecipe] = useState<OptimizationRecipe>(() => {
    if (workspaceState?.recipe) return workspaceState.recipe;
    if (typeof window === 'undefined') return PRESET_RECIPES['web-light'];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw
        ? { ...PRESET_RECIPES['web-light'], ...(JSON.parse(raw) as Partial<OptimizationRecipe>) }
        : PRESET_RECIPES['web-light'];
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
  const [previewStats, setPreviewStats] = useState<{
    originalBytes: number;
    optimizedBytes: number;
    width: number;
    height: number;
  } | null>(null);
  const [results, setResults] = useState<OptimizationResult[]>(() => workspaceState?.results ?? []);
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
      map.set(image.id, sourceVariants.filter((v) => v.imageId === image.id));
    });
    return map;
  }, [images, sourceVariants]);

  const activeImage = useMemo(
    () => images.find((image) => image.id === activeImageId) ?? images[0] ?? null,
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
    setRecipe(workspaceState.recipe);
    setSelectedPreset(workspaceState.selectedPreset);
    setActiveImageId(workspaceState.activeImageId);
    setResults(workspaceState.results);
  }, [restoreToken, workspaceState]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recipe));
  }, [recipe]);

  useEffect(() => {
    if (!onWorkspaceStateChange) return;
    onWorkspaceStateChange({ recipe, selectedPreset, activeImageId, results });
  }, [activeImageId, onWorkspaceStateChange, recipe, results, selectedPreset]);

  useEffect(() => {
    if (!activeImage) return;
    setPreviewLoading(true);
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);

    const source = resolveSourceVariant(activeImage.id);
    const sourceBlob = source?.blob ?? activeImage.file;
    const origUrl = URL.createObjectURL(sourceBlob);
    setOriginalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return origUrl;
    });

    const currentTicket = ++previewTicketRef.current;
    let jobCancelled = false;

    previewDebounceRef.current = setTimeout(() => {
      void sourceBlob
        .arrayBuffer()
        .then((buffer) =>
          runOptimizerJob(
            {
              sourceBuffer: buffer,
              sourceMimeType: sourceBlob.type || activeImage.file.type || 'image/png',
              ...recipe,
            },
            t,
          ),
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
              error instanceof Error ? error.message : t('optimizer.error.preview'),
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
    <K extends keyof OptimizationRecipe>(key: K, value: OptimizationRecipe[K]) => {
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
          const result = await runOptimizerJob(
            {
              sourceBuffer: await sourceBlob.arrayBuffer(),
              sourceMimeType: sourceBlob.type || image.file.type || 'image/png',
              ...recipe,
            },
            t,
          );
          outputs.push({
            sourceImageId: image.id,
            fileName: buildOutputName(image.file.name, recipe.outputFormat, recipe.renamePattern, i),
            blob: result.blob,
            previewUrl: '',
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

        if (saveToDirectory && canUseDirectoryPicker()) {
          const directory = await (window as any).showDirectoryPicker();
          for (const output of outputs) {
            const handle = await directory.getFileHandle(output.fileName, { create: true });
            const writable = await handle.createWritable();
            await writable.write(output.blob);
            await writable.close();
          }
          setStatusMessage(t('optimizer.export.folderSuccess'));
          return;
        }

        const files: Record<string, Uint8Array> = {};
        for (const output of outputs) {
          files[output.fileName] = new Uint8Array(await output.blob.arrayBuffer());
        }
        const zipBlob = new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: 'application/zip' });
        triggerBlobDownload(zipBlob, `chapter-optimizer-${recipe.preset}.zip`);
        setStatusMessage(t('optimizer.export.zipSuccess'));
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : t('optimizer.error.failed'));
      } finally {
        setBusy(false);
        setBatchProgress(null);
      }
    },
    [images, recipe, registerDownloads, resolveSourceVariant, setStatusMessage, triggerBlobDownload, t],
  );

  const handleDownloadSingle = useCallback(
    (result: OptimizationResult) => {
      triggerBlobDownload(result.blob, result.fileName);
    },
    [triggerBlobDownload],
  );

  const totals = useMemo(() => {
    const original = results.reduce((sum, item) => sum + item.originalBytes, 0);
    const optimized = results.reduce((sum, item) => sum + item.optimizedBytes, 0);
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
      const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setComparePosition(pct);
    },
    [],
  );

  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => {
      const idx = ZOOM_LEVELS.findIndex((l) => l >= z);
      const next = ZOOM_LEVELS[idx + 1];
      return next ?? z;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => {
      const idx = ZOOM_LEVELS.findIndex((l) => l >= z);
      const prev = ZOOM_LEVELS[idx - 1];
      return idx > 0 ? (prev ?? z) : z;
    });
  }, []);

  const handleZoomReset = useCallback(() => setZoomLevel(1), []);

  const cycleRotation = useCallback(() => {
    setRecipe((current) => {
      const idx = ROTATION_OPTIONS.indexOf(current.rotation);
      const nextRot = ROTATION_OPTIONS[(idx < 0 ? 0 : idx + 1) % ROTATION_OPTIONS.length] ?? 0;
      const next = { ...current, rotation: nextRot };
      if (current.preset !== 'custom') {
        next.preset = 'custom';
        setSelectedPreset('custom');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!thumbStripRef.current || !activeImageId) return;
    const el = thumbStripRef.current.querySelector(`[data-thumb-id="${activeImageId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeImageId]);

  const presetKeys = Object.keys(PRESET_RECIPES) as OptimizationPreset[];
  const activeIdx = images.findIndex((img) => img.id === activeImageId);

  /* ══════════════════ Render — Manga Noir ══════════════════ */

  return (
    <motion.div
      variants={m.container}
      initial={m.initial}
      animate={m.animate}
      className="flex flex-col gap-4"
    >
      {/* ── Hero ── */}
      <motion.header variants={m.item} className="glass panel-cut relative overflow-hidden p-5">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-8 right-4 select-none font-display text-[110px] font-black leading-none"
        >
          最適
        </span>
        <div className="halftone-red pointer-events-none absolute inset-y-0 right-0 w-40 opacity-40" aria-hidden />

        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-md">
            <p className="kicker mb-2 flex items-center gap-2">
              <Sparkles size={11} aria-hidden />
              {'// '}
              {t('optimizer.hero.title')}
            </p>
            <h2 className="font-display text-2xl font-black uppercase leading-none tracking-tight text-paper">
              Chapter{' '}
              <em className="font-accent font-normal normal-case italic text-crimson">Optimizer</em>
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-paper/50">
              {t('optimizer.hero.desc')}
            </p>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-2">
            <div className="panel-cut-sm flex items-center gap-2 border border-paper/12 bg-ink/60 px-3 py-2">
              <FileImage size={11} className="text-crimson" aria-hidden />
              <span className="font-mono text-[13px] font-bold text-paper">{images.length}</span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                {t('optimizer.hero.pages')}
              </span>
            </div>
            <div className="panel-cut-sm flex items-center gap-2 border border-paper/12 bg-ink/60 px-3 py-2">
              <TrendingDown size={11} className="text-mint" aria-hidden />
              <span
                className="font-mono text-[13px] font-bold"
                style={results.length > 0 ? { color: savingsColor(totals.savingsPercent) } : { color: 'rgba(242,237,227,.35)' }}
              >
                {results.length > 0 ? `${totals.savingsPercent}%` : '—'}
              </span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                {t('optimizer.hero.savings')}
              </span>
            </div>
            <div className="panel-cut-sm flex items-center gap-2 border border-paper/12 bg-ink/60 px-3 py-2">
              <span className="font-mono text-[13px] font-bold text-paper">
                {results.length > 0 ? formatBytes(totals.savings) : '—'}
              </span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                {t('optimizer.hero.saved')}
              </span>
            </div>
            <div className="panel-cut-sm flex items-center gap-2 border border-crimson/40 bg-crimson/10 px-3 py-2">
              <span className="font-mono text-[13px] font-bold text-crimson">
                {recipe.outputFormat.toUpperCase()}
              </span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                {t('optimizer.hero.output')}
              </span>
            </div>
            {recipe.rotation !== 0 && (
              <div className="panel-cut-sm flex items-center gap-2 border border-gold/40 bg-gold/10 px-3 py-2">
                <RotateCw size={11} className="text-gold" aria-hidden />
                <span className="font-mono text-[13px] font-bold text-gold">{recipe.rotation}°</span>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                  {t('optimizer.config.rotation')}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* ── Layout ── */}
      <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ═══ Config column ═══ */}
        <motion.aside variants={m.item} className="flex flex-col gap-3">
          {/* 01 · Presets */}
          <NoirSection no="01" icon={Gauge} title={t('optimizer.panel.presets')} jp="プリセット">
            <div className="grid grid-cols-2 gap-2">
              {presetKeys.map((key) => {
                const meta = PRESET_META[key];
                const Icon = meta.icon;
                const active = selectedPreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updatePreset(key)}
                    className={`panel-cut-sm flex flex-col items-start gap-1 border p-2.5 text-left transition-all duration-150 ${active
                        ? 'border-crimson bg-crimson/10 -translate-x-0.5 -translate-y-0.5 drop-shadow-[4px_4px_0_rgba(255,200,87,0.85)]'
                        : 'border-paper/12 hover:border-paper/35'
                      }`}
                  >
                    <Icon size={13} className={active ? 'text-crimson' : 'text-paper/50'} aria-hidden />
                    <span className="font-display text-[11px] font-extrabold uppercase tracking-wide text-paper">
                      {t(`optimizer.presets.${key === 'web-light' ? 'webLight' : key}`)}
                    </span>
                    <span className="text-[9.5px] leading-snug text-paper/40">{t(meta.descKey)}</span>
                  </button>
                );
              })}
            </div>
          </NoirSection>

          {/* 02 · Output */}
          <NoirSection no="02" icon={ImageIcon} title={t('optimizer.panel.output')} jp="出力">
            <div className="flex flex-col gap-3.5">
              <NoirField as="div" label={t('optimizer.config.format')}>
                <Segmented
                  value={recipe.outputFormat}
                  onChange={(v) => updateRecipe('outputFormat', v as RawOutputFormat)}
                  options={[
                    { value: 'png', label: t('settings.downloadFormat.png') },
                    { value: 'jpeg', label: t('settings.downloadFormat.jpeg') },
                    { value: 'webp', label: t('settings.downloadFormat.webp') },
                  ]}
                />
              </NoirField>
              <NoirSlider
                label={t('optimizer.config.quality')}
                display={`${Math.round(recipe.quality * 100)}%`}
                min={30}
                max={100}
                value={Math.round(recipe.quality * 100)}
                onChange={(v) => updateRecipe('quality', v / 100)}
              />
            </div>
          </NoirSection>

          {/* 03 · Dimensions */}
          <NoirSection no="03" icon={ZoomIn} title={t('optimizer.panel.dimensions')} jp="寸法">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
              <NoirToggle checked={recipe.resizeEnabled} onChange={(v) => updateRecipe('resizeEnabled', v)}>
                {t('optimizer.config.resize')}
              </NoirToggle>
              <NoirToggle checked={recipe.trimBorders} onChange={(v) => updateRecipe('trimBorders', v)}>
                {t('optimizer.config.trimBorders')}
              </NoirToggle>

              <NoirField label={t('optimizer.config.maxWidth')}>
                <NoirInput
                  type="number"
                  min={320}
                  max={4000}
                  value={recipe.maxWidth}
                  disabled={!recipe.resizeEnabled}
                  onChange={(e) =>
                    updateRecipe('maxWidth', Math.max(320, Number(e.target.value) || recipe.maxWidth))
                  }
                />
              </NoirField>
              <NoirField label={t('optimizer.config.maxHeight')}>
                <NoirInput
                  type="number"
                  min={320}
                  max={6000}
                  value={recipe.maxHeight}
                  disabled={!recipe.resizeEnabled}
                  onChange={(e) =>
                    updateRecipe('maxHeight', Math.max(320, Number(e.target.value) || recipe.maxHeight))
                  }
                />
              </NoirField>

              {recipe.trimBorders && (
                <NoirSlider
                  className="col-span-2"
                  label={t('optimizer.config.trimTolerance')}
                  display={recipe.trimTolerance}
                  min={4}
                  max={60}
                  value={recipe.trimTolerance}
                  onChange={(v) => updateRecipe('trimTolerance', v)}
                />
              )}

              <NoirField
                as="div"
                className="col-span-2"
                label={t('optimizer.config.rotation')}
                value={`${recipe.rotation}°`}
              >
                <Segmented
                  value={recipe.rotation}
                  onChange={(v) => updateRecipe('rotation', v as OptimizationRecipe['rotation'])}
                  options={ROTATION_OPTIONS.map((deg) => ({
                    value: deg,
                    label: deg === 0 ? t('optimizer.config.rotationNone') : `${deg}°`,
                  }))}
                />
              </NoirField>
            </div>
          </NoirSection>

          {/* 04 · Filters (collapsible) */}
          <NoirSection
            no="04"
            icon={Wand2}
            title={t('optimizer.panel.filters')}
            jp="フィルター"
            collapsible
            open={filtersExpanded}
            onToggle={() => setFiltersExpanded((p) => !p)}
          >
            <div className="flex flex-col gap-3.5">
              <NoirSlider
                icon={SunMedium}
                label={t('optimizer.config.brightness')}
                display={`${recipe.brightness > 0 ? '+' : ''}${recipe.brightness}`}
                min={-50}
                max={50}
                value={recipe.brightness}
                onChange={(v) => updateRecipe('brightness', v)}
              />
              <NoirSlider
                icon={Contrast}
                label={t('optimizer.config.contrast')}
                display={`${recipe.contrast > 0 ? '+' : ''}${recipe.contrast}`}
                min={-50}
                max={50}
                value={recipe.contrast}
                onChange={(v) => updateRecipe('contrast', v)}
              />

              <NoirToggle icon={Contrast} checked={recipe.sharpen} onChange={(v) => updateRecipe('sharpen', v)}>
                {t('optimizer.config.sharpen')}
              </NoirToggle>
              {recipe.sharpen && (
                <NoirSlider
                  label={t('optimizer.config.sharpenStrength')}
                  display={recipe.sharpenStrength.toFixed(1)}
                  min={10}
                  max={200}
                  step={5}
                  value={Math.round(recipe.sharpenStrength * 100)}
                  onChange={(v) => updateRecipe('sharpenStrength', v / 100)}
                />
              )}

              <NoirToggle
                icon={Sparkles}
                checked={recipe.noiseReduction}
                onChange={(v) => updateRecipe('noiseReduction', v)}
              >
                {t('optimizer.config.noiseReduction')}
              </NoirToggle>
              {recipe.noiseReduction && (
                <NoirSlider
                  label={t('optimizer.config.noiseReductionStrength')}
                  display={recipe.noiseReductionStrength.toFixed(1)}
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(recipe.noiseReductionStrength * 100)}
                  onChange={(v) => updateRecipe('noiseReductionStrength', v / 100)}
                />
              )}

              <NoirToggle icon={Palette} checked={recipe.grayscale} onChange={(v) => updateRecipe('grayscale', v)}>
                {t('optimizer.config.grayscale')}
              </NoirToggle>
              <NoirToggle icon={SunMedium} checked={recipe.autoLevels} onChange={(v) => updateRecipe('autoLevels', v)}>
                {t('optimizer.config.autoLevels')}
              </NoirToggle>
            </div>
          </NoirSection>

          {/* 05 · Advanced (collapsible) */}
          <NoirSection
            no="05"
            icon={Settings2}
            title={t('optimizer.panel.advanced')}
            jp="上級"
            collapsible
            open={advancedExpanded}
            onToggle={() => setAdvancedExpanded((p) => !p)}
          >
            <NoirField
              label={
                <>
                  <Type size={11} aria-hidden />
                  {t('optimizer.config.renamePattern')}
                </>
              }
            >
              <NoirInput
                type="text"
                value={recipe.renamePattern}
                placeholder="{name}"
                onChange={(e) => updateRecipe('renamePattern', e.target.value)}
              />
            </NoirField>
            <p className="mt-2 font-mono text-[9.5px] leading-relaxed text-paper/35">
              {t('optimizer.config.renameHint')}
            </p>
          </NoirSection>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={busy || !images.length}
              onClick={() => void handleOptimizeAll(false)}
            >
              {busy ? (
                <>
                  <span className="noir-spinner" aria-hidden />
                  {batchProgress
                    ? `${batchProgress.current}/${batchProgress.total}`
                    : t('optimizer.action.optimizing')}
                </>
              ) : (
                <>
                  <Download size={12} /> ZIP
                </>
              )}
            </button>
            {canUseDirectoryPicker() && (
              <button
                type="button"
                className="btn-ghost flex-1 justify-center"
                disabled={busy || !images.length}
                onClick={() => void handleOptimizeAll(true)}
              >
                <FolderOutput size={12} /> {t('optimizer.action.folder')}
              </button>
            )}
          </div>

          {/* Batch progress */}
          {batchProgress && (
            <div>
              <div className="panel-cut-sm h-2.5 w-full border border-paper/15 bg-ink p-px">
                <div
                  className="noir-progress-fill h-full transition-[width] duration-300 ease-out"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
              <span className="mt-1.5 block font-mono text-[9.5px] uppercase tracking-[0.2em] text-paper/45">
                {t('optimizer.action.optimizing')} — {batchProgress.current}/{batchProgress.total}
              </span>
            </div>
          )}
        </motion.aside>

        {/* ═══ Preview column ═══ */}
        <motion.section variants={m.item} className="glass panel-cut flex min-w-0 flex-col p-4">
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-paper/10 pb-3">
            <span className="panel-cut-sm grid h-6 w-6 flex-none place-items-center bg-crimson text-ink">
              <Eye size={12} strokeWidth={2.5} />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/75">
              {t('optimizer.panel.preview')}
            </span>
            {activeIdx >= 0 && (
              <span className="font-mono text-[10px] text-crimson">
                {activeIdx + 1}
                <span className="text-paper/30">/{images.length}</span>
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {previewUrl && originalPreviewUrl && (
                <button
                  type="button"
                  aria-pressed={showCompare}
                  onClick={() => setShowCompare((p) => !p)}
                  title={t('optimizer.preview.compare')}
                  className={`panel-cut-sm flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] transition-all ${showCompare
                      ? 'bg-crimson font-bold text-ink drop-shadow-[2px_2px_0_#ffc857]'
                      : 'border border-paper/15 text-paper/55 hover:border-paper/40 hover:text-paper'
                    }`}
                >
                  <Scissors size={10} />
                  {t('optimizer.preview.compare')}
                </button>
              )}
              <button
                type="button"
                className="noir-icon-btn"
                onClick={cycleRotation}
                title={t('optimizer.config.rotation')}
              >
                <RotateCw size={12} />
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="noir-icon-btn"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= (ZOOM_LEVELS[0] ?? 0)}
                >
                  <Minus size={11} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  title="Reset zoom"
                  className="min-w-[44px] px-1 font-mono text-[10px] text-paper/60 transition-colors hover:text-crimson"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  className="noir-icon-btn"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= (ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? 0)}
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>
          </div>

          {activeImage ? (
            <>
              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div ref={thumbStripRef} className="noir-scroll mb-3 flex gap-2 overflow-x-auto pb-1.5">
                  {images.map((img, idx) => {
                    const active = img.id === activeImage.id;
                    return (
                      <button
                        key={img.id}
                        type="button"
                        data-thumb-id={img.id}
                        onClick={() => setActiveImageId(img.id)}
                        title={img.file.name}
                        className={`panel-cut-sm relative h-16 w-12 flex-none overflow-hidden border transition-all duration-150 ${active
                            ? 'border-crimson -translate-y-0.5 drop-shadow-[3px_3px_0_rgba(255,46,99,0.5)]'
                            : 'border-paper/12 opacity-55 hover:opacity-100'
                          }`}
                      >
                        <img src={img.url} alt={img.file.name} className="h-full w-full object-cover" loading="lazy" />
                        <span className="absolute bottom-0 right-0 bg-ink/90 px-1 font-mono text-[8px] text-paper/70">
                          {idx + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Preview area */}
              <div className="noir-scroll halftone relative flex min-h-[320px] flex-1 items-center justify-center overflow-auto border border-paper/10 bg-ink/70 p-3">
                {previewLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-ink/70 backdrop-blur-sm">
                    <RefreshCw size={16} className="animate-spin text-crimson" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60">
                      {t('optimizer.preview.generating')}
                    </span>
                  </div>
                )}

                {showCompare && previewUrl && originalPreviewUrl ? (
                  <div
                    ref={compareRef}
                    className="relative max-w-full cursor-ew-resize select-none"
                    onMouseMove={handleCompareMove}
                    onTouchMove={handleCompareMove}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                  >
                    <img
                      src={originalPreviewUrl}
                      alt={t('optimizer.preview.before')}
                      className="block max-h-[60vh] w-auto max-w-full"
                      draggable={false}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                    >
                      <img
                        src={previewUrl}
                        alt={t('optimizer.preview.after')}
                        className="block h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                    {/* Divider */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-crimson"
                      style={{ left: `${comparePosition}%` }}
                      aria-hidden
                    >
                      <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-ink bg-gold" />
                    </div>
                    <span className="absolute left-2 top-2">
                      <Stamp tone="gold">{t('optimizer.preview.original')}</Stamp>
                    </span>
                    <span className="absolute right-2 top-2">
                      <Stamp tone="mint">{t('optimizer.preview.optimized')}</Stamp>
                    </span>
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={activeImage.file.name}
                    className="block max-h-[60vh] w-auto max-w-full"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    draggable={false}
                  />
                ) : !previewLoading ? (
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-paper/35">
                    {t('optimizer.preview.generating')}
                  </span>
                ) : null}
              </div>

              {/* Stats bar */}
              {previewStats && (
                <div className="mt-3 grid grid-cols-2 gap-px border border-paper/10 bg-paper/10 sm:grid-cols-4">
                  <div className="flex flex-col gap-0.5 bg-ink-2 px-3 py-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                      {t('optimizer.preview.before')}
                    </span>
                    <span className="font-mono text-[12px] font-bold text-paper">
                      {formatBytes(previewStats.originalBytes)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 bg-ink-2 px-3 py-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                      {t('optimizer.preview.after')}
                    </span>
                    <span className="font-mono text-[12px] font-bold text-paper">
                      {formatBytes(previewStats.optimizedBytes)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 bg-ink-2 px-3 py-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                      {t('optimizer.preview.reduction')}
                    </span>
                    <span
                      className="font-mono text-[12px] font-bold"
                      style={{
                        color: savingsColor(
                          savingsPercent(previewStats.originalBytes, previewStats.optimizedBytes),
                        ),
                      }}
                    >
                      -{savingsPercent(previewStats.originalBytes, previewStats.optimizedBytes)}%
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 bg-ink-2 px-3 py-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-paper/40">
                      {t('optimizer.preview.dimensions')}
                    </span>
                    <span className="font-mono text-[12px] font-bold text-paper">
                      {previewStats.width}×{previewStats.height}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 border border-dashed border-paper/15 py-16 text-paper/35">
              <ImageIcon size={28} strokeWidth={1.2} />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em]">
                {t('optimizer.preview.empty')}
              </span>
            </div>
          )}
        </motion.section>
      </div>

      {/* ── Results ── */}
      <motion.section variants={m.item} className="glass panel-cut relative overflow-hidden p-4">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-4 right-4 select-none font-display text-6xl font-black leading-none"
        >
          結果
        </span>

        <div className="relative mb-4 flex flex-wrap items-center gap-2.5">
          <span className="panel-cut-sm grid h-6 w-6 flex-none place-items-center bg-crimson text-ink">
            <Layers3 size={12} strokeWidth={2.5} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/75">
            {t('optimizer.results.title')}
            {results.length > 0 && <span className="ml-1.5 text-crimson">({results.length})</span>}
          </span>

          {results.length > 0 && (
            <span className="ml-auto flex items-center gap-2 font-mono text-[10.5px] text-paper/55">
              {formatBytes(totals.original)} → {formatBytes(totals.optimized)}
              <span
                className="panel-cut-sm px-2 py-0.5 font-bold text-ink"
                style={{ background: savingsColor(totals.savingsPercent) }}
              >
                -{totals.savingsPercent}%
              </span>
            </span>
          )}
        </div>

        {results.length > 0 ? (
          <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((r) => {
              const pct = savingsPercent(r.originalBytes, r.optimizedBytes);
              return (
                <div
                  key={r.sourceImageId}
                  className="panel-cut-sm group border border-paper/10 bg-ink/60 p-3 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-paper/25 hover:drop-shadow-[3px_3px_0_rgba(255,200,87,0.35)]"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <strong className="truncate font-mono text-[10.5px] font-bold text-paper">
                      {r.fileName}
                    </strong>
                    <button
                      type="button"
                      className="noir-icon-btn flex-none"
                      onClick={() => handleDownloadSingle(r)}
                      title={t('optimizer.results.download')}
                    >
                      <ArrowDownToLine size={11} />
                    </button>
                  </div>
                  <div className="mb-2 flex items-center justify-between font-mono text-[9.5px] text-paper/45">
                    <span>
                      {formatBytes(r.originalBytes)} → {formatBytes(r.optimizedBytes)}
                    </span>
                    <span>
                      {r.width}×{r.height}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-paper/8">
                    <div
                      className="h-full transition-[width] duration-500"
                      style={{ width: `${100 - pct}%`, background: savingsColor(pct) }}
                    />
                  </div>
                  <span className="mt-1.5 block font-mono text-[9.5px] font-bold" style={{ color: savingsColor(pct) }}>
                    -{pct}% ({formatBytes(Math.max(0, r.originalBytes - r.optimizedBytes))})
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative flex flex-col items-center justify-center gap-2 border border-dashed border-paper/15 py-9 text-paper/35">
            <Sparkles size={18} strokeWidth={1.2} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
              {t('optimizer.results.empty')}
            </span>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
