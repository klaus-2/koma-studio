import { useI18n } from '../../../i18n';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import { SOURCE_LANGUAGE_OPTIONS, TARGET_LANGUAGE_OPTIONS } from '../../../models/aioStageCatalog';
import type { useDashboardModelManager } from '../../../hooks/useDashboardModelManager';
import type { useModelManager } from '../../../hooks/useModelManager';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import { clampLlmRequestSettings } from '../../../utils/customLlm';
import type { useAioModelSelection } from '../hooks/aio-pipeline';
import type {
  useTranslatorRetranslate,
  useTranslatorTextActions,
  useTranslatorVisualActions,
} from '../hooks/translator';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useActiveTranslatorRegionState } from '../hooks/translator';
import { useUiShellStore } from '../stores/ui-shell-store';
import TranslatorToolsPanel from '../../../components/dashboard/TranslatorToolsPanel';

type AioModelSelectionApi = ReturnType<typeof useAioModelSelection>;
type ModelManagerApi = ReturnType<typeof useModelManager>;
type DashboardModelManagerApi = ReturnType<typeof useDashboardModelManager>;

interface TranslationModelEntryLike {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface TranslatorToolsPanelSectionProps {
  /* ── AIO options memos (multi-store derived; selector candidates in T12) ── */
  translatorAvailableOcrStageOptions: AioStageOption[];
  selectedTranslatorOcrCloudOption: AioStageOption | null;
  selectedOcrStatusText: string | null;
  availableTranslationStageOptions: AioStageOption[];
  selectedTranslationModelState: TranslationModelEntryLike | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  selectedLegacyTranslationOption: AioStageOption | null;
  translatorSelectedLocalTranslationCompatible: boolean;
  selectedTranslatorSfxCleanOption: AioStageOption | null;

  /* ── AIO model selection / model manager hooks (not yet migrated) ── */
  formatAioStageOptionLabel: AioModelSelectionApi['formatAioStageOptionLabel'];
  resolveLocalModelFocusForStage: AioModelSelectionApi['resolveLocalModelFocusForStage'];
  modelEntries: ModelManagerApi['state']['entries'];
  modelSummary: ModelManagerApi['summary'];
  openModelManagerForStage: DashboardModelManagerApi['openModelManagerForStage'];

  /* ── Cleaner options memo + SFX select callback (cleaner domain) ── */
  cleanerAiOptionsForSelect: AioStageOption[];
  selectTranslatorSfxCleanModel: (modelKey: string) => void;

  /* ── LLM panel visibility (page derivation) + refs ── */
  showLlmSettingsPanel: boolean;
  translatorTextImportRef: React.RefObject<HTMLInputElement | null>;
  translatorImageImportRef: React.RefObject<HTMLInputElement | null>;

  /* ── Translator execution callbacks (hooks/translator) ── */
  runTranslatorText: ReturnType<typeof useTranslatorTextActions>;
  processTranslatorVisual: ReturnType<typeof useTranslatorVisualActions>;
  handleTranslatorTextImport: React.ChangeEventHandler<HTMLInputElement>;
  handleTranslatorImageUpload: React.ChangeEventHandler<HTMLInputElement>;

