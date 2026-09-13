/**
 * Cleaner AI model/profile selection — the Automatic AI Clean model picker,
 * the cleaner AI stage option lists with custom-profile resolution, and the
 * draft-profile save/remove actions for the manager sections. Split out of
 * cleaner.ts (T10); the entry file keeps the run orchestration and re-exports
 * this module.
 */
import { useCallback, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import {
  buildCustomStageOption,
  ocrStageOptionSupportsLanguage as ocrModelSupportsLanguage,
  type AioStageOption,
} from '../../../models/aioStageCatalog';
import {
  findCustomProfileForSelection,
  getCustomLlmProviderNotice,
  type CustomLlmProfile,
} from '../../../utils/customLlm';
import type { useCustomLlmDrafts } from './llm-providers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';

/* ── Automatic AI Clean model selection + custom profile reuse ── */

interface UseCleanerModelSelectionArgs {
  /* Page memos (multi-store derived — selector candidates in T12) */
  cleanerAiOptionsForSelect: AioStageOption[];
  cleanStandaloneCustomProfiles: CustomLlmProfile[];
}

export function useCleanerModelSelection({
  cleanerAiOptionsForSelect,
  cleanStandaloneCustomProfiles,
}: UseCleanerModelSelectionArgs) {
  const { t } = useI18n();
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const setCleanerAiModelKey = useCleanerStore((s) => s.setCleanerAiModelKey);

  const useExistingCleanerCustomProfile = useCallback(() => {
    const profileId = customLlmDrafts.clean?.id;
    if (!profileId) {
      setTonedStatus(t('dashboard.status.cleanerSelectProfileFirst'), 'error');
      return;
    }
    const profile =
      cleanStandaloneCustomProfiles.find((item) => item.id === profileId) ?? null;
    if (!profile) {
      setTonedStatus(t('dashboard.status.cleanerProfileNotFound'), 'error');
      return;
    }
    setCleanerAiModelKey(`custom_clean:${profile.id}`);
    setStatusMessage(t('dashboard.status.cleanerProfileInUse', { label: profile.label }));
  }, [customLlmDrafts.clean?.id, cleanStandaloneCustomProfiles, setCleanerAiModelKey, setStatusMessage, setTonedStatus]);

  const selectCleanerAiModel = useCallback(
    (modelKey: string) => {
      const option = cleanerAiOptionsForSelect.find(
        (item) => item.key === modelKey,
      );
      if (!option) {
        setTonedStatus(t('dashboard.status.cleanerSelectValidModel'), 'error');
        return;
      }
      if (!option.implemented) {
        setTonedStatus(t('dashboard.status.modelInRoadmap', { name: option.name }), 'error');
        return;
      }
      if (!option.available) {
        setTonedStatus(t('dashboard.status.modelNeedsConfig', { name: option.name }), 'error');
        return;
      }
      setCleanerAiModelKey(modelKey);
    },
    [cleanerAiOptionsForSelect, setCleanerAiModelKey, setStatusMessage, setTonedStatus],
  );

  return { selectCleanerAiModel, useExistingCleanerCustomProfile };
}

/* ── Cleaner AI stage options: option lists, custom-profile resolution and the
   draft-profile callbacks for the Automatic AI Clean manager (cleaner + llm +
   aio store reads; profile lists arrive from the llm domain by args) ── */

export function useCleanerAiStageOptions({ cleanCustomProfiles }: { cleanCustomProfiles: CustomLlmProfile[] }) {
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const cleanerSrcLang = useCleanerStore((s) => s.cleanerSrcLang);
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const filteredCleanerOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, cleanerSrcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [cleanerSrcLang, aioStageOptions.recognizeText]);
  const cleanerAiCustomOptionsForSelect = useMemo(
    () =>
      cleanCustomProfiles.map((profile) => ({
        ...buildCustomStageOption(profile),
        key: `custom_clean:${profile.id}`,
      })),
    [buildCustomStageOption, cleanCustomProfiles],
  );
  const cleanerAiOptionsForSelect = useMemo(() => {
    const customSelectedOption = cleanerAiCustomOptionsForSelect.find(
      (option) => option.key === cleanerAiModelKey,
    );
    if (customSelectedOption) {
      return [customSelectedOption];
    }
    return [...cleanerAiCustomOptionsForSelect];
  }, [
    cleanerAiCustomOptionsForSelect,
    cleanerAiModelKey,
  ]);
  const selectedCleanerAiDisplayOption = useMemo(() => {
    return (
      cleanerAiOptionsForSelect.find((option) => option.key === cleanerAiModelKey)
      ?? null
    );
  }, [
    cleanerAiOptionsForSelect,
    cleanerAiModelKey,
  ]);
  const selectedCleanerCustomProfile = useMemo(
    () =>
      findCustomProfileForSelection(cleanerAiModelKey, cleanCustomProfiles),
    [cleanerAiModelKey, cleanCustomProfiles],
  );
  const cleanerAiCustomProviderNotice = useMemo(
    () =>
      getCustomLlmProviderNotice(selectedCleanerCustomProfile?.apiBase ?? customLlmDrafts.ocr.apiBase),
    [customLlmDrafts.ocr.apiBase, selectedCleanerCustomProfile?.apiBase],
  );
  return {
    filteredCleanerOcrStageOptions,
    cleanerAiCustomOptionsForSelect,
    cleanerAiOptionsForSelect,
    selectedCleanerAiDisplayOption,
    selectedCleanerCustomProfile,
    cleanerAiCustomProviderNotice,
  };
}


