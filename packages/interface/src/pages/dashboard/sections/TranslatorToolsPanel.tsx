import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../../../i18n';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import { SOURCE_LANGUAGE_OPTIONS, TARGET_LANGUAGE_OPTIONS } from '../../../models/aioStageCatalog';
import type { useDashboardModelManager } from '../../../hooks/useDashboardModelManager';
import { useModelManagerStatusSnapshot } from '../../../hooks/useModelManager';
import { summarizeInstalledModels } from '../../../models/model-storage';
import type { CustomLlmProfile } from '../../../utils/customLlm';
import { clampLlmRequestSettings } from '../../../utils/customLlm';
import type { useAioModelSelection } from '../hooks/aio-pipeline';
import type {
  useTranslatorRetranslate,
  useTranslatorTextActions,
  useTranslatorVisualActions,
} from '../hooks/translator';
import {
  applySheetCorrectionsToImageRegions,
  applySheetRows,
  buildRegionLookup,
  buildSheetRows,
  groupSheetCorrectionsByImage,
} from '../../../utils/spreadsheet-bridge';
import type {
  SheetAppliedRow,
  SheetConflict,
  SheetReimportReport,
  SheetRow,
} from '../../../utils/spreadsheet-bridge';
import type { SheetExportFormat } from '../hooks/exportSheetWorker';
import {
  buildSheetExportFile,
  parseSheetCorrections,
  triggerBlobDownload,
} from '../hooks/export-download';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useActiveTranslatorRegionState } from '../hooks/translator';
import { useUiShellStore } from '../stores/ui-shell-store';
import TranslatorToolsPanel from '../../../components/dashboard/TranslatorToolsPanel';

