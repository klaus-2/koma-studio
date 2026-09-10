import { useMemo } from 'react';

import { getFreeProvidersForStage } from '../../../models/freeAiProviderCatalog';
import { toCustomModelSelectionKey } from '../../../utils/customLlm';
import type {
  useCleanerAiDraftProfileActions,
  useCleanerAiStageOptions,
  useCleanerModelSelection,
} from '../hooks/cleaner';
import type {
  useCustomLlmDrafts,
  useFreeProviderProfiles,
  useLlmProviderTest,
  useLlmStageProfileOptions,
} from '../hooks/llm-providers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import CustomLlmProfilesManagerSection from '../../../components/dashboard/CustomLlmProfilesManagerSection';
import FreeProviderManagerSection from '../../../components/dashboard/FreeProviderManagerSection';

type CustomLlmDraftsApi = ReturnType<typeof useCustomLlmDrafts>;
type FreeProviderProfilesApi = ReturnType<typeof useFreeProviderProfiles>;
type LlmProviderTestApi = ReturnType<typeof useLlmProviderTest>;
type LlmStageProfileOptionsApi = ReturnType<typeof useLlmStageProfileOptions>;
type CleanerAiStageOptionsApi = ReturnType<typeof useCleanerAiStageOptions>;
type CleanerModelSelectionApi = ReturnType<typeof useCleanerModelSelection>;
type CleanerAiDraftProfileActionsApi = ReturnType<
  typeof useCleanerAiDraftProfileActions
>;

interface TranslationFreeProviderManagerSectionProps {
  translationStandaloneCustomProfiles: LlmStageProfileOptionsApi['translationStandaloneCustomProfiles'];
  getFreeProviderDraft: FreeProviderProfilesApi['getFreeProviderDraft'];
  getSelectedFreeProviderProfileLabel: FreeProviderProfilesApi['getSelectedFreeProviderProfileLabel'];
  updateFreeProviderDraft: FreeProviderProfilesApi['updateFreeProviderDraft'];
  saveFreeProviderProfile: FreeProviderProfilesApi['saveFreeProviderProfile'];
  useFreeProviderProfile: FreeProviderProfilesApi['useFreeProviderProfile'];
  testFreeProviderConfig: LlmProviderTestApi['testFreeProviderConfig'];
  useCustomProfileById: CustomLlmDraftsApi['useCustomProfileById'];
  testCustomProfileConfig: LlmProviderTestApi['testCustomProfileConfig'];
  saveCustomProfileInline: CustomLlmDraftsApi['saveCustomProfileInline'];
  removeCustomLlmProfileById: CustomLlmDraftsApi['removeCustomLlmProfileById'];
}

interface OcrFreeProviderManagerSectionProps {
  ocrStandaloneCustomProfiles: LlmStageProfileOptionsApi['ocrStandaloneCustomProfiles'];
  getFreeProviderDraft: FreeProviderProfilesApi['getFreeProviderDraft'];
  getSelectedFreeProviderProfileLabel: FreeProviderProfilesApi['getSelectedFreeProviderProfileLabel'];
  updateFreeProviderDraft: FreeProviderProfilesApi['updateFreeProviderDraft'];
  saveFreeProviderProfile: FreeProviderProfilesApi['saveFreeProviderProfile'];
  useFreeProviderProfile: FreeProviderProfilesApi['useFreeProviderProfile'];
  testFreeProviderConfig: LlmProviderTestApi['testFreeProviderConfig'];
  useCustomProfileById: CustomLlmDraftsApi['useCustomProfileById'];
  testCustomProfileConfig: LlmProviderTestApi['testCustomProfileConfig'];
  saveCustomProfileInline: CustomLlmDraftsApi['saveCustomProfileInline'];
  removeCustomLlmProfileById: CustomLlmDraftsApi['removeCustomLlmProfileById'];
}

interface TranslationCustomProfilesManagerSectionProps {
  translationStandaloneCustomProfiles: LlmStageProfileOptionsApi['translationStandaloneCustomProfiles'];
  translationCustomProviderNotice: CustomLlmDraftsApi['translationCustomProviderNotice'];
  llmProfilesPersistenceHint: string;
  loadCustomLlmDraftFromProfile: CustomLlmDraftsApi['loadCustomLlmDraftFromProfile'];
  updateCustomLlmDraft: CustomLlmDraftsApi['updateCustomLlmDraft'];
  useExistingCustomProfile: CustomLlmDraftsApi['useExistingCustomProfile'];
  resetCustomLlmDraft: CustomLlmDraftsApi['resetCustomLlmDraft'];
  removeCustomLlmDraftProfile: CustomLlmDraftsApi['removeCustomLlmDraftProfile'];
  saveCustomLlmDraftProfile: CustomLlmDraftsApi['saveCustomLlmDraftProfile'];
  applyOllamaPresetToTranslationDraft: CustomLlmDraftsApi['applyOllamaPresetToTranslationDraft'];
}

