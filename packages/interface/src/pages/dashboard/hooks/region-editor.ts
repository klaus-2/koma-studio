/**
 * AIO region editor domain — entry point. Hosts the render-region editing
 * hook (style/mode/preset/shape edits + removal) and re-exports the
 * per-concern sibling modules split out in T10, so consumer imports from
 * 'hooks/region-editor' stay valid.
 */
import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useI18n } from '../../../i18n';
import { TRANSLATION_NOTE_REGION_PREFIX } from '../../../constants/dashboard.constants';
import {
  applyDetectedGradientToStyle,
  applyRenderDefaultsToRegion,
  clamp,
  cloneAioRegion,
  cloneRenderStyle,
  normalizeRegion,
  rebuildRegionShapeForAutoMode,
  rebuildRegionShapeForKind,
  rebuildRegionShapeForRefinement,
  resolveRegionShapeKind,
} from '../../../utils/dashboard.utils';
import {
  getRenderModePresetStyle,
  normalizeDetectedRenderMode,
  type RenderTextMode,
} from '../../../utils/renderModes';
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
import type {
  AioTextRegion,
} from '../../../types/dashboard.types';
import type { useTypographerWorkspace } from './typographer';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import {
  readActiveAioSelectedRegion,
  readActiveAioSelectedRegionId,
  readActiveTypographerPreset,
} from './region-editor.render';

export { useAioRegionSnapshotSync } from './region-editor.snapshot';
export {
  useAioRegionRenderToBlob,
  useActiveAioRegionState,
  readActiveAioSelectedRegion,
  readActiveAioSelectedRegionId,
  readActiveSelectedRegionIdForMode,
  readActiveTypographerPreset,
} from './region-editor.render';

type TypographerWorkspaceApi = ReturnType<typeof useTypographerWorkspace>;

/* ── Render-region editing: style/mode/preset/shape edits + removal ── */

interface UseAioRegionEditingArgs {
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
  translatorDetectionsByImage: () => Record<string, AioTextRegion[]>;
  cleanerDetectionsByImage: () => Record<string, AioTextRegion[]>;
}

