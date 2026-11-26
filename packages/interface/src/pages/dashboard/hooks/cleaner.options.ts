import { useCallback, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import {
  buildCustomStageOption,
  ocrStageOptionSupportsLanguage as ocrModelSupportsLanguage,
  type AioStageOption,
} from '../../../models/aioStageCatalog';
import { IMAGE_EDIT_MODELS_REGISTRY } from '../../../models/translation-models-registry';
import { useModelManagerStatusSnapshot } from '../../../hooks/useModelManager';
import {
  findCustomProfileForSelection,
  getCustomLlmProviderNotice,
  type CustomLlmProfile,
} from '../../../utils/customLlm';
import {
  formatLocalImageEditModelKey,
  getLocalImageEditSpec,
  isLocalImageEditModelKey,
  type LocalImageEditModelId,
} from '../../../utils/imageEditLocalModels';
import type { useCustomLlmDrafts } from './llm-providers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import {
  useCleanerStore,
  type ImageEditModelManagerTarget,
} from '../stores/cleaner-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';

export const applyImageEditModelKeyForTarget = (
  target: ImageEditModelManagerTarget,
  modelKey: string,
): void => {
  if (target === 'aio_ai') {
    useAioPipelineStore.getState().setAioAiModelKey(modelKey);
    return;
  }
  if (target === 'aio_clean') {
    useAioPipelineStore.getState().setAioCleanAiModelKey(modelKey);
    return;
  }
  useCleanerStore.getState().setCleanerAiModelKey(modelKey);
};

export const getImageEditModelKeyForTarget = (
  target: ImageEditModelManagerTarget,
): string => {
  if (target === 'aio_ai') {
    return useAioPipelineStore.getState().aioAiModelKey;
  }
  if (target === 'aio_clean') {
    return useAioPipelineStore.getState().aioCleanAiModelKey;
  }
  return useCleanerStore.getState().cleanerAiModelKey;
};

interface UseCleanerModelSelectionArgs {
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

  const useExistingCleanerCustomProfile = useCallback((): boolean => {
    const profileId = customLlmDrafts.clean?.id;
    if (!profileId) {
      setTonedStatus(t('dashboard.status.cleanerSelectProfileFirst'), 'error');
      return false;
    }
    const profile =
      cleanStandaloneCustomProfiles.find((item) => item.id === profileId) ?? null;
    if (!profile) {
      setTonedStatus(t('dashboard.status.cleanerProfileNotFound'), 'error');
      return false;
    }
    const activeTarget = useCleanerStore.getState().imageEditModelManagerTarget;
    applyImageEditModelKeyForTarget(activeTarget, `custom_clean:${profile.id}`);
    setStatusMessage(t('dashboard.status.cleanerProfileInUse', { label: profile.label }));
    return true;
  }, [customLlmDrafts.clean?.id, cleanStandaloneCustomProfiles, setStatusMessage, setTonedStatus, t]);

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
      if (!option.available && !isLocalImageEditModelKey(modelKey)) {
        setTonedStatus(t('dashboard.status.modelNeedsConfig', { name: option.name }), 'error');
        return;
      }
      setCleanerAiModelKey(modelKey);
      if (isLocalImageEditModelKey(modelKey) && !option.available) {
        setTonedStatus(
          t('dashboard.aio.clean.aiClean.readiness.localNotInstalled', {
            model: option.name,
          }),
          'warning',
        );
      } else {
        setStatusMessage(t('dashboard.status.aiCleanModelSelected', { model: option.name }));
      }
    },
    [cleanerAiOptionsForSelect, setCleanerAiModelKey, setStatusMessage, setTonedStatus, t],
  );

  return { selectCleanerAiModel, useExistingCleanerCustomProfile };
}