interface OcrCustomProfilesManagerSectionProps {
  ocrStandaloneCustomProfiles: LlmStageProfileOptionsApi['ocrStandaloneCustomProfiles'];
  ocrCustomProviderNotice: CustomLlmDraftsApi['ocrCustomProviderNotice'];
  llmProfilesPersistenceHint: string;
  loadCustomLlmDraftFromProfile: CustomLlmDraftsApi['loadCustomLlmDraftFromProfile'];
  updateCustomLlmDraft: CustomLlmDraftsApi['updateCustomLlmDraft'];
  useExistingCustomProfile: CustomLlmDraftsApi['useExistingCustomProfile'];
  resetCustomLlmDraft: CustomLlmDraftsApi['resetCustomLlmDraft'];
  removeCustomLlmDraftProfile: CustomLlmDraftsApi['removeCustomLlmDraftProfile'];
  saveCustomLlmDraftProfile: CustomLlmDraftsApi['saveCustomLlmDraftProfile'];
}

interface CleanerAiCustomProfilesManagerSectionProps {
  cleanStandaloneCustomProfiles: LlmStageProfileOptionsApi['cleanStandaloneCustomProfiles'];
  cleanerAiCustomProviderNotice: CleanerAiStageOptionsApi['cleanerAiCustomProviderNotice'];
  llmProfilesPersistenceHint: string;
  loadCustomLlmDraftFromProfile: CustomLlmDraftsApi['loadCustomLlmDraftFromProfile'];
  updateCustomLlmDraft: CustomLlmDraftsApi['updateCustomLlmDraft'];
  useExistingCleanerCustomProfile: CleanerModelSelectionApi['useExistingCleanerCustomProfile'];
  resetCustomLlmDraft: CustomLlmDraftsApi['resetCustomLlmDraft'];
  removeCleanerCustomDraftProfile: CleanerAiDraftProfileActionsApi['removeCleanerCustomDraftProfile'];
  saveCleanerCustomDraftProfile: CleanerAiDraftProfileActionsApi['saveCleanerCustomDraftProfile'];
}

interface CleanerAiFreeProviderManagerSectionProps {
  cleanStandaloneCustomProfiles: LlmStageProfileOptionsApi['cleanStandaloneCustomProfiles'];
  getFreeProviderDraft: FreeProviderProfilesApi['getFreeProviderDraft'];
  getSelectedFreeProviderProfileLabel: FreeProviderProfilesApi['getSelectedFreeProviderProfileLabel'];
  updateFreeProviderDraft: FreeProviderProfilesApi['updateFreeProviderDraft'];
  saveFreeProviderProfile: FreeProviderProfilesApi['saveFreeProviderProfile'];
  testFreeProviderConfig: LlmProviderTestApi['testFreeProviderConfig'];
  testCustomProfileConfig: LlmProviderTestApi['testCustomProfileConfig'];
  saveCustomProfileInline: CustomLlmDraftsApi['saveCustomProfileInline'];
  removeCustomLlmProfileById: CustomLlmDraftsApi['removeCustomLlmProfileById'];
}

/**
 * Manager section views (FreeProviderManagerSection / CustomLlmProfilesManagerSection
 * mounts previously memoized inline in the page). Each component keeps the exact
 * memo body the page had (deps included); store-backed values are read through
 * granular selectors and hook-derived callbacks/notice memos arrive as same-name
 * props. No React.memo — the internal useMemo preserves the element identity.
 */
