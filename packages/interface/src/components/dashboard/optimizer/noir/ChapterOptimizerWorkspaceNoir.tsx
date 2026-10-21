'use client';

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowDownToLine,
  ChevronDown,
  Contrast,
  Download,
  Eye,
  FileImage,
  FolderOutput,
  Gauge,
  Globe,
  Image as ImageIcon,
  Layers3,
  Minus,
  MonitorSmartphone,
  Palette,
  Plus,
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
  type LucideIcon,
} from 'lucide-react';
import { zipSync } from 'fflate';

import type {
  OptimizationPreset,
  OptimizationRecipe,
  OptimizationResult,
  RawOutputFormat,
} from '../../../../types';
import { useI18n } from '../../../../i18n';
import { useLatestCallback } from '../../../../utils/shallowStable';

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
  onWorkspaceStateChange?: (
    state: ChapterOptimizerWorkspaceState,
  ) => void;
  images: OptimizerImageInput[];
  sourceVariants: OptimizerSourceVariant[];
  registerDownloads: (
    items: Array<{
      fileName: string;
      blob: Blob;
      sourceImageId: string;
    }>,
    scope: 'optimizer',
  ) => void;
  triggerBlobDownload: (
    blob: Blob,
    fileName: string,
  ) => void;
  setStatusMessage: (message: string) => void;
}

// usa o State do koma (recipe Partial — persistido do clássico)
type ChapterOptimizerWorkspaceState = import('../ChapterOptimizerWorkspace.types').ChapterOptimizerWorkspaceState;

interface WritableLike {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}

interface FileHandleLike {
  createWritable: () => Promise<WritableLike>;
}

interface DirectoryHandleLike {
  getFileHandle: (
    fileName: string,
    options: { create: boolean },
  ) => Promise<FileHandleLike>;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
};

const STORAGE_KEY =
  'koma-studio.chapter-optimizer.recipe.v2';

const EASE = [0.22, 1, 0.36, 1] as const;

const DEFAULT_NEW_FIELDS = {
  brightness: 0,
  contrast: 0,
  noiseReduction: false,
  noiseReductionStrength: 0.5,
  rotation: 0 as const,
  renamePattern: '{name}',
};

const PRESET_RECIPES: Record<
  OptimizationPreset,
  OptimizationRecipe
> = {
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

const PRESET_META: Record<
  OptimizationPreset,
  {
    icon: LucideIcon;
    descKey: string;
  }
> = {
  'web-light': {
    icon: Globe,
    descKey: 'optimizer.presets.webLight.desc',
  },
  reading: {
    icon: Eye,
    descKey: 'optimizer.presets.reading.desc',
  },
  archive: {
    icon: Layers3,
    descKey: 'optimizer.presets.archive.desc',
  },
  social: {
    icon: MonitorSmartphone,
    descKey: 'optimizer.presets.social.desc',
  },
  custom: {
    icon: Settings2,
    descKey: 'optimizer.presets.custom.desc',
  },
};

type OptimizerPersistedRecipe = Omit<Partial<OptimizationRecipe>, 'preset' | 'sharpen'> & {
  preset?: OptimizationPreset | 'manga';
  sharpen?: boolean | number;
};

const normalizeRecipe = (
  input?: OptimizerPersistedRecipe | null,
): OptimizationRecipe => {
  const preset =
    input?.preset && input.preset in PRESET_RECIPES && input.preset !== 'manga'
      ? (input.preset as OptimizationPreset)
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
  } as OptimizationRecipe;
};

const ROTATION_OPTIONS = [0, 90, 180, 270] as const;

const ZOOM_LEVELS = [
  0.25,
  0.5,
  0.75,
  1,
  1.25,
  1.5,
  2,
  3,
];

const getExtension = (
  format: RawOutputFormat,
): string => (format === 'jpeg' ? 'jpg' : format);

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
  const extension = getExtension(format);
  const paddedIndex = String(index + 1).padStart(3, '0');

  const resolved = pattern
    .replace(/\{name\}/g, stem)
    .replace(/\{index\}/g, paddedIndex)
    .replace(/\{ext\}/g, extension);

  return `${resolved.trim() || stem}.${extension}`;
};

const savingsPercent = (
  original: number,
  optimized: number,
): number => {
  if (original <= 0) return 0;

  return Math.round(
    ((original - optimized) / original) * 100,
  );
};

const savingsColor = (percentage: number): string => {
  if (percentage >= 60) return 'var(--color-mint)';
  if (percentage >= 30) return 'var(--color-azure)';
  if (percentage > 0) return 'var(--color-gold)';

  return 'rgb(242 237 227 / 0.42)';
};

const formatDelta = (percentage: number): string => {
  if (percentage >= 0) return `-${percentage}%`;
  return `+${Math.abs(percentage)}%`;
};

type WorkerSuccess = {
  blob: Blob;
  width: number;
  height: number;
};

