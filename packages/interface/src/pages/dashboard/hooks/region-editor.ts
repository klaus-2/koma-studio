import { useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useI18n } from '../../../i18n';
import {
  AIO_MANUAL_STAGE_ORDER,
  TRANSLATION_NOTE_REGION_PREFIX,
} from '../../../constants/dashboard.constants';
import {
  applyDetectedGradientToStyle,
  applyRenderDefaultsToRegion,
  areAioRegionsEqual,
  clamp,
  cloneAioRegion,
  cloneAioRegions,
  cloneRenderStyle,
  canvasToBlob,
  getRegionTranslationNotesForDisplay,
  ensureCanvasFontLoaded,
  buildDefaultRegionRenderText,
  buildTranslationNoteOverlayRegions,
  normalizeRegion,
  rebuildRegionShapeForAutoMode,
  rebuildRegionShapeForKind,
  rebuildRegionShapeForRefinement,
  resolveRegionShapeKind,
  resolveSelectedRegionForRegions,
  scaleTypographyShapeForBounds,
} from '../../../utils/dashboard.utils';
import {
  type RenderTextMode,
  getRenderModePresetStyle,
  normalizeDetectedRenderMode,
  resolveRenderTextMode,
} from '../../../utils/renderModes';
import { listTextFillSwatches } from '../../../utils/textFillPicker';
import {
  computeRenderTextLayout,
  drawRenderedTextInRegion,
} from '../../../utils/renderText';
import {
  buildShapeFromPreset,
  createTypographyStyleFromPreset,
  resolveLegacyTypographyPresetForMode,
  resolveTypographyPresetForMode,
  updateTypographyPreset,
} from '../../../typography/presets';
import type {
  TypographyShape,
  TypographyShapeKind,
  TypographyStylePreset,
} from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import type {
  AioTextRegion,
  DownloadItem,
  LoadedImage,
} from '../../../types/dashboard.types';
import type { useTypographerWorkspace } from './typographer';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';

type TypographerWorkspaceApi = ReturnType<typeof useTypographerWorkspace>;

interface AioManualImageEditComposer {
  (
    imgData: LoadedImage,
    fallbackBaseSource?: string,
    options?: { includePaintLayer?: boolean },
  ): Promise<HTMLCanvasElement>;
}

/* ── Snapshot sync: region edits plumbed into the aio snapshot history ── */

interface UseAioRegionSnapshotSyncArgs {
  /* Page callbacks */
  getAioImageSnapshotIndex: (imageId: string) => number;
  syncManualStagePreviewToNextStage: (
    imageId: string,
    fromStageIndex: number,
    toStageIndex: number,
  ) => void;
  typographerWorkspace: TypographerWorkspaceApi;
}