export function TranslationFreeProviderManagerSection({
  translationStandaloneCustomProfiles,
  getFreeProviderDraft,
  getSelectedFreeProviderProfileLabel,
  updateFreeProviderDraft,
  saveFreeProviderProfile,
  useFreeProviderProfile: applyFreeProviderProfile,
  testFreeProviderConfig,
  useCustomProfileById: applyCustomProfileById,
  testCustomProfileConfig,
  saveCustomProfileInline,
  removeCustomLlmProfileById,
}: TranslationFreeProviderManagerSectionProps) {
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const translationFreeProviders = useMemo(
    () => getFreeProvidersForStage('translation'),
    [],
  );
  const translationFreeProviderManagerSection = useMemo(
    () => (
      <FreeProviderManagerSection
        stage="translation"
        providers={translationFreeProviders}
        standaloneProfiles={translationStandaloneCustomProfiles}
        selectedModelKey={aioStageSelection.getTranslations}
        getDraft={getFreeProviderDraft}
        getSelectedProfileLabel={getSelectedFreeProviderProfileLabel}
        onDraftChange={updateFreeProviderDraft}
        onSaveProvider={saveFreeProviderProfile}
        onUseProvider={applyFreeProviderProfile}
        onTestProvider={testFreeProviderConfig}
        onUseCustomProfile={(profileId) =>
          applyCustomProfileById('translation', profileId)
        }
        onTestCustomProfile={(profile) => testCustomProfileConfig('translation', profile)}
        onSaveCustomProfile={(draft) => {
          void saveCustomProfileInline('translation', draft);
        }}
        onDeleteCustomProfile={(profileId) => {
          void removeCustomLlmProfileById('translation', profileId);
        }}
        toSelectionKey={toCustomModelSelectionKey}
      />
    ),
    [
      aioStageSelection.getTranslations,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      removeCustomLlmProfileById,
      saveCustomProfileInline,
      saveFreeProviderProfile,
      testCustomProfileConfig,
      testFreeProviderConfig,
      translationStandaloneCustomProfiles,
      translationFreeProviders,
      applyCustomProfileById,
      applyFreeProviderProfile,
      updateFreeProviderDraft,
    ],
  );

  return translationFreeProviderManagerSection;
}

export function OcrFreeProviderManagerSection({
  ocrStandaloneCustomProfiles,
  getFreeProviderDraft,
  getSelectedFreeProviderProfileLabel,
  updateFreeProviderDraft,
  saveFreeProviderProfile,
  useFreeProviderProfile: applyFreeProviderProfile,
  testFreeProviderConfig,
  useCustomProfileById: applyCustomProfileById,
  testCustomProfileConfig,
  saveCustomProfileInline,
  removeCustomLlmProfileById,
}: OcrFreeProviderManagerSectionProps) {
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const ocrFreeProviders = useMemo(() => getFreeProvidersForStage('ocr'), []);
  const ocrFreeProviderManagerSection = useMemo(
    () => (
      <FreeProviderManagerSection
        stage="ocr"
        providers={ocrFreeProviders}
        standaloneProfiles={ocrStandaloneCustomProfiles}
        selectedModelKey={aioStageSelection.recognizeText}
        getDraft={getFreeProviderDraft}
        getSelectedProfileLabel={getSelectedFreeProviderProfileLabel}
        onDraftChange={updateFreeProviderDraft}
        onSaveProvider={saveFreeProviderProfile}
        onUseProvider={applyFreeProviderProfile}
        onTestProvider={testFreeProviderConfig}
        onUseCustomProfile={(profileId) =>
          applyCustomProfileById('ocr', profileId)
        }
        onTestCustomProfile={(profile) => testCustomProfileConfig('ocr', profile)}
        onSaveCustomProfile={(draft) => {
          void saveCustomProfileInline('ocr', draft);
        }}
        onDeleteCustomProfile={(profileId) => {
          void removeCustomLlmProfileById('ocr', profileId);
        }}
        toSelectionKey={toCustomModelSelectionKey}
      />
    ),
    [
      aioStageSelection.recognizeText,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      ocrStandaloneCustomProfiles,
      ocrFreeProviders,
      removeCustomLlmProfileById,
      saveCustomProfileInline,
      saveFreeProviderProfile,
      testCustomProfileConfig,
      testFreeProviderConfig,
      applyCustomProfileById,
      applyFreeProviderProfile,
      updateFreeProviderDraft,
    ],
  );

  return ocrFreeProviderManagerSection;
}

