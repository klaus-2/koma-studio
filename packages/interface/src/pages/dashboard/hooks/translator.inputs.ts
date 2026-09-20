/**
 * Translator inputs & region state — per-image visual region update/select
 * callbacks, the text-import/image-upload entry points, and the active-image
 * region memos (incl. translation-notes display state). Split out of
 * translator.ts (T10); the entry file keeps the visual batch run and
 * re-exports this module.
 */
import { useCallback, useMemo } from 'react';

import {
  cloneAioRegionsCoW,
  cloneRenderStyle,
  getRegionTranslationNotesForDisplay,
  isDirectImageUploadFile,
  resolveSelectedRegionForRegions,
} from '../../../utils/dashboard.utils';
import type { AioTextRegion } from '../../../types/dashboard.types';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';

/* ── Region callbacks (update/select per-image visual regions) ── */

export function useTranslatorRegionEditing() {
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const setTranslatorDetectionsByImage = useTranslatorStore(
    (s) => s.setTranslatorDetectionsByImage,
  );
  const setTranslatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.setTranslatorSelectedRegionByImage,
  );

  const updateTranslatorRegionsForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      // Clone-on-write: untouched regions keep their identity (see
      // cloneAioRegionsCoW) so the preview canvas and memoized boxes don't
      // churn on every edit.
      const { regions: clonedRegions } = cloneAioRegionsCoW(
        nextRegions,
        translatorDetectionsByImage[imageId],
        cloneRenderStyle,
      );
      setTranslatorDetectionsByImage((prev) => ({
        ...prev,
        [imageId]: clonedRegions,
      }));
      setTranslatorSelectedRegionByImage((prev) => {
        const currentSelected = prev[imageId] ?? null;
        const resolvedSelected =
          selectedRegionIdOverride === undefined
            ? resolveSelectedRegionForRegions(clonedRegions, currentSelected)
            : resolveSelectedRegionForRegions(
                clonedRegions,
                selectedRegionIdOverride,
              );
        return {
          ...prev,
          [imageId]: resolvedSelected,
        };
      });
    },
    [
      resolveSelectedRegionForRegions,
      setTranslatorDetectionsByImage,
      setTranslatorSelectedRegionByImage,
    ],
  );

  const selectTranslatorRegionForImage = useCallback(
    (imageId: string, regionId: string | null) => {
      const regions = translatorDetectionsByImage[imageId] ?? [];
      const resolvedSelected = resolveSelectedRegionForRegions(
        regions,
        regionId,
      );
      setTranslatorSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: resolvedSelected,
      }));
    },
    [
      resolveSelectedRegionForRegions,
      setTranslatorSelectedRegionByImage,
      translatorDetectionsByImage,
    ],
  );

  return { updateTranslatorRegionsForImage, selectTranslatorRegionForImage };
}

/* ── Text file import + image upload entry points ── */

interface UseTranslatorImportsArgs {
  /* Cross-domain callback (image-collection uploads) */
  onDrop: (files: File[]) => Promise<void>;
}

export function useTranslatorImports({
  onDrop,
}: UseTranslatorImportsArgs) {
  const setTranslatorDraftText = useTranslatorStore(
    (s) => s.setTranslatorDraftText,
  );
  const setTranslatorTextDirty = useTranslatorStore(
    (s) => s.setTranslatorTextDirty,
  );
  const setTranslatorWorkspaceMode = useTranslatorStore(
    (s) => s.setTranslatorWorkspaceMode,
  );
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  const handleTranslatorTextImport = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      setTranslatorDraftText(content);
      setTranslatorTextDirty(true);
      setStatusMessage(`Text "${file.name}" imported into the Translator.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to import the text into the Translator.');
    }
  }, [setStatusMessage, setTranslatorDraftText, setTranslatorTextDirty]);

  const handleTranslatorImageUpload = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []).filter(isDirectImageUploadFile);
    event.target.value = '';
    if (files.length === 0) {
      setStatusMessage('Select at least one PNG/JPG/WEBP image for the visual Translator.');
      return;
    }
    setTranslatorWorkspaceMode('visual');
    await onDrop(files);
  }, [onDrop, setStatusMessage, setTranslatorWorkspaceMode]);

  return {
    handleTranslatorTextImport,
    handleTranslatorImageUpload,
  };
}

/* ── Active translator region state: memos for the active image
   (translator store + llm translation-notes setting) ── */

export function useActiveTranslatorRegionState({ resolvedActiveId }: { resolvedActiveId: string | null }) {
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const translatorSelectedRegionByImage = useTranslatorStore(
    (s) => s.translatorSelectedRegionByImage,
  );
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const activeTranslatorImageDetections = useMemo(
    () =>
      resolvedActiveId
        ? (translatorDetectionsByImage[resolvedActiveId] ?? [])
        : [],
    [resolvedActiveId, translatorDetectionsByImage],
  );
  const activeTranslatorSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (translatorSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [resolvedActiveId, translatorSelectedRegionByImage],
  );
  const activeTranslatorSelectedRegion = useMemo(
    () =>
      activeTranslatorImageDetections.find(
        (region) => region.id === activeTranslatorSelectedRegionId,
      ) ?? null,
    [activeTranslatorImageDetections, activeTranslatorSelectedRegionId],
  );
  const activeTranslatorSelectedTranslationNotes = useMemo(
    () =>
      activeTranslatorSelectedRegion
        ? getRegionTranslationNotesForDisplay(
            activeTranslatorSelectedRegion,
            llmSettings.translation_notes_enabled,
          )
        : [],
    [activeTranslatorSelectedRegion, llmSettings.translation_notes_enabled],
  );

  return {
    activeTranslatorImageDetections,
    activeTranslatorSelectedRegionId,
    activeTranslatorSelectedRegion,
    activeTranslatorSelectedTranslationNotes,
  };
}