export function useAioRegionSnapshotSync({
  getAioImageSnapshotIndex,
  syncManualStagePreviewToNextStage,
  typographerWorkspace,
}: UseAioRegionSnapshotSyncArgs) {
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const setAioDetectionsByImage = useRegionEditorStore(
    (s) => s.setAioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const setAioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.setAioSelectedRegionByImage,
  );
  const setAioPipelineSnapshots = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshots,
  );
  const aioManualProgressByImage = useAioPipelineStore(
    (s) => s.aioManualProgressByImage,
  );
  const setAioManualProgressByImage = useAioPipelineStore(
    (s) => s.setAioManualProgressByImage,
  );
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);

  const patchAioSnapshotsForImageEdit = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionId: string | null,
    ) => {
      const snapshotIndex = getAioImageSnapshotIndex(imageId);
      if (snapshotIndex < 0) return;
      setAioPipelineSnapshots((prev) => {
        if (prev.length === 0 || snapshotIndex >= prev.length) return prev;
        let changed = false;
        const nextSnapshots = prev.map((snapshot, index) => {
          if (index < snapshotIndex) return snapshot;
          const snapshotRegions = snapshot.detectionsByImage[imageId] ?? [];
          const snapshotSelected =
            snapshot.selectedRegionByImage[imageId] ?? null;
          const snapshotById = new Map(
            snapshotRegions.map((region) => [region.id, region]),
          );
          const mergedSnapshotRegions = nextRegions.map((region) => {
            const existing = snapshotById.get(region.id);
            if (!existing) return cloneAioRegion(region, cloneRenderStyle);
            return {
              ...existing,
              ...region,
              bbox: [...region.bbox] as [number, number, number, number],
              segmentBoxes:
                region.segmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ) ??
                existing.segmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ),
              mergedSegmentBoxes:
                region.mergedSegmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ) ??
                existing.mergedSegmentBoxes?.map(
                  (box) => [...box] as [number, number, number, number],
                ),
              renderStyle: region.renderStyle
                ? cloneRenderStyle(region.renderStyle)
                : existing.renderStyle
                  ? cloneRenderStyle(existing.renderStyle)
                  : undefined,
            };
          });
          const resolvedSelected =
            selectedRegionId === null ? null : selectedRegionId;
          const regionsChanged = !areAioRegionsEqual(
            snapshotRegions,
            mergedSnapshotRegions,
            cloneRenderStyle,
          );
          const selectedChanged = snapshotSelected !== resolvedSelected;
          if (!regionsChanged && !selectedChanged) return snapshot;
          changed = true;
          return {
            ...snapshot,
            detectionsByImage: regionsChanged
              ? {
                  ...snapshot.detectionsByImage,
                  [imageId]: mergedSnapshotRegions,
                }
              : snapshot.detectionsByImage,
            selectedRegionByImage: selectedChanged
              ? {
                  ...snapshot.selectedRegionByImage,
                  [imageId]: resolvedSelected,
                }
              : snapshot.selectedRegionByImage,
          };
        });
        return changed ? nextSnapshots : prev;
      });
    },
    [getAioImageSnapshotIndex, resolveSelectedRegionForRegions, setAioPipelineSnapshots],
  );

  const patchAioSnapshotSelectionForImage = useCallback(
    (imageId: string, selectedRegionId: string | null) => {
      const snapshotIndex = getAioImageSnapshotIndex(imageId);
      if (snapshotIndex < 0) return;
      setAioPipelineSnapshots((prev) => {
        if (prev.length === 0 || snapshotIndex >= prev.length) return prev;
        let changed = false;
        const nextSnapshots = prev.map((snapshot, index) => {
          if (index < snapshotIndex) return snapshot;
          const snapshotSelected =
            snapshot.selectedRegionByImage[imageId] ?? null;
          const resolvedSelected = selectedRegionId;
          if (snapshotSelected === resolvedSelected) return snapshot;
          changed = true;
          return {
            ...snapshot,
            selectedRegionByImage: {
              ...snapshot.selectedRegionByImage,
              [imageId]: resolvedSelected,
            },
          };
        });
        return changed ? nextSnapshots : prev;
      });
    },
    [getAioImageSnapshotIndex, setAioPipelineSnapshots],
  );

  const applyAioRegionsEditForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      const clonedRegions = cloneAioRegions(nextRegions, cloneRenderStyle);
      const currentRegions = aioDetectionsByImage[imageId] ?? [];
      const currentSelected = aioSelectedRegionByImage[imageId] ?? null;
      const hasSelectedOverride = selectedRegionIdOverride !== undefined;
      const resolvedSelected = hasSelectedOverride
        ? selectedRegionIdOverride === null
          ? null
          : resolveSelectedRegionForRegions(
              clonedRegions,
              selectedRegionIdOverride,
            )
        : currentSelected === null
          ? null
          : resolveSelectedRegionForRegions(clonedRegions, currentSelected);

      const regionsChanged = !areAioRegionsEqual(
        currentRegions,
        clonedRegions,
        cloneRenderStyle,
      );
      const selectedChanged = currentSelected !== resolvedSelected;
      if (!regionsChanged && !selectedChanged) return;

      setAioDetectionsByImage((prev) => ({
        ...prev,
        [imageId]: clonedRegions,
      }));
      setAioSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: resolvedSelected,
      }));
      patchAioSnapshotsForImageEdit(imageId, clonedRegions, resolvedSelected);
    },
    [
      aioDetectionsByImage,
      aioSelectedRegionByImage,
      patchAioSnapshotsForImageEdit,
      resolveSelectedRegionForRegions,
      setAioDetectionsByImage,
      setAioSelectedRegionByImage,
    ],
  );

  const unlockManualDetectStageIfReady = useCallback(
    (imageId: string, nextRegions: AioTextRegion[]) => {
      if (mode !== 'aio' || subMode !== 'manual') return;
      if (nextRegions.length === 0) return;

      const detectStageIndex = AIO_MANUAL_STAGE_ORDER.indexOf('detectText');
      if (detectStageIndex < 0) return;
      const nextStageIndex = Math.min(
        detectStageIndex + 1,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      if (nextStageIndex === detectStageIndex) return;

      const currentProgress = aioManualProgressByImage[imageId];
      if (!currentProgress || currentProgress.currentIndex !== detectStageIndex)
        return;

      syncManualStagePreviewToNextStage(
        imageId,
        detectStageIndex,
        nextStageIndex,
      );

      setAioManualProgressByImage((prev) => {
        const progress = prev[imageId];
        if (!progress || progress.currentIndex !== detectStageIndex)
          return prev;

        const detectStageKey = AIO_MANUAL_STAGE_ORDER[detectStageIndex];
        const nextStageKey = AIO_MANUAL_STAGE_ORDER[nextStageIndex];
        if (!detectStageKey || !nextStageKey) return prev;
        const nextUnlockedIndex = Math.max(
          progress.unlockedMaxIndex,
          nextStageIndex,
        );
        const nextStatusByStage = { ...progress.statusByStage };
        let changed = false;

        if (nextStatusByStage[detectStageKey] !== 'done') {
          nextStatusByStage[detectStageKey] = 'done';
          changed = true;
        }
        if (nextStatusByStage[nextStageKey] === 'locked') {
          nextStatusByStage[nextStageKey] = 'pending';
          changed = true;
        }
        if (nextUnlockedIndex !== progress.unlockedMaxIndex) {
          changed = true;
        }
        if (!changed) return prev;

        return {
          ...prev,
          [imageId]: {
            ...progress,
            unlockedMaxIndex: nextUnlockedIndex,
            statusByStage: nextStatusByStage,
          },
        };
      });
    },
    [
      aioManualProgressByImage,
      mode,
      setAioManualProgressByImage,
      subMode,
      syncManualStagePreviewToNextStage,
    ],
  );

  const updateAioRegionsForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      applyAioRegionsEditForImage(
        imageId,
        nextRegions,
        selectedRegionIdOverride,
      );
      unlockManualDetectStageIfReady(imageId, nextRegions);
    },
    [applyAioRegionsEditForImage, unlockManualDetectStageIfReady],
  );

  const selectAioRegionForImage = useCallback(
    (imageId: string, regionId: string | null) => {
      const resolvedSelected = regionId;
      setAioSelectedRegionByImage((prev) => {
        if ((prev[imageId] ?? null) === resolvedSelected) return prev;
        return { ...prev, [imageId]: resolvedSelected };
      });
      typographerWorkspace.setSelectedRegionId(imageId, resolvedSelected);
      patchAioSnapshotSelectionForImage(imageId, resolvedSelected);
    },
    [patchAioSnapshotSelectionForImage, setAioSelectedRegionByImage, typographerWorkspace],
  );

  return {
    applyAioRegionsEditForImage,
    selectAioRegionForImage,
    updateAioRegionsForImage,
  };
}

