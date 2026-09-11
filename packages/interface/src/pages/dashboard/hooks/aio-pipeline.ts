import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../../i18n';
import {
  AIO_MANUAL_STAGE_ORDER,
  AIO_PRESET_STAGE_KEYS,
  AIO_STAGE_LABELS,
  MIN_REGION_SIZE,
} from '../../../constants/dashboard.constants';
import {
  buildAioStageCatalog,
  ocrStageOptionSupportsLanguage as ocrModelSupportsLanguage,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
  type AioDeviceInfo,
  type AioStageOption,
} from '../../../models/aioStageCatalog';
import type { ModelInstallState } from '../../../models/types';
import { desktopBridge } from '../../../lib/desktop-bridge';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  parseApiError,
} from '../helpers';
import {
  normalizeBatchConcurrency,
  runConcurrentBatch,
} from '../../../utils/concurrentBatch';
import {
  applyPresetToStageSelection,
  createPreset as createAioPreset,
  deletePreset as deleteAioPreset,
  getActivePresetForLanguage,
  setActivePresetForLanguage,
  updatePreset as updateAioPreset,
} from '../../../utils/aioModelPresets';
import {
  applyDetectedGradientToStyle,
  clamp,
  createEmptyAioPresetEditorDraft,
  normalizePresetLanguage,
} from '../../../utils/dashboard.utils';
import type { RenderTextStyle } from '../../../utils/renderText';
import {
  FULL_LLM_CAPABILITIES,
  isCustomModelSelectionKey,
  type CustomLlmProfile,
} from '../../../utils/customLlm';
import {
  isAbortError,
  isTimeoutError,
  type AioExecutionScope,
} from '../../../utils/dashboardRenderUtils';
import type {
  AioLanguageModelPreset,
  AioStageKey,
  AioStageSelection,
} from '../../../types/aioModelPresets';
import type {
  AioDownloadEntry,
  AioManualImageEditState,
  AioManualImageProgress,
  AioPipelineSnapshot,
  AioPipelineSnapshotKey,
  AioTextRegion,
  AioPresetEditorDraft,
  LoadedImage,
  WebhookMetrics,
} from '../../../types/dashboard.types';
import type { DesktopMiniBackendRuntimeState } from '../../../types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useAioManualProgressControls } from '../../../hooks/useAioManualProgressControls';
import { useAioManualStageExecutor } from '../../../hooks/useAioManualStageExecutor';
import { useAioManualStageSkip } from '../../../hooks/useAioManualStageSkip';
import { useAioExecutionPreparation } from '../../../hooks/useAioExecutionPreparation';
import { useAioSingleImageProcessor } from '../../../hooks/useAioSingleImageProcessor';
import { useAioResultConsolidation } from '../../../hooks/useAioResultConsolidation';

interface LocalModelEntry {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

/* ── Preset editor (load/apply/create/edit/delete presets per source language) ── */

interface UseAioPresetEditorArgs {
  availableDetectStageOptions: AioStageOption[];
  availableOcrStageOptions: AioStageOption[];
  availableTranslationStageOptions: AioStageOption[];
  availableSegmentStageOptions: AioStageOption[];
  availableCleanStageOptions: AioStageOption[];
  setStatusMessage: (message: string) => void;
}

export function useAioPresetEditor({
  availableDetectStageOptions,
  availableOcrStageOptions,
  availableTranslationStageOptions,
  availableSegmentStageOptions,
  availableCleanStageOptions,
  setStatusMessage,
}: UseAioPresetEditorArgs) {
  const { t } = useI18n();
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioLanguageSourceOptions = useAioPipelineStore(
    (s) => s.aioLanguageOptions.source,
  );
  const aioPresetState = useAioPipelineStore((s) => s.aioPresetState);
  const setAioPresetState = useAioPipelineStore((s) => s.setAioPresetState);
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );
  const [aioPresetEditorOpen, setAioPresetEditorOpen] = useState(false);
  const [aioPresetEditorDraft, setAioPresetEditorDraft] = useState<AioPresetEditorDraft>(() =>
    createEmptyAioPresetEditorDraft({
      detectText: 'font_rtdetr_v2',
      recognizeText: 'manga_ocr',
      getTranslations: 'google_translate',
      segmentText: 'baka_content_cc',
      cleanImage: 'aot',
    }),
  );
  const autoAppliedPresetSignatureRef = useRef<string | null>(null);

  const normalizedAioSourceLanguage = useMemo(
    () => normalizePresetLanguage(aioSrcLang),
    [aioSrcLang],
  );