export function TranslationCustomProfilesManagerSection({
  translationStandaloneCustomProfiles,
  translationCustomProviderNotice,
  llmProfilesPersistenceHint,
  loadCustomLlmDraftFromProfile,
  updateCustomLlmDraft,
  useExistingCustomProfile: applyExistingCustomProfile,
  resetCustomLlmDraft,
  removeCustomLlmDraftProfile,
  saveCustomLlmDraftProfile,
  applyOllamaPresetToTranslationDraft,
}: TranslationCustomProfilesManagerSectionProps) {
  const customLlmProfilesLoading = useLlmProvidersStore(
    (s) => s.customLlmProfilesLoading,
  );
  const customLlmProfilesError = useLlmProvidersStore(
    (s) => s.customLlmProfilesError,
  );
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const translationCustomProfilesManagerSection = useMemo(
    () => (
      <CustomLlmProfilesManagerSection
        stage="translation"
        profiles={translationStandaloneCustomProfiles}
        draft={customLlmDrafts.translation}
        loading={customLlmProfilesLoading}
        error={customLlmProfilesError}
        persistenceHint={llmProfilesPersistenceHint}
        providerNotice={translationCustomProviderNotice}
        onLoadProfile={(profileId) =>
          loadCustomLlmDraftFromProfile('translation', profileId)
        }
        onUpdateDraft={(patch) => updateCustomLlmDraft('translation', patch)}
        onUseExisting={() => applyExistingCustomProfile('translation')}
        onResetDraft={() => resetCustomLlmDraft('translation')}
        onRemoveDraft={() => removeCustomLlmDraftProfile('translation')}
        onSaveDraft={() => saveCustomLlmDraftProfile('translation')}
        onApplyOllamaPreset={applyOllamaPresetToTranslationDraft}
      />
    ),
    [
      applyOllamaPresetToTranslationDraft,
      customLlmDrafts.translation,
      customLlmProfilesError,
      customLlmProfilesLoading,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      removeCustomLlmDraftProfile,
      resetCustomLlmDraft,
      saveCustomLlmDraftProfile,
      translationCustomProviderNotice,
      translationStandaloneCustomProfiles,
      updateCustomLlmDraft,
      applyExistingCustomProfile,
    ],
  );

  return translationCustomProfilesManagerSection;
}

export function OcrCustomProfilesManagerSection({
  ocrStandaloneCustomProfiles,
  ocrCustomProviderNotice,
  llmProfilesPersistenceHint,
  loadCustomLlmDraftFromProfile,
  updateCustomLlmDraft,
  useExistingCustomProfile: applyExistingCustomProfile,
  resetCustomLlmDraft,
  removeCustomLlmDraftProfile,
  saveCustomLlmDraftProfile,
}: OcrCustomProfilesManagerSectionProps) {
  const customLlmProfilesLoading = useLlmProvidersStore(
    (s) => s.customLlmProfilesLoading,
  );
  const customLlmProfilesError = useLlmProvidersStore(
    (s) => s.customLlmProfilesError,
  );
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const ocrCustomProfilesManagerSection = useMemo(
    () => (
      <CustomLlmProfilesManagerSection
        stage="ocr"
        profiles={ocrStandaloneCustomProfiles}
        draft={customLlmDrafts.ocr}
        loading={customLlmProfilesLoading}
        error={customLlmProfilesError}
        persistenceHint={llmProfilesPersistenceHint}
        providerNotice={ocrCustomProviderNotice}
        onLoadProfile={(profileId) =>
          loadCustomLlmDraftFromProfile('ocr', profileId)
        }
        onUpdateDraft={(patch) => updateCustomLlmDraft('ocr', patch)}
        onUseExisting={() => applyExistingCustomProfile('ocr')}
        onResetDraft={() => resetCustomLlmDraft('ocr')}
        onRemoveDraft={() => removeCustomLlmDraftProfile('ocr')}
        onSaveDraft={() => saveCustomLlmDraftProfile('ocr')}
      />
    ),
    [
      customLlmDrafts.ocr,
      customLlmProfilesError,
      customLlmProfilesLoading,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      ocrCustomProviderNotice,
      ocrStandaloneCustomProfiles,
      removeCustomLlmDraftProfile,
      resetCustomLlmDraft,
      saveCustomLlmDraftProfile,
      updateCustomLlmDraft,
      applyExistingCustomProfile,
    ],
  );

  return ocrCustomProfilesManagerSection;
}

