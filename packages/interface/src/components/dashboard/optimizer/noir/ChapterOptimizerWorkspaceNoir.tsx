'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import { useRafCoalescedState } from '../../../../hooks/useRafCoalescedState';
import { zipSync } from 'fflate';

import type {
  OptimizationPreset,
  OptimizationRecipe,
  OptimizationResult,
} from '../../../../types';
import { useI18n } from '../../../../i18n';
import { useLatestCallback } from '../../../../utils/shallowStable';
import type {
  ChapterOptimizerWorkspaceState,
  OptimizerImageInput,
  OptimizerSourceVariant,
} from '../ChapterOptimizerWorkspace.types';
import {
  ROTATION_OPTIONS,
  savingsPercent,
  ZOOM_LEVELS,
} from '../ChapterOptimizerWorkspace.utils';
import { runOptimizerJob } from '../optimizerJob';
import { buildOutputName } from '../optimizerOutputName';
import {
  normalizeRecipe,
  PRESET_RECIPES,
  STORAGE_KEY,
  type OptimizerPersistedRecipe,
} from '../optimizerRecipe';
import ChapterOptimizerControlPanelNoir from './ChapterOptimizerControlPanelNoir';
import ChapterOptimizerHeroNoir from './ChapterOptimizerHeroNoir';
import ChapterOptimizerPreviewPanelNoir from './ChapterOptimizerPreviewPanelNoir';
import ChapterOptimizerResultsPanelNoir from './ChapterOptimizerResultsPanelNoir';
import { useChapterOptimizerPreviewNoir } from './useChapterOptimizerPreviewNoir';

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

  const {
    value: comparePosition,
    schedule: scheduleComparePosition,
    setNow: setComparePositionNow,
  } = useRafCoalescedState(50);

  const [filtersExpanded, setFiltersExpanded] =
    useState(false);

  const [advancedExpanded, setAdvancedExpanded] =
    useState(false);

  const [zoomLevel, setZoomLevel] = useState(1);

  // Feature-detect up front: a mount effect set this after paint, flashing the
  // fallback button for one frame (react-doctor rendering-hydration-no-flicker).
  const [directoryPickerAvailable] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof (window as DirectoryPickerWindow).showDirectoryPicker ===
        'function',
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

  const handleSourceChange = useCallback(() => {
    setComparePositionNow(50);
    setZoomLevel(1);
  }, [setComparePositionNow]);

  const {
    previewUrl,
    originalPreviewUrl,
    previewStats,
    previewLoading,
  } = useChapterOptimizerPreviewNoir({
    activeImage,
    activeSourceBlob,
    recipe,
    setStatusMessage,
    t,
    onSourceChange: handleSourceChange,
  });

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
        }

        return nextRecipe;
      });
    },
    [],
  );

  // Recipe edits on a named preset flip it to custom; the chip follows via
  // state sync because state updaters must stay pure (StrictMode runs them
  // twice in dev).
  useEffect(() => {
    if (recipe.preset === 'custom' && selectedPreset !== 'custom') {
      setSelectedPreset('custom');
    }
  }, [recipe.preset, selectedPreset]);

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

  return (
    <section
      className="relative isolate space-y-5"
      aria-labelledby="optimizer-v2-title"
      data-coauthor="OpenAI ChatGPT; model ID from API response.model"
    >
      <ChapterOptimizerHeroNoir
        imageCount={images.length}
        resultCount={results.length}
        recipe={recipe}
        totals={totals}
        formatBytes={formatBytes}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(350px,430px)_minmax(0,1fr)]">
        <ChapterOptimizerControlPanelNoir
          recipe={recipe}
          selectedPreset={selectedPreset}
          presetKeys={presetKeys}
          imageCount={images.length}
          activeImage={activeImage}
          activeImageIndex={activeImageIndex}
          busy={busy}
          batchProgress={batchProgress}
          filtersExpanded={filtersExpanded}
          advancedExpanded={advancedExpanded}
          directoryPickerAvailable={directoryPickerAvailable}
          onPresetChange={updatePreset}
          onRecipeChange={updateRecipe}
          onToggleFilters={() =>
            setFiltersExpanded(
              (current) => !current,
            )
          }
          onToggleAdvanced={() =>
            setAdvancedExpanded(
              (current) => !current,
            )
          }
          onOptimizeAll={handleOptimizeAll}
        />

        <ChapterOptimizerPreviewPanelNoir
          activeImage={activeImage}
          activeImageIndex={activeImageIndex}
          images={images}
          previewUrl={previewUrl}
          originalPreviewUrl={originalPreviewUrl}
          previewStats={previewStats}
          previewLoading={previewLoading}
          showCompare={showCompare}
          comparePosition={comparePosition}
          scheduleComparePosition={scheduleComparePosition}
          thumbStripRef={thumbStripRef}
          zoomLevel={zoomLevel}
          rotation={recipe.rotation}
          outputFormat={recipe.outputFormat}
          formatBytes={formatBytes}
          onActiveImageChange={setActiveImageId}
          onCompareToggle={() =>
            setShowCompare(
              (current) => !current,
            )
          }
          onCycleRotation={cycleRotation}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={() => setZoomLevel(1)}
        />
      </div>

      <ChapterOptimizerResultsPanelNoir
        results={results}
        totals={totals}
        formatBytes={formatBytes}
        onDownloadSingle={handleDownloadSingle}
      />
    </section>
  );
}