export function useCleanerAiStageOptions({ cleanCustomProfiles }: { cleanCustomProfiles: CustomLlmProfile[] }) {
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const cleanerSrcLang = useCleanerStore((s) => s.cleanerSrcLang);
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const { entries: modelEntries } = useModelManagerStatusSnapshot();
  const filteredCleanerOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, cleanerSrcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [cleanerSrcLang, aioStageOptions.recognizeText]);
  const cleanerAiLocalOptionsForSelect = useMemo<AioStageOption[]>(
    () =>
      IMAGE_EDIT_MODELS_REGISTRY.map((model) => ({
        key: formatLocalImageEditModelKey(model.id as LocalImageEditModelId),
        name: model.name,
        device: model.requirements.gpu ? `GPU (${model.requirements.vramMin})` : 'CPU',
        use_case: `${model.requirements.diskSpace} · ${
          getLocalImageEditSpec(model.id)?.hfRepo ?? model.docsUrl ?? ''
        }`,
        implemented: true,
        available: modelEntries[model.id]?.status === 'installed',
        minVramGb: model.minVramGb,
        provider_name: 'Hugging Face (Local)',
      })),
    [modelEntries],
  );
  const cleanerAiCustomOptionsForSelect = useMemo(
    () =>
      cleanCustomProfiles.map((profile) => ({
        ...buildCustomStageOption(profile),
        key: `custom_clean:${profile.id}`,
      })),
    [buildCustomStageOption, cleanCustomProfiles],
  );
  const cleanerAiOptionsForSelect = useMemo(
    () => [...cleanerAiCustomOptionsForSelect, ...cleanerAiLocalOptionsForSelect],
    [cleanerAiCustomOptionsForSelect, cleanerAiLocalOptionsForSelect],
  );
  const selectedCleanerAiDisplayOption = useMemo(() => {
    return (
      cleanerAiOptionsForSelect.find((option) => option.key === cleanerAiModelKey)
      ?? null
    );
  }, [
    cleanerAiOptionsForSelect,
    cleanerAiModelKey,
  ]);
  const selectedCleanerLocalSpec = useMemo(
    () => (isLocalImageEditModelKey(cleanerAiModelKey) ? getLocalImageEditSpec(cleanerAiModelKey) : null),
    [cleanerAiModelKey],
  );
  const selectedCleanerCustomProfile = useMemo(
    () =>
      findCustomProfileForSelection(cleanerAiModelKey, cleanCustomProfiles),
    [cleanerAiModelKey, cleanCustomProfiles],
  );
  const cleanerAiCustomProviderNotice = useMemo(
    () =>
      getCustomLlmProviderNotice(selectedCleanerCustomProfile?.apiBase ?? customLlmDrafts.clean.apiBase),
    [customLlmDrafts.clean.apiBase, selectedCleanerCustomProfile?.apiBase],
  );
  return {
    filteredCleanerOcrStageOptions,
    cleanerAiLocalOptionsForSelect,
    cleanerAiCustomOptionsForSelect,
    cleanerAiOptionsForSelect,
    selectedCleanerAiDisplayOption,
    selectedCleanerLocalSpec,
    selectedCleanerCustomProfile,
    cleanerAiCustomProviderNotice,
  };
}

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
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const saveCleanerCustomDraftProfile = useCallback(async (): Promise<boolean> => {
    try {
      const profile = await saveCustomProfileInline('clean', useLlmProvidersStore.getState().customLlmDrafts.clean);
      const activeTarget = useCleanerStore.getState().imageEditModelManagerTarget;
      applyImageEditModelKeyForTarget(activeTarget, `custom_clean:${profile.id}`);
      setTonedStatus(t('dashboard.status.cleanerProfileSaved', { label: profile.label }), 'success');
      return true;
    } catch {
      return false;
    }
  }, [saveCustomProfileInline, setTonedStatus, t]);
  const removeCleanerCustomDraftProfile = useCallback(async () => {
    const profileId = customLlmDrafts.clean?.id;
    if (!profileId) {
      setTonedStatus(t('dashboard.status.cleanerSelectProfileToRemove'), 'error');
      return;
    }
    await removeCustomLlmProfileById('clean', profileId);
    const activeTarget = useCleanerStore.getState().imageEditModelManagerTarget;
    if (getImageEditModelKeyForTarget(activeTarget) === `custom_clean:${profileId}`) {
      const fallbackManagedKey =
        cleanerAiOptionsForSelect.find((option) => option.available)?.key ?? '';
      if (fallbackManagedKey) {
        applyImageEditModelKeyForTarget(activeTarget, fallbackManagedKey);
      }
    }
  }, [
    cleanerAiOptionsForSelect,
    customLlmDrafts.clean?.id,
    removeCustomLlmProfileById,
    setTonedStatus,
    t,
  ]);
  return {
    saveCleanerCustomDraftProfile,
    removeCleanerCustomDraftProfile,
  };
}
