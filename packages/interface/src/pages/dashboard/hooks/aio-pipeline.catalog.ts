/**
 * AIO model & stage-catalog selection — per-stage local/cloud model pickers,
 * the stage-catalog build effect (options + language options + selection
 * reconcile), selected-model memos, and install-state availability gating.
 * Split out of aio-pipeline.ts (T10); the entry file keeps orchestration and
 * re-exports this module.
 */
import { useCallback, useEffect, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { AIO_STAGE_LABELS } from '../../../constants/dashboard.constants';
import type { ModelInstallState } from '../../../models/types';
import {
  buildAioStageCatalog,
  ocrStageOptionSupportsLanguage as ocrModelSupportsLanguage,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
  type AioStageOption,
} from '../../../models/aioStageCatalog';
import {
  FULL_LLM_CAPABILITIES,
  isCustomModelSelectionKey,
} from '../../../utils/customLlm';
import type { AioStageKey } from '../../../types/aioModelPresets';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useUiShellStore } from '../stores/ui-shell-store';

interface LocalModelEntry {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

/* ── Model selection per stage (local installs, roadmap/config guards) ── */

interface UseAioModelSelectionArgs {
  ocrStageOptionsForSelect: AioStageOption[];
  filteredOcrStageOptions: AioStageOption[];
  modelEntries: Record<string, LocalModelEntry>;
  openModelManagerForStage: (
    stage: AioStageKey,
    args?: { language?: string; focusedModelId?: string | null },
  ) => void;
  setStatusMessage: (message: string) => void;
}

export function useAioModelSelection({
  ocrStageOptionsForSelect,
  filteredOcrStageOptions,
  modelEntries,
  openModelManagerForStage,
  setStatusMessage,
}: UseAioModelSelectionArgs) {
  const { t } = useI18n();
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );

  const getAioStageOption = useCallback((stage: AioStageKey, modelKey: string): AioStageOption | null => {
    if (stage === 'recognizeText') {
      return ocrStageOptionsForSelect.find((option) => option.key === modelKey)
        ?? aioStageOptions.recognizeText.find((option) => option.key === modelKey)
        ?? null;
    }

    return aioStageOptions[stage].find((option) => option.key === modelKey) ?? null;
  }, [aioStageOptions, ocrStageOptionsForSelect]);

  const formatAioStageOptionLabel = useCallback((option: AioStageOption): string => {
    const localEntry = modelEntries[option.key];
    if (!localEntry) {
      if (!option.implemented) {
        return `${option.name} (roadmap)`;
      }
      return `${option.name}${option.available ? '' : t('aioModel.label.unavailable')}`;
    }

    const installed =
      localEntry.status === 'installed' || localEntry.status === 'update_available';
    if (!installed) {
      return `${option.name} ${t('aioModel.label.notInstalled')}`;
    }

    if (localEntry.status === 'update_available') {
      return `${option.name} ${t('aioModel.label.updateAvailable')}`;
    }

    return `${option.name} ${t('aioModel.label.installed')}`;
  }, [modelEntries, t]);

  const resolveLocalModelFocusForStage = useCallback((
    stage: Exclude<AioStageKey, 'getTranslations'>,
    selectedKey: string,
  ): string | null => {
    const selectedEntry = modelEntries[selectedKey];
    if (selectedEntry) {
      return selectedEntry.model.id;
    }

    const stageOptions = stage === 'recognizeText'
      ? filteredOcrStageOptions
      : aioStageOptions[stage];
    const firstLocalOption = stageOptions.find((option) => Boolean(modelEntries[option.key]));
    if (firstLocalOption) {
      return firstLocalOption.key;
    }

    return null;
  }, [aioStageOptions, filteredOcrStageOptions, modelEntries]);

