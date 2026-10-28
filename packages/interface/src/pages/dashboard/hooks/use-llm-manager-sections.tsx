import { useMemo, type ComponentProps, type ReactElement } from 'react';

import { useI18n } from '../../../i18n';
import type { LlmProfilesPersistenceMode } from '../../../utils/customLlm';
import {
  CleanerAiCustomProfilesManagerSection,
  CleanerAiFreeProviderManagerSection,
  OcrCustomProfilesManagerSection,
  OcrFreeProviderManagerSection,
  TranslationCustomProfilesManagerSection,
  TranslationFreeProviderManagerSection,
} from '../sections/LlmManagerSections';

type TranslationFreeProps = ComponentProps<typeof TranslationFreeProviderManagerSection>;
type OcrFreeProps = ComponentProps<typeof OcrFreeProviderManagerSection>;
type TranslationCustomProps = ComponentProps<typeof TranslationCustomProfilesManagerSection>;
type OcrCustomProps = ComponentProps<typeof OcrCustomProfilesManagerSection>;
type CleanerAiCustomProps = ComponentProps<typeof CleanerAiCustomProfilesManagerSection>;
type CleanerAiFreeProps = ComponentProps<typeof CleanerAiFreeProviderManagerSection>;

export interface UseLlmManagerSectionsArgs {
  readonly customLlmProfilesMode: LlmProfilesPersistenceMode;
  readonly t: ReturnType<typeof useI18n>['t'];
  readonly translationStandaloneCustomProfiles: TranslationFreeProps['translationStandaloneCustomProfiles'];
  readonly ocrStandaloneCustomProfiles: OcrFreeProps['ocrStandaloneCustomProfiles'];
  readonly cleanStandaloneCustomProfiles: CleanerAiFreeProps['cleanStandaloneCustomProfiles'];
  readonly getFreeProviderDraft: TranslationFreeProps['getFreeProviderDraft'];
  readonly getSelectedFreeProviderProfileLabel: TranslationFreeProps['getSelectedFreeProviderProfileLabel'];
  readonly updateFreeProviderDraft: TranslationFreeProps['updateFreeProviderDraft'];
  readonly saveFreeProviderProfile: TranslationFreeProps['saveFreeProviderProfile'];
  readonly useFreeProviderProfile: TranslationFreeProps['useFreeProviderProfile'];
  readonly testFreeProviderConfig: TranslationFreeProps['testFreeProviderConfig'];
  readonly testCustomProfileConfig: TranslationFreeProps['testCustomProfileConfig'];
  readonly useCustomProfileById: TranslationFreeProps['useCustomProfileById'];
  readonly saveCustomProfileInline: TranslationFreeProps['saveCustomProfileInline'];
  readonly removeCustomLlmProfileById: TranslationFreeProps['removeCustomLlmProfileById'];
  readonly translationCustomProviderNotice: TranslationCustomProps['translationCustomProviderNotice'];
  readonly ocrCustomProviderNotice: OcrCustomProps['ocrCustomProviderNotice'];
  readonly cleanerAiCustomProviderNotice: CleanerAiCustomProps['cleanerAiCustomProviderNotice'];
  readonly loadCustomLlmDraftFromProfile: TranslationCustomProps['loadCustomLlmDraftFromProfile'];
  readonly updateCustomLlmDraft: TranslationCustomProps['updateCustomLlmDraft'];
  readonly useExistingCustomProfile: TranslationCustomProps['useExistingCustomProfile'];
  readonly resetCustomLlmDraft: TranslationCustomProps['resetCustomLlmDraft'];
  readonly removeCustomLlmDraftProfile: TranslationCustomProps['removeCustomLlmDraftProfile'];
  readonly saveCustomLlmDraftProfile: TranslationCustomProps['saveCustomLlmDraftProfile'];
  readonly applyOllamaPresetToTranslationDraft: TranslationCustomProps['applyOllamaPresetToTranslationDraft'];
  readonly useExistingCleanerCustomProfile: CleanerAiCustomProps['useExistingCleanerCustomProfile'];
  readonly removeCleanerCustomDraftProfile: CleanerAiCustomProps['removeCleanerCustomDraftProfile'];
  readonly saveCleanerCustomDraftProfile: CleanerAiCustomProps['saveCleanerCustomDraftProfile'];
}

export interface DashboardLlmManagerSections {
  readonly translationFreeProviderManagerSection: ReactElement;
  readonly ocrFreeProviderManagerSection: ReactElement;
  readonly translationCustomProfilesManagerSection: ReactElement;
  readonly ocrCustomProfilesManagerSection: ReactElement;
  readonly cleanerAiCustomProfilesManagerSection: ReactElement;
  readonly cleanerAiFreeProviderManagerSection: ReactElement;
}

