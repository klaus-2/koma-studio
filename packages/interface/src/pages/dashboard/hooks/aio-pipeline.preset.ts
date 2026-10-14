import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { AIO_STAGE_LABELS } from '@/constants/dashboard.constants';
import { useI18n } from '@/i18n';
import type { AioStageOption } from '@/models/aioStageCatalog';
import {
  arePresetSelectionsEqual,
  buildPresetStageAvailability,
  findUnavailablePresetStage,
  getPresetApplicationSignature,
} from '@/pages/dashboard/lib/aio-preset-selection';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import {
  createAioPresetInputSchema,
  type AioLanguageModelPreset,
  type AioStageSelection,
} from '@/types/aioModelPresets';
import type { AioPresetEditorDraft } from '@/types/dashboard.types';
import {
  applyPresetToStageSelection,
  createPreset as createAioPreset,
  deletePreset as deleteAioPreset,
  getActivePresetForLanguage,
  setActivePresetForLanguage,
  updatePreset as updateAioPreset,
} from '@/utils/aioModelPresets';
import {
  createEmptyAioPresetEditorDraft,
  normalizePresetLanguage,
} from '@/utils/dashboard.utils';

interface UseAioPresetEditorArgs {
  readonly availableDetectStageOptions: AioStageOption[];
  readonly availableOcrStageOptions: AioStageOption[];
  readonly availableTranslationStageOptions: AioStageOption[];
  readonly availableSegmentStageOptions: AioStageOption[];
  readonly availableCleanStageOptions: AioStageOption[];
  readonly setStatusMessage: (message: string) => void;
}

interface PresetEditorSession {
  readonly open: boolean;
  readonly sourceLanguage: string;
}