  const selectAioLocalStageModel = useCallback((
    stage: Exclude<AioStageKey, 'getTranslations'>,
    modelKey: string,
  ) => {
    const localEntry = modelEntries[modelKey];
    if (!localEntry) {
      const focusedModelId = resolveLocalModelFocusForStage(stage, modelKey);
      setStatusMessage(t('aioModel.status.selectAndInstall', { stage: AIO_STAGE_LABELS[stage] }));
      openModelManagerForStage(stage, { focusedModelId });
      return;
    }

    const installed =
      localEntry.status === 'installed' || localEntry.status === 'update_available';
    if (!installed) {
      setStatusMessage(t('aioModel.status.installBeforeUse', { name: localEntry.model.name }));
      openModelManagerForStage(stage, { focusedModelId: localEntry.model.id });
      return;
    }

    setAioStageSelection((prev) => ({ ...prev, [stage]: modelKey }));
  }, [modelEntries, openModelManagerForStage, resolveLocalModelFocusForStage, setAioStageSelection, setStatusMessage, t]);

  const selectAioRecognizeTextModel = useCallback((modelKey: string) => {
    const localEntry = modelEntries[modelKey];
    if (localEntry) {
      selectAioLocalStageModel('recognizeText', modelKey);
      return;
    }

    const option = getAioStageOption('recognizeText', modelKey);
    if (!option) {
      setStatusMessage(t('aioModel.status.selectValidOcr'));
      return;
    }

    if (!option.implemented) {
      setStatusMessage(t('aioModel.status.inRoadmap', { name: option.name }));
      return;
    }

    if (!option.available) {
      setStatusMessage(t('aioModel.status.requiresConfig', { name: option.name }));
      return;
    }

    setAioStageSelection((prev) => ({ ...prev, recognizeText: modelKey }));
  }, [
    aioStageSelection.recognizeText,
    getAioStageOption,
    modelEntries,
    openModelManagerForStage,
    resolveLocalModelFocusForStage,
    selectAioLocalStageModel,
    setAioStageSelection,
    setStatusMessage,
    t,
  ]);

  const getLocalStageStatusText = useCallback((modelKey: string): string | null => {
    const entry = modelEntries[modelKey];
    if (!entry) {
      return null;
    }

    if (entry.status === 'installed') {
      return t('aioModel.status.installedOk');
    }

    if (entry.status === 'update_available') {
      return t('aioModel.status.installedUpdate');
    }

    return entry.status;
  }, [modelEntries, t]);

  const selectedDetectStatusText = useMemo(
    () => getLocalStageStatusText(aioStageSelection.detectText),
    [aioStageSelection.detectText, getLocalStageStatusText],
  );
  const selectedOcrStatusText = useMemo(
    () => getLocalStageStatusText(aioStageSelection.recognizeText),
    [aioStageSelection.recognizeText, getLocalStageStatusText],
  );
  const selectedSegmentStatusText = useMemo(
    () => getLocalStageStatusText(aioStageSelection.segmentText),
    [aioStageSelection.segmentText, getLocalStageStatusText],
  );
  const selectedCleanStatusText = useMemo(
    () => getLocalStageStatusText(aioStageSelection.cleanImage),
    [aioStageSelection.cleanImage, getLocalStageStatusText],
  );

  return {
    getAioStageOption,
    formatAioStageOptionLabel,
    resolveLocalModelFocusForStage,
    selectAioLocalStageModel,
    selectAioRecognizeTextModel,
    getLocalStageStatusText,
    selectedDetectStatusText,
    selectedOcrStatusText,
    selectedSegmentStatusText,
    selectedCleanStatusText,
  };
}

/* ── Stage catalog build (options + language options + selection reconcile) ── */

interface UseAioStageCatalogBuildArgs {
  customOcrStageOptions: AioStageOption[];
  customTranslationStageOptions: AioStageOption[];
  modelEntries: Record<string, ModelInstallState>;
}