type AioModelSelectionApi = ReturnType<typeof useAioModelSelection>;
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
  const modelManagerState = useModelManagerStatusSnapshot();
  const modelSummary = useMemo(
    () => summarizeInstalledModels(modelManagerState.entries),
    [modelManagerState.entries],
  );
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
  // The twins consume exactly these six fields — subscribe with useShallow so
  // unrelated llm-settings writes (extra-context keystrokes) don't re-render.
  const llmSettings = useLlmProvidersStore(
    useShallow((s) => ({
      extra_context: s.llmSettings.extra_context,
      translation_notes_enabled: s.llmSettings.translation_notes_enabled,
      image_input_enabled: s.llmSettings.image_input_enabled,
      temperature: s.llmSettings.temperature,
      top_p: s.llmSettings.top_p,
      max_tokens: s.llmSettings.max_tokens,
    })),
  );
  const setLlmSettings = useLlmProvidersStore((s) => s.setLlmSettings);
  const processing = useUiShellStore((s) => s.processing);
  const images = useImageCollectionStore((s) => s.images);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  // Setter subscriptions only (stable identities): the sheet handlers read
  // fresh region state via getState, so the panel never re-renders on
  // unrelated region-map writes.
  const setTranslatorDetectionsByImage = useTranslatorStore(
    (s) => s.setTranslatorDetectionsByImage,
  );

  /* ── Bilingual spreadsheet (Feature 3): export / import corrections ── */

  const [sheetReport, setSheetReport] = useState<SheetReimportReport | null>(
    null,
  );
  const sheetImportRef = useRef<HTMLInputElement | null>(null);
  // Rows of the last import, kept so a per-row conflict opt-in can re-run the
  // ladder against fresh store state (already-applied rows then compare
  // unchanged and stay out of the write).
  const sheetRowsRef = useRef<readonly SheetRow[] | null>(null);

  // Writes corrections through the EXISTING authoritative translator region
  // map (the same store the visual preview edits live in) — no parallel
  // store. Grouping is by MATCHED image id: a row whose declared imageId is
  // stale (cross-session reimport) but whose OCR text matched a live region
  // on another page must still land. Untouched regions keep their object
  // identity; applied regions get the manual-edit provenance stamp, matching
  // the hand-edit path.
  const writeSheetCorrections = useCallback(
    (appliedRows: readonly SheetAppliedRow[]): void => {
      if (appliedRows.length === 0) return;
      const detectionsByImage =
        useTranslatorStore.getState().translatorDetectionsByImage;
      for (const [imageId, rows] of groupSheetCorrectionsByImage(appliedRows)) {
        const regions = detectionsByImage[imageId] ?? [];
        const nextRegions = applySheetCorrectionsToImageRegions(regions, rows);
        setTranslatorDetectionsByImage((prev) => ({
          ...prev,
          [imageId]: nextRegions,
        }));
      }
    },
    [setTranslatorDetectionsByImage],
  );

  const handleSheetExport = useCallback(
    async (format: SheetExportFormat) => {
      const rows = buildSheetRows(
        useImageCollectionStore.getState().images,
        useTranslatorStore.getState().translatorDetectionsByImage,
      );
      if (rows.length === 0) {
        setStatusMessage(t('dashboard.translator.sheet.noRows'));
        return;
      }
      try {
        const { blob, fileName } = await buildSheetExportFile(rows, format);
        triggerBlobDownload(blob, fileName);
        setStatusMessage(
          t('dashboard.translator.sheet.exportSuccess', { name: fileName }),
        );
      } catch (error) {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : t('dashboard.translator.sheet.exportFailed'),
        );
      }
    },
    [setStatusMessage, t],
  );

  const handleSheetImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const rows = await parseSheetCorrections(file);
        const result = applySheetRows(
          rows,
          buildRegionLookup(
            useImageCollectionStore.getState().images,
            useTranslatorStore.getState().translatorDetectionsByImage,
          ),
        );
        writeSheetCorrections(result.appliedRows);
        sheetRowsRef.current = rows;
        setSheetReport({
          appliedRows: result.appliedRows,
          skippedRows: result.skippedRows,
          conflicts: result.conflicts,
        });
        setStatusMessage(
          t('dashboard.translator.sheet.importSuccess', {
            applied: result.applied,
            skipped: result.skipped,
            conflicts: result.conflicts.length,
          }),
        );
      } catch (error) {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : t('dashboard.translator.sheet.importFailed'),
        );
      }
    },
    [setStatusMessage, t, writeSheetCorrections],
  );

  const handleApplySheetConflict = useCallback(
    (rowId: string) => {
      const rows = sheetRowsRef.current;
      if (rows === null) return;
      const priorReport = sheetReport;
      const overrides = new Set<string>();
      for (const entry of priorReport?.conflicts ?? []) {
        if (entry.resolved) overrides.add(entry.rowId);
      }
      overrides.add(rowId);
      const result = applySheetRows(
        rows,
        buildRegionLookup(
          useImageCollectionStore.getState().images,
          useTranslatorStore.getState().translatorDetectionsByImage,
        ),
        { applyConflictRowIds: overrides },
      );
      writeSheetCorrections(result.appliedRows);
      // The re-run is the source of truth for conflicts and skips (fresh
      // state: already-applied rows compare unchanged there). Applied history
      // from prior runs is carried over — those rows WERE written by this
      // feature — and then excluded from the re-run's skip list so no row is
      // counted in both groups.
      const reappliedIds = new Set(
        result.appliedRows.map((row) => row.rowId),
      );
      const carriedApplied = (priorReport?.appliedRows ?? []).filter(
        (row) => !reappliedIds.has(row.rowId),
      );
      const appliedIds = new Set(
        [...carriedApplied, ...result.appliedRows].map((row) => row.rowId),
      );
      const conflictByRowId = new Map<string, SheetConflict>();
      for (const entry of priorReport?.conflicts ?? []) {
        conflictByRowId.set(entry.rowId, entry);
      }
      for (const entry of result.conflicts) {
        if (!conflictByRowId.has(entry.rowId)) {
          conflictByRowId.set(entry.rowId, entry);
        }
      }
      setSheetReport({
        appliedRows: [...carriedApplied, ...result.appliedRows],
        skippedRows: result.skippedRows.filter(
          (row) => !appliedIds.has(row.rowId),
        ),
        conflicts: [...conflictByRowId.values()].map((entry) =>
          overrides.has(entry.rowId) ? { ...entry, resolved: true } : entry,
        ),
      });
    },
    [sheetReport, writeSheetCorrections],
  );

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
      modelEntries={modelManagerState.entries}
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
      onSheetExport={handleSheetExport}
      sheetImportRef={sheetImportRef}
      handleSheetImportFile={handleSheetImportFile}
      sheetReport={sheetReport}
      onApplySheetConflict={handleApplySheetConflict}
    />
  );
}