/** Memoized LLM manager section elements previously bound inline in the page. */
export function useLlmManagerSections({
  customLlmProfilesMode,
  t,
  translationStandaloneCustomProfiles,
  ocrStandaloneCustomProfiles,
  cleanStandaloneCustomProfiles,
  getFreeProviderDraft,
  getSelectedFreeProviderProfileLabel,
  updateFreeProviderDraft,
  saveFreeProviderProfile,
  useFreeProviderProfile,
  testFreeProviderConfig,
  testCustomProfileConfig,
  useCustomProfileById,
  saveCustomProfileInline,
  removeCustomLlmProfileById,
  translationCustomProviderNotice,
  ocrCustomProviderNotice,
  cleanerAiCustomProviderNotice,
  loadCustomLlmDraftFromProfile,
  updateCustomLlmDraft,
  useExistingCustomProfile,
  resetCustomLlmDraft,
  removeCustomLlmDraftProfile,
  saveCustomLlmDraftProfile,
  applyOllamaPresetToTranslationDraft,
  useExistingCleanerCustomProfile,
  removeCleanerCustomDraftProfile,
  saveCleanerCustomDraftProfile,
}: UseLlmManagerSectionsArgs): DashboardLlmManagerSections {
  const llmProfilesPersistenceHint = useMemo(() => {
    if (customLlmProfilesMode === 'desktop_secure') {
      return t('dashboard.status.profilesPersistedDesktopSecure');
    }
    if (customLlmProfilesMode === 'desktop_local') {
      return t('dashboard.status.profilesPersistedDesktopLocal');
    }
    return t('dashboard.status.profilesPersistedBrowser');
  }, [customLlmProfilesMode, t]);
  const translationFreeProviderManagerSection = useMemo(
    () => (
      <TranslationFreeProviderManagerSection
        translationStandaloneCustomProfiles={translationStandaloneCustomProfiles}
        getFreeProviderDraft={getFreeProviderDraft}
        getSelectedFreeProviderProfileLabel={getSelectedFreeProviderProfileLabel}
        updateFreeProviderDraft={updateFreeProviderDraft}
        saveFreeProviderProfile={saveFreeProviderProfile}
        useFreeProviderProfile={useFreeProviderProfile}
        testFreeProviderConfig={testFreeProviderConfig}
        useCustomProfileById={useCustomProfileById}
        testCustomProfileConfig={testCustomProfileConfig}
        saveCustomProfileInline={saveCustomProfileInline}
        removeCustomLlmProfileById={removeCustomLlmProfileById}
      />
    ),
    [
      translationStandaloneCustomProfiles,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      updateFreeProviderDraft,
      saveFreeProviderProfile,
      useFreeProviderProfile,
      testFreeProviderConfig,
      useCustomProfileById,
      testCustomProfileConfig,
      saveCustomProfileInline,
      removeCustomLlmProfileById,
    ],
  );
  const ocrFreeProviderManagerSection = useMemo(
    () => (
      <OcrFreeProviderManagerSection
        ocrStandaloneCustomProfiles={ocrStandaloneCustomProfiles}
        getFreeProviderDraft={getFreeProviderDraft}
        getSelectedFreeProviderProfileLabel={getSelectedFreeProviderProfileLabel}
        updateFreeProviderDraft={updateFreeProviderDraft}
        saveFreeProviderProfile={saveFreeProviderProfile}
        useFreeProviderProfile={useFreeProviderProfile}
        testFreeProviderConfig={testFreeProviderConfig}
        useCustomProfileById={useCustomProfileById}
        testCustomProfileConfig={testCustomProfileConfig}
        saveCustomProfileInline={saveCustomProfileInline}
        removeCustomLlmProfileById={removeCustomLlmProfileById}
      />
    ),
    [
      ocrStandaloneCustomProfiles,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      updateFreeProviderDraft,
      saveFreeProviderProfile,
      useFreeProviderProfile,
      testFreeProviderConfig,
      useCustomProfileById,
      testCustomProfileConfig,
      saveCustomProfileInline,
      removeCustomLlmProfileById,
    ],
  );
  const translationCustomProfilesManagerSection = useMemo(
    () => (
      <TranslationCustomProfilesManagerSection
        translationStandaloneCustomProfiles={translationStandaloneCustomProfiles}
        translationCustomProviderNotice={translationCustomProviderNotice}
        llmProfilesPersistenceHint={llmProfilesPersistenceHint}
        loadCustomLlmDraftFromProfile={loadCustomLlmDraftFromProfile}
        updateCustomLlmDraft={updateCustomLlmDraft}
        useExistingCustomProfile={useExistingCustomProfile}
        resetCustomLlmDraft={resetCustomLlmDraft}
        removeCustomLlmDraftProfile={removeCustomLlmDraftProfile}
        saveCustomLlmDraftProfile={saveCustomLlmDraftProfile}
        applyOllamaPresetToTranslationDraft={applyOllamaPresetToTranslationDraft}
      />
    ),
    [
      translationStandaloneCustomProfiles,
      translationCustomProviderNotice,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      updateCustomLlmDraft,
      useExistingCustomProfile,
      resetCustomLlmDraft,
      removeCustomLlmDraftProfile,
      saveCustomLlmDraftProfile,
      applyOllamaPresetToTranslationDraft,
    ],
  );
  const ocrCustomProfilesManagerSection = useMemo(
    () => (
      <OcrCustomProfilesManagerSection
        ocrStandaloneCustomProfiles={ocrStandaloneCustomProfiles}
        ocrCustomProviderNotice={ocrCustomProviderNotice}
        llmProfilesPersistenceHint={llmProfilesPersistenceHint}
        loadCustomLlmDraftFromProfile={loadCustomLlmDraftFromProfile}
        updateCustomLlmDraft={updateCustomLlmDraft}
        useExistingCustomProfile={useExistingCustomProfile}
        resetCustomLlmDraft={resetCustomLlmDraft}
        removeCustomLlmDraftProfile={removeCustomLlmDraftProfile}
        saveCustomLlmDraftProfile={saveCustomLlmDraftProfile}
      />
    ),
    [
      ocrStandaloneCustomProfiles,
      ocrCustomProviderNotice,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      updateCustomLlmDraft,
      useExistingCustomProfile,
      resetCustomLlmDraft,
      removeCustomLlmDraftProfile,
      saveCustomLlmDraftProfile,
    ],
  );
  const cleanerAiCustomProfilesManagerSection = useMemo(
    () => (
      <CleanerAiCustomProfilesManagerSection
        cleanStandaloneCustomProfiles={cleanStandaloneCustomProfiles}
        cleanerAiCustomProviderNotice={cleanerAiCustomProviderNotice}
        llmProfilesPersistenceHint={llmProfilesPersistenceHint}
        loadCustomLlmDraftFromProfile={loadCustomLlmDraftFromProfile}
        updateCustomLlmDraft={updateCustomLlmDraft}
        useExistingCleanerCustomProfile={useExistingCleanerCustomProfile}
        resetCustomLlmDraft={resetCustomLlmDraft}
        removeCleanerCustomDraftProfile={removeCleanerCustomDraftProfile}
        saveCleanerCustomDraftProfile={saveCleanerCustomDraftProfile}
      />
    ),
    [
      cleanStandaloneCustomProfiles,
      cleanerAiCustomProviderNotice,
      llmProfilesPersistenceHint,
      loadCustomLlmDraftFromProfile,
      updateCustomLlmDraft,
      useExistingCleanerCustomProfile,
      resetCustomLlmDraft,
      removeCleanerCustomDraftProfile,
      saveCleanerCustomDraftProfile,
    ],
  );
  const cleanerAiFreeProviderManagerSection = useMemo(
    () => (
      <CleanerAiFreeProviderManagerSection
        cleanStandaloneCustomProfiles={cleanStandaloneCustomProfiles}
        getFreeProviderDraft={getFreeProviderDraft}
        getSelectedFreeProviderProfileLabel={getSelectedFreeProviderProfileLabel}
        updateFreeProviderDraft={updateFreeProviderDraft}
        saveFreeProviderProfile={saveFreeProviderProfile}
        testFreeProviderConfig={testFreeProviderConfig}
        testCustomProfileConfig={testCustomProfileConfig}
        saveCustomProfileInline={saveCustomProfileInline}
        removeCustomLlmProfileById={removeCustomLlmProfileById}
      />
    ),
    [
      cleanStandaloneCustomProfiles,
      getFreeProviderDraft,
      getSelectedFreeProviderProfileLabel,
      updateFreeProviderDraft,
      saveFreeProviderProfile,
      testFreeProviderConfig,
      testCustomProfileConfig,
      saveCustomProfileInline,
      removeCustomLlmProfileById,
    ],
  );

  return {
    translationFreeProviderManagerSection,
    ocrFreeProviderManagerSection,
    translationCustomProfilesManagerSection,
    ocrCustomProfilesManagerSection,
    cleanerAiCustomProfilesManagerSection,
    cleanerAiFreeProviderManagerSection,
  };
}
