/**
 * AIO preset editor — create/edit/delete per-source-language model presets and
 * apply them to the AIO stage selection (with auto-apply of the active preset).
 * Split out of aio-pipeline.ts (T10); the entry file keeps orchestration and
 * re-exports this module.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../../i18n';
import {
  AIO_PRESET_STAGE_KEYS,
  AIO_STAGE_LABELS,
} from '../../../constants/dashboard.constants';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import {
  applyPresetToStageSelection,
  createPreset as createAioPreset,
  deletePreset as deleteAioPreset,
  getActivePresetForLanguage,
  setActivePresetForLanguage,
  updatePreset as updateAioPreset,
} from '../../../utils/aioModelPresets';
import {
  createEmptyAioPresetEditorDraft,
  normalizePresetLanguage,
} from '../../../utils/dashboard.utils';
import type {
  AioLanguageModelPreset,
  AioStageSelection,
} from '../../../types/aioModelPresets';
import type { AioPresetEditorDraft } from '../../../types/dashboard.types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';

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