  const sourceLanguageLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    aioLanguageSourceOptions.forEach((option) => {
      map.set(normalizePresetLanguage(option.value), option.label);
    });
    return map;
  }, [aioLanguageSourceOptions]);

  const presetStageAvailability = useMemo(
    () => ({
      detectText: new Set(availableDetectStageOptions.map((option) => option.key)),
      recognizeText: new Set(availableOcrStageOptions.map((option) => option.key)),
      getTranslations: new Set(availableTranslationStageOptions.map((option) => option.key)),
      segmentText: new Set(availableSegmentStageOptions.map((option) => option.key)),
      cleanImage: new Set(availableCleanStageOptions.map((option) => option.key)),
    }),
    [
      availableCleanStageOptions,
      availableDetectStageOptions,
      availableOcrStageOptions,
      availableSegmentStageOptions,
      availableTranslationStageOptions,
    ],
  );

  const presetsForCurrentLanguage = useMemo(() => {
    const activePresetId = aioPresetState.activePresetBySourceLanguage[normalizedAioSourceLanguage] ?? null;
    return aioPresetState.presets
      .filter((preset) => preset.sourceLanguage === normalizedAioSourceLanguage)
      .sort((left, right) => {
        const leftActive = left.id === activePresetId ? 0 : 1;
        const rightActive = right.id === activePresetId ? 0 : 1;
        if (leftActive !== rightActive) {
          return leftActive - rightActive;
        }
        return left.name.localeCompare(right.name);
      });
  }, [aioPresetState, normalizedAioSourceLanguage]);

  const activePresetForCurrentLanguage = useMemo(
    () => getActivePresetForLanguage(normalizedAioSourceLanguage, aioPresetState),
    [aioPresetState, normalizedAioSourceLanguage],
  );

  const presetEditorStageOptions = useMemo(
    () => ({
      detectText: availableDetectStageOptions,
      recognizeText: availableOcrStageOptions,
      getTranslations: availableTranslationStageOptions,
      segmentText: availableSegmentStageOptions,
      cleanImage: availableCleanStageOptions,
    }),
    [
      availableCleanStageOptions,
      availableDetectStageOptions,
      availableOcrStageOptions,
      availableSegmentStageOptions,
      availableTranslationStageOptions,
    ],
  );

  const sanitizePresetEditorStageModels = useCallback((stageModels: AioStageSelection): AioStageSelection => ({
    detectText:
      presetEditorStageOptions.detectText.find((option) => option.key === stageModels.detectText)?.key
      ?? presetEditorStageOptions.detectText[0]?.key
      ?? '',
    recognizeText:
      presetEditorStageOptions.recognizeText.find((option) => option.key === stageModels.recognizeText)?.key
      ?? presetEditorStageOptions.recognizeText[0]?.key
      ?? '',
    getTranslations:
      presetEditorStageOptions.getTranslations.find((option) => option.key === stageModels.getTranslations)?.key
      ?? presetEditorStageOptions.getTranslations[0]?.key
      ?? '',
    segmentText:
      presetEditorStageOptions.segmentText.find((option) => option.key === stageModels.segmentText)?.key
      ?? presetEditorStageOptions.segmentText[0]?.key
      ?? '',
    cleanImage:
      presetEditorStageOptions.cleanImage.find((option) => option.key === stageModels.cleanImage)?.key
      ?? presetEditorStageOptions.cleanImage[0]?.key
      ?? '',
  }), [presetEditorStageOptions]);

  const applyPresetSelection = useCallback((preset: AioLanguageModelPreset) => {
    const currentSelection = useAioPipelineStore.getState().aioStageSelection;
    const applyResult = applyPresetToStageSelection(preset, currentSelection, presetStageAvailability);
    const hasChanges = JSON.stringify(currentSelection) !== JSON.stringify(applyResult.selection);
    if (hasChanges) {
      setAioStageSelection(applyResult.selection);
    }

    if (applyResult.unappliedStages.length > 0) {
      const stageLabels = applyResult.unappliedStages.map((stage) => AIO_STAGE_LABELS[stage]).join(', ');
      setStatusMessage(
        t('dashboard.status.preset.appliedPartial', {
          name: preset.name,
          stages: stageLabels,
        }),
      );
      return;
    }

    if (hasChanges) {
      setStatusMessage(
        t('dashboard.status.preset.applied', {
          name: preset.name,
          lang: preset.sourceLanguage.toUpperCase(),
        }),
      );
    }
  }, [presetStageAvailability, setAioStageSelection, setStatusMessage, t]);

  const presetAutoApplySignature = useMemo(
    () => [
      normalizedAioSourceLanguage,
      activePresetForCurrentLanguage?.id ?? 'none',
      activePresetForCurrentLanguage?.stageModels.detectText ?? 'none',
      activePresetForCurrentLanguage?.stageModels.recognizeText ?? 'none',
      activePresetForCurrentLanguage?.stageModels.getTranslations ?? 'none',
      activePresetForCurrentLanguage?.stageModels.segmentText ?? 'none',
      activePresetForCurrentLanguage?.stageModels.cleanImage ?? 'none',
    ].join('|'),
    [
      activePresetForCurrentLanguage?.id,
      activePresetForCurrentLanguage?.stageModels.cleanImage,
      activePresetForCurrentLanguage?.stageModels.detectText,
      activePresetForCurrentLanguage?.stageModels.getTranslations,
      activePresetForCurrentLanguage?.stageModels.recognizeText,
      activePresetForCurrentLanguage?.stageModels.segmentText,
      normalizedAioSourceLanguage,
    ],
  );

  useEffect(() => {
    if (!activePresetForCurrentLanguage) {
      autoAppliedPresetSignatureRef.current = null;
      return;
    }
    if (autoAppliedPresetSignatureRef.current === presetAutoApplySignature) {
      return;
    }
    applyPresetSelection(activePresetForCurrentLanguage);
    autoAppliedPresetSignatureRef.current = presetAutoApplySignature;
  }, [activePresetForCurrentLanguage, applyPresetSelection, presetAutoApplySignature]);

  const openCreatePresetEditor = useCallback(() => {
    setAioPresetEditorDraft(
      createEmptyAioPresetEditorDraft(
        sanitizePresetEditorStageModels({
          ...useAioPipelineStore.getState().aioStageSelection,
        }),
      ),
    );
    setAioPresetEditorOpen(true);
  }, [sanitizePresetEditorStageModels]);

  const openEditPresetEditor = useCallback(() => {
    if (!activePresetForCurrentLanguage) {
      setStatusMessage('Select an active preset to edit.');
      return;
    }
    setAioPresetEditorDraft({
      presetId: activePresetForCurrentLanguage.id,
      name: activePresetForCurrentLanguage.name,
      description: activePresetForCurrentLanguage.description,
      stageModels: sanitizePresetEditorStageModels({ ...activePresetForCurrentLanguage.stageModels }),
      setAsActive: true,
    });
    setAioPresetEditorOpen(true);
  }, [activePresetForCurrentLanguage, sanitizePresetEditorStageModels, setStatusMessage]);

  const closePresetEditor = useCallback(() => {
    setAioPresetEditorOpen(false);
  }, []);

  const handlePresetSelectionChange = useCallback((presetId: string) => {
    const normalizedPresetId = presetId.trim();
    const nextState = setActivePresetForLanguage(
      normalizedAioSourceLanguage,
      normalizedPresetId || null,
      aioPresetState,
    );
    setAioPresetState(nextState);

    if (!normalizedPresetId) {
      setStatusMessage(
        t('dashboard.status.preset.cleared', {
          lang: normalizedAioSourceLanguage.toUpperCase(),
        }),
      );
      return;
    }

    const selectedPreset = nextState.presets.find((preset: AioLanguageModelPreset) => preset.id === normalizedPresetId) ?? null;
    if (!selectedPreset) {
      setStatusMessage('The selected preset was not found.');
      return;
    }

    applyPresetSelection(selectedPreset);
  }, [aioPresetState, applyPresetSelection, normalizedAioSourceLanguage, setAioPresetState, setStatusMessage, t]);

  const handleDeleteActivePreset = useCallback(() => {
    if (!activePresetForCurrentLanguage) {
      setStatusMessage('No active preset to delete.');
      return;
    }
    const confirmed = window.confirm(`Delete preset "${activePresetForCurrentLanguage.name}"?`);
    if (!confirmed) return;

    const nextState = deleteAioPreset(activePresetForCurrentLanguage.id, aioPresetState);
    setAioPresetState(nextState);
    setAioPresetEditorOpen(false);
    setStatusMessage(
      t('dashboard.status.preset.deleted', { name: activePresetForCurrentLanguage.name }),
    );
  }, [activePresetForCurrentLanguage, aioPresetState, setAioPresetState, setStatusMessage, t]);

  const handleSaveCurrentSelectionAsPreset = useCallback(() => {
    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const languageLabel = sourceLanguageLabelByCode.get(normalizedAioSourceLanguage)
      ?? normalizedAioSourceLanguage.toUpperCase();
    const stageModels = sanitizePresetEditorStageModels({
      ...useAioPipelineStore.getState().aioStageSelection,
    });
    const missingStage = AIO_PRESET_STAGE_KEYS.find((stageKey) => !stageModels[stageKey]);
    if (missingStage) {
      setStatusMessage(`No model is available for the "${AIO_STAGE_LABELS[missingStage]}" stage.`);
      return;
    }
    const created = createAioPreset(
      {
        name: t('aioPreset.autoName', { lang: languageLabel, time: nowLabel }),
        description: t('aioPreset.autoDescription'),
        sourceLanguage: normalizedAioSourceLanguage,
        stageModels,
      },
      aioPresetState,
    );
    const withActive = setActivePresetForLanguage(
      normalizedAioSourceLanguage,
      created.preset.id,
      created.state,
    );
    setAioPresetState(withActive);
    setStatusMessage(
      t('dashboard.status.preset.created', { name: created.preset.name }),
    );
  }, [aioPresetState, normalizedAioSourceLanguage, sanitizePresetEditorStageModels, setAioPresetState, setStatusMessage, sourceLanguageLabelByCode, t]);

  const handleSavePresetEditor = useCallback(() => {
    const trimmedName = aioPresetEditorDraft.name.trim();
    if (!trimmedName) {
      setStatusMessage('Enter a name for the preset.');
      return;
    }
    const nextStageModels = sanitizePresetEditorStageModels({ ...aioPresetEditorDraft.stageModels });
    const missingStage = AIO_PRESET_STAGE_KEYS.find((stageKey) => !nextStageModels[stageKey]);
    if (missingStage) {
      setStatusMessage(`No model is available for the "${AIO_STAGE_LABELS[missingStage]}" stage.`);
      return;
    }

    let nextState = aioPresetState;
    let savedPreset: AioLanguageModelPreset | null = null;
    if (aioPresetEditorDraft.presetId) {
      const updated = updateAioPreset(
        aioPresetEditorDraft.presetId,
        {
          name: trimmedName,
          description: aioPresetEditorDraft.description,
          sourceLanguage: normalizedAioSourceLanguage,
          stageModels: nextStageModels,
        },
        aioPresetState,
      );
      nextState = updated.state;
      savedPreset = updated.preset;
    } else {
      const created = createAioPreset(
        {
          name: trimmedName,
          description: aioPresetEditorDraft.description,
          sourceLanguage: normalizedAioSourceLanguage,
          stageModels: nextStageModels,
        },
        aioPresetState,
      );
      nextState = created.state;
      savedPreset = created.preset;
    }

    if (!savedPreset) {
      setStatusMessage('Could not save the preset.');
      return;
    }

    if (aioPresetEditorDraft.setAsActive) {
      nextState = setActivePresetForLanguage(normalizedAioSourceLanguage, savedPreset.id, nextState);
      applyPresetSelection(savedPreset);
    }

    setAioPresetState(nextState);
    setAioPresetEditorOpen(false);
    setStatusMessage(
      t('dashboard.status.preset.saved', { name: savedPreset.name }),
    );
  }, [aioPresetEditorDraft, aioPresetState, applyPresetSelection, normalizedAioSourceLanguage, sanitizePresetEditorStageModels, setAioPresetState, setStatusMessage, t]);

  return {
    normalizedAioSourceLanguage,
    sourceLanguageLabelByCode,
    presetsForCurrentLanguage,
    activePresetForCurrentLanguage,
    presetEditorStageOptions,
    aioPresetEditorOpen,
    setAioPresetEditorOpen,
    aioPresetEditorDraft,
    setAioPresetEditorDraft,
    handlePresetSelectionChange,
    openCreatePresetEditor,
    openEditPresetEditor,
    closePresetEditor,
    handleDeleteActivePreset,
    handleSaveCurrentSelectionAsPreset,
    handleSavePresetEditor,
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

    setAioStageOptions(nextOptions);
    // The catalog stores i18n keys (e.g. "aioStage.lang.en") as `label` to keep
    // the data file locale-agnostic. Without resolving them through `t` here the
    // raw key leaks into the UI (and into preset names saved by the user).
    setAioLanguageOptions({
      source: SOURCE_LANGUAGE_OPTIONS.map((option) => ({ ...option, label: t(option.label) })),
      target: TARGET_LANGUAGE_OPTIONS.map((option) => ({ ...option, label: t(option.label) })),
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
      return {
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

/* ── Mini-backend runtime state (desktop IPC listener + initial fetch) ── */

export function useAioMiniBackendRuntimeSync() {
  const setAioMiniBackendRuntimeState = useAioPipelineStore(
    (s) => s.setAioMiniBackendRuntimeState,
  );

  useEffect(() => {
    let cancelled = false;
    const runtimeListener = (payload: DesktopMiniBackendRuntimeState) => {
      if (!cancelled) {
        setAioMiniBackendRuntimeState(payload);
      }
    };

    const loadMiniBackendRuntimeState = async () => {
      try {
        const payload = await desktopBridge.desktop?.getMiniBackendRuntimeState?.();
        if (!cancelled) {
          setAioMiniBackendRuntimeState(
            (payload ?? null) as DesktopMiniBackendRuntimeState | null,
          );
        }
      } catch {
        if (!cancelled) {
          setAioMiniBackendRuntimeState(null);
        }
      }
    };

    void loadMiniBackendRuntimeState();
    desktopBridge.desktop?.onMiniBackendRuntimeState?.(runtimeListener);
    return () => {
      cancelled = true;
      desktopBridge.desktop?.offMiniBackendRuntimeState?.(runtimeListener);
    };
  }, [setAioMiniBackendRuntimeState]);
}

/* ── Device info (GPU snapshot from the local backend) ── */

export function useAioDeviceInfoSync(localApiUrl: string) {
  const { t } = useI18n();
  const mode = useUiShellStore((s) => s.mode);
  const setAioDeviceInfo = useAioPipelineStore((s) => s.setAioDeviceInfo);

  useEffect(() => {
    if (mode !== 'aio') return;
    let cancelled = false;

    const loadAioDeviceInfo = async () => {
      try {
        const response = await fetchWithTimeoutAndRetry(
          `${localApiUrl}/device/info`,
          { method: 'GET' },
          { timeoutMs: 10_000, retryCount: 1 },
        );
        if (!response.ok) {
          throw new Error(t('dashboard.error.loadHardwareFailed'));
        }
        const payload = (await response.json()) as AioDeviceInfo;
        if (!cancelled) {
          setAioDeviceInfo(payload);
        }
      } catch {
        // Preserve the previous device snapshot on transient failures so
        // the UI does not randomly hide GPU-related controls.
      }
    };

    void loadAioDeviceInfo();
    return () => {
      cancelled = true;
    };
    // `t` deliberately outside the deps — parity with the baseline effect.
  }, [localApiUrl, mode, setAioDeviceInfo]);
}

/* ── Selection fallbacks (keep per-stage selection pointing at a live option) ── */

interface UseAioStageSelectionFallbacksArgs {
  availableDetectStageOptions: AioStageOption[];
  availableOcrStageOptions: AioStageOption[];
  availableTranslationStageOptions: AioStageOption[];
  availableSegmentStageOptions: AioStageOption[];
  availableCleanStageOptions: AioStageOption[];
  selectedCustomOcrProfile: { id: string } | null;
  selectedCustomTranslationProfile: { id: string } | null;
  isInstalledLocalAioEntry: (modelKey: string) => boolean;
}

export function useAioStageSelectionFallbacks({
  availableDetectStageOptions,
  availableOcrStageOptions,
  availableTranslationStageOptions,
  availableSegmentStageOptions,
  availableCleanStageOptions,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  isInstalledLocalAioEntry,
}: UseAioStageSelectionFallbacksArgs) {
  const pendingCustomSelections = useLlmProvidersStore(
    (s) => s.pendingCustomSelections,
  );
  const setAioStageSelection = useAioPipelineStore(
    (s) => s.setAioStageSelection,
  );

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableDetectStageOptions.some(
          (option) => option.key === prev.detectText,
        )
      ) {
        return prev;
      }
      const fallback = availableDetectStageOptions[0]?.key;
      if (!fallback || fallback === prev.detectText) {
        return prev;
      }
      return { ...prev, detectText: fallback };
    });
  }, [availableDetectStageOptions, setAioStageSelection]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (isCustomModelSelectionKey(prev.recognizeText)) {
        if (
          pendingCustomSelections.ocr === prev.recognizeText ||
          selectedCustomOcrProfile
        ) {
          return prev;
        }
      }
      if (
        availableOcrStageOptions.some(
          (option) => option.key === prev.recognizeText,
        )
      ) {
        return prev;
      }
      const fallback = availableOcrStageOptions[0]?.key;
      if (!fallback || fallback === prev.recognizeText) {
        return prev;
      }
      return { ...prev, recognizeText: fallback };
    });
  }, [
    availableOcrStageOptions,
    pendingCustomSelections.ocr,
    selectedCustomOcrProfile,
    setAioStageSelection,
  ]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (isInstalledLocalAioEntry(prev.getTranslations)) {
        return prev;
      }
      if (isCustomModelSelectionKey(prev.getTranslations)) {
        if (
          pendingCustomSelections.translation === prev.getTranslations ||
          selectedCustomTranslationProfile
        ) {
          return prev;
        }
      }
      if (
        availableTranslationStageOptions.some(
          (option) => option.key === prev.getTranslations,
        )
      ) {
        return prev;
      }
      const fallback = availableTranslationStageOptions[0]?.key;
      if (!fallback || fallback === prev.getTranslations) {
        return prev;
      }
      return {
        ...prev,
        getTranslations: fallback,
      };
    });
  }, [
    availableTranslationStageOptions,
    isInstalledLocalAioEntry,
    pendingCustomSelections.translation,
    selectedCustomTranslationProfile,
    setAioStageSelection,
  ]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableSegmentStageOptions.some(
          (option) => option.key === prev.segmentText,
        )
      ) {
        return prev;
      }
      const fallback = availableSegmentStageOptions[0]?.key;
      if (!fallback || fallback === prev.segmentText) {
        return prev;
      }
      return { ...prev, segmentText: fallback };
    });
  }, [availableSegmentStageOptions, setAioStageSelection]);

  useEffect(() => {
    setAioStageSelection((prev) => {
      if (
        availableCleanStageOptions.some(
          (option) => option.key === prev.cleanImage,
        )
      ) {
        return prev;
      }
      const fallback = availableCleanStageOptions[0]?.key;
      if (!fallback || fallback === prev.cleanImage) {
        return prev;
      }
      return { ...prev, cleanImage: fallback };
    });
  }, [availableCleanStageOptions, setAioStageSelection]);
}

