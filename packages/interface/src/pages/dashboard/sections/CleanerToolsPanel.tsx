import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { useDashboardModelManager } from '../../../hooks/useDashboardModelManager';
import type { useAioModelSelection } from '../hooks/aio-pipeline';
import type { useCleanerActions } from '../hooks/cleaner';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useActiveCleanerRegionState } from '../hooks/cleaner';
import CleanerToolsPanel from '../../../components/dashboard/CleanerToolsPanel';

type AioModelSelectionApi = ReturnType<typeof useAioModelSelection>;

interface CleanerToolsPanelSectionProps {
  /* ── Cleaner options memos (multi-store derived; selector candidates in T12) ── */
  cleanerAiModelOptions: AioStageOption[];
  availableOcrStageOptions: AioStageOption[];
  availableSegmentStageOptions: AioStageOption[];
  availableCleanStageOptions: AioStageOption[];
  selectedOcrCloudOption: AioStageOption | null;
  selectedSegmentModel: AioStageOption | null;
  selectedCleanModel: AioStageOption | null;
  selectedCleanerAiOption: AioStageOption | null;
  selectedOcrStatusText: string | null;
  selectedSegmentStatusText: string | null;
  selectedCleanStatusText: string | null;

  /* ── AIO model selection / model manager hooks (not yet migrated) ── */
  formatAioStageOptionLabel: AioModelSelectionApi['formatAioStageOptionLabel'];
  selectAioLocalStageModel: AioModelSelectionApi['selectAioLocalStageModel'];
  openModelManagerForStage: ReturnType<
    typeof useDashboardModelManager
  >['openModelManagerForStage'];
  resolveLocalModelFocusForStage: AioModelSelectionApi['resolveLocalModelFocusForStage'];

  /* ── Cleaner hook (not yet migrated) ── */
  selectCleanerAiModel: (modelKey: string) => void;
  handleClean: ReturnType<typeof useCleanerActions>;

  /* ── Page memos / config (not yet migrated) ── */
  localApiUrl: string;
}

/**
 * Cleaner tools panel view (the `{mode === 'cleaner'}` block).
 * Reads the cleaner/aio/shell/image stores and forwards the same-name props
 * the page previously passed (multi-store memos stay page props).
 */