export function CleanerAiCustomProfilesManagerSection({
  cleanStandaloneCustomProfiles,
  cleanerAiCustomProviderNotice,
  llmProfilesPersistenceHint,
  loadCustomLlmDraftFromProfile,
  updateCustomLlmDraft,
  useExistingCleanerCustomProfile: applyExistingCleanerCustomProfile,
  resetCustomLlmDraft,
  removeCleanerCustomDraftProfile,
  saveCleanerCustomDraftProfile,
}: CleanerAiCustomProfilesManagerSectionProps) {
  const customLlmProfilesLoading = useLlmProvidersStore(
    (s) => s.customLlmProfilesLoading,
  );
  const customLlmProfilesError = useLlmProvidersStore(
    (s) => s.customLlmProfilesError,
  );
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const cleanerAiCustomProfilesManagerSection = useMemo(
    () => (
      <CustomLlmProfilesManagerSection
        stage="clean"
        profiles={cleanStandaloneCustomProfiles}
        draft={customLlmDrafts.clean}
        loading={customLlmProfilesLoading}
        error={customLlmProfilesError}
        persistenceHint={llmProfilesPersistenceHint}
        providerNotice={cleanerAiCustomProviderNotice}
        titleOverride="AI Custom (Automatic AI Clean)"
        emptyLabelOverride="Novo perfil visual"
        namePlaceholderOverride="Ex.: Gemini Image Clean"
        modelPlaceholderOverride="gemini-2.5-flash-image"
        useLabelOverride="Usar no Cleaner"
        onLoadProfile={(profileId) =>
          loadCustomLlmDraftFromProfile('clean', profileId)
        }
        onUpdateDraft={(patch) => updateCustomLlmDraft('clean', patch)}
        onUseExisting={applyExistingCleanerCustomProfile}
        onResetDraft={() => resetCustomLlmDraft('clean')}
        onRemoveDraft={() => removeCleanerCustomDraftProfile()}
        onSaveDraft={() => saveCleanerCustomDraftProfile()}
      />
    ),
    [
      cleanerAiCustomProviderNotice,
      customLlmDrafts.clean,
      customLlmProfilesError,
      customLlmProfilesLoading,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      cleanStandaloneCustomProfiles,
      removeCleanerCustomDraftProfile,
      resetCustomLlmDraft,
      saveCleanerCustomDraftProfile,
      updateCustomLlmDraft,
      applyExistingCleanerCustomProfile,
    ],
  );

  return cleanerAiCustomProfilesManagerSection;
}

export function CleanerAiFreeProviderManagerSection({
  cleanStandaloneCustomProfiles,
  getFreeProviderDraft,
  getSelectedFreeProviderProfileLabel,
  updateFreeProviderDraft,
  saveFreeProviderProfile,
  testFreeProviderConfig,
  testCustomProfileConfig,
  saveCustomProfileInline,
  removeCustomLlmProfileById,
}: CleanerAiFreeProviderManagerSectionProps) {
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const setCleanerAiModelKey = useCleanerStore((s) => s.setCleanerAiModelKey);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const cleanFreeProviders = useMemo(() => getFreeProvidersForStage('clean'), []);
  const cleanerAiFreeProviderManagerSection = useMemo(
    () => (
      <FreeProviderManagerSection
        stage="clean"
        providers={cleanFreeProviders}
        standaloneProfiles={cleanStandaloneCustomProfiles}
        selectedModelKey={cleanerAiModelKey}
        getDraft={getFreeProviderDraft}
        getSelectedProfileLabel={getSelectedFreeProviderProfileLabel}
        onDraftChange={updateFreeProviderDraft}
        onSaveProvider={saveFreeProviderProfile}
        onTestProvider={testFreeProviderConfig}
        onUseProvider={async (_stage, provider) => {
          const payload = await saveFreeProviderProfile('clean', provider);
          if (!payload) return;
          setCleanerAiModelKey(`custom_clean:${payload.profile.id}`);
          setStatusMessage(`Provider ${provider.name} em uso no Automatic AI Clean.`);
        }}
        onUseCustomProfile={(profileId) =>
          setCleanerAiModelKey(`custom_clean:${profileId}`)
        }
        onTestCustomProfile={(profile) => testCustomProfileConfig('clean', profile)}
        onSaveCustomProfile={async (draft) => {
          const profile = await saveCustomProfileInline('clean', draft);
          setCleanerAiModelKey(`custom_clean:${profile.id}`);
        }}
        onDeleteCustomProfile={(profileId) =>
          removeCustomLlmProfileById('clean', profileId)
        }
        toSelectionKey={(profile) => `custom_clean:${profile.id}`}
      />
    ),
    [
      cleanerAiModelKey,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      cleanFreeProviders,
      cleanStandaloneCustomProfiles,
      removeCustomLlmProfileById,
      saveCustomProfileInline,
      saveFreeProviderProfile,
      setCleanerAiModelKey,
      setStatusMessage,
      testCustomProfileConfig,
      testFreeProviderConfig,
      updateFreeProviderDraft,
    ],
  );

  return cleanerAiFreeProviderManagerSection;
}