/* ── Render-region editing: style/mode/preset/shape edits + removal ── */

interface UseAioRegionEditingArgs {
  /* Page-derived values (active image memos) */
  activeId: string | null;
  activeSelectedRegionId: string | null;
  activeSelectedRegion: AioTextRegion | null;
  activeImage: LoadedImage | null;
  activeSelectedRenderStyle: RenderTextStyle;
  activeTypographerPreset: TypographyStylePreset | null;
  typographyPresetList: TypographyStylePreset[];
  /* Page callbacks */
  typographerWorkspace: TypographerWorkspaceApi;
  applyAioRegionsEditForImage: (
    imageId: string,
    nextRegions: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  selectAioRegionForImage: (imageId: string, regionId: string | null) => void;
  updateTranslatorRegionsForImage: (
    imageId: string,
    nextRegions: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  updateCleanerRegionsForImage: (
    imageId: string,
    nextRegions: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  /* Cross-domain state not yet in stores (translator T09, cleaner T08) */
  translatorDetectionsByImage: Record<string, AioTextRegion[]>;
  cleanerDetectionsByImage: Record<string, AioTextRegion[]>;
  activeTranslatorSelectedRegionId: string | null;
  activeCleanerSelectedRegionId: string | null;
}

export function useAioRegionEditing({
  activeId,
  activeSelectedRegionId,
  activeSelectedRegion,
  activeImage,
  activeSelectedRenderStyle,
  activeTypographerPreset,
  typographyPresetList,
  typographerWorkspace,
  applyAioRegionsEditForImage,
  selectAioRegionForImage,
  updateTranslatorRegionsForImage,
  updateCleanerRegionsForImage,
  translatorDetectionsByImage,
  cleanerDetectionsByImage,
  activeTranslatorSelectedRegionId,
  activeCleanerSelectedRegionId,
}: UseAioRegionEditingArgs) {
  const { t } = useI18n();
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const mode = useUiShellStore((s) => s.mode);
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  const renderModePresetState = useRegionEditorStore(
    (s) => s.renderModePresetState,
  );
  const typographyPresetState = useRegionEditorStore(
    (s) => s.typographyPresetState,
  );
  const setTypographyPresetState = useRegionEditorStore(
    (s) => s.setTypographyPresetState,
  );
  const setAioDetectionsByImage = useRegionEditorStore(
    (s) => s.setAioDetectionsByImage,
  );
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);

  const updateActiveRenderRegion = useCallback(
    (updater: (region: AioTextRegion) => AioTextRegion) => {
      if (!activeId || !activeSelectedRegionId) return;
      const currentRegions = aioDetectionsByImage[activeId] ?? [];
      const nextRegions = currentRegions.map((region) =>
        region.id === activeSelectedRegionId
          ? updater(
              applyRenderDefaultsToRegion(
                region,
                renderDefaultStyle,
                applyDetectedGradientToStyle,
                undefined,
                aioTgtLang,
              ),
            )
          : region,
      );
      applyAioRegionsEditForImage(
        activeId,
        nextRegions,
        activeSelectedRegionId,
      );
    },
    [
      activeId,
      activeSelectedRegionId,
      aioDetectionsByImage,
      aioTgtLang,
      applyAioRegionsEditForImage,
      renderDefaultStyle,
    ],
  );

  const updateRenderRegionById = useCallback(
    (
      imageId: string,
      regionId: string,
      updater: (region: AioTextRegion) => AioTextRegion,
    ) => {
      const currentRegions = aioDetectionsByImage[imageId] ?? [];
      const nextRegions = currentRegions.map((region) =>
        region.id === regionId
          ? updater(
              applyRenderDefaultsToRegion(
                region,
                renderDefaultStyle,
                applyDetectedGradientToStyle,
                undefined,
                aioTgtLang,
              ),
            )
          : region,
      );
      applyAioRegionsEditForImage(imageId, nextRegions, regionId);
    },
    [
      aioDetectionsByImage,
      aioTgtLang,
      applyAioRegionsEditForImage,
      renderDefaultStyle,
    ],
  );

  const applyTypographyPresetToRegion = useCallback(
    (
      region: AioTextRegion,
      preset: TypographyStylePreset | null,
    ): AioTextRegion => {
      if (!preset) return region;
      const [x1, y1, x2, y2] = region.bbox;
      const width = Math.max(1, x2 - x1);
      const height = Math.max(1, y2 - y1);
      return {
        ...region,
        stylePresetId: preset.id,
        renderStyle: applyDetectedGradientToStyle(
          region,
          createTypographyStyleFromPreset(
            preset,
            cloneRenderStyle(region.renderStyle ?? renderDefaultStyle),
          ),
        ),
        shape: buildShapeFromPreset(preset, width, height),
      };
    },
    [renderDefaultStyle],
  );

  const applyActiveTypographyPresetToSelection = useCallback(() => {
    if (!activeTypographerPreset || !activeId || !activeSelectedRegionId)
      return;
    updateActiveRenderRegion((region) =>
      applyTypographyPresetToRegion(region, activeTypographerPreset),
    );
    setTonedStatus(
      t('dashboard.status.presetAppliedToSelection', { name: activeTypographerPreset.name }),
      'success',
    );
  }, [
    activeId,
    activeSelectedRegionId,
    activeTypographerPreset,
    applyTypographyPresetToRegion,
    setTonedStatus,
    updateActiveRenderRegion,
  ]);

  const applyTypographyPresetToRegionById = useCallback(
    (imageId: string, regionId: string, presetId: string) => {
      const preset =
        typographyPresetList.find((entry) => entry.id === presetId) ?? null;
      if (!preset) return;
      updateRenderRegionById(imageId, regionId, (region) =>
        applyTypographyPresetToRegion(region, preset),
      );
      setTonedStatus(t('dashboard.status.presetAppliedToSelection', { name: preset.name }), 'success');
    },
    [
      applyTypographyPresetToRegion,
      setTonedStatus,
      typographyPresetList,
      updateRenderRegionById,
    ],
  );

  const applyLegacyTypographyPresetToSelection = useCallback(
    (
      modeKey:
        | 'text_bubble'
        | 'text_free'
        | 'text_sfx'
        | 'text_narration'
        | 'text_inside_black_bubble',
    ) => {
      if (!activeSelectedRegion || !activeId) return false;
      const preset = resolveLegacyTypographyPresetForMode(
        modeKey,
        typographyPresetState,
      );
      if (!preset) {
        setTonedStatus(
          t('dashboard.status.legacyPresetNotFound', { modeKey }),
          'error',
        );
        return false;
      }
      updateActiveRenderRegion((region) =>
        applyTypographyPresetToRegion(region, preset),
      );
      typographerWorkspace.setActivePreset(activeId, preset.id);
      setTonedStatus(t('dashboard.status.presetAppliedShort', { name: preset.name }), 'success');
      return true;
    },
    [
      activeId,
      activeSelectedRegion,
      applyTypographyPresetToRegion,
      setStatusMessage,
      setTonedStatus,
      typographyPresetState,
      typographerWorkspace,
      updateActiveRenderRegion,
    ],
  );

  const applyActiveTypographyPresetToImage = useCallback(() => {
    if (!activeTypographerPreset || !activeId) return;
    const currentRegions = aioDetectionsByImage[activeId] ?? [];
    const nextRegions = currentRegions.map((region) =>
      applyTypographyPresetToRegion(region, activeTypographerPreset),
    );
    applyAioRegionsEditForImage(activeId, nextRegions, activeSelectedRegionId);
    setTonedStatus(
      t('dashboard.status.presetAppliedToImage', { name: activeTypographerPreset.name }),
      'success',
    );
  }, [
    activeId,
    activeSelectedRegionId,
    activeTypographerPreset,
    aioDetectionsByImage,
    applyAioRegionsEditForImage,
    applyTypographyPresetToRegion,
    setTonedStatus,
  ]);

  const duplicateSelectedTypographerRegion = useCallback(() => {
    if (!activeId || !activeSelectedRegion) return;
    const [x1, y1, x2, y2] = activeSelectedRegion.bbox;
    const offsetX = 18;
    const offsetY = 18;
    const nextRegion: AioTextRegion = {
      ...cloneAioRegion(activeSelectedRegion, cloneRenderStyle),
      id: `manual-${uuidv4()}`,
      bbox: normalizeRegion(
        x1 + offsetX,
        y1 + offsetY,
        x2 + offsetX,
        y2 + offsetY,
        activeImage?.width ?? x2,
        activeImage?.height ?? y2,
      ),
      source: 'manual',
    };
    applyAioRegionsEditForImage(
      activeId,
      [...(aioDetectionsByImage[activeId] ?? []), nextRegion],
      nextRegion.id,
    );
    setTonedStatus(t('dashboard.status.typographerSelectionDuplicated'), 'success');
  }, [
    activeId,
    activeImage?.height,
    activeImage?.width,
    activeSelectedRegion,
    aioDetectionsByImage,
    applyAioRegionsEditForImage,
    setTonedStatus,
  ]);

  const normalizeActiveTypographerShape = useCallback(
    (
      options: {
        kind?: TypographyShapeKind;
        centerText?: boolean;
        source?: TypographyShape['source'];
        statusMessage?: string;
      } = {},
    ) => {
      if (!activeSelectedRegion) return;
      const shapeKind =
        options.kind ?? resolveRegionShapeKind(activeSelectedRegion);
      const nextSource = options.source ?? 'converted';
      const shouldApplyRefinementShape =
        nextSource === 'refined' &&
        options.centerText === true;
      updateActiveRenderRegion((region) => {
        const nextRegion = shouldApplyRefinementShape
          ? rebuildRegionShapeForRefinement(region, shapeKind, nextSource)
          : rebuildRegionShapeForKind(region, shapeKind, nextSource);
        if (options.centerText) {
          return {
            ...nextRegion,
            renderStyle: {
              ...cloneRenderStyle(nextRegion.renderStyle ?? renderDefaultStyle),
              alignment: 'center',
              ...(shouldApplyRefinementShape ? { autoFontSize: true } : {}),
            },
          };
        }
        return nextRegion;
      });
      if (options.statusMessage) {
        setStatusMessage(options.statusMessage);
      }
    },
    [activeSelectedRegion, setStatusMessage, updateActiveRenderRegion],
  );

  const convertActiveTypographerShape = useCallback(
    (kind: TypographyShapeKind) => {
      normalizeActiveTypographerShape({
        kind,
        source: 'converted',
        statusMessage: `Shape convertido para ${kind === 'rounded' ? 'elliptic' : 'rectangular'}.`,
      });
    },
    [normalizeActiveTypographerShape],
  );

  const applyAutoDetectedShapeToActiveRegion = useCallback(() => {
    if (!activeSelectedRegion) return;
    updateActiveRenderRegion((region) =>
      rebuildRegionShapeForAutoMode(region, 'detected'),
    );
    const nextKind =
      normalizeDetectedRenderMode(activeSelectedRegion.detectedRenderMode) ===
        'text_bubble' ||
      normalizeDetectedRenderMode(activeSelectedRegion.detectedRenderMode) ===
        'text_inside_black_bubble'
        ? 'rounded'
        : 'square';
    setStatusMessage(
      t('dashboard.status.autoShapeApplied', { shape: nextKind === 'rounded' ? 'elliptic' : 'rectangular' }),
    );
  }, [activeSelectedRegion, setStatusMessage, updateActiveRenderRegion]);

  const applyAutoDetectedShapeToRegionById = useCallback(
    (imageId: string, regionId: string) => {
      const region = (aioDetectionsByImage[imageId] ?? []).find(
        (entry) => entry.id === regionId,
      );
      if (!region) return;
      updateRenderRegionById(imageId, regionId, (current) =>
        rebuildRegionShapeForAutoMode(current, 'detected'),
      );
      const detectedMode = normalizeDetectedRenderMode(
        region.detectedRenderMode,
      );
      const nextKind =
        detectedMode === 'text_bubble' ||
        detectedMode === 'text_inside_black_bubble'
          ? 'rounded'
          : 'square';
      setStatusMessage(
        t('dashboard.status.autoShapeApplied', { shape: nextKind === 'rounded' ? 'elliptic' : 'rectangular' }),
      );
    },
    [aioDetectionsByImage, setStatusMessage, updateRenderRegionById],
  );

  const convertRegionShapeById = useCallback(
    (imageId: string, regionId: string, kind: TypographyShapeKind) => {
      updateRenderRegionById(imageId, regionId, (region) =>
        rebuildRegionShapeForKind(region, kind, 'converted'),
      );
      setStatusMessage(
        `Shape convertido para ${kind === 'rounded' ? 'elliptic' : 'rectangular'}.`,
      );
    },
    [setStatusMessage, updateRenderRegionById],
  );

  const handleUpdateTypographyPreset = useCallback(
    (presetId: string, patch: Partial<TypographyStylePreset>) => {
      const result = updateTypographyPreset(presetId, patch, typographyPresetState);
      setTypographyPresetState(result.state);
    },
    [setTypographyPresetState, typographyPresetState],
  );

  const navigateActiveTypographerRegion = useCallback(
    (delta: number) => {
      if (!activeId) return;
      const regions = aioDetectionsByImage[activeId] ?? [];
      if (regions.length === 0) return;
      const currentIndex = regions.findIndex(
        (region) => region.id === activeSelectedRegionId,
      );
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = clamp(safeIndex + delta, 0, regions.length - 1);
      const nextRegion = regions[nextIndex];
      if (!nextRegion) return;
      selectAioRegionForImage(activeId, nextRegion.id);
    },
    [
      activeId,
      activeSelectedRegionId,
      aioDetectionsByImage,
      selectAioRegionForImage,
    ],
  );

  const removeSelectedAioRegion = useCallback(() => {
    if (!activeId) return;

    if (mode === 'translator') {
      if (!activeTranslatorSelectedRegionId) return;
      const currentRegions = translatorDetectionsByImage[activeId] ?? [];
      const nextRegions = currentRegions.filter(
        (region) => region.id !== activeTranslatorSelectedRegionId,
      );
      updateTranslatorRegionsForImage(activeId, nextRegions, null);
      return;
    }

    if (mode === 'cleaner') {
      if (!activeCleanerSelectedRegionId) return;
      const currentRegions = cleanerDetectionsByImage[activeId] ?? [];
      const nextRegions = currentRegions.filter(
        (region) => region.id !== activeCleanerSelectedRegionId,
      );
      updateCleanerRegionsForImage(activeId, nextRegions, null);
      return;
    }

    if (!activeSelectedRegionId) return;

    if (activeSelectedRegionId.startsWith(TRANSLATION_NOTE_REGION_PREFIX)) {
      const parentId = activeSelectedRegionId.slice(
        TRANSLATION_NOTE_REGION_PREFIX.length,
      );
      const currentRegions = aioDetectionsByImage[activeId] ?? [];
      const nextRegions = currentRegions.map((region) =>
        region.id === parentId
          ? {
              ...region,
              translationNotes: undefined,
              translationNoteOverlay: undefined,
            }
          : region,
      );
      applyAioRegionsEditForImage(activeId, nextRegions, parentId);
      return;
    }

    const currentRegions = aioDetectionsByImage[activeId] ?? [];
    const nextRegions = currentRegions.filter(
      (region) => region.id !== activeSelectedRegionId,
    );
    applyAioRegionsEditForImage(activeId, nextRegions, null);
  }, [
    activeCleanerSelectedRegionId,
    activeId,
    activeSelectedRegionId,
    activeTranslatorSelectedRegionId,
    aioDetectionsByImage,
    applyAioRegionsEditForImage,
    cleanerDetectionsByImage,
    mode,
    translatorDetectionsByImage,
    updateCleanerRegionsForImage,
    updateTranslatorRegionsForImage,
  ]);

  const clearAioRegionsForActiveImage = useCallback(() => {
    if (!activeId) return;
    applyAioRegionsEditForImage(activeId, [], null);
  }, [activeId, applyAioRegionsEditForImage]);

  const updateActiveRenderMode = useCallback(
    (nextMode: RenderTextMode) => {
      updateActiveRenderRegion((region) => {
        const currentStyle = cloneRenderStyle(
          region.renderStyle ?? renderDefaultStyle,
        );
        const detectedRenderMode = region.detectedRenderMode ?? 'text_bubble';
        const resolvedMode =
          nextMode === 'auto' ? detectedRenderMode : nextMode;
        const typographyPreset = resolveTypographyPresetForMode(
          resolvedMode,
          typographyPresetState,
        );
        const presetStyle = typographyPreset
          ? createTypographyStyleFromPreset(
              typographyPreset,
              renderDefaultStyle,
            )
          : getRenderModePresetStyle(
              nextMode,
              renderDefaultStyle,
              detectedRenderMode,
              renderModePresetState.presets,
            );
        const [x1, y1, x2, y2] = region.bbox;
        return {
          ...region,
          renderMode: nextMode,
          stylePresetId: typographyPreset?.id ?? region.stylePresetId ?? null,
          renderStyle: applyDetectedGradientToStyle(region, {
            ...presetStyle,
            hyphenationEnabled: currentStyle.hyphenationEnabled,
            rotation: currentStyle.rotation,
          }),
          shape: typographyPreset
            ? buildShapeFromPreset(typographyPreset, x2 - x1, y2 - y1)
            : region.shape,
        };
      });
    },
    [
      renderDefaultStyle,
      renderModePresetState.presets,
      typographyPresetState,
      updateActiveRenderRegion,
    ],
  );

  const applyActiveRenderStyleToAllRegions = useCallback(() => {
    if (!activeSelectedRegion) return;
    const styleSnapshot = cloneRenderStyle(activeSelectedRenderStyle);
    Object.entries(aioDetectionsByImage).forEach(([imageId, regions]) => {
      const nextRegions = regions.map((region) => {
        const withDefaults = applyRenderDefaultsToRegion(
          region,
          renderDefaultStyle,
          applyDetectedGradientToStyle,
          undefined,
          aioTgtLang,
        );
        return {
          ...withDefaults,
          renderStyle: cloneRenderStyle(styleSnapshot),
        };
      });
      applyAioRegionsEditForImage(
        imageId,
        nextRegions,
        aioSelectedRegionByImage[imageId] ?? null,
      );
    });
    setTonedStatus(
      t('dashboard.status.renderStyleAppliedAll'),
      'success',
    );
  }, [
    activeSelectedRegion,
    activeSelectedRenderStyle,
    aioDetectionsByImage,
    aioSelectedRegionByImage,
    aioTgtLang,
    applyAioRegionsEditForImage,
    renderDefaultStyle,
    setTonedStatus,
  ]);

  const ensureRenderDefaultsInAllRegions = useCallback(() => {
    setAioDetectionsByImage((prev) => {
      let changed = false;
      const next: Record<string, AioTextRegion[]> = {};
      for (const [imageId, regions] of Object.entries(prev)) {
        const needsDefaults = regions.some(
          (region) =>
            region.renderText === undefined ||
            !region.renderStyle ||
            !region.renderMode ||
            !region.detectedRenderMode,
        );
        if (!needsDefaults) {
          next[imageId] = regions;
          continue;
        }
        changed = true;
        next[imageId] = regions.map((region) =>
          applyRenderDefaultsToRegion(
            region,
            renderDefaultStyle,
            applyDetectedGradientToStyle,
            undefined,
            aioTgtLang,
          ),
        );
      }
      return changed ? next : prev;
    });
  }, [aioTgtLang, renderDefaultStyle, setAioDetectionsByImage]);

  // Narrow selector: the effect only depends on the `render` toggle, so it
  // re-runs exactly when that boolean flips (same cadence as the baseline
  // `aioSteps.render` dep without subscribing to the whole toggles object).
  const aioStepsRender = useAioPipelineStore((s) => s.aioSteps.render);

  useEffect(() => {
    if (!aioStepsRender) return;
    ensureRenderDefaultsInAllRegions();
  }, [aioStepsRender, ensureRenderDefaultsInAllRegions]);

  return {
    applyActiveTypographyPresetToImage,
    applyActiveTypographyPresetToSelection,
    applyActiveRenderStyleToAllRegions,
    applyAutoDetectedShapeToActiveRegion,
    applyAutoDetectedShapeToRegionById,
    applyLegacyTypographyPresetToSelection,
    applyTypographyPresetToRegionById,
    clearAioRegionsForActiveImage,
    convertActiveTypographerShape,
    convertRegionShapeById,
    duplicateSelectedTypographerRegion,
    ensureRenderDefaultsInAllRegions,
    handleUpdateTypographyPreset,
    navigateActiveTypographerRegion,
    normalizeActiveTypographerShape,
    removeSelectedAioRegion,
    updateActiveRenderMode,
    updateActiveRenderRegion,
  };
}

/* ── Export rendering: composites the edited canvas and draws the regions ── */

interface UseAioRegionRenderToBlobArgs {
  /* Page callbacks / export-download state (T10) */
  composeAioEditableCanvas: AioManualImageEditComposer;
  downloadItems: DownloadItem[];
  outFormat: string;
  outQuality: number;
}

export function useAioRegionRenderToBlob({
  composeAioEditableCanvas,
  downloadItems,
  outFormat,
  outQuality,
}: UseAioRegionRenderToBlobArgs) {
  const { t } = useI18n();
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);

  const renderAioImageToBlob = useCallback(
    async (imgData: LoadedImage, regions: AioTextRegion[]): Promise<Blob> => {
      const baseItem = downloadItems.find(
        (item) => item.scope === 'aio' && item.sourceImageId === imgData.id,
      );
      const canvas = await composeAioEditableCanvas(
        imgData,
        baseItem?.previewUrl ?? imgData.url,
      );
      const renderWidth = canvas.width;
      const renderHeight = canvas.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('dashboard.status.renderCanvasInitFailed'));
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const baseRenderRegions = regions.map((item) =>
        applyRenderDefaultsToRegion(
          item,
          renderDefaultStyle,
          applyDetectedGradientToStyle,
          undefined,
          aioTgtLang,
        ),
      );
      const renderRegions = [
        ...baseRenderRegions,
        ...buildTranslationNoteOverlayRegions(
          baseRenderRegions,
          imgData.width,
          imgData.height,
          renderDefaultStyle,
          llmSettings.translation_notes_enabled,
        ),
      ];
      await Promise.all(
        renderRegions.map(async (region) => {
          const style = cloneRenderStyle(
            region.renderStyle ?? renderDefaultStyle,
          );
          await ensureCanvasFontLoaded(style, region.renderTextStyleRanges);
        }),
      );

      const scaleX = renderWidth / Math.max(1, imgData.width);
      const scaleY = renderHeight / Math.max(1, imgData.height);
      for (const region of renderRegions) {
        const text = buildDefaultRegionRenderText(region);
        if (!text.trim()) continue;
        const style = cloneRenderStyle(
          region.renderStyle ?? renderDefaultStyle,
        );
        const [x1, y1, x2, y2] = region.bbox;
        const scaledBbox: [number, number, number, number] = [
          Math.round(x1 * scaleX),
          Math.round(y1 * scaleY),
          Math.round(x2 * scaleX),
          Math.round(y2 * scaleY),
        ];
        const scaledShape = scaleTypographyShapeForBounds(
          region.shape,
          region.bbox,
          scaledBbox,
        );
        const width = Math.max(1, scaledBbox[2] - scaledBbox[0]);
        const height = Math.max(1, scaledBbox[3] - scaledBbox[1]);
        const layout = computeRenderTextLayout(
          ctx,
          text,
          width,
          height,
          style,
          scaledShape,
          region.renderTextStyleRanges,
        );
        drawRenderedTextInRegion(ctx, scaledBbox, layout, style, scaledShape);
      }

      return canvasToBlob(canvas, outFormat, outQuality);
    },
    [
      aioTgtLang,
      composeAioEditableCanvas,
      downloadItems,
      llmSettings.translation_notes_enabled,
      outFormat,
      outQuality,
      renderDefaultStyle,
    ],
  );