  /* ── Active-image memos (multi-store; selector candidates in T12) ── */
  activeId: string | null;
  retranslateTranslatorRegions: ReturnType<typeof useTranslatorRetranslate>;
}

/**
 * Translator tools panel view (the `{mode === 'translator'}` block).
 * Reads the translator/aio/llm/shell/image stores and forwards the
 * same-name props the page previously passed (multi-store memos stay
 * page props).
 */
export default function TranslatorToolsPanelSection({
  translatorAvailableOcrStageOptions,
  selectedTranslatorOcrCloudOption,
  selectedOcrStatusText,
  availableTranslationStageOptions,
  selectedTranslationModelState,
  selectedCustomTranslationProfile,
  selectedLegacyTranslationOption,
  translatorSelectedLocalTranslationCompatible,
  selectedTranslatorSfxCleanOption,
  formatAioStageOptionLabel,
  resolveLocalModelFocusForStage,
  modelEntries,
  modelSummary,
  openModelManagerForStage,
  cleanerAiOptionsForSelect,
  selectTranslatorSfxCleanModel,
  showLlmSettingsPanel,
  translatorTextImportRef,
  translatorImageImportRef,
  runTranslatorText,
  processTranslatorVisual,
  handleTranslatorTextImport,
  handleTranslatorImageUpload,
  activeId,
  retranslateTranslatorRegions,
}: TranslatorToolsPanelSectionProps) {
  const { t } = useI18n();
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const setTranslatorWorkspaceMode = useTranslatorStore(
    (s) => s.setTranslatorWorkspaceMode,
  );
  const translatorVisualProcessingMode = useTranslatorStore(
    (s) => s.translatorVisualProcessingMode,
  );
  const setTranslatorVisualProcessingMode = useTranslatorStore(
    (s) => s.setTranslatorVisualProcessingMode,
  );
  const srcLang = useTranslatorStore((s) => s.srcLang);
  const setSrcLang = useTranslatorStore((s) => s.setSrcLang);
  const tgtLang = useTranslatorStore((s) => s.tgtLang);
  const setTgtLang = useTranslatorStore((s) => s.setTgtLang);
  const translatorSfxCleanModelKey = useTranslatorStore(
    (s) => s.translatorSfxCleanModelKey,
  );
  const translatorSfxAdditionalInstructions = useTranslatorStore(
    (s) => s.translatorSfxAdditionalInstructions,
  );
  const setTranslatorSfxAdditionalInstructions = useTranslatorStore(
    (s) => s.setTranslatorSfxAdditionalInstructions,
  );
  const {
    activeTranslatorImageDetections,
    activeTranslatorSelectedRegion,
    activeTranslatorSelectedTranslationNotes,
  } = useActiveTranslatorRegionState({ resolvedActiveId: activeId });
  const translatorDraftText = useTranslatorStore((s) => s.translatorDraftText);
  const translatorTextPending = useTranslatorStore(
    (s) => s.translatorTextPending,
  );
  const translatorTranslatedText = useTranslatorStore(
    (s) => s.translatorTranslatedText,
  );
  const translatorTextRunning = useTranslatorStore(
    (s) => s.translatorTextRunning,
  );
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const setLlmSettings = useLlmProvidersStore((s) => s.setLlmSettings);
  const processing = useUiShellStore((s) => s.processing);
  const images = useImageCollectionStore((s) => s.images);

  return (
    <TranslatorToolsPanel
      translatorWorkspaceMode={translatorWorkspaceMode}
      setTranslatorWorkspaceMode={setTranslatorWorkspaceMode}
      translatorVisualProcessingMode={translatorVisualProcessingMode}
      setTranslatorVisualProcessingMode={
        setTranslatorVisualProcessingMode
      }
      srcLang={srcLang}
      setSrcLang={setSrcLang}
      tgtLang={tgtLang}
      setTgtLang={setTgtLang}
      sourceLanguageOptions={SOURCE_LANGUAGE_OPTIONS}
      targetLanguageOptions={TARGET_LANGUAGE_OPTIONS}
      aioRecognizeTextValue={aioStageSelection.recognizeText}
      translatorAvailableOcrStageOptions={
        translatorAvailableOcrStageOptions
      }
      selectedTranslatorOcrCloudOption={selectedTranslatorOcrCloudOption}
      selectedOcrStatusText={selectedOcrStatusText ?? ''}
      formatAioStageOptionLabel={formatAioStageOptionLabel}
      setAioRecognizeTextModel={(modelKey) =>
        setAioStageSelection((prev) => ({
          ...prev,
          recognizeText: modelKey,
        }))
      }
      openRecognizeTextManager={() => {
        openModelManagerForStage('recognizeText', {
          focusedModelId: resolveLocalModelFocusForStage(
            'recognizeText',
            aioStageSelection.recognizeText,
          ),
        });
      }}
      translationSelectedModelId={aioStageSelection.getTranslations}
      modelEntries={modelEntries}
      availableTranslationStageOptions={availableTranslationStageOptions}
      installedCount={modelSummary.installedCount}
      updatesCount={modelSummary.updateCount}
      setTranslationModel={(modelId) =>
        setAioStageSelection((prev) => ({
          ...prev,
          getTranslations: modelId,
        }))
      }
      openTranslationManager={(args) => {
        openModelManagerForStage('getTranslations', {
          language: args?.language ?? srcLang,
          focusedModelId: args?.focusedModelId ?? null,
        });
      }}
      translationSelectedSummary={
        selectedTranslationModelState
          ? `${t('dashboard.status.selectedLabel')}: ${selectedTranslationModelState.model.name}`
          : selectedCustomTranslationProfile
            ? `${t('dashboard.status.selectedLabel')}: ${selectedCustomTranslationProfile.label} (Custom/FREE Provider)`
            : selectedLegacyTranslationOption
              ? `${t('dashboard.status.selectedLabel')}: ${selectedLegacyTranslationOption.name} ${t('dashboard.status.cloudApiSuffix')}`
              : t('dashboard.status.selectTranslatorModel')
      }
      translationSupportSummary={
        translatorSelectedLocalTranslationCompatible
          ? t('dashboard.status.translatorUsesAioModel')
          : t('dashboard.status.translatorLocalModelIncompatible')
      }
      translatorSfxCleanModelKey={translatorSfxCleanModelKey}
      translatorSfxCleanModelOptions={cleanerAiOptionsForSelect}
      selectedTranslatorSfxCleanOption={
        selectedTranslatorSfxCleanOption
      }
      selectTranslatorSfxCleanModel={selectTranslatorSfxCleanModel}
      translatorSfxAdditionalInstructions={
        translatorSfxAdditionalInstructions
      }
      setTranslatorSfxAdditionalInstructions={
        setTranslatorSfxAdditionalInstructions
      }
      showLlmSettingsPanel={showLlmSettingsPanel}
      llmSettings={llmSettings}
      setLlmSettings={setLlmSettings}
      clampLlmRequestSettings={clampLlmRequestSettings}
      translatorTextImportRef={translatorTextImportRef}
      translatorImageImportRef={translatorImageImportRef}
      translatorDraftText={translatorDraftText}
      translatorTextPending={translatorTextPending}
      translatorTranslatedText={translatorTranslatedText}
      translatorTextRunning={translatorTextRunning}
      processing={processing}
      imagesCount={images.length}
      runTranslatorText={runTranslatorText}
      processTranslatorVisual={processTranslatorVisual}
      handleTranslatorTextImport={handleTranslatorTextImport}
      handleTranslatorImageUpload={handleTranslatorImageUpload}
      activeId={activeId}
      activeTranslatorImageDetectionsCount={
        activeTranslatorImageDetections.length
      }
      activeTranslatorSelectedRegion={activeTranslatorSelectedRegion}
      activeTranslatorSelectedTranslationNotes={
        activeTranslatorSelectedTranslationNotes
      }
      retranslateTranslatorRegions={retranslateTranslatorRegions}
    />
  );
}
