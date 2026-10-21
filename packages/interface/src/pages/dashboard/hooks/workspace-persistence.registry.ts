/**
 * Workspace persistence registry — the single source of truth for the
 * workspace capture state.
 *
 * Owns, per capture slice: the field descriptor table (capture key, owning
 * store, asset codec kind, restore-apply mode), ONE capture builder shared by
 * the live-store path and the restored-document path (the two hand-written
 * mirrors this module replaces), ONE ordered restore apply (replacing the
 * hand-written setter sequence and its baseline deps array) and the unified
 * domain-store subscription list (previously duplicated between the capture
 * mirror and the change-signal effect).
 *
 * Binding contracts preserved verbatim from the pre-registry implementation:
 * - Capture-state key insertion order per slice (the signature builders
 *   stringify the capture state — order is part of the signature contract;
 *   pinned by workspace-persistence.registry.test.ts).
 * - The 10 asset-bearing fields keep their codec semantics in
 *   dashboardWorkspace.serialization.ts (collector addFile/addBlob/addDataUrl
 *   on capture; toFileFromAsset/toBlobFromAsset/toDataUrlFromAsset on
 *   restore). This registry only documents which fields are asset-bearing;
 *   codecs stay in serialization until the codec slice moves them.
 * - The LLM block applies as a MERGE (profiles merged byId with
 *   updatedAt-newer-wins NaN-tolerant then pt-BR label sort; profiles mode
 *   refuses desktop_secure/desktop_local downgrade; drafts per-stage
 *   defaults). The three existing `as` casts in that block are preserved
 *   verbatim (grandfathered — their underlying document types live in frozen
 *   packages/types/src/workspace.ts). The same applies to every other cast
 *   below: each one is relocated from the pre-registry implementation, forced
 *   by the frozen document types (e.g. view.mode: string) — none are new.
 * - Restore call order: releaseWorkspaceObjectUrls FIRST; the
 *   setActiveId-before-setImages quirk preserved as-is; healing/running
 *   resets in place; restore-token increment LAST among field writes;
 *   setProcessing(false)/setProgress(0) terminal.
 * - The manualQuotaChargedByImage v1 synthesis (v2 does not charge manual
 *   quota; the unified-contract field is built as {}).
 */