export function useAioStageCatalogBuild({
  customOcrStageOptions,
  customTranslationStageOptions,
  modelEntries,
}: UseAioStageCatalogBuildArgs) {
  const { t } = useI18n();
  const mode = useUiShellStore((s) => s.mode);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const customLlmProfiles = useLlmProvidersStore((s) => s.customLlmProfiles);
  const pendingCustomSelections = useLlmProvidersStore(
    (s) => s.pendingCustomSelections,
  );
  const setAioOptionsLoading = useAioPipelineStore(
    (s) => s.setAioOptionsLoading,
  );
  const setAioStageOptions = useAioPipelineStore((s) => s.setAioStageOptions);
  const setAioLanguageOptions = useAioPipelineStore(
    (s) => s.setAioLanguageOptions,
  );
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );

  useEffect(() => {
    if (mode !== 'aio') return;
    setAioOptionsLoading(true);

    const pendingTranslationOption = pendingCustomSelections.translation
      ? {
        key: pendingCustomSelections.translation,
        name: t('dashboard.status.pendingCustomTranslationName'),
        device: 'cloud',
        use_case: t('dashboard.status.customProfilePendingSync'),
        languages: ['multi'],
        available: true,
        implemented: true,
        llm_capabilities: FULL_LLM_CAPABILITIES,
      }
      : null;
    const pendingOcrOption = pendingCustomSelections.ocr
      ? {
        key: pendingCustomSelections.ocr,
        name: t('dashboard.status.pendingCustomOcrName'),
        device: 'cloud',
        use_case: t('dashboard.status.customProfileOcrPendingSync'),
        languages: ['multi'],
        available: true,
        implemented: true,
        llm_capabilities: FULL_LLM_CAPABILITIES,
      }
      : null;

    const builtOptions = buildAioStageCatalog({
      sourceLanguage: aioSrcLang,
      localModelEntries: modelEntries,
      customProfiles: customLlmProfiles,
    });

    const nextOptions = {
      ...builtOptions,
      recognizeText:
        pendingOcrOption &&
          !builtOptions.recognizeText.some(
            (option) => option.key === pendingOcrOption.key,
          )
          ? [...builtOptions.recognizeText, pendingOcrOption]
          : builtOptions.recognizeText,
      getTranslations:
        pendingTranslationOption &&
          !builtOptions.getTranslations.some(
            (option) => option.key === pendingTranslationOption.key,
          )
          ? [...builtOptions.getTranslations, pendingTranslationOption]
          : builtOptions.getTranslations,
    };

    setAioStageOptions((prev) => {
      const sameOptions = (
        a: AioStageOption[],
        b: AioStageOption[],
      ): boolean =>
        a.length === b.length &&
        a.every(
          (option, index) =>
            JSON.stringify(option) === JSON.stringify(b[index]),
        );
      return (
        Object.keys(prev).every((stage) =>
          sameOptions(
            prev[stage as keyof typeof prev],
            nextOptions[stage as keyof typeof nextOptions],
          ),
        )
          ? prev
          : nextOptions
      );
    });
    // The catalog stores i18n keys (e.g. "aioStage.lang.en") as `label` to keep
    // the data file locale-agnostic. Without resolving them through `t` here the
    // raw key leaks into the UI (and into preset names saved by the user).
    setAioLanguageOptions((prev) => {
      const source = SOURCE_LANGUAGE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      }));
      const target = TARGET_LANGUAGE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      }));
      const sameList = (
        a: Array<{ value: string; label: string }>,
        b: Array<{ value: string; label: string }>,
      ): boolean =>
        a.length === b.length &&
        a.every(
          (option, index) =>
            option.value === b[index]?.value && option.label === b[index]?.label,
        );
      return sameList(prev.source, source) && sameList(prev.target, target)
        ? prev
        : { source, target };
    });
    setAioSrcLang((prev) =>
      SOURCE_LANGUAGE_OPTIONS.some((option) => option.value === prev)
        ? prev
        : (SOURCE_LANGUAGE_OPTIONS[0]?.value ?? 'ja'),
    );
    setAioTgtLang((prev) =>
      TARGET_LANGUAGE_OPTIONS.some((option) => option.value === prev)
        ? prev
        : (TARGET_LANGUAGE_OPTIONS[0]?.value ?? 'en'),
    );
    setAioStageSelection((prev) => {
      const detectDefault =
        nextOptions.detectText.find((item) => item.available)?.key ??
        nextOptions.detectText[0]?.key ??
        prev.detectText;
      const ocrDefault =
        nextOptions.recognizeText.find((item) => item.available)?.key ??
        nextOptions.recognizeText[0]?.key ??
        prev.recognizeText;
      const translationDefault =
        nextOptions.getTranslations.find((item) => item.available)?.key ??
        nextOptions.getTranslations[0]?.key ??
        prev.getTranslations;
      const segmentDefault =
        nextOptions.segmentText.find((item) => item.available)?.key ??
        nextOptions.segmentText[0]?.key ??
        prev.segmentText;
      const cleanDefault =
        nextOptions.cleanImage.find((item) => item.available)?.key ??
        nextOptions.cleanImage[0]?.key ??
        prev.cleanImage;
      const keepCustomOcrSelection =
        isCustomModelSelectionKey(prev.recognizeText) &&
        (customOcrStageOptions.some(
          (item) => item.key === prev.recognizeText,
        ) ||
          pendingCustomSelections.ocr === prev.recognizeText);
      const keepCustomTranslationSelection =
        isCustomModelSelectionKey(prev.getTranslations) &&
        (customTranslationStageOptions.some(
          (item) => item.key === prev.getTranslations,
        ) ||
          pendingCustomSelections.translation === prev.getTranslations);
      const next = {
        detectText:
          prev.detectText &&
            nextOptions.detectText.some((item) => item.key === prev.detectText)
            ? prev.detectText
            : detectDefault,
        recognizeText: keepCustomOcrSelection
          ? prev.recognizeText
          : prev.recognizeText &&
            nextOptions.recognizeText.some(
              (item) => item.key === prev.recognizeText,
            )
            ? prev.recognizeText
            : ocrDefault,
        getTranslations:
          prev.getTranslations &&
            nextOptions.getTranslations.some(
              (item) => item.key === prev.getTranslations,
            )
            ? prev.getTranslations
            : keepCustomTranslationSelection
              ? prev.getTranslations
              : translationDefault,
        segmentText:
          prev.segmentText &&
            nextOptions.segmentText.some((item) => item.key === prev.segmentText)
            ? prev.segmentText
            : segmentDefault,
        cleanImage:
          prev.cleanImage &&
            nextOptions.cleanImage.some((item) => item.key === prev.cleanImage)
            ? prev.cleanImage
            : cleanDefault,
      };
      return (
        next.detectText === prev.detectText &&
          next.recognizeText === prev.recognizeText &&
          next.getTranslations === prev.getTranslations &&
          next.segmentText === prev.segmentText &&
          next.cleanImage === prev.cleanImage
          ? prev
          : next
      );
    });
    setAioOptionsLoading(false);
    // `t` deliberately outside the deps — parity with the baseline effect,
    // which also kept its deps without `t` (labels refresh on the next run).
  }, [
    aioSrcLang,
    customLlmProfiles,
    customOcrStageOptions,
    customTranslationStageOptions,
    mode,
    modelEntries,
    pendingCustomSelections.ocr,
    pendingCustomSelections.translation,
    setAioLanguageOptions,
    setAioOptionsLoading,
    setAioStageOptions,
    setAioStageSelection,
    setAioSrcLang,
    setAioTgtLang,
  ]);
}