  return { renderAioImageToBlob };
}

/* ── Active region state: memos derived from the region-editor stores for the
   active image (page consumers: region editing hooks + stage/layout views) ── */

export function useActiveAioRegionState({ resolvedActiveId }: { resolvedActiveId: string | null }) {
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const typographyPresetState = useRegionEditorStore(
    (s) => s.typographyPresetState,
  );
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  const textFillSwatchState = useRegionEditorStore(
    (s) => s.textFillSwatchState,
  );
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const textFillSwatches = useMemo(
    () => listTextFillSwatches(textFillSwatchState),
    [textFillSwatchState],
  );
  const typographyPresetList = useMemo(
    () =>
      [...typographyPresetState.presets].sort((left, right) =>
        left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [typographyPresetState.presets],
  );
  const typographyFolderList = useMemo(
    () => [...typographyPresetState.folders].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'pt-BR')),
    [typographyPresetState.folders],
  );
  const defaultBubbleTypographyPreset = useMemo(
    () => resolveTypographyPresetForMode('text_bubble', typographyPresetState),
    [typographyPresetState],
  );
  const activeImageDetections = useMemo(
    () =>
      resolvedActiveId ? (aioDetectionsByImage[resolvedActiveId] ?? []) : [],
    [aioDetectionsByImage, resolvedActiveId],
  );
  const activeSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (aioSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [aioSelectedRegionByImage, resolvedActiveId],
  );
  const activeSelectedRegion = useMemo(
    () =>
      activeImageDetections.find(
        (region) => region.id === activeSelectedRegionId,
      ) ?? null,
    [activeImageDetections, activeSelectedRegionId],
  );
  const activeSelectedRenderStyle = useMemo(
    () =>
      cloneRenderStyle(activeSelectedRegion?.renderStyle ?? renderDefaultStyle),
    [activeSelectedRegion?.renderStyle, renderDefaultStyle],
  );
  const activeSelectedRenderMode = useMemo<RenderTextMode>(
    () => activeSelectedRegion?.renderMode ?? 'auto',
    [activeSelectedRegion?.renderMode],
  );
  const activeSelectedDetectedRenderMode = useMemo(
    () => activeSelectedRegion?.detectedRenderMode ?? 'text_bubble',
    [activeSelectedRegion?.detectedRenderMode],
  );
  const activeSelectedResolvedRenderMode = useMemo(
    () =>
      resolveRenderTextMode({
        renderMode: activeSelectedRenderMode,
        detectedRenderMode: activeSelectedDetectedRenderMode,
      }),
    [activeSelectedDetectedRenderMode, activeSelectedRenderMode],
  );
  const activeSelectedTranslationNotes = useMemo(
    () =>
      activeSelectedRegion
        ? getRegionTranslationNotesForDisplay(
            activeSelectedRegion,
            llmSettings.translation_notes_enabled,
          )
        : [],
    [activeSelectedRegion, llmSettings.translation_notes_enabled],
  );

  return {
    textFillSwatches,
    typographyPresetList,
    typographyFolderList,
    defaultBubbleTypographyPreset,
    activeImageDetections,
    activeSelectedRegionId,
    activeSelectedRegion,
    activeSelectedRenderStyle,
    activeSelectedRenderMode,
    activeSelectedDetectedRenderMode,
    activeSelectedResolvedRenderMode,
    activeSelectedTranslationNotes,
  };
}