const runOptimizerJob = (
  payload: {
    sourceBuffer: ArrayBuffer;
    sourceMimeType: string;
  } & OptimizationRecipe,
  t: (key: any) => string,
): Promise<WorkerSuccess> => {
  if (typeof Worker === 'undefined') {
    return Promise.reject(
      new Error(t('optimizer.error.worker')),
    );
  }

  const worker = new Worker(
    new URL('../optimizerWorker.ts', import.meta.url),
    {
      type: 'module',
    },
  );

  const requestId = `optimizer-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

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
        reject(
          new Error(
            event.data.error ||
            t('optimizer.error.failed'),
          ),
        );
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

      reject(
        new Error(t('optimizer.error.worker')),
      );
    };

    worker.postMessage({
      id: requestId,
      ...payload,
    });
  });
};

/* ───────────────────── UI primitives ───────────────────── */

interface ControlSectionProps {
  index: string;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}

function ControlSection({
  index,
  icon: Icon,
  title,
  children,
  expanded = true,
  onToggle,
}: ControlSectionProps) {
  const contentId = useId();
  const reduceMotion = useReducedMotion();

  const header = (
    <>
      <span
        className="text-outline font-display font-black text-[58px] leading-none select-none pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-[0.12]"
        aria-hidden="true"
      >
        {index}
      </span>

      <span
        className="relative grid size-8 shrink-0 place-items-center border border-crimson/30 bg-crimson/10 text-crimson panel-cut-sm"
        aria-hidden="true"
      >
        <Icon size={13} />
      </span>

      <span className="relative min-w-0 flex-1 text-left">
        <span className="kicker block text-[0.58rem]">
          // {index}
        </span>

        <span className="mt-1 block font-display text-sm font-black uppercase tracking-[-0.025em] text-paper">
          {title}
        </span>
      </span>

      {onToggle ? (
        <span
          className={[
            'relative grid size-7 place-items-center border border-paper/10',
            'bg-paper/[0.035] text-paper/45 panel-cut-sm',
            'transition-transform duration-300',
            expanded ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden="true"
        >
          <ChevronDown size={13} />
        </span>
      ) : null}
    </>
  );

  return (
    <section className="border-b border-paper/[0.065] last:border-b-0">
      {onToggle ? (
        <button
          type="button"
          className="panel-cut-sm relative flex w-full items-center gap-3 px-4 py-4 hover:bg-paper/[0.025]"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggle}
        >
          {header}
        </button>
      ) : (
        <div className="relative flex items-center gap-3 px-4 py-4">
          {header}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={contentId}
            initial={
              reduceMotion
                ? false
                : {
                  height: 0,
                  opacity: 0,
                }
            }
            animate={{
              height: 'auto',
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              ease: EASE,
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: LucideIcon;
}

function ToggleControl({
  label,
  checked,
  onChange,
  icon: Icon,
}: ToggleControlProps) {
  return (
    <label className="panel-cut-sm flex min-h-12 cursor-pointer items-center gap-3 border border-paper/10 bg-ink/45 px-3 py-2.5 transition-colors hover:border-paper/20 hover:bg-paper/[0.035] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-crimson">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />

      <span
        className={[
          'relative h-5 w-9 shrink-0 border transition-colors panel-cut-sm',
          checked
            ? 'border-crimson bg-crimson/20'
            : 'border-paper/15 bg-ink-2',
        ].join(' ')}
        aria-hidden="true"
      >
        <motion.span
          layout
          transition={{ ease: EASE, duration: 0.2 }}
          className={[
            'absolute top-0.5 size-3.5 transition-colors',
            checked
              ? 'left-[18px] bg-crimson'
              : 'left-0.5 bg-paper/50',
          ].join(' ')}
        />
      </span>

      <span className="flex min-w-0 items-center gap-2 font-mono text-[0.67rem] font-bold uppercase tracking-[0.08em] text-paper/58">
        {Icon ? (
          <Icon
            size={13}
            className={
              checked ? 'text-crimson' : 'text-paper/35'
            }
            aria-hidden="true"
          />
        ) : null}

        {label}
      </span>
    </label>
  );
}

interface RangeControlProps {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  icon?: LucideIcon;
}

function RangeControl({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
  icon: Icon,
}: RangeControlProps) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/48">
          {Icon ? (
            <Icon
              size={13}
              className="text-crimson"
              aria-hidden="true"
            />
          ) : null}
          {label}
        </span>

        <output className="stamp !px-2 !py-1 !text-[0.58rem]">
          {valueLabel}
        </output>
      </span>

      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        className={[
          'w-full h-1 appearance-none bg-paper/15 cursor-pointer',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
          '[&::-webkit-slider-thumb]:bg-crimson [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:cursor-pointer',
          '[&::-webkit-slider-thumb]:shadow-[2px_2px_0_0_rgba(255,200,87,0.4)]',
          '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-crimson [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer',
        ].join(' ')}
      />
    </label>
  );
}

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
  const reduceMotion = useReducedMotion();

  const [recipe, setRecipe] =
    useState<OptimizationRecipe>(() => {
      if (workspaceState?.recipe) {
        return normalizeRecipe(
          workspaceState.recipe as OptimizerPersistedRecipe,
        );
      }

      if (typeof window === 'undefined') {
        return PRESET_RECIPES['web-light'];
      }

      try {
        const savedRecipe =
          window.localStorage.getItem(STORAGE_KEY);

        return savedRecipe
          ? {
            ...PRESET_RECIPES['web-light'],
            ...(JSON.parse(
              savedRecipe,
            ) as Partial<OptimizationRecipe>),
          }
          : PRESET_RECIPES['web-light'];
      } catch {
        return PRESET_RECIPES['web-light'];
      }
    });

  const [selectedPreset, setSelectedPreset] =
    useState<OptimizationPreset>(
      workspaceState?.selectedPreset ??
      recipe.preset,
    );

  const [activeImageId, setActiveImageId] =
    useState<string | null>(
      workspaceState?.activeImageId ??
      images[0]?.id ??
      null,
    );

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [originalPreviewUrl, setOriginalPreviewUrl] =
    useState<string | null>(null);

  const [previewStats, setPreviewStats] =
    useState<{
      originalBytes: number;
      optimizedBytes: number;
      width: number;
      height: number;
    } | null>(null);

  const [results, setResults] = useState<
    OptimizationResult[]
  >(() => workspaceState?.results ?? []);

  const [busy, setBusy] = useState(false);

  const [batchProgress, setBatchProgress] =
    useState<{
      current: number;
      total: number;
    } | null>(null);

  const [showCompare, setShowCompare] =
    useState(false);

  const [comparePosition, setComparePosition] =
    useState(50);

  const [filtersExpanded, setFiltersExpanded] =
    useState(false);

  const [advancedExpanded, setAdvancedExpanded] =
    useState(false);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [zoomLevel, setZoomLevel] = useState(1);

  const [
    directoryPickerAvailable,
    setDirectoryPickerAvailable,
  ] = useState(false);

  const previewTicketRef = useRef(0);

  const previewDebounceRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const thumbStripRef =
    useRef<HTMLDivElement | null>(null);

  const formatBytes = useCallback(
    (value: number): string => {
      if (value < 1024) {
        return `${value} ${t('update.units.bytes')}`;
      }

      if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} ${t(
          'update.units.kilobytes',
        )}`;
      }

      return `${(value / (1024 * 1024)).toFixed(
        2,
      )} ${t('update.units.megabytes')}`;
    },
    [t],
  );

  const variantsByImage = useMemo(() => {
    const map = new Map<
      string,
      OptimizerSourceVariant[]
    >();

    images.forEach((image) => {
      map.set(
        image.id,
        sourceVariants.filter(
          (variant) =>
            variant.imageId === image.id,
        ),
      );
    });

    return map;
  }, [images, sourceVariants]);

  const activeImage = useMemo(
    () =>
      images.find(
        (image) => image.id === activeImageId,
      ) ??
      images[0] ??
      null,
    [activeImageId, images],
  );

  const resolveSourceVariant = useCallback(
    (
      imageId: string,
    ): OptimizerSourceVariant | null => {
      const variants =
        variantsByImage.get(imageId) ?? [];

      const priority = (scope: string): number => {
        if (scope === 'typesetter') return 0;
        if (scope === 'cleaner') return 1;
        if (scope === 'aio') return 2;
        if (scope === 'enhance') return 3;
        return 10;
      };

      return (
        [...variants].sort(
          (left, right) =>
            priority(left.scope) -
            priority(right.scope),
        )[0] ?? null
      );
    },
    [variantsByImage],
  );

  const activeSourceBlob = useMemo(() => {
    if (!activeImage) return null;

    return (
      resolveSourceVariant(activeImage.id)?.blob ??
      activeImage.file
    );
  }, [activeImage, resolveSourceVariant]);

  useEffect(() => {
    const imageStillExists = images.some(
      (image) => image.id === activeImageId,
    );

    if (!imageStillExists) {
      setActiveImageId(images[0]?.id ?? null);
    }
  }, [activeImageId, images]);


  const [prevRestoreToken, setPrevRestoreToken] = useState(restoreToken);
  if (prevRestoreToken !== restoreToken) {
    setPrevRestoreToken(restoreToken);
    if (workspaceState) {
      setRecipe(
        normalizeRecipe(
          workspaceState.recipe as OptimizerPersistedRecipe,
        ),
      );
      setSelectedPreset(workspaceState.selectedPreset);
      setActiveImageId(workspaceState.activeImageId);
      setResults(workspaceState.results);
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(recipe),
      );
    } catch {
      // Storage can fail in restricted browser modes.
    }
  }, [recipe]);

  const pushWorkspaceState = useLatestCallback(() => {
    onWorkspaceStateChange?.({
      recipe,
      selectedPreset,
      activeImageId,
      results,
    });
  });

  useEffect(() => {
    if (!onWorkspaceStateChange) return;

    // Debounce push-up (300ms) so slider ticks don't thrash the parent.
    const timer = window.setTimeout(() => {
      pushWorkspaceState();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    activeImageId,
    onWorkspaceStateChange,
    recipe,
    results,
    selectedPreset,
    pushWorkspaceState,
  ]);

  useEffect(() => {
    setDirectoryPickerAvailable(
      typeof window !== 'undefined' &&
      typeof (
        window as DirectoryPickerWindow
      ).showDirectoryPicker === 'function',
    );
  }, []);

  useEffect(() => {
    if (!activeSourceBlob) {
      setOriginalPreviewUrl(null);
      return;
    }

    const nextUrl =
      URL.createObjectURL(activeSourceBlob);

    setOriginalPreviewUrl(nextUrl);
    setPreviewStats(null);
    setComparePosition(50);
    setZoomLevel(1);
  }, [activeSourceBlob]);

  useEffect(
    () => () => {
      if (originalPreviewUrl) {
        URL.revokeObjectURL(
          originalPreviewUrl,
        );
      }
    },
    [originalPreviewUrl],
  );

  useEffect(() => {
    if (!activeImage || !activeSourceBlob) {
      setPreviewLoading(false);
      setPreviewUrl(null);
      return;
    }

    setPreviewLoading(true);

    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }

    const currentTicket =
      ++previewTicketRef.current;

    let jobCancelled = false;

    previewDebounceRef.current = setTimeout(() => {
      void activeSourceBlob
        .arrayBuffer()
        .then((buffer) =>
          runOptimizerJob(
            {
              sourceBuffer: buffer,
              sourceMimeType:
                activeSourceBlob.type ||
                activeImage.file.type ||
                'image/png',
              ...recipe,
            },
            t,
          ),
        )
        .then((result) => {
          if (
            jobCancelled ||
            currentTicket !==
            previewTicketRef.current
          ) {
            return;
          }

          const nextUrl =
            URL.createObjectURL(result.blob);

          setPreviewUrl(nextUrl);

          setPreviewStats({
            originalBytes:
              activeSourceBlob.size,
            optimizedBytes: result.blob.size,
            width: result.width,
            height: result.height,
          });

          setPreviewLoading(false);
        })
        .catch((error) => {
          if (jobCancelled) return;

          setPreviewLoading(false);

          setStatusMessage(
            error instanceof Error
              ? error.message
              : t('optimizer.error.preview'),
          );
        });
    }, 280);

    return () => {
      jobCancelled = true;

      if (previewDebounceRef.current) {
        clearTimeout(
          previewDebounceRef.current,
        );
        previewDebounceRef.current = null;
      }
    };
  }, [
    activeImage,
    activeSourceBlob,
    recipe,
    setStatusMessage,
    t,
  ]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  useEffect(() => {
    if (
      !thumbStripRef.current ||
      !activeImageId
    ) {
      return;
    }

    const activeThumbnail =
      thumbStripRef.current.querySelector<HTMLElement>(
        `[data-thumb-id="${activeImageId}"]`,
      );

    activeThumbnail?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeImageId, reduceMotion]);

  const updatePreset = useCallback(
    (preset: OptimizationPreset) => {
      setSelectedPreset(preset);
      setRecipe(PRESET_RECIPES[preset]);
    },
    [],
  );

  const updateRecipe = useCallback(
    <Key extends keyof OptimizationRecipe>(
      key: Key,
      value: OptimizationRecipe[Key],
    ) => {
      setRecipe((currentRecipe) => {
        const nextRecipe = {
          ...currentRecipe,
          [key]: value,
        };

        if (
          currentRecipe.preset !== 'custom' &&
          key !== 'preset'
        ) {
          nextRecipe.preset = 'custom';
          setSelectedPreset('custom');
        }

        return nextRecipe;
      });
    },
    [],
  );

  const handleOptimizeAll = useCallback(
    async (saveToDirectory: boolean) => {
      if (images.length === 0) return;

      setBusy(true);

      setBatchProgress({
        current: 0,
        total: images.length,
      });

      try {
        const outputs: OptimizationResult[] = [];

        for (
          let index = 0;
          index < images.length;
          index += 1
        ) {
          const image = images[index];
          if (!image) continue;
          const sourceVariant =
            resolveSourceVariant(image.id);

          const sourceBlob =
            sourceVariant?.blob ?? image.file;

          const result = await runOptimizerJob(
            {
              sourceBuffer:
                await sourceBlob.arrayBuffer(),
              sourceMimeType:
                sourceBlob.type ||
                image.file.type ||
                'image/png',
              ...recipe,
            },
            t,
          );

          outputs.push({
            sourceImageId: image.id,
            fileName: buildOutputName(
              image.file.name,
              recipe.outputFormat,
              recipe.renamePattern,
              index,
            ),
            blob: result.blob,
            originalBytes: sourceBlob.size,
            optimizedBytes: result.blob.size,
            width: result.width,
            height: result.height,
          });

          setBatchProgress({
            current: index + 1,
            total: images.length,
          });
        }

        setResults(outputs);

        registerDownloads(
          outputs.map((output) => ({
            fileName: output.fileName,
            blob: output.blob,
            sourceImageId:
              output.sourceImageId,
          })),
          'optimizer',
        );

        const pickerWindow =
          window as DirectoryPickerWindow;

        if (
          saveToDirectory &&
          pickerWindow.showDirectoryPicker
        ) {
          const directory =
            await pickerWindow.showDirectoryPicker();

          for (const output of outputs) {
            const fileHandle =
              await directory.getFileHandle(
                output.fileName,
                {
                  create: true,
                },
              );

            const writable =
              await fileHandle.createWritable();

            await writable.write(output.blob);
            await writable.close();
          }

          setStatusMessage(
            t('optimizer.export.folderSuccess'),
          );

          return;
        }

        const files: Record<
          string,
          Uint8Array
        > = {};

        for (const output of outputs) {
          files[output.fileName] =
            new Uint8Array(
              await output.blob.arrayBuffer(),
            );
        }

        const zipData = zipSync(files, {
          level: 6,
        });

        const zipBlob = new Blob(
          [zipData as BlobPart],
          {
            type: 'application/zip',
          },
        );

        triggerBlobDownload(
          zipBlob,
          `chapter-optimizer-${recipe.preset}.zip`,
        );

        setStatusMessage(
          t('optimizer.export.zipSuccess'),
        );
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
      t,
      triggerBlobDownload,
    ],
  );

  const handleDownloadSingle = useCallback(
    (result: OptimizationResult) => {
      triggerBlobDownload(
        result.blob,
        result.fileName,
      );
    },
    [triggerBlobDownload],
  );

  const handleZoomIn = useCallback(() => {
    setZoomLevel((currentZoom) => {
      const currentIndex = ZOOM_LEVELS.findIndex(
        (level) => level >= currentZoom,
      );

      return currentIndex <
        ZOOM_LEVELS.length - 1
        ? (ZOOM_LEVELS[currentIndex + 1] ?? currentZoom)
        : currentZoom;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((currentZoom) => {
      const currentIndex = ZOOM_LEVELS.findIndex(
        (level) => level >= currentZoom,
      );

      return currentIndex > 0
        ? (ZOOM_LEVELS[currentIndex - 1] ?? currentZoom)
        : currentZoom;
    });
  }, []);

  const cycleRotation = useCallback(() => {
    setRecipe((currentRecipe) => {
      const currentIndex =
        ROTATION_OPTIONS.indexOf(
          currentRecipe.rotation,
        );

      const nextRotation =
        ROTATION_OPTIONS[
        (currentIndex < 0 ? 0 : currentIndex + 1) %
        ROTATION_OPTIONS.length
        ] ?? 0;

      const nextRecipe = {
        ...currentRecipe,
        rotation: nextRotation,
      };

      if (
        currentRecipe.preset !== 'custom'
      ) {
        nextRecipe.preset = 'custom';
        setSelectedPreset('custom');
      }

      return nextRecipe;
    });
  }, []);

  const totals = useMemo(() => {
    const original = results.reduce(
      (sum, item) =>
        sum + item.originalBytes,
      0,
    );

    const optimized = results.reduce(
      (sum, item) =>
        sum + item.optimizedBytes,
      0,
    );

    return {
      original,
      optimized,
      savings: Math.max(
        0,
        original - optimized,
      ),
      savingsPercent: savingsPercent(
        original,
        optimized,
      ),
    };
  }, [results]);

  const presetKeys = Object.keys(
    PRESET_RECIPES,
  ) as OptimizationPreset[];

  const activeImageIndex = images.findIndex(
    (image) => image.id === activeImageId,
  );

  const listVariants = useMemo(
    () => ({
      hidden: {},
      visible: {
        transition: {
          staggerChildren: reduceMotion ? 0 : 0.055,
        },
      },
    }),
    [reduceMotion],
  );

  const cardVariants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        y: 14,
      },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.42,
          ease: EASE,
        },
      },
    }),
    [reduceMotion],
  );

  return (
    <section
      className="relative isolate space-y-5"
      aria-labelledby="optimizer-v2-title"
      data-coauthor="OpenAI ChatGPT; model ID from API response.model"
    >
      {/* Hero */}
      <motion.header
        initial={
          reduceMotion
            ? false
            : {
              opacity: 0,
              y: 22,
              clipPath: 'inset(0 0 100% 0)',
            }
        }
        animate={{
          opacity: 1,
          y: 0,
          clipPath: 'inset(0 0 0% 0)',
        }}
        transition={{
          duration: reduceMotion ? 0 : 0.68,
          ease: EASE,
        }}
        className="glass panel-cut manga-grid-bg relative overflow-hidden p-5 sm:p-7"
      >
        <div className="halftone-red absolute inset-0 opacity-40" aria-hidden />
        <span aria-hidden className="v-text absolute right-4 top-3 text-crimson/60  font-accent italic text-2xl leading-none select-none">最適化</span>
        <div
          className="absolute -right-8 -top-8 h-40 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,46,99,0.35), transparent)' }}
          aria-hidden
        />

        <span
          className="text-outline pointer-events-none absolute right-8 top-0 font-display text-[7rem] font-black leading-none"
          aria-hidden="true"
        >
          02
        </span>

        <div
          className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-2/5 bg-crimson"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="stamp">
                <span
                  className="koma-blink size-1.5 bg-crimson"
                  aria-hidden="true"
                />
                Export press / V2
              </span>

              <span className="kicker text-paper/35">
                KOMA // Chapter lab
              </span>
            </div>

            <h1
              id="optimizer-v2-title"
              className="font-display text-3xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-paper sm:text-5xl lg:text-6xl"
            >
              {t('optimizer.hero.title')}
              <span
                className="font-accent font-normal italic text-crimson"
                aria-hidden="true"
              >
                {' '}
                press
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-paper/48">
              {t('optimizer.hero.desc')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden border border-paper/10 bg-paper/10 panel-cut-sm sm:grid-cols-4">
            <div className="min-w-28 bg-ink-2/95 p-3">
              <FileImage
                size={14}
                className="mb-2 text-crimson"
                aria-hidden="true"
              />
              <strong className="block font-display text-xl font-black text-paper">
                {images.length}
              </strong>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
                {t('optimizer.hero.pages')}
              </span>
            </div>

            <div className="min-w-28 bg-ink-2/95 p-3">
              <TrendingDown
                size={14}
                className="mb-2 text-mint"
                aria-hidden="true"
              />
              <strong
                className="block font-display text-xl font-black"
                style={{
                  color:
                    results.length > 0
                      ? savingsColor(
                        totals.savingsPercent,
                      )
                      : undefined,
                }}
              >
                {results.length > 0
                  ? formatDelta(
                    totals.savingsPercent,
                  )
                  : '—'}
              </strong>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
                {t('optimizer.hero.savings')}
              </span>
            </div>

            <div className="min-w-28 bg-ink-2/95 p-3">
              <Sparkles
                size={14}
                className="mb-2 text-gold"
                aria-hidden="true"
              />
              <strong className="block font-display text-xl font-black text-paper">
                {results.length > 0
                  ? formatBytes(totals.savings)
                  : '—'}
              </strong>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
                {t('optimizer.hero.saved')}
              </span>
            </div>

            <div className="min-w-28 bg-ink-2/95 p-3">
              <Layers3
                size={14}
                className="mb-2 text-azure"
                aria-hidden="true"
              />
              <strong className="block font-display text-xl font-black uppercase text-paper">
                {recipe.outputFormat}
              </strong>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
                {t('optimizer.hero.output')}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(350px,430px)_minmax(0,1fr)]">
        {/* Configuration press */}
        <motion.aside
          initial={
            reduceMotion
              ? false
              : {
                opacity: 0,
                x: -20,
              }
          }
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: reduceMotion ? 0 : 0.55,
            delay: reduceMotion ? 0 : 0.08,
            ease: EASE,
          }}
          className="glass panel-cut overflow-hidden"
        >
          {/* Presets */}
          <ControlSection
            index="A01"
            icon={Gauge}
            title={t('optimizer.panel.presets')}
          >
            <div className="grid grid-cols-2 gap-2">
              {presetKeys.map((presetKey) => {
                const metadata =
                  PRESET_META[presetKey];

                const PresetIcon = metadata.icon;

                const presetNameKey =
                  presetKey === 'web-light'
                    ? 'webLight'
                    : presetKey;

                const active =
                  selectedPreset === presetKey;

                return (
                  <button
                    key={presetKey}
                    type="button"
                    aria-pressed={active}
                    className={[
                      'offset-card panel-cut-sm min-h-24 border p-3 text-left',
                      active
                        ? 'border-crimson/65 bg-crimson/10 drop-shadow-[4px_4px_0_rgba(255,46,99,0.3)]'
                        : 'border-paper/10 bg-ink/50 hover:border-crimson/35',
                    ].join(' ')}
                    onClick={() =>
                      updatePreset(presetKey)
                    }
                  >
                    <span
                      className={[
                        'mb-3 grid size-7 place-items-center border panel-cut-sm',
                        active
                          ? 'border-crimson/45 bg-crimson text-ink'
                          : 'border-paper/10 bg-paper/[0.035] text-paper/40',
                      ].join(' ')}
                    >
                      <PresetIcon size={13} />
                    </span>

                    <strong className="block font-display text-xs font-black uppercase tracking-[-0.02em] text-paper">
                      {t(
                        `optimizer.presets.${presetNameKey}`,
                      )}
                    </strong>

                    <span className="mt-1 block text-[0.65rem] leading-4 text-paper/35">
                      {t(metadata.descKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </ControlSection>

          {/* Output */}
          <ControlSection
            index="A02"
            icon={ImageIcon}
            title={t('optimizer.panel.output')}
          >
            <div className="space-y-5">
              <div>
                <span className="mb-2 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/48">
                  {t('optimizer.config.format')}
                </span>

                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      'png',
                      'jpeg',
                      'webp',
                    ] as RawOutputFormat[]
                  ).map((format) => (
                    <button
                      key={format}
                      type="button"
                      aria-pressed={
                        recipe.outputFormat === format
                      }
                      className={[
                        'panel-cut-sm min-h-10 border font-mono text-[0.65rem] font-black uppercase tracking-[0.08em] transition',
                        recipe.outputFormat === format
                          ? 'border-crimson bg-crimson text-ink shadow-[2px_2px_0_0_rgba(255,200,87,0.4)]'
                          : 'border-paper/10 bg-ink/55 text-paper/45 hover:border-crimson/40',
                      ].join(' ')}
                      onClick={() =>
                        updateRecipe(
                          'outputFormat',
                          format,
                        )
                      }
                    >
                      {format === 'jpeg'
                        ? 'JPG'
                        : format}
                    </button>
                  ))}
                </div>
              </div>

              <RangeControl
                label={t(
                  'optimizer.config.quality',
                )}
                valueLabel={`${Math.round(
                  recipe.quality * 100,
                )}%`}
                min={30}
                max={100}
                step={1}
                value={Math.round(
                  recipe.quality * 100,
                )}
                onChange={(value) =>
                  updateRecipe(
                    'quality',
                    value / 100,
                  )
                }
              />
            </div>
          </ControlSection>

          {/* Dimensions */}
          <ControlSection
            index="A03"
            icon={ZoomIn}
            title={t(
              'optimizer.panel.dimensions',
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <ToggleControl
                label={t(
                  'optimizer.config.resize',
                )}
                checked={recipe.resizeEnabled}
                onChange={(checked) =>
                  updateRecipe(
                    'resizeEnabled',
                    checked,
                  )
                }
              />

              <ToggleControl
                label={t(
                  'optimizer.config.trimBorders',
                )}
                checked={recipe.trimBorders}
                onChange={(checked) =>
                  updateRecipe(
                    'trimBorders',
                    checked,
                  )
                }
              />

              <label className="block">
                <span className="mb-2 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-paper/42">
                  {t(
                    'optimizer.config.maxWidth',
                  )}
                </span>

                <input
                  type="number"
                  className="w-full bg-ink-2 text-paper px-3 py-2 panel-cut-sm border border-paper/15 font-mono text-[11px] focus:border-crimson focus:shadow-[3px_3px_0_0_#ff2e63] focus-visible:outline-none transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
                  min={320}
                  max={4000}
                  value={recipe.maxWidth}
                  disabled={!recipe.resizeEnabled}
                  onChange={(event) =>
                    updateRecipe(
                      'maxWidth',
                      Math.max(
                        320,
                        Number(
                          event.target.value,
                        ) || recipe.maxWidth,
                      ),
                    )
                  }
                />
              </label>

              <label className="block">
                <span className="mb-2 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-paper/42">
                  {t(
                    'optimizer.config.maxHeight',
                  )}
                </span>

                <input
                  type="number"
                  className="w-full bg-ink-2 text-paper px-3 py-2 panel-cut-sm border border-paper/15 font-mono text-[11px] focus:border-crimson focus:shadow-[3px_3px_0_0_#ff2e63] focus-visible:outline-none transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
                  min={320}
                  max={6000}
                  value={recipe.maxHeight}
                  disabled={!recipe.resizeEnabled}
                  onChange={(event) =>
                    updateRecipe(
                      'maxHeight',
                      Math.max(
                        320,
                        Number(
                          event.target.value,
                        ) || recipe.maxHeight,
                      ),
                    )
                  }
                />
              </label>

              {recipe.trimBorders ? (
                <div className="sm:col-span-2">
                  <RangeControl
                    label={t(
                      'optimizer.config.trimTolerance',
                    )}
                    valueLabel={String(
                      recipe.trimTolerance,
                    )}
                    min={4}
                    max={60}
                    step={1}
                    value={recipe.trimTolerance}
                    onChange={(value) =>
                      updateRecipe(
                        'trimTolerance',
                        value,
                      )
                    }
                  />
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <span className="mb-2 flex items-center justify-between font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-paper/42">
                  {t(
                    'optimizer.config.rotation',
                  )}
                  <span className="text-crimson">
                    {recipe.rotation}°
                  </span>
                </span>

                <div className="grid grid-cols-4 gap-1">
                  {ROTATION_OPTIONS.map(
                    (rotation) => (
                      <button
                        key={rotation}
                        type="button"
                        aria-pressed={
                          recipe.rotation ===
                          rotation
                        }
                        className={[
                          'panel-cut-sm min-h-10 border font-mono text-[0.63rem] font-black transition',
                          recipe.rotation === rotation
                            ? 'border-crimson bg-crimson text-ink shadow-[2px_2px_0_0_rgba(255,200,87,0.4)]'
                            : 'border-paper/10 bg-ink/50 text-paper/40 hover:border-crimson/40',
                        ].join(' ')}
                        onClick={() =>
                          updateRecipe(
                            'rotation',
                            rotation,
                          )
                        }
                      >
                        {rotation === 0
                          ? t(
                            'optimizer.config.rotationNone',
                          )
                          : `${rotation}°`}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          </ControlSection>

          {/* Filters */}
          <ControlSection
            index="A04"
            icon={Wand2}
            title={t('optimizer.panel.filters')}
            expanded={filtersExpanded}
            onToggle={() =>
              setFiltersExpanded(
                (current) => !current,
              )
            }
          >
            <div className="space-y-5">
              <RangeControl
                label={t(
                  'optimizer.config.brightness',
                )}
                valueLabel={`${recipe.brightness > 0 ? '+' : ''
                  }${recipe.brightness}`}
                min={-50}
                max={50}
                step={1}
                value={recipe.brightness}
                icon={SunMedium}
                onChange={(value) =>
                  updateRecipe(
                    'brightness',
                    value,
                  )
                }
              />

              <RangeControl
                label={t(
                  'optimizer.config.contrast',
                )}
                valueLabel={`${recipe.contrast > 0 ? '+' : ''
                  }${recipe.contrast}`}
                min={-50}
                max={50}
                step={1}
                value={recipe.contrast}
                icon={Contrast}
                onChange={(value) =>
                  updateRecipe('contrast', value)
                }
              />

              <ToggleControl
                label={t(
                  'optimizer.config.sharpen',
                )}
                checked={recipe.sharpen}
                icon={Contrast}
                onChange={(checked) =>
                  updateRecipe(
                    'sharpen',
                    checked,
                  )
                }
              />

              {recipe.sharpen ? (
                <RangeControl
                  label={t(
                    'optimizer.config.sharpenStrength',
                  )}
                  valueLabel={recipe.sharpenStrength.toFixed(
                    1,
                  )}
                  min={10}
                  max={200}
                  step={5}
                  value={Math.round(
                    recipe.sharpenStrength * 100,
                  )}
                  onChange={(value) =>
                    updateRecipe(
                      'sharpenStrength',
                      value / 100,
                    )
                  }
                />
              ) : null}

              <ToggleControl
                label={t(
                  'optimizer.config.noiseReduction',
                )}
                checked={recipe.noiseReduction}
                icon={Sparkles}
                onChange={(checked) =>
                  updateRecipe(
                    'noiseReduction',
                    checked,
                  )
                }
              />

              {recipe.noiseReduction ? (
                <RangeControl
                  label={t(
                    'optimizer.config.noiseReductionStrength',
                  )}
                  valueLabel={recipe.noiseReductionStrength.toFixed(
                    1,
                  )}
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(
                    recipe.noiseReductionStrength *
                    100,
                  )}
                  onChange={(value) =>
                    updateRecipe(
                      'noiseReductionStrength',
                      value / 100,
                    )
                  }
                />
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                <ToggleControl
                  label={t(
                    'optimizer.config.grayscale',
                  )}
                  checked={recipe.grayscale}
                  icon={Palette}
                  onChange={(checked) =>
                    updateRecipe(
                      'grayscale',
                      checked,
                    )
                  }
                />

                <ToggleControl
                  label={t(
                    'optimizer.config.autoLevels',
                  )}
                  checked={recipe.autoLevels}
                  icon={SunMedium}
                  onChange={(checked) =>
                    updateRecipe(
                      'autoLevels',
                      checked,
                    )
                  }
                />
              </div>
            </div>
          </ControlSection>

          {/* Advanced */}
          <ControlSection
            index="A05"
            icon={Settings2}
            title={t('optimizer.panel.advanced')}
            expanded={advancedExpanded}
            onToggle={() =>
              setAdvancedExpanded(
                (current) => !current,
              )
            }
          >
            <label className="block">
              <span className="mb-2 flex items-center gap-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.1em] text-paper/45">
                <Type
                  size={13}
                  className="text-crimson"
                  aria-hidden="true"
                />
                {t(
                  'optimizer.config.renamePattern',
                )}
              </span>

              <input
                type="text"
                className="w-full bg-ink-2 text-paper px-3 py-2 panel-cut-sm border border-paper/15 font-mono text-[11px] focus:border-crimson focus:shadow-[3px_3px_0_0_#ff2e63] focus-visible:outline-none transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
                value={recipe.renamePattern}
                placeholder="{name}"
                onChange={(event) =>
                  updateRecipe(
                    'renamePattern',
                    event.target.value,
                  )
                }
              />

              <span className="mt-2 block text-[0.66rem] leading-4 text-paper/32">
                {t(
                  'optimizer.config.renameHint',
                )}
              </span>

              {activeImage ? (
                <code className="mt-3 block overflow-hidden text-ellipsis whitespace-nowrap border-l-2 border-azure bg-azure/[0.045] px-3 py-2 font-mono text-[0.64rem] text-azure panel-cut-sm">
                  {buildOutputName(
                    activeImage.file.name,
                    recipe.outputFormat,
                    recipe.renamePattern,
                    activeImageIndex >= 0
                      ? activeImageIndex
                      : 0,
                  )}
                </code>
              ) : null}
            </label>
          </ControlSection>

          {/* Execute */}
          <div className="bg-ink/55 p-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy || images.length === 0}
                onClick={() =>
                  void handleOptimizeAll(false)
                }
              >
                {busy ? (
                  <>
                    <RefreshCw
                      size={14}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    {batchProgress
                      ? `${batchProgress.current}/${batchProgress.total}`
                      : t(
                        'optimizer.action.optimizing',
                      )}
                  </>
                ) : (
                  <>
                    <Download
                      size={14}
                      aria-hidden="true"
                    />
                    ZIP
                  </>
                )}
              </button>

              {directoryPickerAvailable ? (
                <button
                  type="button"
                  className="btn-ghost w-full"
                  disabled={
                    busy || images.length === 0
                  }
                  onClick={() =>
                    void handleOptimizeAll(true)
                  }
                >
                  <FolderOutput
                    size={14}
                    aria-hidden="true"
                  />
                  {t('optimizer.action.folder')}
                </button>
              ) : null}
            </div>

            {batchProgress ? (
              <div
                className="mt-4"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={
                  batchProgress.total
                }
                aria-valuenow={
                  batchProgress.current
                }
              >
                <div className="h-1.5 overflow-hidden bg-paper/[0.055] panel-cut-sm">
                  <motion.div
                    className="h-full bg-crimson"
                    animate={{
                      width: `${(batchProgress.current /
                        batchProgress.total) *
                        100
                        }%`,
                    }}
                    transition={{
                      duration: reduceMotion
                        ? 0
                        : 0.28,
                      ease: EASE,
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.09em] text-paper/38">
                  <span>
                    {t(
                      'optimizer.action.optimizing',
                    )}
                  </span>
                  <span className="text-crimson">
                    {batchProgress.current}/
                    {batchProgress.total}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </motion.aside>

        {/* Preview press */}
        <motion.main
          initial={
            reduceMotion
              ? false
              : {
                opacity: 0,
                x: 20,
              }
          }
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: reduceMotion ? 0 : 0.55,
            delay: reduceMotion ? 0 : 0.12,
            ease: EASE,
          }}
          className="glass panel-cut overflow-hidden xl:sticky xl:top-5"
        >
          <header className="flex flex-col gap-3 border-b border-paper/[0.065] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                className="grid size-9 place-items-center border border-azure/30 bg-azure/10 text-azure panel-cut-sm"
                aria-hidden="true"
              >
                <Eye size={15} />
              </span>

              <span>
                <span className="kicker block">
                  // B01 / Proof
                </span>

                <strong className="mt-1 block font-display text-base font-black uppercase tracking-[-0.03em] text-paper">
                  {t('optimizer.panel.preview')}
                </strong>
              </span>

              {activeImageIndex >= 0 ? (
                <span className="stamp !border-paper/15 !bg-paper/[0.035] !text-paper/45">
                  {activeImageIndex + 1}/
                  {images.length}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {previewUrl &&
                originalPreviewUrl ? (
                <button
                  type="button"
                  className={[
                    'btn-ghost !min-h-9 !px-3 !py-2',
                    showCompare
                      ? '!border-crimson/60 !bg-crimson/10 !text-crimson'
                      : '',
                  ].join(' ')}
                  aria-pressed={showCompare}
                  onClick={() =>
                    setShowCompare(
                      (current) => !current,
                    )
                  }
                >
                  <Scissors
                    size={13}
                    aria-hidden="true"
                  />
                  {t(
                    'optimizer.preview.compare',
                  )}
                </button>
              ) : null}

              <button
                type="button"
                className="btn-ghost !min-h-9 !px-3 !py-2"
                title={t(
                  'optimizer.config.rotation',
                )}
                onClick={cycleRotation}
              >
                <RotateCw
                  size={13}
                  aria-hidden="true"
                />
                {recipe.rotation}°
              </button>

              <div className="flex border border-paper/10 bg-ink/60 panel-cut-sm">
                <button
                  type="button"
                  className="panel-cut-sm grid size-9 place-items-center text-paper/45 transition hover:bg-paper/[0.05] hover:text-paper disabled:opacity-25"
                  aria-label="Zoom out"
                  disabled={
                    zoomLevel <= (ZOOM_LEVELS[0] ?? 0)
                  }
                  onClick={handleZoomOut}
                >
                  <Minus
                    size={13}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  className="panel-cut-sm min-w-14 border-x border-paper/10 px-2 font-mono text-[0.62rem] font-bold text-paper/55 hover:bg-paper/[0.05] hover:text-paper"
                  title="Reset zoom"
                  onClick={() => setZoomLevel(1)}
                >
                  {Math.round(zoomLevel * 100)}%
                </button>

                <button
                  type="button"
                  className="panel-cut-sm grid size-9 place-items-center text-paper/45 transition hover:bg-paper/[0.05] hover:text-paper disabled:opacity-25"
                  aria-label="Zoom in"
                  disabled={
                    zoomLevel >=
                    (ZOOM_LEVELS[
                      ZOOM_LEVELS.length - 1
                    ] ?? 0)
                  }
                  onClick={handleZoomIn}
                >
                  <Plus
                    size={13}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </header>

          {activeImage ? (
            <>
              {images.length > 1 ? (
                <div
                  ref={thumbStripRef}
                  className="koma-scrollbar flex gap-2 overflow-x-auto border-b border-paper/[0.065] bg-ink/35 p-3"
                >
                  {images.map((image, index) => {
                    const active =
                      image.id === activeImage.id;

                    return (
                      <button
                        key={image.id}
                        type="button"
                        data-thumb-id={image.id}
                        title={image.file.name}
                        aria-label={`${index + 1}: ${image.file.name}`}
                        aria-pressed={active}
                        className={[
                          'panel-cut-sm relative h-16 w-12 shrink-0 overflow-hidden border transition',
                          active
                            ? 'border-crimson drop-shadow-[3px_3px_0_rgba(255,46,99,0.38)]'
                            : 'border-paper/10 opacity-48 hover:border-paper/30 hover:opacity-100',
                        ].join(' ')}
                        onClick={() =>
                          setActiveImageId(image.id)
                        }
                      >
                        <img
                          src={image.url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />

                        <span className="absolute bottom-0 left-0 bg-ink/90 px-1.5 py-0.5 font-mono text-[0.52rem] font-bold text-paper">
                          {String(index + 1).padStart(
                            2,
                            '0',
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="halftone relative grid min-h-[420px] place-items-center overflow-auto bg-ink/60 p-5 sm:min-h-[560px]">
                <div
                  className="pointer-events-none absolute inset-4 border border-paper/[0.045] panel-cut"
                  aria-hidden="true"
                />

                <div className="pointer-events-none absolute left-6 top-5 z-10 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-paper/22">
                  Proof frame / RGB /{' '}
                  {recipe.outputFormat}
                </div>

                {previewLoading ? (
                  <div className="absolute inset-0 z-40 grid place-items-center bg-ink/68 backdrop-blur-sm">
                    <div className="panel-cut-sm flex items-center gap-3 border border-crimson/30 bg-ink-2 px-4 py-3 drop-shadow-[5px_5px_0_rgba(255,46,99,0.25)]">
                      <span
                        className="koma-spinner text-crimson"
                        aria-hidden="true"
                      />

                      <span className="font-mono text-[0.66rem] font-bold uppercase tracking-[0.1em] text-paper/60">
                        {t(
                          'optimizer.preview.generating',
                        )}
                      </span>
                    </div>
                  </div>
                ) : null}

                {showCompare &&
                  previewUrl &&
                  originalPreviewUrl ? (
                  <div
                    className="relative max-w-full transition-transform duration-200 focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-crimson"
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center',
                    }}
                  >
                    <img
                      src={originalPreviewUrl}
                      alt={t(
                        'optimizer.preview.before',
                      )}
                      className="block max-h-[68vh] max-w-full select-none object-contain"
                      draggable={false}
                    />

                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden"
                      style={{
                        clipPath: `inset(0 ${100 - comparePosition
                          }% 0 0)`,
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt={t(
                          'optimizer.preview.after',
                        )}
                        className="size-full select-none object-contain"
                        draggable={false}
                      />
                    </div>

                    <div
                      className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-crimson"
                      style={{
                        left: `${comparePosition}%`,
                      }}
                      aria-hidden="true"
                    >
                      <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-ink bg-crimson text-ink panel-cut-sm drop-shadow-[3px_3px_0_#ffc857]">
                        <Scissors size={14} />
                      </span>
                    </div>

                    <span className="stamp pointer-events-none absolute left-3 top-3 z-20 !border-paper/20 !bg-ink/80 !text-paper/65">
                      {t(
                        'optimizer.preview.original',
                      )}
                    </span>

                    <span className="stamp pointer-events-none absolute right-3 top-3 z-20">
                      {t(
                        'optimizer.preview.optimized',
                      )}
                    </span>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={comparePosition}
                      aria-label={t(
                        'optimizer.preview.compare',
                      )}
                      aria-valuetext={`${Math.round(
                        comparePosition,
                      )}%`}
                      className="panel-cut-sm absolute inset-0 z-30 size-full cursor-ew-resize appearance-none bg-transparent opacity-0"
                      onChange={(event) =>
                        setComparePosition(
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                    />
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={activeImage.file.name}
                    draggable={false}
                    className="max-h-[68vh] max-w-full select-none object-contain transition-transform duration-200"
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center',
                    }}
                  />
                ) : !previewLoading ? (
                  <div className="text-center">
                    <ImageIcon
                      size={34}
                      className="mx-auto text-paper/16"
                      aria-hidden="true"
                    />

                    <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-paper/32">
                      {t(
                        'optimizer.preview.generating',
                      )}
                    </p>
                  </div>
                ) : null}
              </div>

              {previewStats ? (
                <div className="grid grid-cols-2 gap-px border-t border-paper/[0.065] bg-paper/[0.065] sm:grid-cols-4">
                  <div className="bg-ink-2/95 p-3">
                    <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/30">
                      {t(
                        'optimizer.preview.before',
                      )}
                    </span>
                    <strong className="mt-1 block font-display text-base font-black text-paper">
                      {formatBytes(
                        previewStats.originalBytes,
                      )}
                    </strong>
                  </div>

                  <div className="bg-ink-2/95 p-3">
                    <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/30">
                      {t(
                        'optimizer.preview.after',
                      )}
                    </span>
                    <strong className="mt-1 block font-display text-base font-black text-paper">
                      {formatBytes(
                        previewStats.optimizedBytes,
                      )}
                    </strong>
                  </div>

                  <div className="bg-ink-2/95 p-3">
                    <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/30">
                      {t(
                        'optimizer.preview.reduction',
                      )}
                    </span>
                    <strong
                      className="mt-1 block font-display text-base font-black"
                      style={{
                        color: savingsColor(
                          savingsPercent(
                            previewStats.originalBytes,
                            previewStats.optimizedBytes,
                          ),
                        ),
                      }}
                    >
                      {formatDelta(
                        savingsPercent(
                          previewStats.originalBytes,
                          previewStats.optimizedBytes,
                        ),
                      )}
                    </strong>
                  </div>

                  <div className="bg-ink-2/95 p-3">
                    <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-paper/30">
                      {t(
                        'optimizer.preview.dimensions',
                      )}
                    </span>
                    <strong className="mt-1 block font-display text-base font-black text-paper">
                      {previewStats.width}×
                      {previewStats.height}
                    </strong>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="halftone grid min-h-[560px] place-items-center bg-ink/50 text-center">
              <div>
                <ImageIcon
                  size={44}
                  strokeWidth={1.2}
                  className="mx-auto text-paper/16"
                  aria-hidden="true"
                />

                <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-paper/34">
                  {t('optimizer.preview.empty')}
                </p>
              </div>
            </div>
          )}
        </motion.main>
      </div>

      {/* Results press */}
      <section className="glass panel-cut overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-paper/[0.065] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 place-items-center border border-mint/30 bg-mint/10 text-mint panel-cut-sm"
              aria-hidden="true"
            >
              <Layers3 size={15} />
            </span>

            <span>
              <span className="kicker block">
                // C01 / Output manifest
              </span>

              <strong className="mt-1 block font-display text-base font-black uppercase tracking-[-0.03em] text-paper">
                {t('optimizer.results.title')}
                {results.length > 0
                  ? ` / ${results.length}`
                  : ''}
              </strong>
            </span>
          </div>

          {results.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 font-mono text-[0.65rem] text-paper/42">
              <span>
                {formatBytes(totals.original)}
              </span>
              <span className="text-crimson">→</span>
              <span>
                {formatBytes(totals.optimized)}
              </span>

              <span
                className="stamp"
                style={{
                  color: savingsColor(
                    totals.savingsPercent,
                  ),
                  borderColor: savingsColor(
                    totals.savingsPercent,
                  ),
                }}
              >
                {formatDelta(
                  totals.savingsPercent,
                )}
              </span>
            </div>
          ) : null}
        </header>

        {results.length > 0 ? (
          <motion.div
            variants={listVariants}
            initial={
              reduceMotion ? false : 'hidden'
            }
            whileInView="visible"
            viewport={{
              once: true,
              amount: 0.08,
            }}
            className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {results.map((result, index) => {
              const percentage =
                savingsPercent(
                  result.originalBytes,
                  result.optimizedBytes,
                );

              const remainingWidth = Math.min(
                100,
                Math.max(
                  3,
                  100 - Math.max(0, percentage),
                ),
              );

              return (
                <motion.article
                  key={result.sourceImageId}
                  variants={cardVariants}
                  className="offset-card panel-cut-sm relative overflow-hidden border border-paper/10 bg-ink/50 p-4"
                >
                  <span
                    className="text-outline pointer-events-none absolute right-3 top-0 font-display text-5xl font-black leading-none"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(
                      2,
                      '0',
                    )}
                  </span>

                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="kicker block text-[0.55rem]">
                        Export file
                      </span>

                      <strong className="mt-2 block truncate font-mono text-[0.7rem] text-paper">
                        {result.fileName}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="panel-cut-sm grid size-9 shrink-0 place-items-center border border-paper/10 bg-paper/[0.035] text-paper/45 transition hover:border-crimson/50 hover:bg-crimson/10 hover:text-crimson"
                      title={t(
                        'optimizer.results.download',
                      )}
                      aria-label={`${t(
                        'optimizer.results.download',
                      )}: ${result.fileName}`}
                      onClick={() =>
                        handleDownloadSingle(result)
                      }
                    >
                      <ArrowDownToLine
                        size={14}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div className="relative z-10 mt-4 flex items-center justify-between gap-4 font-mono text-[0.6rem] text-paper/38">
                    <span>
                      {formatBytes(
                        result.originalBytes,
                      )}{' '}
                      →{' '}
                      {formatBytes(
                        result.optimizedBytes,
                      )}
                    </span>

                    <span>
                      {result.width}×{result.height}
                    </span>
                  </div>

                  <div className="relative z-10 mt-3 h-1.5 overflow-hidden bg-paper/[0.055] panel-cut-sm">
                    <motion.div
                      initial={
                        reduceMotion
                          ? false
                          : {
                            width: '100%',
                          }
                      }
                      whileInView={{
                        width: `${remainingWidth}%`,
                      }}
                      viewport={{ once: true }}
                      transition={{
                        duration: reduceMotion
                          ? 0
                          : 0.72,
                        delay: reduceMotion
                          ? 0
                          : index * 0.04,
                        ease: EASE,
                      }}
                      className="h-full"
                      style={{
                        background:
                          savingsColor(percentage),
                      }}
                    />
                  </div>

                  <div className="relative z-10 mt-3 flex items-center justify-between">
                    <strong
                      className="font-display text-lg font-black"
                      style={{
                        color:
                          savingsColor(percentage),
                      }}
                    >
                      {formatDelta(percentage)}
                    </strong>

                    <span className="font-mono text-[0.6rem] text-paper/32">
                      {formatBytes(
                        Math.max(
                          0,
                          result.originalBytes -
                          result.optimizedBytes,
                        ),
                      )}{' '}
                      saved
                    </span>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        ) : (
          <div className="halftone grid min-h-52 place-items-center p-6 text-center">
            <div>
              <Sparkles
                size={28}
                strokeWidth={1.2}
                className="mx-auto text-paper/16"
                aria-hidden="true"
              />

              <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-paper/32">
                {t('optimizer.results.empty')}
              </p>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