/* ── Selected stage models: memos resolving the aio stage options against the
   current selection keys (aio-pipeline store only) ── */

export function useAioSelectedStageModels() {
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const selectedDetectModel = useMemo(
    () =>
      aioStageOptions.detectText.find(
        (option) => option.key === aioStageSelection.detectText,
      ) ?? null,
    [aioStageOptions.detectText, aioStageSelection.detectText],
  );
  const filteredOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, aioSrcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [aioSrcLang, aioStageOptions.recognizeText]);
  const selectedOcrModel = useMemo(
    () =>
      filteredOcrStageOptions.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ??
      aioStageOptions.recognizeText.find(
        (option) => option.key === aioStageSelection.recognizeText,
      ) ??
      null,
    [
      aioStageOptions.recognizeText,
      aioStageSelection.recognizeText,
      filteredOcrStageOptions,
    ],
  );
  const selectedLegacyTranslationOption = useMemo(
    () =>
      aioStageOptions.getTranslations.find(
        (option) => option.key === aioStageSelection.getTranslations,
      ) ?? null,
    [aioStageOptions.getTranslations, aioStageSelection.getTranslations],
  );
  const selectedSegmentModel = useMemo(
    () =>
      aioStageOptions.segmentText.find(
        (option) => option.key === aioStageSelection.segmentText,
      ) ?? null,
    [aioStageOptions.segmentText, aioStageSelection.segmentText],
  );
  const selectedCleanModel = useMemo(
    () =>
      aioStageOptions.cleanImage.find(
        (option) => option.key === aioStageSelection.cleanImage,
      ) ?? null,
    [aioStageOptions.cleanImage, aioStageSelection.cleanImage],
  );
  return {
    selectedDetectModel,
    filteredOcrStageOptions,
    selectedOcrModel,
    selectedLegacyTranslationOption,
    selectedSegmentModel,
    selectedCleanModel,
  };
}


