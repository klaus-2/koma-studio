import type {
  AioManualStageStatus,
  AioPipelineSnapshotKey,
} from "../../../../packages/interface/src/types/dashboard.types";
import { useAioPipelineStore } from "../../../../packages/interface/src/pages/dashboard/stores/aio-pipeline-store";
import { useImageCollectionStore } from "../../../../packages/interface/src/pages/dashboard/stores/image-collection-store";
import { useManualToolsStore } from "../../../../packages/interface/src/pages/dashboard/stores/manual-tools-store";
import { useRegionEditorStore } from "../../../../packages/interface/src/pages/dashboard/stores/region-editor-store";
import { useUiShellStore } from "../../../../packages/interface/src/pages/dashboard/stores/ui-shell-store";

export interface KomaE2EManualEditState {
  paint: boolean;
  wand: boolean;
  segment: boolean;
  base: boolean;
}

export interface KomaE2EImageSummary {
  id: string;
  name: string;
  regions: number;
}

export interface KomaE2EStateBridge {
  aioSnapshots(): number;
  processing(): boolean;
  imageCount(): number;
  imageSummaries(): KomaE2EImageSummary[];
  activeImageId(): string | null;
  manualTool(): string;
  segmentTool(): string;
  manualStageIndex(): number;
  setManualStageIndex(index: number): void;
  manualToolsConfigOpen(): boolean;
  areaCreateMode(): string;
  selectFirstRegion(): string | null;
  clearRegionSelection(): void;
  regionCount(imageId: string): number;
  manualEdit(imageId: string): KomaE2EManualEditState;
  baseSignature(imageId: string): string | null;
}

export const installE2eState = (): void => {
  window.__komaE2E = {
    aioSnapshots: () =>
      useAioPipelineStore.getState().aioPipelineSnapshots.length,
    processing: () => useUiShellStore.getState().processing,
    imageCount: () => useImageCollectionStore.getState().images.length,
    imageSummaries: () => {
      const images = useImageCollectionStore.getState().images;
      const regions = useRegionEditorStore.getState().aioDetectionsByImage;
      return images.map((image) => ({
        id: image.id,
        name: image.file.name,
        regions: (regions[image.id] ?? []).length,
      }));
    },
    activeImageId: () => useImageCollectionStore.getState().activeId ?? null,
    manualTool: () => useManualToolsStore.getState().manualImageTool,
    segmentTool: () => useManualToolsStore.getState().segmentEditTool,
    manualStageIndex: () => {
      const imageId = useImageCollectionStore.getState().activeId;
      if (!imageId) return 0;
      return (
        useAioPipelineStore.getState().aioManualProgressByImage[imageId]
          ?.currentIndex ?? 0
      );
    },
    setManualStageIndex: (index: number) => {
      const imageId = useImageCollectionStore.getState().activeId;
      if (!imageId) return;
      const statusByStage: Record<
        AioPipelineSnapshotKey,
        AioManualStageStatus
      > = {
        detectText: "done",
        recognizeText: "done",
        getTranslations: "done",
        segmentText: "done",
        cleanImage: "done",
        render: "done",
      };
      useAioPipelineStore.getState().setAioManualProgressByImage({
        [imageId]: {
          currentIndex: index,
          unlockedMaxIndex: index,
          statusByStage,
        },
      });
    },
    manualToolsConfigOpen: () =>
      useManualToolsStore.getState().manualToolsConfigOpen,
    areaCreateMode: () =>
      useManualToolsStore.getState().areaSelectionCreateMode,
    selectFirstRegion: () => {
      const imageId = useImageCollectionStore.getState().activeId;
      if (!imageId) return null;
      const regions =
        useRegionEditorStore.getState().aioDetectionsByImage[imageId] ?? [];
      const first = regions[0];
      if (!first) return null;
      useRegionEditorStore
        .getState()
        .setAioSelectedRegionByImage({ [imageId]: first.id });
      return first.id;
    },
    clearRegionSelection: () => {
      const imageId = useImageCollectionStore.getState().activeId;
      if (!imageId) return;
      useRegionEditorStore
        .getState()
        .setAioSelectedRegionByImage({ [imageId]: null });
    },
    regionCount: (imageId: string) =>
      (useRegionEditorStore.getState().aioDetectionsByImage[imageId] ?? [])
        .length,
    manualEdit: (imageId: string): KomaE2EManualEditState => {
      const state =
        useManualToolsStore.getState().aioManualImageEditsByImage[imageId];
      return {
        paint: Boolean(state?.paintLayerDataUrl),
        wand: Boolean(state?.wandMaskDataUrl),
        segment: Boolean(state?.segmentBrushDataUrl),
        base: Boolean(state?.baseImageDataUrl),
      };
    },
    baseSignature: (imageId: string): string | null => {
      const url =
        useManualToolsStore.getState().aioManualImageEditsByImage[imageId]
          ?.baseImageDataUrl;
      return url ? `${url.length}:${url.slice(0, 64)}:${url.slice(-64)}` : null;
    },
  };
};