/* ── Manual stage execution (progress controls, stage executor, skip, run entry) ── */

interface UseAioManualExecutionArgs {
  /* Cross-domain state not yet in stores (region-editor T07, manual-tools T08) */
  aioDetectionsByImage: Record<string, AioTextRegion[]>;
  aioSelectedRegionByImage: Record<string, string | null>;
  renderDefaultStyle: RenderTextStyle;
  getAioManualImageEditState: (imageId: string) => AioManualImageEditState;
  /* Page callbacks (snapshot/manual-history family still on the page) */
  applyAioPipelineSnapshotToImage: (
    imageId: string,
    index: number,
  ) => AioPipelineSnapshot | null;
  syncManualStagePreviewToNextStage: (
    imageId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;
  patchAioSnapshotStageForImage: (
    imageId: string,
    stageIndex: number,
    nextRegions: AioTextRegion[],
    downloadEntry?: AioDownloadEntry | null,
  ) => void;
  validateManualLocalStageModel: (
    stage: Exclude<AioStageKey, 'getTranslations'>,
    stageLabel: string,
    selectedKey: string,
  ) => boolean;
  getAioStageOption: (
    stageKey: 'recognizeText' | 'getTranslations',
    key: string,
  ) => AioStageOption | null;
  recordProcessedPages: (pages: number) => void;
  syncDiscordForTab: () => Promise<void> | void;
  /* Page bindings that compute the execution i18n labels (kept at the call
     site per the T05b review decision — do not move into the store) */
  beginAioExecution: (
    scope: AioExecutionScope,
    totalImages: number,
    stageKeys: AioPipelineSnapshotKey[],
  ) => void;
  updateAioExecutionStage: (
    scope: AioExecutionScope,
    stageKey: AioPipelineSnapshotKey,
    image: LoadedImage,
    index: number,
    totalImages: number,
  ) => void;
  /* Page-derived values (memos / hook returns) */
  localApiUrl: string;
  modelEntries: Record<string, ModelInstallState>;
  compatibleTranslationModelIds: Set<string>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  activeManualProgress: AioManualImageProgress | null;
  resolvedActiveId: string | null;
}

export function useAioManualExecution({
  aioDetectionsByImage,
  aioSelectedRegionByImage,
  renderDefaultStyle,
  getAioManualImageEditState,
  applyAioPipelineSnapshotToImage,
  syncManualStagePreviewToNextStage,
  patchAioSnapshotStageForImage,
  validateManualLocalStageModel,
  getAioStageOption,
  recordProcessedPages,
  syncDiscordForTab,
  beginAioExecution,
  updateAioExecutionStage,
  localApiUrl,
  modelEntries,
  compatibleTranslationModelIds,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  activeManualProgress,
  resolvedActiveId,
}: UseAioManualExecutionArgs) {
  const activeId = useImageCollectionStore((s) => s.activeId);
  const images = useImageCollectionStore((s) => s.images);
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const processing = useUiShellStore((s) => s.processing);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const setRuntimeExecutionNotice = useStatusStore(
    (s) => s.setRuntimeExecutionNotice,
  );
  const llmSettings = useLlmProvidersStore((s) => s.llmSettings);
  const aioPipelineSnapshots = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots,
  );
  const aioManualProgressByImage = useAioPipelineStore(
    (s) => s.aioManualProgressByImage,
  );
  const aioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.aioImageSnapshotIndexById,
  );
  const setAioManualProgressByImage = useAioPipelineStore(
    (s) => s.setAioManualProgressByImage,
  );
  const aioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.aioAutoProcessedImageById,
  );
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.aioHdCropTriggerSize,
  );
  const aioGpuStages = useAioPipelineStore((s) => s.aioGpuStages);
  const clearAioExecutionState = useAioPipelineStore(
    (s) => s.clearAioExecutionState,
  );
  const getActiveAioAbortSignal = useAioPipelineStore(
    (s) => s.getActiveAioAbortSignal,
  );

  const {
    getAioRegionsFromSnapshot,
    setManualStageForActiveImage,
    completeManualStageForImage,
    syncActiveManualStageSnapshot,
  } = useAioManualProgressControls({
    activeId,
    aioPipelineSnapshots,
    aioManualProgressByImage,
    aioImageSnapshotIndexById,
    aioDetectionsByImage,
    aioSelectedRegionByImage,
    applyAioPipelineSnapshotToImage,
    syncManualStagePreviewToNextStage,
    setAioManualProgressByImage,
    setStatusMessage,
  });

  useEffect(() => {
    if (mode !== 'aio' || subMode !== 'manual') return;
    syncActiveManualStageSnapshot();
  }, [mode, subMode, syncActiveManualStageSnapshot]);

  const executeManualStageForActiveImage = useAioManualStageExecutor({
    activeId,
    processing,
    images,
    aioManualProgressByImage,
    aioAutoProcessedImageById,
    aioDetectionsByImage,
    aioStageOptions: {
      detectText: aioStageOptions.detectText,
      recognizeText: aioStageOptions.recognizeText,
      segmentText: aioStageOptions.segmentText,
      cleanImage: aioStageOptions.cleanImage,
    },
    aioStageSelection: {
      detectText: aioStageSelection.detectText,
      recognizeText: aioStageSelection.recognizeText,
      getTranslations: aioStageSelection.getTranslations,
      segmentText: aioStageSelection.segmentText,
      cleanImage: aioStageSelection.cleanImage,
    },
    aioSrcLang,
    aioTgtLang,
    aioMaskDilation,
    aioHdStrategy,
    aioHdResizeLimit,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    gpuStages: aioGpuStages,
    minRegionSize: MIN_REGION_SIZE,
    llmSettings,
    renderDefaultStyle,
    localApiUrl,
    modelEntries,
    compatibleTranslationModelIds,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    validateManualLocalStageModel: (stageKey, stageLabel, modelKey) =>
      validateManualLocalStageModel(stageKey as Exclude<AioStageKey, 'getTranslations'>, stageLabel, modelKey),
    getAioStageOption,
    parseApiError,
    getAioRegionsFromSnapshot,
    getAioManualImageEditState,
    patchAioSnapshotStageForImage,
    completeManualStageForImage,
    recordProcessedPages,
    syncDiscordForTab,
    setProcessing,
    setProgress,
    setStatusMessage,
    applyDetectedGradientToStyle,
    getAbortSignal: getActiveAioAbortSignal,
    onStageStart: (stageKey, image, index) =>
      updateAioExecutionStage('manual', stageKey, image, index, 1),
    setRuntimeExecutionNotice,
  });

  const skipManualStageForActiveImage = useAioManualStageSkip({
    activeId,
    aioManualProgressByImage,
    completeManualStageForImage,
    setStatusMessage,
  });

  const handleExecuteManualAioStage = useCallback(async () => {
    if (processing) {
      return;
    }
    setRuntimeExecutionNotice(null);

    if (resolvedActiveId && activeManualProgress) {
      const currentStageIndex = clamp(
        activeManualProgress.currentIndex,
        0,
        AIO_MANUAL_STAGE_ORDER.length - 1,
      );
      beginAioExecution('manual', 1, [
        AIO_MANUAL_STAGE_ORDER[currentStageIndex]!,
      ]);
    }

    await executeManualStageForActiveImage();
    setTimeout(() => {
      // Read the processing mirror through the store at the same point the
      // baseline read `processingRef.current` (latest value at timeout-fire
      // time; the mirror ref itself had no other consumer and was removed).
      if (!useUiShellStore.getState().processing) {
        clearAioExecutionState();
      }
    }, 0);
  }, [
    activeManualProgress,
    beginAioExecution,
    clearAioExecutionState,
    executeManualStageForActiveImage,
    processing,
    resolvedActiveId,
    setRuntimeExecutionNotice,
  ]);

  return {
    setManualStageForActiveImage,
    executeManualStageForActiveImage,
    skipManualStageForActiveImage,
    handleExecuteManualAioStage,
  };
}