export default function CleanerToolsPanelSection({
  cleanerAiModelOptions,
  availableOcrStageOptions,
  availableSegmentStageOptions,
  availableCleanStageOptions,
  selectedOcrCloudOption,
  selectedSegmentModel,
  selectedCleanModel,
  selectedCleanerAiOption,
  selectedOcrStatusText,
  selectedSegmentStatusText,
  selectedCleanStatusText,
  formatAioStageOptionLabel,
  selectAioLocalStageModel,
  openModelManagerForStage,
  resolveLocalModelFocusForStage,
  selectCleanerAiModel,
  handleClean,
  localApiUrl,
}: CleanerToolsPanelSectionProps) {
  const cleanerMode = useCleanerStore((s) => s.cleanerMode);
  const setCleanerMode = useCleanerStore((s) => s.setCleanerMode);
  const cleanerSrcLang = useCleanerStore((s) => s.cleanerSrcLang);
  const setCleanerSrcLang = useCleanerStore((s) => s.setCleanerSrcLang);
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const cleanerAiAdditionalInstructions = useCleanerStore(
    (s) => s.cleanerAiAdditionalInstructions,
  );
  const setCleanerAiAdditionalInstructions = useCleanerStore(
    (s) => s.setCleanerAiAdditionalInstructions,
  );
  const setCleanerAiModelManagerOpen = useCleanerStore(
    (s) => s.setCleanerAiModelManagerOpen,
  );
  const aioLanguageOptions = useAioPipelineStore((s) => s.aioLanguageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const setAioMaskDilation = useAioPipelineStore((s) => s.setAioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const setAioHdStrategy = useAioPipelineStore((s) => s.setAioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const setAioHdResizeLimit = useAioPipelineStore((s) => s.setAioHdResizeLimit);
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const setAioHdCropMargin = useAioPipelineStore((s) => s.setAioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore((s) => s.aioHdCropTriggerSize);
  const setAioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.setAioHdCropTriggerSize,
  );
  const processing = useUiShellStore((s) => s.processing);
  const progress = useUiShellStore((s) => s.progress);
  const images = useImageCollectionStore((s) => s.images);
  const resolvedActiveId = useImageCollectionStore((s) => s.activeId);
  const { activeCleanerRunMeta, activeCleanerSelectedRegion } =
    useActiveCleanerRegionState({ resolvedActiveId });

  return (
    <CleanerToolsPanel
      cleanerMode={cleanerMode}
      setCleanerMode={setCleanerMode}
      cleanerSrcLang={cleanerSrcLang}
      setCleanerSrcLang={setCleanerSrcLang}
      sourceLanguageOptions={aioLanguageOptions.source}
      recognizeTextValue={aioStageSelection.recognizeText}
      segmentTextValue={aioStageSelection.segmentText}
      cleanImageValue={aioStageSelection.cleanImage}
      cleanerAiModelKey={cleanerAiModelKey}
      cleanerAiModelOptions={cleanerAiModelOptions}
      availableOcrStageOptions={availableOcrStageOptions}
      availableSegmentStageOptions={availableSegmentStageOptions}
      availableCleanStageOptions={availableCleanStageOptions}
      selectedOcrCloudOption={selectedOcrCloudOption}
      selectedSegmentModel={selectedSegmentModel}
      selectedCleanModel={selectedCleanModel}
      selectedCleanerAiOption={selectedCleanerAiOption}
      selectedOcrStatusText={selectedOcrStatusText}
      selectedSegmentStatusText={selectedSegmentStatusText}
      selectedCleanStatusText={selectedCleanStatusText}
      formatAioStageOptionLabel={formatAioStageOptionLabel}
      setRecognizeTextModel={(modelKey) =>
        setAioStageSelection((prev) => ({
          ...prev,
          recognizeText: modelKey,
        }))
      }
      selectSegmentTextModel={(modelKey) =>
        selectAioLocalStageModel('segmentText', modelKey)
      }
      selectCleanImageModel={(modelKey) =>
        selectAioLocalStageModel('cleanImage', modelKey)
      }
      selectCleanerAiModel={selectCleanerAiModel}
      openRecognizeTextManager={() => {
        openModelManagerForStage('recognizeText', {
          focusedModelId: resolveLocalModelFocusForStage(
            'recognizeText',
            aioStageSelection.recognizeText,
          ),
        });
      }}
      openSegmentTextManager={() => {
        openModelManagerForStage('segmentText', {
          focusedModelId: aioStageSelection.segmentText,
        });
      }}
      openCleanImageManager={() => {
        openModelManagerForStage('cleanImage', {
          focusedModelId: aioStageSelection.cleanImage,
        });
      }}
      openCleanerAiModelManager={() =>
        setCleanerAiModelManagerOpen(true)
      }
      localApiUrl={localApiUrl}
      aioMaskDilation={aioMaskDilation}
      setAioMaskDilation={setAioMaskDilation}
      aioHdStrategy={aioHdStrategy}
      setAioHdStrategy={setAioHdStrategy}
      aioHdResizeLimit={aioHdResizeLimit}
      setAioHdResizeLimit={setAioHdResizeLimit}
      aioHdCropMargin={aioHdCropMargin}
      setAioHdCropMargin={setAioHdCropMargin}
      aioHdCropTriggerSize={aioHdCropTriggerSize}
      setAioHdCropTriggerSize={setAioHdCropTriggerSize}
      cleanerAiAdditionalInstructions={cleanerAiAdditionalInstructions}
      setCleanerAiAdditionalInstructions={
        setCleanerAiAdditionalInstructions
      }
      activeCleanerRunMeta={activeCleanerRunMeta}
      activeCleanerSelectedRegion={activeCleanerSelectedRegion}
      processing={processing}
      imagesCount={images.length}
      progress={progress}
      handleClean={handleClean}
    />
  );
}
