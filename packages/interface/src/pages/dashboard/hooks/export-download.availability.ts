import { INFO_MODES } from '../../../constants/dashboard.constants';
import type {
  LoadedImage,
  ProcessableMode,
} from '../../../types/dashboard.types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';

export function useExportDownloadAvailability({ activeImage }: { activeImage: LoadedImage | null }) {
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const images = useImageCollectionStore((s) => s.images);
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioAiEnabled = useAioPipelineStore((s) => s.aioAiEnabled);
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const translatorTranslatedText = useTranslatorStore(
    (s) => s.translatorTranslatedText,
  );
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => s.translatorDetectionsByImage,
  );
  const downloadItems = useExportStore((s) => s.downloadItems);
  const lastActionScope = useExportStore((s) => s.lastActionScope);
  const isProcessableMode =
    !INFO_MODES.includes(mode) &&
    mode !== 'blogger' &&
    mode !== 'imgur';
  const hasRenderableAioOutput =
    mode === 'aio' &&
    !(subMode === 'auto' && aioAiEnabled) &&
    aioSteps.render &&
    images.length > 0;
  const hasRenderableTypographerOutput =
    mode === 'typesetter' && images.length > 0;
  const hasAioTextOutput = useRegionEditorStore((s) =>
    mode === 'aio' &&
    images.some((img) =>
      (s.aioDetectionsByImage[img.id] ?? []).some(
        (region) =>
          (region.recognizedText ?? '').trim().length > 0 ||
          (region.translatedText ?? '').trim().length > 0,
      ),
    ),
  );
  const translatorTextHasDownload = translatorTranslatedText.trim().length > 0;
  const translatorVisualHasDownload = images.some((img) => {
    const regions = translatorDetectionsByImage[img.id] ?? [];
    return regions.some(
      (region) =>
        (region.recognizedText ?? '').trim().length > 0 ||
        (region.translatedText ?? '').trim().length > 0,
    );
  });
  const activeDownloadScope: ProcessableMode | null = isProcessableMode
    ? (mode as ProcessableMode)
    : lastActionScope;
  const canExportAioMetadata = activeDownloadScope === 'aio';
  const activePsdImage = activeImage ?? images[0] ?? null;
  const activePsdImageId = activePsdImage?.id ?? null;
  const canExportPsd =
    mode !== 'cleaner' &&
    (mode !== 'translator' || translatorWorkspaceMode === 'visual') &&
    Boolean(activePsdImage);
  const activePsdAioRegionCount = useRegionEditorStore((s) =>
    activePsdImageId
      ? (s.aioDetectionsByImage[activePsdImageId]?.length ?? 0)
      : 0,
  );
  const hasAioRenderRegionsForPsd = Boolean(
    activePsdImage &&
    activePsdAioRegionCount > 0,
  );
  const hasInpaintedOutputs = downloadItems.some(
    (item) => item.scope === 'aio',
  );
  const hasDownloads =
    mode === 'translator'
      ? translatorWorkspaceMode === 'text'
        ? translatorTextHasDownload
        : translatorVisualHasDownload
      : downloadItems.some((item) =>
        isProcessableMode
          ? item.scope === mode
          : lastActionScope
            ? item.scope === lastActionScope
            : false,
      ) ||
      hasRenderableAioOutput ||
      hasAioTextOutput ||
      hasRenderableTypographerOutput;
  const hasDownloadActions = hasDownloads || canExportPsd;
  return {
    hasDownloadActions,
    hasDownloads,
    activeDownloadScope,
    canExportAioMetadata,
    hasInpaintedOutputs,
    canExportPsd,
    hasAioRenderRegionsForPsd,
  };
}