/* ── Auto pipeline execution (prepare, per-image processor, result consolidation, processAIO) ── */

interface UseAioPipelineExecutionArgs {
  /* Cross-domain state not yet in stores (region-editor T07) */
  renderDefaultStyle: RenderTextStyle;
  /* Page-derived values */
  isDesktopRuntime: boolean;
  localApiUrl: string;
  effectiveBatchConcurrency: number;
  modelEntries: Record<string, ModelInstallState>;
  compatibleTranslationModelIds: Set<string>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  aioPipelineStageProgressLabels: Record<AioPipelineSnapshotKey, string>;
  /* Cross-domain setters (region-editor T07, manual-tools T08, export-download T10) */
  setAioDetectionsByImage: (value: Record<string, AioTextRegion[]>) => void;
  setAioSelectedRegionByImage: (value: Record<string, string | null>) => void;
  setAioDownloadItems: (entries: AioDownloadEntry[]) => void;
  setAioManualImageEditsByImage: (value: Record<string, never>) => void;
  setAioManualHealingBusyByImage: (value: Record<string, never>) => void;
  /* Page callbacks */
  getAioStageOption: (
    stageKey: 'recognizeText' | 'getTranslations',
    key: string,
  ) => AioStageOption | null;
  openModelManagerForStage: (
    stage: AioStageKey,
    options?: Record<string, unknown>,
  ) => void;
  resolveLocalModelFocusForStage: (
    stage: Exclude<AioStageKey, 'getTranslations'>,
    key: string,
  ) => string | null;
  refreshSession: () => Promise<string | null>;
  getAuthToken: () => string | null;
  buildAioImageSnapshotIndexMap: (index: number) => Record<string, number>;
  emitProcessStartWebhook: (
    processMode: string,
    pages: number,
    metrics?: WebhookMetrics,
  ) => void;
  emitProcessCompleteWebhook: (
    processMode: string,
    pages: number,
    metrics?: WebhookMetrics,
  ) => void;
  emitProcessErrorWebhook: (
    processMode: string,
    pages: number,
    error: unknown,
    metrics?: WebhookMetrics,
  ) => void;
  ensureVerifiedEmailOrNotify: () => boolean;
  recordProcessedPages: (pages: number) => void;
  syncDiscordForTab: () => Promise<void> | void;
  tryShowHealingHint: () => void;
  /* Page bindings that compute the execution i18n labels (kept at the call
     site per the T05b review decision — do not move into the store) */
  beginAioExecution: (
    scope: AioExecutionScope,
    totalImages: number,
    stageKeys: AioPipelineSnapshotKey[],
  ) => void;
  updateAioExecutionStage: (
    scope: AioExecutionScope,
    stageKey: AioPipelineSnapshotKey,
    image: LoadedImage,
    index: number,
    totalImages: number,
  ) => void;
}