import type { DashboardWorkspaceCaptureState, DashboardWorkspaceRestoreState } from '../../../workspace/dashboardWorkspace';
import type {
  AioManualImageEditState,
  AioManualImageProgress,
  AioPipelineSnapshot,
  AioTextRegion,
  CleanerRunMeta,
  EnhanceProfile,
  EnhanceScale,
  FreeProviderDraftMap,
  ProcessableMode,
  SubMode,
  ToolMode,
  TranslatorVisualProcessingMode,
  TranslatorVisualRunMeta,
  TranslatorWorkspaceMode,
  ViewMode,
} from '../../../types/dashboard.types';
import type {
  AioModelPresetStateV2,
  AioStageSelection,
} from '../../../types/aioModelPresets';
import type { TypographySession } from '../../../typography/types';
import {
  createEmptyCustomLlmDraft,
  type CustomLlmProfile,
  type CustomLlmProfileDraft,
  type CustomLlmStage,
  type LlmProfilesPersistenceMode,
  type LlmRequestSettings,
} from '../../../utils/customLlm';
import type { SplitterWorkspaceState } from '../../../components/dashboard/splitter/types';
import type { WatermarkWorkspaceState } from '../../../components/dashboard/watermark/watermarkTypes';
import type { ChapterOptimizerWorkspaceState } from '../../../components/dashboard/optimizer/ChapterOptimizerWorkspace';
import type {
  StitchAlignMode,
  StitchBatchStrategy,
  StitchLayoutMode,
} from '../../../components/dashboard/stitch/types';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useExportStore } from '../stores/export-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useTypographerStore } from '../stores/typographer-store';
import { useEnhanceStore } from '../stores/enhance-store';
import { useUtilityStore } from '../stores/utility-store';
import { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';
import { resolveUtilityWorkspaceSnapshots } from './utility-workspaces';

/* ── Store state type aliases (type-level queries, no casts) ── */

type AioPipelineStoreState = ReturnType<typeof useAioPipelineStore.getState>;
type TypographerStoreState = ReturnType<typeof useTypographerStore.getState>;

/* ── Registry metadata ── */

/** How serialization treats the field's binary content (documentary metadata; codecs live in dashboardWorkspace.serialization.ts). */
export type WorkspaceAssetCodecKind =
  | 'plain'
  | 'file'
  | 'blob'
  | 'dataUrl'
  | 'edits';

/** How the restore apply writes the field back onto the stores. */
export type WorkspaceFieldApplyMode = 'set' | 'merge' | 'derived';

export interface WorkspaceFieldDescriptor {
  /** Capture-state key (also the restore source key unless noted). */
  readonly key: string;
  /** Owning store (or non-store source) of the field. */
  readonly store: string;
  /** Asset codec kind used by the serialization collector. */
  readonly asset: WorkspaceAssetCodecKind;
  /** Restore-apply mode. */
  readonly apply: WorkspaceFieldApplyMode;
  /** Preserved quirk/contract note, if any. */
  readonly note?: string;
}

export interface WorkspaceSliceDescriptor {
  /** Capture-state group key ('' for the root scalar run). */
  readonly key: string;
  readonly fields: ReadonlyArray<WorkspaceFieldDescriptor>;
}

/**
 * Root capture-state key order. The signature builders stringify the capture
 * state — this order is part of the signature contract and is pinned by the
 * registry test.
 */
export const WORKSPACE_CAPTURE_ROOT_KEYS: ReadonlyArray<string> = [
  'autosaveScope',
  'autosaveUserId',
  'mode',
  'subMode',
  'activeImageId',
  'viewMode',
  'translatorWorkspaceMode',
  'translatorVisualProcessingMode',
  'statusMessage',
  'lastActionScope',
  'images',
  'downloadItems',
  'batchThreadsEnabled',
  'batchThreads',
  'aio',
  'cleaner',
  'translator',
  'typesetter',
  'enhance',
  'utility',
  'llm',
];

/** Per-slice field descriptor tables, in capture-state key order. */
export const WORKSPACE_CAPTURE_SLICES: ReadonlyArray<WorkspaceSliceDescriptor> = [
  {
    key: '',
    fields: [
      { key: 'autosaveScope', store: 'derived(authUser.id)', asset: 'plain', apply: 'derived' },
      { key: 'autosaveUserId', store: 'react-state(authUser)', asset: 'plain', apply: 'derived' },
      { key: 'mode', store: 'ui-shell-store', asset: 'plain', apply: 'set' },
      { key: 'subMode', store: 'ui-shell-store', asset: 'plain', apply: 'set' },
      { key: 'activeImageId', store: 'image-collection-store', asset: 'plain', apply: 'set', note: 'legacy quirk: applied before setImages and before setViewMode — preserved as-is' },
      { key: 'viewMode', store: 'ui-shell-store', asset: 'plain', apply: 'set' },
      { key: 'translatorWorkspaceMode', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'translatorVisualProcessingMode', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'statusMessage', store: 'status-store', asset: 'plain', apply: 'set', note: 'restore falls back to the localized workspaceRestored message when the document value is empty' },
      { key: 'lastActionScope', store: 'export-store', asset: 'plain', apply: 'set' },
      { key: 'images', store: 'image-collection-store', asset: 'file', apply: 'set' },
      { key: 'downloadItems', store: 'export-store', asset: 'blob', apply: 'set' },
      { key: 'batchThreadsEnabled', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'batchThreads', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
    ],
  },
  {
    key: 'aio',
    fields: [
      { key: 'steps', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'stageSelection', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'presetState', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'maskDilation', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'hdStrategy', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'hdResizeLimit', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'hdCropMargin', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'hdCropTriggerSize', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'detectionsByImage', store: 'region-editor-store', asset: 'plain', apply: 'set' },
      { key: 'selectedRegionByImage', store: 'region-editor-store', asset: 'plain', apply: 'set' },
      { key: 'pipelineSnapshots', store: 'aio-pipeline-store', asset: 'blob', apply: 'set', note: 'aioDownloads blobs are collected per snapshot' },
      { key: 'pipelineSnapshotIndex', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'imageSnapshotIndexById', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'autoHistoryAvailable', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'autoProcessedImageById', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'manualQuotaChargedByImage', store: 'synthesized', asset: 'plain', apply: 'derived', note: 'v2 does not charge manual quota; unified-contract v1 field built as {}' },
      { key: 'manualProgressByImage', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'manualImageEditsByImage', store: 'manual-tools-store', asset: 'edits', apply: 'set' },
    ],
  },
  {
    key: 'cleaner',
    fields: [
      { key: 'detectionsByImage', store: 'cleaner-store', asset: 'plain', apply: 'set' },
      { key: 'selectedRegionByImage', store: 'cleaner-store', asset: 'plain', apply: 'set' },
      { key: 'processedBaseByImage', store: 'cleaner-store', asset: 'dataUrl', apply: 'set' },
      { key: 'runMetaByImage', store: 'cleaner-store', asset: 'plain', apply: 'set' },
      { key: 'manualImageEditsByImage', store: 'cleaner-store', asset: 'edits', apply: 'set' },
    ],
  },
  {
    key: 'translator',
    fields: [
      { key: 'srcLang', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'tgtLang', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'aioSrcLang', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'aioTgtLang', store: 'aio-pipeline-store', asset: 'plain', apply: 'set' },
      { key: 'translatorDraftText', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'translatorTranslatedText', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'translatorLastTextModelUsed', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'translatorTextDirty', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'translatorDetectionsByImage', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'translatorSelectedRegionByImage', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'translatorRunMetaByImage', store: 'translator-store', asset: 'plain', apply: 'set' },
      { key: 'translatorProcessedBaseByImage', store: 'translator-store', asset: 'dataUrl', apply: 'set', note: 'restored-side keeps the legacy document fallback chain (document copy, then legacy asset map) — document-only asset keys are NOT leaked into the capture state' },
    ],
  },
  {
    key: 'typesetter',
    fields: [
      { key: 'selectionTool', store: 'typographer-store', asset: 'plain', apply: 'set' },
      { key: 'queueSelectedId', store: 'typographer-store', asset: 'plain', apply: 'set' },
      { key: 'snapshotName', store: 'typographer-store', asset: 'plain', apply: 'set' },
      { key: 'selectedSnapshotId', store: 'typographer-store', asset: 'plain', apply: 'set' },
      { key: 'sessionsByImage', store: 'typographer-workspace-handle', asset: 'plain', apply: 'set', note: 'written via typographerWorkspace.replaceSessionsByImage, grouped after the typographer setters' },
    ],
  },
  {
    key: 'enhance',
    fields: [
      { key: 'scale', store: 'enhance-store', asset: 'plain', apply: 'set' },
      { key: 'profile', store: 'enhance-store', asset: 'plain', apply: 'set' },
      { key: 'modelId', store: 'enhance-store', asset: 'plain', apply: 'set' },
      { key: 'outputFormat', store: 'enhance-store', asset: 'plain', apply: 'set' },
    ],
  },
  {
    key: 'utility',
    fields: [
      { key: 'stitch.stitchLayoutMode', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchBatchStrategy', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchBatchSize', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchTargetPrimaryAxis', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchGap', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchAlignMode', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchBackground', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchSingleExportFormat', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchFileBaseName', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchSelectedBatchIndex', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'stitch.stitchBatchIndexes', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'splitter', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'watermark.draft', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'watermark.activeImageId', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'watermark.compareMode', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'watermark.compareValue', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'watermark.selectedPresetId', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'watermark.autoSuggestion', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'watermark.userPresets', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'watermark.watermarkImageFile', store: 'utility-store', asset: 'file', apply: 'set' },
      { key: 'watermark.results', store: 'utility-store', asset: 'blob', apply: 'set' },
      { key: 'watermark.textZoneCache', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'optimizer.recipe', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'optimizer.selectedPreset', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'optimizer.activeImageId', store: 'utility-store', asset: 'plain', apply: 'set' },
      { key: 'optimizer.results', store: 'utility-store', asset: 'blob', apply: 'set' },
    ],
  },
  {
    key: 'llm',
    fields: [
      { key: 'llmSettings', store: 'llm-providers-store', asset: 'plain', apply: 'set' },
      { key: 'customLlmProfiles', store: 'llm-providers-store', asset: 'plain', apply: 'merge', note: 'prev+restored merged byId, updatedAt-newer-wins (NaN-tolerant), pt-BR label sort' },
      { key: 'customLlmProfilesMode', store: 'llm-providers-store', asset: 'plain', apply: 'merge', note: 'refuses desktop_secure/desktop_local downgrade' },
      { key: 'pendingCustomSelections', store: 'llm-providers-store', asset: 'plain', apply: 'set' },
      { key: 'customLlmDrafts', store: 'llm-providers-store', asset: 'plain', apply: 'merge', note: 'per-stage createEmptyCustomLlmDraft defaults' },
      { key: 'freeProviderDrafts', store: 'react-state(setFreeProviderDrafts)', asset: 'plain', apply: 'set' },
    ],
  },
];

/* ── Unified domain-store subscription list ── */

/**
 * The 14 domain stores whose changes drive BOTH the capture mirror and the
 * history/autosave change signal (previously two hand-written identical
 * lists). Order is byte-equivalent to the pre-registry lists.
 */
export const WORKSPACE_PERSISTENCE_STORES: ReadonlyArray<{
  subscribe: (listener: () => void) => () => void;
}> = [
  useUiShellStore,
  useImageCollectionStore,
  useStatusStore,
  useExportStore,
  useAioPipelineStore,
  useRegionEditorStore,
  useManualToolsStore,
  useCleanerStore,
  useTranslatorStore,
  useTypographerStore,
  useEnhanceStore,
  useUtilityStore,
  useLlmProvidersStore,
  // Hydration completion must fire the signal too: setWorkspaceHydrated(true)
  // triggering this subscription restores the pre-surgery re-seed trigger.
  useWorkspacePersistenceStore,
];

/* ── Capture sources (one builder, two source kinds) ── */

export interface WorkspaceLiveCaptureValues {
  /** authUser?.id — drives autosaveScope/autosaveUserId. */
  readonly authUserId: string | null;
  /** Free-provider drafts are React state (LLM free profiles domain). */
  readonly freeProviderDrafts: FreeProviderDraftMap;
}

export type WorkspaceCaptureSource =
  | { readonly kind: 'live'; readonly values: WorkspaceLiveCaptureValues }
  | { readonly kind: 'restored'; readonly restored: DashboardWorkspaceRestoreState };

/**
 * Builds the whole capture state from ONE source descriptor. The restored
 * path selects the SAME field set as the live path (the legacy spread of
 * document blocks leaked document-only asset keys — e.g.
 * translatorProcessedBaseAssetByImage — into the restored capture state,
 * which is the within-session signature-duality this builder fixes).
 */
export const buildWorkspaceCaptureState = (
  source: WorkspaceCaptureSource,
): DashboardWorkspaceCaptureState => {
  if (source.kind === 'restored') {
    const restored = source.restored;
    const legacyTranslatorDocument = restored.document.translator as unknown as {
      translatorProcessedBaseByImage?: Record<string, string>;
      translatorProcessedBaseAssetByImage?: Record<string, string>;
    };
    return {
      autosaveScope: restored.document.autosaveScope,
      autosaveUserId: restored.document.autosaveUserId,
      mode: restored.document.view.mode,
      subMode: restored.document.view.subMode,
      activeImageId: restored.document.view.activeImageId,
      viewMode: restored.document.view.viewMode,
      translatorWorkspaceMode: restored.document.view.translatorWorkspaceMode,
      translatorVisualProcessingMode:
        (restored.document.view.translatorVisualProcessingMode ??
          'sequential') as DashboardWorkspaceCaptureState['translatorVisualProcessingMode'],
      statusMessage: restored.document.footer.statusMessage,
      lastActionScope: restored.document.footer.lastActionScope,
      images: restored.images,
      downloadItems: restored.downloadItems,
      batchThreadsEnabled: restored.document.batchThreadsEnabled,
      batchThreads: restored.document.batchThreads,
      aio: {
        ...restored.aio,
        pipelineSnapshots: toRuntimeOrderedRestoredSnapshots(restored),
      },
      cleaner: {
        detectionsByImage: restored.cleaner.detectionsByImage,
        selectedRegionByImage: restored.cleaner.selectedRegionByImage,
        processedBaseByImage: restored.cleaner.processedBaseByImage,
        runMetaByImage: restored.document.cleaner.runMetaByImage as Record<string, CleanerRunMeta>,
        manualImageEditsByImage: restored.cleaner.manualImageEditsByImage,
      },
      translator: {
        srcLang: restored.document.translator.srcLang,
        tgtLang: restored.document.translator.tgtLang,
        aioSrcLang: restored.document.translator.aioSrcLang,
        aioTgtLang: restored.document.translator.aioTgtLang,
        translatorDraftText: restored.document.translator.translatorDraftText,
        translatorTranslatedText: restored.document.translator.translatorTranslatedText,
        translatorLastTextModelUsed: restored.document.translator.translatorLastTextModelUsed,
        translatorTextDirty: restored.document.translator.translatorTextDirty,
        translatorDetectionsByImage: restored.document.translator.translatorDetectionsByImage,
        translatorSelectedRegionByImage: restored.document.translator.translatorSelectedRegionByImage,
        translatorRunMetaByImage: restored.document.translator.translatorRunMetaByImage,
        translatorProcessedBaseByImage:
          legacyTranslatorDocument.translatorProcessedBaseByImage ??
          legacyTranslatorDocument.translatorProcessedBaseAssetByImage ??
          {},
      },
      typesetter: restored.typesetter,
      enhance: restored.document.enhance,
      utility: {
        stitch: restored.document.utility.stitch,
        splitter: restored.utility.splitter,
        watermark: restored.utility.watermark,
        optimizer: restored.utility.optimizer,
      },
      llm: restored.document.llm,
    };
  }

  const uiShellStore = useUiShellStore.getState();
  const imageCollectionStore = useImageCollectionStore.getState();
  const statusStore = useStatusStore.getState();
  const exportStore = useExportStore.getState();
  const aioStore = useAioPipelineStore.getState();
  const regionEditorStore = useRegionEditorStore.getState();
  const manualToolsStore = useManualToolsStore.getState();
  const cleanerStore = useCleanerStore.getState();
  const translatorStore = useTranslatorStore.getState();
  const typographerStore = useTypographerStore.getState();
  const enhanceStore = useEnhanceStore.getState();
  const utilityStore = useUtilityStore.getState();
  const llmStore = useLlmProvidersStore.getState();
  const utilitySnapshots = resolveUtilityWorkspaceSnapshots(
    imageCollectionStore.activeId,
  );

  return {
    autosaveScope: source.values.authUserId ? 'user' : 'guest',
    autosaveUserId: source.values.authUserId ?? null,
    mode: uiShellStore.mode,
    subMode: uiShellStore.subMode,
    activeImageId: imageCollectionStore.activeId,
    viewMode: uiShellStore.viewMode,
    translatorWorkspaceMode: translatorStore.translatorWorkspaceMode,
    translatorVisualProcessingMode: translatorStore.translatorVisualProcessingMode,
    statusMessage: statusStore.statusMessage,
    lastActionScope: exportStore.lastActionScope,
    images: imageCollectionStore.images,
    downloadItems: exportStore.downloadItems,
    batchThreadsEnabled: aioStore.batchThreadsEnabled,
    batchThreads: aioStore.batchThreads,
    aio: {
      steps: aioStore.aioSteps,
      stageSelection: aioStore.aioStageSelection,
      presetState: aioStore.aioPresetState,
      maskDilation: aioStore.aioMaskDilation,
      hdStrategy: aioStore.aioHdStrategy,
      hdResizeLimit: aioStore.aioHdResizeLimit,
      hdCropMargin: aioStore.aioHdCropMargin,
      hdCropTriggerSize: aioStore.aioHdCropTriggerSize,
      detectionsByImage: regionEditorStore.aioDetectionsByImage,
      selectedRegionByImage: regionEditorStore.aioSelectedRegionByImage,
      pipelineSnapshots:
        aioStore.aioPipelineSnapshots as unknown as DashboardWorkspaceCaptureState['aio']['pipelineSnapshots'],
      pipelineSnapshotIndex: aioStore.aioPipelineSnapshotIndex,
      imageSnapshotIndexById: aioStore.aioImageSnapshotIndexById,
      autoHistoryAvailable: aioStore.aioAutoHistoryAvailable,
      autoProcessedImageById: aioStore.aioAutoProcessedImageById,
      // v2 does not charge manual quota (unified-contract field used by v1)
      manualQuotaChargedByImage: {},
      manualProgressByImage: aioStore.aioManualProgressByImage,
      manualImageEditsByImage:
        manualToolsStore.aioManualImageEditsByImage as unknown as DashboardWorkspaceCaptureState['aio']['manualImageEditsByImage'],
    },
    cleaner: {
      detectionsByImage: cleanerStore.cleanerDetectionsByImage,
      selectedRegionByImage: cleanerStore.cleanerSelectedRegionByImage,
      processedBaseByImage: cleanerStore.cleanerProcessedBaseByImage,
      runMetaByImage: cleanerStore.cleanerRunMetaByImage,
      manualImageEditsByImage: cleanerStore.cleanerManualImageEditsByImage,
    },
    translator: {
      srcLang: translatorStore.srcLang,
      tgtLang: translatorStore.tgtLang,
      aioSrcLang: aioStore.aioSrcLang,
      aioTgtLang: aioStore.aioTgtLang,
      translatorDraftText: translatorStore.translatorDraftText,
      translatorTranslatedText: translatorStore.translatorTranslatedText,
      translatorLastTextModelUsed: translatorStore.translatorLastTextModelUsed,
      translatorTextDirty: translatorStore.translatorTextDirty,
      translatorDetectionsByImage: translatorStore.translatorDetectionsByImage,
      translatorSelectedRegionByImage: translatorStore.translatorSelectedRegionByImage,
      translatorRunMetaByImage: translatorStore.translatorRunMetaByImage,
      translatorProcessedBaseByImage: translatorStore.translatorProcessedBaseByImage,
    },
    typesetter: {
      selectionTool: typographerStore.typographerSelectionTool,
      queueSelectedId: typographerStore.typographerQueueSelectedId,
      snapshotName: typographerStore.typographerSnapshotName,
      selectedSnapshotId: typographerStore.typographerSelectedSnapshotId,
      sessionsByImage: typographerStore.typographerSessionsByImage,
    },
    enhance: {
      scale: enhanceStore.enhanceScale,
      profile: enhanceStore.enhanceProfile,
      modelId: enhanceStore.enhanceModelId,
      outputFormat: enhanceStore.enhanceOutputFormat,
    },
    utility: {
      stitch: {
        stitchLayoutMode: utilityStore.stitchLayoutMode,
        stitchBatchStrategy: utilityStore.stitchBatchStrategy,
        stitchBatchSize: utilityStore.stitchBatchSize,
        stitchTargetPrimaryAxis: utilityStore.stitchTargetPrimaryAxis,
        stitchGap: utilityStore.stitchGap,
        stitchAlignMode: utilityStore.stitchAlignMode,
        stitchBackground: utilityStore.stitchBackground,
        stitchSingleExportFormat: utilityStore.stitchSingleExportFormat,
        stitchFileBaseName: utilityStore.stitchFileBaseName,
        stitchSelectedBatchIndex: utilityStore.stitchSelectedBatchIndex,
        stitchBatchIndexes: utilityStore.stitchBatchIndexes,
      },
      splitter: utilitySnapshots.currentSplitterWorkspaceState,
      watermark: utilitySnapshots.currentWatermarkWorkspaceState,
      optimizer: utilitySnapshots.currentOptimizerWorkspaceState,
    },
    llm: {
      llmSettings: llmStore.llmSettings,
      customLlmProfiles: llmStore.customLlmProfiles,
      customLlmProfilesMode: llmStore.customLlmProfilesMode,
      pendingCustomSelections: llmStore.pendingCustomSelections,
      customLlmDrafts: llmStore.customLlmDrafts,
      freeProviderDrafts: source.values.freeProviderDrafts,
    },
  };
};

/**
 * Restored-side pipeline snapshots: rebuilds the entries into the RUNTIME
 * shape/order the live capture produces (AioDownloadEntry: fileName, blob,
 * sourceImageId — restoreWorkspaceDocument emits document order: fileName,
 * sourceImageId, blob). Whole-object key order is signature-visible, the
 * rebuilt capture state must match what the same workspace would capture
 * live, and the stores must hold what their own runtime type declares — this
 * is part of the within-session signature-duality fix. The terminal cast
 * mirrors serialization.ts's existing restored-aio cast (the restore-state
 * type declares asset refs where the runtime value is a resolved Blob) — no
 * new type lie.
 */
const toRuntimeOrderedRestoredSnapshots = (
  restored: DashboardWorkspaceRestoreState,
): DashboardWorkspaceCaptureState['aio']['pipelineSnapshots'] =>
  restored.aio.pipelineSnapshots.map((snapshot) => ({
    key: snapshot.key,
    label: snapshot.label,
    detectionsByImage: snapshot.detectionsByImage,
    selectedRegionByImage: snapshot.selectedRegionByImage,
    aioDownloads: snapshot.aioDownloads.map((download) => ({
      fileName: download.fileName,
      blob: download.blob,
      sourceImageId: download.sourceImageId,
    })),
  })) as DashboardWorkspaceCaptureState['aio']['pipelineSnapshots'];

/* ── Restore apply ── */

export interface WorkspaceRestoreContext {
  /** MUST run first — releases the object URLs the restore is about to replace. */
  readonly releaseWorkspaceObjectUrls: () => void;
  /** Typographer workspace handle (sessions write path). */
  readonly typographerWorkspace: {
    readonly replaceSessionsByImage: (
      sessions: Record<string, TypographySession>,
    ) => void;
  };
  /** Free-provider drafts are React state — written through the hook arg. */
  readonly setFreeProviderDrafts: (value: FreeProviderDraftMap) => void;
  /** Localized fallback when the document statusMessage is empty. */
  readonly statusMessageFallback: string;
  /** Footer workspace status detail (defaults to the legacy PT literal). */
  readonly statusDetail?: string;
}

/**
 * LLM profiles MERGE: prev + restored merged byId, dedupe with
 * updatedAt-newer-wins (NaN-tolerant), then pt-BR label sort. Cast
 * grandfathered (frozen document types).
 */
const mergeRestoredCustomLlmProfiles = (
  restored: DashboardWorkspaceRestoreState,
): ((prev: CustomLlmProfile[]) => CustomLlmProfile[]) =>
(prev) => {
  const restoredProfiles =
    (restored.document.llm.customLlmProfiles as CustomLlmProfile[]) ?? [];
  const byId = new Map<string, CustomLlmProfile>();
  for (const profile of [...prev, ...restoredProfiles]) {
    if (!profile?.id) {
      continue;
    }
    const current = byId.get(profile.id);
    if (!current) {
      byId.set(profile.id, profile);
      continue;
    }
    const currentTime = Date.parse(current.updatedAt || current.createdAt || '');
    const nextTime = Date.parse(profile.updatedAt || profile.createdAt || '');
    if (Number.isNaN(currentTime) || (!Number.isNaN(nextTime) && nextTime >= currentTime)) {
      byId.set(profile.id, profile);
    }
  }
  return Array.from(byId.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'pt-BR'),
  );
};

/**
 * LLM profiles mode MERGE: refuses desktop_secure/desktop_local downgrade.
 * Cast grandfathered (frozen document types).
 */
const resolveRestoredCustomLlmProfilesMode = (
  restored: DashboardWorkspaceRestoreState,
): ((prev: LlmProfilesPersistenceMode) => LlmProfilesPersistenceMode) =>
(prev) => {
  if (prev === 'desktop_secure' || prev === 'desktop_local') {
    return prev;
  }
  return restored.document.llm.customLlmProfilesMode as LlmProfilesPersistenceMode;
};

/**
 * LLM drafts MERGE: per-stage defaults via createEmptyCustomLlmDraft.
 * Cast grandfathered (frozen document types).
 */
const buildRestoredCustomLlmDrafts = (
  restored: DashboardWorkspaceRestoreState,
): Record<CustomLlmStage, CustomLlmProfileDraft> => {
  const restoredDrafts = restored.document.llm.customLlmDrafts as Record<CustomLlmStage, CustomLlmProfileDraft> | undefined;
  return {
    translation: restoredDrafts?.translation ?? createEmptyCustomLlmDraft(),
    ocr: restoredDrafts?.ocr ?? createEmptyCustomLlmDraft(),
    clean: restoredDrafts?.clean ?? createEmptyCustomLlmDraft(),
  };
};

export interface WorkspaceRestoreStep {
  readonly id: string;
  readonly run: (
    restored: DashboardWorkspaceRestoreState,
    ctx: WorkspaceRestoreContext,
  ) => void;
}

/**
 * Ordered restore plan — call order preserved verbatim from the pre-registry
 * implementation (release FIRST, setActiveId quirk as-is, healing/running
 * resets in place, token increment LAST among field writes, processing/
 * progress terminal). All `as` casts below are relocated from that
 * implementation (forced by the frozen document types) — none are new.
 */
export const WORKSPACE_RESTORE_STEPS: ReadonlyArray<WorkspaceRestoreStep> = [
  {
    id: 'release-object-urls',
    run: (_restored, ctx) => {
      ctx.releaseWorkspaceObjectUrls();
    },
  },
  {
    id: 'view-and-active-image',
    run: (restored) => {
      useUiShellStore.getState().setMode(restored.document.view.mode as ToolMode);
      useUiShellStore.getState().setSubMode(restored.document.view.subMode as SubMode);
      // Legacy quirk preserved as-is: setActiveId runs before setViewMode and
      // before setImages.
      useImageCollectionStore.getState().setActiveId(restored.document.view.activeImageId);
      useUiShellStore.getState().setViewMode(restored.document.view.viewMode as ViewMode);
      useTranslatorStore.getState().setTranslatorWorkspaceMode(
        restored.document.view.translatorWorkspaceMode as TranslatorWorkspaceMode,
      );
      useTranslatorStore.getState().setTranslatorVisualProcessingMode(
        (restored.document.view.translatorVisualProcessingMode as TranslatorVisualProcessingMode | undefined) ?? 'standard',
      );
    },
  },
  {
    id: 'footer',
    run: (restored, ctx) => {
      useStatusStore.getState().setStatusMessage(
        restored.document.footer.statusMessage || ctx.statusMessageFallback,
      );
      useExportStore.getState().setLastActionScope(
        restored.document.footer.lastActionScope as ProcessableMode | null,
      );
    },
  },
  {
    id: 'collection-and-downloads',
    run: (restored) => {
      useImageCollectionStore.getState().setImages(restored.images);
      useExportStore.getState().setDownloadItems(restored.downloadItems);
    },
  },
  {
    id: 'batch-threads',
    run: (restored) => {
      useAioPipelineStore.getState().setBatchThreadsEnabled(restored.document.batchThreadsEnabled);
      useAioPipelineStore.getState().setBatchThreads(restored.document.batchThreads);
    },
  },
  {
    id: 'aio-fields',
    run: (restored) => {
      const aio = useAioPipelineStore.getState();
      const regionEditor = useRegionEditorStore.getState();
      const manualTools = useManualToolsStore.getState();
      aio.setAioSteps(restored.document.aio.steps as AioPipelineStoreState['aioSteps']);
      aio.setAioStageSelection(
        restored.document.aio.stageSelection as AioStageSelection,
      );
      aio.setAioPresetState(
        restored.document.aio.presetState as AioModelPresetStateV2,
      );
      aio.setAioMaskDilation(restored.document.aio.maskDilation);
      aio.setAioHdStrategy(
        restored.document.aio.hdStrategy as AioPipelineStoreState['aioHdStrategy'],
      );
      aio.setAioHdResizeLimit(restored.document.aio.hdResizeLimit);
      aio.setAioHdCropMargin(restored.document.aio.hdCropMargin);
      aio.setAioHdCropTriggerSize(restored.document.aio.hdCropTriggerSize);
      regionEditor.setAioDetectionsByImage(
        restored.document.aio.detectionsByImage as Record<string, AioTextRegion[]>,
      );
      regionEditor.setAioSelectedRegionByImage(
        restored.document.aio.selectedRegionByImage,
      );
      aio.setAioPipelineSnapshots(
        toRuntimeOrderedRestoredSnapshots(restored) as unknown as AioPipelineSnapshot[],
      );
      aio.setAioPipelineSnapshotIndex(restored.document.aio.pipelineSnapshotIndex);
      aio.setAioImageSnapshotIndexById(
        restored.document.aio.imageSnapshotIndexById,
      );
      aio.setAioAutoHistoryAvailable(restored.document.aio.autoHistoryAvailable);
      aio.setAioAutoProcessedImageById(
        restored.document.aio.autoProcessedImageById,
      );
      aio.setAioManualProgressByImage(
        restored.document.aio.manualProgressByImage as Record<
          string,
          AioManualImageProgress
        >,
      );
      manualTools.setAioManualImageEditsByImage(
        restored.aio.manualImageEditsByImage as Record<
          string,
          AioManualImageEditState
        >,
      );
      manualTools.setAioManualHealingBusyByImage({});
    },
  },
  {
    id: 'cleaner-fields',
    run: (restored) => {
      const cleaner = useCleanerStore.getState();
      cleaner.setCleanerDetectionsByImage(
        restored.cleaner.detectionsByImage as Record<string, AioTextRegion[]>,
      );
      cleaner.setCleanerSelectedRegionByImage(
        restored.cleaner.selectedRegionByImage,
      );
      cleaner.setCleanerProcessedBaseByImage(restored.cleaner.processedBaseByImage);
      cleaner.setCleanerRunMetaByImage(
        restored.document.cleaner.runMetaByImage as Record<
          string,
          CleanerRunMeta
        >,
      );
      cleaner.setCleanerManualImageEditsByImage(
        restored.cleaner.manualImageEditsByImage,
      );
      cleaner.setCleanerHealingBusyByImage({});
    },
  },
  {
    id: 'translator-fields',
    run: (restored) => {
      const translator = useTranslatorStore.getState();
      translator.setSrcLang(restored.document.translator.srcLang);
      translator.setTgtLang(restored.document.translator.tgtLang);
      const aio = useAioPipelineStore.getState();
      aio.setAioSrcLang(restored.document.translator.aioSrcLang);
      aio.setAioTgtLang(restored.document.translator.aioTgtLang);
      translator.setTranslatorDraftText(restored.document.translator.translatorDraftText);
      translator.setTranslatorTranslatedText(
        restored.document.translator.translatorTranslatedText,
      );
      translator.setTranslatorLastTextModelUsed(
        restored.document.translator.translatorLastTextModelUsed,
      );
      translator.setTranslatorTextDirty(restored.document.translator.translatorTextDirty);
      translator.setTranslatorDetectionsByImage(
        restored.document.translator
          .translatorDetectionsByImage as Record<string, AioTextRegion[]>,
      );
      translator.setTranslatorSelectedRegionByImage(
        restored.document.translator.translatorSelectedRegionByImage,
      );
      translator.setTranslatorRunMetaByImage(
        restored.document.translator
          .translatorRunMetaByImage as Record<string, TranslatorVisualRunMeta>,
      );
      translator.setTranslatorProcessedBaseByImage(
        restored.translator.translatorProcessedBaseByImage,
      );
      translator.setTranslatorVisualRunning(false);
      translator.setTranslatorTextRunning(false);
    },
  },
  {
    id: 'typographer-fields',
    run: (restored, ctx) => {
      const typographer = useTypographerStore.getState();
      typographer.setTypographerSelectionTool(
        restored.typesetter.selectionTool as TypographerStoreState['typographerSelectionTool'],
      );
      typographer.setTypographerQueueSelectedId(restored.typesetter.queueSelectedId);
      typographer.setTypographerSnapshotName(restored.typesetter.snapshotName);
      typographer.setTypographerSelectedSnapshotId(restored.typesetter.selectedSnapshotId);
      ctx.typographerWorkspace.replaceSessionsByImage(
        restored.typesetter.sessionsByImage,
      );
    },
  },
  {
    id: 'enhance-fields',
    run: (restored) => {
      const enhance = useEnhanceStore.getState();
      enhance.setEnhanceScale(restored.document.enhance.scale as EnhanceScale);
      enhance.setEnhanceProfile(
        restored.document.enhance.profile as EnhanceProfile,
      );
      enhance.setEnhanceModelId(restored.document.enhance.modelId);
      enhance.setEnhanceOutputFormat(
        restored.document.enhance.outputFormat as 'png' | 'webp',
      );
    },
  },
  {
    id: 'utility-fields',
    run: (restored) => {
      const utility = useUtilityStore.getState();
      utility.setStitchLayoutMode(
        restored.document.utility.stitch
          .stitchLayoutMode as StitchLayoutMode,
      );
      utility.setStitchBatchStrategy(
        restored.document.utility.stitch
          .stitchBatchStrategy as StitchBatchStrategy,
      );
      utility.setStitchBatchSize(restored.document.utility.stitch.stitchBatchSize);
      utility.setStitchTargetPrimaryAxis(
        restored.document.utility.stitch.stitchTargetPrimaryAxis,
      );
      utility.setStitchGap(restored.document.utility.stitch.stitchGap);
      utility.setStitchAlignMode(
        restored.document.utility.stitch.stitchAlignMode as StitchAlignMode,
      );
      utility.setStitchBackground(restored.document.utility.stitch.stitchBackground);
      utility.setStitchSingleExportFormat(
        restored.document.utility.stitch
          .stitchSingleExportFormat as 'png' | 'jpeg' | 'webp',
      );
      utility.setStitchFileBaseName(restored.document.utility.stitch.stitchFileBaseName);
      utility.setStitchSelectedBatchIndex(
        restored.document.utility.stitch.stitchSelectedBatchIndex,
      );
      utility.setStitchBatchIndexes(
        restored.document.utility.stitch.stitchBatchIndexes,
      );
      utility.setSplitterWorkspaceState(
        restored.utility.splitter as SplitterWorkspaceState | null,
      );
      utility.setWatermarkWorkspaceState(
        restored.utility.watermark as WatermarkWorkspaceState | null,
      );
      utility.setOptimizerWorkspaceState(
        restored.utility.optimizer as ChapterOptimizerWorkspaceState | null,
      );
    },
  },
  {
    id: 'llm-fields',
    run: (restored, ctx) => {
      const llm = useLlmProvidersStore.getState();
      llm.setLlmSettings(
        restored.document.llm.llmSettings as LlmRequestSettings,
      );
      llm.setCustomLlmProfiles(mergeRestoredCustomLlmProfiles(restored));
      llm.setCustomLlmProfilesMode(resolveRestoredCustomLlmProfilesMode(restored));
      llm.setPendingCustomSelections(
        restored.document.llm.pendingCustomSelections as Record<
          CustomLlmStage,
          string | null
        >,
      );
      llm.setCustomLlmDrafts(buildRestoredCustomLlmDrafts(restored));
      ctx.setFreeProviderDrafts(
        restored.document.llm.freeProviderDrafts as FreeProviderDraftMap,
      );
    },
  },
  {
    id: 'terminal-status',
    run: (_restored, ctx) => {
      // Restore-token increment stays LAST among the field writes.
      useWorkspacePersistenceStore.getState().setWorkspaceRestoreToken((prev) => prev + 1);
      useWorkspacePersistenceStore.getState().setWorkspaceStatus('idle');
      useWorkspacePersistenceStore.getState().setWorkspaceStatusDetail(
        ctx.statusDetail ?? 'Workspace local restaurado.',
      );
      useUiShellStore.getState().setProcessing(false);
      useUiShellStore.getState().setProgress(0);
    },
  },
];

/**
 * Applies a restored workspace document to every store through the ordered
 * registry plan. Uses getState() accessor writes (zustand setters are stable
 * identities — the previous hook-captured setters were identical values), so
 * the baseline ~90-entry deps array collapses to the hook-level collaborators.
 */
export const applyRestoredWorkspaceToStores = (
  restored: DashboardWorkspaceRestoreState,
  ctx: WorkspaceRestoreContext,
): void => {
  for (const step of WORKSPACE_RESTORE_STEPS) {
    step.run(restored, ctx);
  }
};