export function useAioPresetEditor(args: UseAioPresetEditorArgs) {
  const { t } = useI18n();
  const sourceLanguage = useAioPipelineStore((state) => state.aioSrcLang);
  const languageOptions = useAioPipelineStore(
    (state) => state.aioLanguageOptions.source,
  );
  const presetState = useAioPipelineStore((state) => state.aioPresetState);
  const optionsLoading = useAioPipelineStore(
    (state) => state.aioOptionsLoading,
  );
  const executing = useAioPipelineStore(
    (state) => state.aioAbortController !== null,
  );
  const processing = useUiShellStore((state) => state.processing);

  const normalizedAioSourceLanguage = normalizePresetLanguage(sourceLanguage);
  const appliedSignatureRef = useRef<string | null>(null);

  const [session, setSession] = useState<PresetEditorSession>(() => ({
    open: false,
    sourceLanguage: normalizedAioSourceLanguage,
  }));

  const [aioPresetEditorDraft, setAioPresetEditorDraft] =
    useState<AioPresetEditorDraft>(() =>
      createEmptyAioPresetEditorDraft({
        ...useAioPipelineStore.getState().aioStageSelection,
      }),
    );

  const sourceLanguageLabelByCode = useMemo(
    () =>
      new Map(
        languageOptions.map((option) => [
          normalizePresetLanguage(option.value),
          option.label,
        ]),
      ),
    [languageOptions],
  );

  const presetEditorStageOptions = useMemo(
    () => ({
      detectText: args.availableDetectStageOptions,
      recognizeText: args.availableOcrStageOptions,
      getTranslations: args.availableTranslationStageOptions,
      segmentText: args.availableSegmentStageOptions,
      cleanImage: args.availableCleanStageOptions,
    }),
    [
      args.availableCleanStageOptions,
      args.availableDetectStageOptions,
      args.availableOcrStageOptions,
      args.availableSegmentStageOptions,
      args.availableTranslationStageOptions,
    ],
  );

  const availability = useMemo(
    () => buildPresetStageAvailability(presetEditorStageOptions),
    [presetEditorStageOptions],
  );

  const activePresetForCurrentLanguage = getActivePresetForLanguage(
    normalizedAioSourceLanguage,
    presetState,
  );

  const presetsForCurrentLanguage = useMemo(() => {
    const activeId =
      presetState.activePresetBySourceLanguage[normalizedAioSourceLanguage];

    return presetState.presets
      .filter(
        (preset) =>
          normalizePresetLanguage(preset.sourceLanguage) ===
          normalizedAioSourceLanguage,
      )
      .sort(
        (left, right) =>
          Number(right.id === activeId) - Number(left.id === activeId) ||
          left.name.localeCompare(right.name),
      );
  }, [normalizedAioSourceLanguage, presetState]);

  const applicationSignature = getPresetApplicationSignature(
    normalizedAioSourceLanguage,
    activePresetForCurrentLanguage,
    availability,
  );

  useEffect(() => {
    if (processing || executing || optionsLoading) {
      return;
    }

    if (!activePresetForCurrentLanguage) {
      appliedSignatureRef.current = null;
      return;
    }

    if (appliedSignatureRef.current === applicationSignature) {
      return;
    }

    const state = useAioPipelineStore.getState();
    const result = applyPresetToStageSelection(
      activePresetForCurrentLanguage,
      state.aioStageSelection,
      availability,
    );

    appliedSignatureRef.current = applicationSignature;

    const changed = !arePresetSelectionsEqual(
      state.aioStageSelection,
      result.selection,
    );

    if (changed) {
      state.setAioStageSelection(result.selection);
    }

    if (result.unappliedStages.length > 0) {
      args.setStatusMessage(
        t('dashboard.status.preset.appliedPartial', {
          name: activePresetForCurrentLanguage.name,
          stages: result.unappliedStages
            .map((stage) => AIO_STAGE_LABELS[stage])
            .join(', '),
        }),
      );
    } else if (changed) {
      args.setStatusMessage(
        t('dashboard.status.preset.applied', {
          name: activePresetForCurrentLanguage.name,
          lang: normalizedAioSourceLanguage.toUpperCase(),
        }),
      );
    }
  }, [
    activePresetForCurrentLanguage,
    applicationSignature,
    args.setStatusMessage,
    availability,
    executing,
    normalizedAioSourceLanguage,
    optionsLoading,
    processing,
    t,
  ]);

  const setAioPresetEditorOpen: Dispatch<SetStateAction<boolean>> = (
    update,
  ) => {
    const language = normalizePresetLanguage(
      useAioPipelineStore.getState().aioSrcLang,
    );

    setSession((previous) => {
      const open =
        typeof update === 'function' ? update(previous.open) : update;

      return {
        open,
        sourceLanguage:
          open && !previous.open ? language : previous.sourceLanguage,
      };
    });
  };

  function canChangePresetSelection(): boolean {
    const state = useAioPipelineStore.getState();

    if (
      state.aioAbortController ||
      state.aioBackendRestarting ||
      useUiShellStore.getState().processing
    ) {
      args.setStatusMessage('Wait for the current execution to finish.');
      return false;
    }

    return true;
  }

  function validateStageModels(selection: AioStageSelection): boolean {
    const unavailable = findUnavailablePresetStage(selection, availability);

    if (!unavailable) {
      return true;
    }

    args.setStatusMessage(
      `Select an available model for the "${AIO_STAGE_LABELS[unavailable]}" stage.`,
    );

    return false;
  }

  function openCreatePresetEditor(): void {
    setAioPresetEditorDraft(
      createEmptyAioPresetEditorDraft({
        ...useAioPipelineStore.getState().aioStageSelection,
      }),
    );

    setAioPresetEditorOpen(true);
  }

  function openEditPresetEditor(): void {
    const state = useAioPipelineStore.getState();
    const language = normalizePresetLanguage(state.aioSrcLang);
    const preset = getActivePresetForLanguage(language, state.aioPresetState);

    if (!preset) {
      args.setStatusMessage('Select an active preset to edit.');
      return;
    }

    setAioPresetEditorDraft({
      presetId: preset.id,
      name: preset.name,
      description: preset.description,
      stageModels: { ...preset.stageModels },
      setAsActive: true,
    });

    setAioPresetEditorOpen(true);
  }

  function closePresetEditor(): void {
    setAioPresetEditorOpen(false);
  }

  function handlePresetSelectionChange(presetId: string): void {
    if (!canChangePresetSelection()) {
      return;
    }

    const state = useAioPipelineStore.getState();
    const language = normalizePresetLanguage(state.aioSrcLang);
    const id = presetId.trim();

    if (
      id &&
      !state.aioPresetState.presets.some(
        (preset) => preset.id === id && preset.sourceLanguage === language,
      )
    ) {
      args.setStatusMessage('The selected preset was not found.');
      return;
    }

    appliedSignatureRef.current = null;

    state.setAioPresetState(
      setActivePresetForLanguage(language, id || null, state.aioPresetState),
    );

    if (!id) {
      args.setStatusMessage(
        t('dashboard.status.preset.cleared', {
          lang: language.toUpperCase(),
        }),
      );
    }
  }

  function handleDeleteActivePreset(): void {
    if (!canChangePresetSelection()) {
      return;
    }

    const state = useAioPipelineStore.getState();
    const language = normalizePresetLanguage(state.aioSrcLang);
    const preset = getActivePresetForLanguage(language, state.aioPresetState);

    if (!preset) {
      args.setStatusMessage('No active preset to delete.');
      return;
    }

    if (!window.confirm(`Delete preset "${preset.name}"?`)) {
      return;
    }

    const latest = useAioPipelineStore.getState();

    latest.setAioPresetState(
      deleteAioPreset(preset.id, latest.aioPresetState),
    );

    closePresetEditor();
    args.setStatusMessage(
      t('dashboard.status.preset.deleted', { name: preset.name }),
    );
  }

  function handleSaveCurrentSelectionAsPreset(): void {
    if (!canChangePresetSelection()) {
      return;
    }

    const state = useAioPipelineStore.getState();
    const language = normalizePresetLanguage(state.aioSrcLang);
    const stageModels = { ...state.aioStageSelection };

    if (!validateStageModels(stageModels)) {
      return;
    }

    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const created = createAioPreset(
      createAioPresetInputSchema.parse({
        name: t('aioPreset.autoName', {
          lang:
            sourceLanguageLabelByCode.get(language) ?? language.toUpperCase(),
          time,
        }),
        description: t('aioPreset.autoDescription'),
        sourceLanguage: language,
        stageModels,
      }),
      state.aioPresetState,
    );

    state.setAioPresetState(
      setActivePresetForLanguage(language, created.preset.id, created.state),
    );

    args.setStatusMessage(
      t('dashboard.status.preset.created', { name: created.preset.name }),
    );
  }

  function handleSavePresetEditor(): void {
    if (!canChangePresetSelection()) {
      return;
    }

    const state = useAioPipelineStore.getState();
    const currentLanguage = normalizePresetLanguage(state.aioSrcLang);

    if (currentLanguage !== session.sourceLanguage) {
      args.setStatusMessage(
        'The source language changed. Reopen the preset editor before saving.',
      );
      return;
    }

    const input = createAioPresetInputSchema.safeParse({
      name: aioPresetEditorDraft.name,
      description: aioPresetEditorDraft.description,
      sourceLanguage: session.sourceLanguage,
      stageModels: aioPresetEditorDraft.stageModels,
    });

    if (!input.success) {
      args.setStatusMessage(
        'Enter a name and select a model for every stage.',
      );
      return;
    }

    if (!validateStageModels(input.data.stageModels)) {
      return;
    }

    const result = aioPresetEditorDraft.presetId
      ? updateAioPreset(
        aioPresetEditorDraft.presetId,
        input.data,
        state.aioPresetState,
      )
      : createAioPreset(input.data, state.aioPresetState);

    const savedPreset: AioLanguageModelPreset | null = result.preset;

    if (!savedPreset) {
      args.setStatusMessage('The preset no longer exists.');
      return;
    }

    const nextState = aioPresetEditorDraft.setAsActive
      ? setActivePresetForLanguage(
        session.sourceLanguage,
        savedPreset.id,
        result.state,
      )
      : result.state;

    state.setAioPresetState(nextState);
    closePresetEditor();

    args.setStatusMessage(
      t('dashboard.status.preset.saved', { name: savedPreset.name }),
    );
  }

  return {
    normalizedAioSourceLanguage,
    sourceLanguageLabelByCode,
    presetsForCurrentLanguage,
    activePresetForCurrentLanguage,
    presetEditorStageOptions,
    aioPresetEditorOpen: session.open,
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