export function useAioRegionEditing({
  typographerWorkspace,
  applyAioRegionsEditForImage,
  selectAioRegionForImage,
  updateTranslatorRegionsForImage,
  updateCleanerRegionsForImage,
  translatorDetectionsByImage,
  cleanerDetectionsByImage,
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
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);

  const updateActiveRenderRegion = useCallback(
    (updater: (region: AioTextRegion) => AioTextRegion) => {
      const activeId = useImageCollectionStore.getState().activeId;
      const activeSelectedRegionId = readActiveAioSelectedRegionId(activeId);
      if (!activeId || !activeSelectedRegionId) return;
      const currentRegions =
        useRegionEditorStore.getState().aioDetectionsByImage[activeId] ?? [];
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
      const currentRegions =
        useRegionEditorStore.getState().aioDetectionsByImage[imageId] ?? [];
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
    const activeId = useImageCollectionStore.getState().activeId;
    const activeTypographerPreset = readActiveTypographerPreset(activeId);
    const activeSelectedRegionId = readActiveAioSelectedRegionId(activeId);
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
    applyTypographyPresetToRegion,
    setTonedStatus,
    updateActiveRenderRegion,
  ]);

  const applyTypographyPresetToRegionById = useCallback(
    (imageId: string, regionId: string, presetId: string) => {
      const preset =
        typographyPresetState.presets.find((entry) => entry.id === presetId) ?? null;
      if (!preset) return;
      updateRenderRegionById(imageId, regionId, (region) =>
        applyTypographyPresetToRegion(region, preset),
      );
      setTonedStatus(t('dashboard.status.presetAppliedToSelection', { name: preset.name }), 'success');
    },
    [
      applyTypographyPresetToRegion,
      setTonedStatus,
      typographyPresetState.presets,
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
      const activeId = useImageCollectionStore.getState().activeId;
      const activeSelectedRegion = readActiveAioSelectedRegion(activeId);
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
      applyTypographyPresetToRegion,
      setTonedStatus,
      typographyPresetState,
      typographerWorkspace,
      updateActiveRenderRegion,
    ],
  );

  const applyActiveTypographyPresetToImage = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    const activeTypographerPreset = readActiveTypographerPreset(activeId);
    const activeSelectedRegionId = readActiveAioSelectedRegionId(activeId);
    if (!activeTypographerPreset || !activeId) return;
    const currentRegions =
      useRegionEditorStore.getState().aioDetectionsByImage[activeId] ?? [];
    const nextRegions = currentRegions.map((region) =>
      applyTypographyPresetToRegion(region, activeTypographerPreset),
    );
    applyAioRegionsEditForImage(activeId, nextRegions, activeSelectedRegionId);
    setTonedStatus(
      t('dashboard.status.presetAppliedToImage', { name: activeTypographerPreset.name }),
      'success',
    );
  }, [
    applyAioRegionsEditForImage,
    applyTypographyPresetToRegion,
    setTonedStatus,
  ]);

  const duplicateSelectedTypographerRegion = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    const activeSelectedRegion = readActiveAioSelectedRegion(activeId);
    if (!activeId || !activeSelectedRegion) return;
    const activeImage = useImageCollectionStore
      .getState()
      .images.find((img) => img.id === activeId);
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
      [
        ...(useRegionEditorStore.getState().aioDetectionsByImage[activeId] ??
          []),
        nextRegion,
      ],
      nextRegion.id,
    );
    setTonedStatus(t('dashboard.status.typographerSelectionDuplicated'), 'success');
  }, [
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
      const activeSelectedRegion = readActiveAioSelectedRegion(
        useImageCollectionStore.getState().activeId,
      );
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
    [
      renderDefaultStyle,
      setStatusMessage,
      updateActiveRenderRegion,
    ],
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
    const activeSelectedRegion = readActiveAioSelectedRegion(
      useImageCollectionStore.getState().activeId,
    );
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
  }, [setStatusMessage, updateActiveRenderRegion]);

  const applyAutoDetectedShapeToRegionById = useCallback(
    (imageId: string, regionId: string) => {
      const region = (
        useRegionEditorStore.getState().aioDetectionsByImage[imageId] ?? []
      ).find((entry) => entry.id === regionId);
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
    [setStatusMessage, updateRenderRegionById],
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
      const activeId = useImageCollectionStore.getState().activeId;
      if (!activeId) return;
      const regions =
        useRegionEditorStore.getState().aioDetectionsByImage[activeId] ?? [];
      if (regions.length === 0) return;
      const activeSelectedRegionId = readActiveAioSelectedRegionId(activeId);
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
      selectAioRegionForImage,
    ],
  );

  const removeSelectedAioRegion = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId) return;

    if (mode === 'translator') {
      const activeTranslatorSelectedRegionId =
        useTranslatorStore.getState().translatorSelectedRegionByImage[activeId] ??
        null;
      if (!activeTranslatorSelectedRegionId) return;
      const currentRegions = translatorDetectionsByImage()[activeId] ?? [];
      const nextRegions = currentRegions.filter(
        (region) => region.id !== activeTranslatorSelectedRegionId,
      );
      updateTranslatorRegionsForImage(activeId, nextRegions, null);
      return;
    }

    if (mode === 'cleaner') {
      const activeCleanerSelectedRegionId =
        useCleanerStore.getState().cleanerSelectedRegionByImage[activeId] ?? null;
      if (!activeCleanerSelectedRegionId) return;
      const currentRegions = cleanerDetectionsByImage()[activeId] ?? [];
      const nextRegions = currentRegions.filter(
        (region) => region.id !== activeCleanerSelectedRegionId,
      );
      updateCleanerRegionsForImage(activeId, nextRegions, null);
      return;
    }

    const activeSelectedRegionId = readActiveAioSelectedRegionId(activeId);
    if (!activeSelectedRegionId) return;

    if (activeSelectedRegionId.startsWith(TRANSLATION_NOTE_REGION_PREFIX)) {
      const parentId = activeSelectedRegionId.slice(
        TRANSLATION_NOTE_REGION_PREFIX.length,
      );
      const currentRegions =
        useRegionEditorStore.getState().aioDetectionsByImage[activeId] ?? [];
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

    const currentRegions =
      useRegionEditorStore.getState().aioDetectionsByImage[activeId] ?? [];
    const nextRegions = currentRegions.filter(
      (region) => region.id !== activeSelectedRegionId,
    );
    applyAioRegionsEditForImage(activeId, nextRegions, null);
  }, [
    applyAioRegionsEditForImage,
    cleanerDetectionsByImage,
    mode,
    translatorDetectionsByImage,
    updateCleanerRegionsForImage,
    updateTranslatorRegionsForImage,
  ]);

  const clearAioRegionsForActiveImage = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId) return;
    applyAioRegionsEditForImage(activeId, [], null);
  }, [applyAioRegionsEditForImage]);

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
    const activeId = useImageCollectionStore.getState().activeId;
    const activeSelectedRegion = readActiveAioSelectedRegion(activeId);
    if (!activeSelectedRegion) return;
    const styleSnapshot = cloneRenderStyle(
      activeSelectedRegion.renderStyle ?? renderDefaultStyle,
    );
    const { aioSelectedRegionByImage } = useRegionEditorStore.getState();
    Object.entries(useRegionEditorStore.getState().aioDetectionsByImage).forEach(
      ([imageId, regions]) => {
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
      },
    );
    setTonedStatus(
      t('dashboard.status.renderStyleAppliedAll'),
      'success',
    );
  }, [
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