/* ── Stage availability: install-state gating of the stage option lists
   (modelManagerState arrives from the model manager; the llm stage option
   lists and the cleaner OCR filter arrive by args) ── */

export function useAioStageAvailability({
  modelManagerState,
  translationStageOptionsForSelect,
  ocrStageOptionsForSelect,
  filteredCleanerOcrStageOptions,
}: {
  modelManagerState: { entries: Record<string, LocalModelEntry> };
  translationStageOptionsForSelect: AioStageOption[];
  ocrStageOptionsForSelect: AioStageOption[];
  filteredCleanerOcrStageOptions: AioStageOption[];
}) {
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const isInstalledLocalAioEntry = useCallback(
    (modelKey: string): boolean => {
      const entry = modelManagerState.entries[modelKey];
      if (!entry) {
        return false;
      }
      return (
        entry.status === 'installed' || entry.status === 'update_available'
      );
    },
    [modelManagerState.entries],
  );
  const isStageOptionSelectable = useCallback(
    (option: AioStageOption | null | undefined): boolean => {
      if (!option) {
        return false;
      }
      if (option.key === 'custom' || option.key === 'custom_ocr') {
        return false;
      }
      if (modelManagerState.entries[option.key]) {
        return isInstalledLocalAioEntry(option.key);
      }
      return option.implemented && option.available;
    },
    [
      isInstalledLocalAioEntry,
      modelManagerState.entries,
    ],
  );
  const availableDetectStageOptions = useMemo(
    () =>
      aioStageOptions.detectText.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [aioStageOptions.detectText, isStageOptionSelectable],
  );
  const availableSegmentStageOptions = useMemo(
    () =>
      aioStageOptions.segmentText.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [aioStageOptions.segmentText, isStageOptionSelectable],
  );
  const availableCleanStageOptions = useMemo(
    () =>
      aioStageOptions.cleanImage.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [aioStageOptions.cleanImage, isStageOptionSelectable],
  );
  const availableTranslationStageOptions = useMemo(
    () =>
      translationStageOptionsForSelect.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, translationStageOptionsForSelect],
  );
  const availableOcrStageOptions = useMemo(
    () =>
      ocrStageOptionsForSelect.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, ocrStageOptionsForSelect],
  );
  const cleanerAvailableOcrStageOptions = useMemo(
    () =>
      filteredCleanerOcrStageOptions.filter((option) =>
        isStageOptionSelectable(option),
      ),
    [isStageOptionSelectable, filteredCleanerOcrStageOptions],
  );
  return {
    isInstalledLocalAioEntry,
    isStageOptionSelectable,
    availableDetectStageOptions,
    availableSegmentStageOptions,
    availableCleanStageOptions,
    availableTranslationStageOptions,
    availableOcrStageOptions,
    cleanerAvailableOcrStageOptions,
  };
}