export function useAioPipelineExecution({
  renderDefaultStyle,
  isDesktopRuntime,
  localApiUrl,
  effectiveBatchConcurrency,
  modelEntries,
  compatibleTranslationModelIds,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  aioPipelineStageProgressLabels,
  setAioDetectionsByImage,
  setAioSelectedRegionByImage,
  setAioDownloadItems,
  setAioManualImageEditsByImage,
  setAioManualHealingBusyByImage,
  getAioStageOption,
  openModelManagerForStage,
  resolveLocalModelFocusForStage,
  refreshSession,
  getAuthToken,
  buildAioImageSnapshotIndexMap,
  emitProcessStartWebhook,
  emitProcessCompleteWebhook,
  emitProcessErrorWebhook,
  ensureVerifiedEmailOrNotify,
  recordProcessedPages,
  syncDiscordForTab,
  tryShowHealingHint,
  beginAioExecution,
  updateAioExecutionStage,
}: UseAioPipelineExecutionArgs) {
  const { t } = useI18n();
  const images = useImageCollectionStore((s) => s.images);
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const setRuntimeExecutionNotice = useStatusStore(
    (s) => s.setRuntimeExecutionNotice,
  );
  const invalidateAioPipelineHistory = useAioPipelineStore(
    (s) => s.invalidateAioPipelineHistory,
  );
  const getActiveAioAbortSignal = useAioPipelineStore(
    (s) => s.getActiveAioAbortSignal,
  );
  const setAioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.setAioAutoProcessedImageById,
  );
  const setAioPipelineSnapshots = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshots,
  );
  const setAioPipelineSnapshotIndex = useAioPipelineStore(
    (s) => s.setAioPipelineSnapshotIndex,
  );
  const setAioImageSnapshotIndexById = useAioPipelineStore(
    (s) => s.setAioImageSnapshotIndexById,
  );
  const setAioAutoHistoryAvailable = useAioPipelineStore(
    (s) => s.setAioAutoHistoryAvailable,
  );

  const prepareAioExecution = useAioExecutionPreparation({
    imagesCount: images.length,
    aioSteps,
    aioSrcLang,
    detectSelectionKey: aioStageSelection.detectText,
    ocrSelectionKey: aioStageSelection.recognizeText,
    translationSelectionKey: aioStageSelection.getTranslations,
    segmentSelectionKey: aioStageSelection.segmentText,
    cleanSelectionKey: aioStageSelection.cleanImage,
    effectiveBatchConcurrency,
    modelEntries,
    compatibleTranslationModelIds,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    getAioStageOption,
    openModelManagerForStage,
    resolveLocalModelFocusForStage,
    refreshSession,
    getAuthToken,
    invalidateAioPipelineHistory,
    setAioManualImageEditsByImage,
    setAioManualHealingBusyByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    emitProcessStartWebhook: (name, pages, context) =>
      emitProcessStartWebhook(name, pages, (context as WebhookMetrics) ?? {}),
  });

  const processSingleAioImageWithHook = useAioSingleImageProcessor({
    localApiUrl,
    minRegionSize: MIN_REGION_SIZE,
    renderDefaultStyle,
    applyDetectedGradientToStyle,
    isDesktopRuntime,
    refreshSession,
    parseApiError,
    getAbortSignal: getActiveAioAbortSignal,
    onStageStart: (stageKey, image, index) =>
      updateAioExecutionStage('auto', stageKey, image, index, images.length),
    setRuntimeExecutionNotice,
  });

  const consolidateAioResults = useAioResultConsolidation({
    aioSteps,
    buildAioImageSnapshotIndexMap,
    setAioAutoProcessedImageById,
    setAioDetectionsByImage,
    setAioSelectedRegionByImage,
    setAioPipelineSnapshots,
    setAioPipelineSnapshotIndex,
    setAioImageSnapshotIndexById,
    setAioAutoHistoryAvailable,
    setAioDownloadItems,
  });

  // processAIO keeps the baseline ref pattern (the entry below always calls
  // the latest closure, so callbacks/read points see current values). The old
  // `aioStateRef` mirror (~30 fields re-assigned every render) is gone: every
  // store-backed member is read via `getState()` at the exact same read point
  // (strictly fresher for reads that happen after awaits), while page-owned
  // members (callbacks, memos, `t`) are closure args of this hook — same
  // frozen-at-invocation semantics the mirror object had.
  const processAIORef = useRef<(() => Promise<void>) | null>(null);

  processAIORef.current = async () => {
    if (!ensureVerifiedEmailOrNotify()) return;
    useStatusStore.getState().setRuntimeExecutionNotice(null);
    const enabledStageKeys = AIO_MANUAL_STAGE_ORDER.filter((stageKey) =>
      stageKey === 'detectText'
        ? true
        : stageKey === 'recognizeText'
          ? useAioPipelineStore.getState().aioSteps.recognizeText
          : stageKey === 'getTranslations'
            ? useAioPipelineStore.getState().aioSteps.getTranslations
            : stageKey === 'segmentText'
              ? useAioPipelineStore.getState().aioSteps.segmentText
              : stageKey === 'cleanImage'
                ? useAioPipelineStore.getState().aioSteps.cleanImage
                : useAioPipelineStore.getState().aioSteps.render,
    );
    beginAioExecution(
      'auto',
      useImageCollectionStore.getState().images.length,
      enabledStageKeys,
    );
    const preparedAioExecution = await prepareAioExecution();
    if (!preparedAioExecution) {
      useAioPipelineStore.getState().clearAioExecutionState();
      return;
    }

    const {
      selectedDetectorKey,
      selectedOcrKey,
      selectedTranslationKey,
      selectedSegmentKey,
      selectedCleanKey,
      useCloudOcr,
      useLlmSettingsForOcr,
      useLlmSettingsForTranslation,
    } = preparedAioExecution;

    const logAioBatchDebug = (...args: unknown[]) => {
      if (
        !import.meta.env.DEV ||
        typeof console === 'undefined' ||
        typeof console.info !== 'function'
      ) {
        return;
      }
      console.info('[AIO batch]', ...args);
    };
    const executionStrategy = 'per-image-concurrent';

    try {
      const processSingleAioImage = (imgData: LoadedImage, index: number) =>
        processSingleAioImageWithHook(
          imgData,
          index,
          {
            sourceLanguage: useAioPipelineStore.getState().aioSrcLang,
            targetLanguage: useAioPipelineStore.getState().aioTgtLang,
            detectSelectionKey: selectedDetectorKey,
            ocrSelectionKey: selectedOcrKey,
            translationSelectionKey: selectedTranslationKey,
            segmentSelectionKey: selectedSegmentKey,
            cleanSelectionKey: selectedCleanKey,
            aioSteps: {
              recognizeText: useAioPipelineStore.getState().aioSteps.recognizeText,
              getTranslations: useAioPipelineStore.getState().aioSteps.getTranslations,
              segmentText: useAioPipelineStore.getState().aioSteps.segmentText,
              cleanImage: useAioPipelineStore.getState().aioSteps.cleanImage,
              render: useAioPipelineStore.getState().aioSteps.render,
            },
            useCloudOcr: useCloudOcr ?? false,
            useLlmSettingsForOcr: useLlmSettingsForOcr ?? false,
            useLlmSettingsForTranslation: useLlmSettingsForTranslation ?? false,
            llmSettings: useLlmProvidersStore.getState().llmSettings,
            selectedCustomOcrProfile,
            selectedCustomTranslationProfile,
            maskDilation: useAioPipelineStore.getState().aioMaskDilation,
            hdStrategy: useAioPipelineStore.getState().aioHdStrategy,
            hdResizeLimit: useAioPipelineStore.getState().aioHdResizeLimit,
            hdCropMargin: useAioPipelineStore.getState().aioHdCropMargin,
            hdCropTriggerSize: useAioPipelineStore.getState().aioHdCropTriggerSize,
            gpuStages: useAioPipelineStore.getState().aioGpuStages,
          },
        );

      logAioBatchDebug('strategy', {
        type: executionStrategy,
        concurrency: effectiveBatchConcurrency,
        stages: {
          detect: Boolean(useAioPipelineStore.getState().aioSteps.detectText),
          ocr: Boolean(useAioPipelineStore.getState().aioSteps.recognizeText),
          translation: Boolean(useAioPipelineStore.getState().aioSteps.getTranslations),
          segment: Boolean(useAioPipelineStore.getState().aioSteps.segmentText),
          clean: Boolean(useAioPipelineStore.getState().aioSteps.cleanImage),
        },
      });

      const imageResults = await runConcurrentBatch({
        items: useImageCollectionStore.getState().images,
        concurrency: effectiveBatchConcurrency,
        signal: useAioPipelineStore.getState().getActiveAioAbortSignal(),
        worker: async ({ item: imgData, index }) =>
          processSingleAioImage(imgData, index),
        onProgress: ({ completed }) => {
          if (completed >= useImageCollectionStore.getState().images.length) {
            useUiShellStore.getState().setProgress(100);
          }
        },
      });

      const {
        processedPagesCount,
        totalDetections,
        totalRecognized,
        totalTranslated,
        totalSegmented,
        totalCleaned,
        totalRendered,
        finalMessage,
      } = consolidateAioResults(imageResults);

      if (processedPagesCount > 0) {
        recordProcessedPages(processedPagesCount);
      }
      logAioBatchDebug('final-summary', {
        strategy: executionStrategy,
        total_detected: totalDetections,
        total_recognized: totalRecognized,
        total_translated: totalTranslated,
        total_segmented: totalSegmented,
        total_cleaned_images: totalCleaned,
        processed_pages: processedPagesCount,
      });
      emitProcessCompleteWebhook(
        'AIO',
        useImageCollectionStore.getState().images.length,
        {
          regioes_detectadas: totalDetections,
          textos_reconhecidos: totalRecognized,
          traducoes_geradas: totalTranslated,
          regioes_segmentadas: totalSegmented,
          imagens_limpas: totalCleaned,
          blocos_render_prontos: totalRendered,
          paginas_processadas: processedPagesCount,
          estrategia: executionStrategy,
        },
      );
      useStatusStore.getState().setTonedStatus(
        t('dashboard.status.aioCompleteAdjust', { message: finalMessage }),
        'success',
      );
      tryShowHealingHint();
      if (finalMessage.includes('caiu para CPU por falta de VRAM')) {
        window.setTimeout(() => {
          useStatusStore.getState().setRuntimeExecutionNotice(null);
        }, 4500);
      } else {
        useStatusStore.getState().setRuntimeExecutionNotice(null);
      }
    } catch (error) {
      if (isAbortError(error)) {
        useStatusStore.getState().setTonedStatus(
          t('dashboard.status.aioAborted'),
          'warning',
        );
      } else if (isTimeoutError(error)) {
        const executionStatus = useAioPipelineStore.getState().aioExecutionStatus;
        const stageLabel = executionStatus?.stageKey
          ? aioPipelineStageProgressLabels[
              executionStatus.stageKey as AioPipelineSnapshotKey
            ]
          : 'OCR';
        useStatusStore.getState().setTonedStatus(
          `Timed out during the "${stageLabel}" stage. The mini-backend may have crashed, restarted, or taken too long to respond.`,
          'error',
        );
      } else {
        emitProcessErrorWebhook(
          'AIO',
          useImageCollectionStore.getState().images.length,
          error,
          {
            estrategia: executionStrategy,
          },
        );
        useStatusStore.getState().setTonedStatus(
          error instanceof Error ? error.message : t('dashboard.status.aioExecutionFailed'),
          'error',
        );
      }
    } finally {
      useUiShellStore.getState().setProcessing(false);
      useUiShellStore.getState().setProgress(0);
      useAioPipelineStore.getState().clearAioExecutionState();
      void syncDiscordForTab();
    }
  };

  const processAIO = () => processAIORef.current?.();

  return { processAIO };
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


/* ── Effective batch concurrency: normalizes the batch-threads settings against
   the image count (aio-pipeline store + image-collection length) ── */

export function useEffectiveBatchConcurrency() {
  const images = useImageCollectionStore((s) => s.images);
  const batchThreadsEnabled = useAioPipelineStore((s) => s.batchThreadsEnabled);
  const batchThreads = useAioPipelineStore((s) => s.batchThreads);
  const effectiveBatchConcurrency = useMemo(
    () =>
      normalizeBatchConcurrency(
        batchThreadsEnabled,
        batchThreads,
        images.length,
      ),
    [batchThreads, batchThreadsEnabled, images.length],
  );
  return { effectiveBatchConcurrency };
}