/* ── Cleaner AI draft-profile actions (need the custom-llm drafts hook
   callbacks, which arrive by args; the manager sections consume them) ── */

export function useCleanerAiDraftProfileActions({
  cleanerAiOptionsForSelect,
  saveCustomProfileInline,
  removeCustomLlmProfileById,
}: {
  cleanerAiOptionsForSelect: AioStageOption[];
  saveCustomProfileInline: ReturnType<typeof useCustomLlmDrafts>['saveCustomProfileInline'];
  removeCustomLlmProfileById: ReturnType<typeof useCustomLlmDrafts>['removeCustomLlmProfileById'];
}) {
  const { t } = useI18n();
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const setCleanerAiModelKey = useCleanerStore((s) => s.setCleanerAiModelKey);
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const saveCleanerCustomDraftProfile = useCallback(async () => {
    try {
      const profile = await saveCustomProfileInline('clean', customLlmDrafts.clean);
      setCleanerAiModelKey(`custom_clean:${profile.id}`);
      setTonedStatus(t('dashboard.status.cleanerProfileSaved', { label: profile.label }), 'success');
    } catch {
      // saveCustomProfileInline already updates the error message
    }
  }, [customLlmDrafts.clean, saveCustomProfileInline, setCleanerAiModelKey, setStatusMessage, setTonedStatus]);
  const removeCleanerCustomDraftProfile = useCallback(async () => {
    const profileId = customLlmDrafts.clean?.id;
    if (!profileId) {
      setTonedStatus(t('dashboard.status.cleanerSelectProfileToRemove'), 'error');
      return;
    }
    await removeCustomLlmProfileById('clean', profileId);
    if (cleanerAiModelKey === `custom_clean:${profileId}`) {
      const fallbackManagedKey = cleanerAiOptionsForSelect[0]?.key ?? '';
      if (fallbackManagedKey) {
        setCleanerAiModelKey(fallbackManagedKey);
      }
    }
  }, [
    cleanerAiModelKey,
    cleanerAiOptionsForSelect,
    customLlmDrafts.clean?.id,
    removeCustomLlmProfileById,
    setCleanerAiModelKey,
    setStatusMessage,
    setTonedStatus,
  ]);
  return {
    saveCleanerCustomDraftProfile,
    removeCleanerCustomDraftProfile,
  };
}
