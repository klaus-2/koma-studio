import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type WheelEvent,
} from 'react';
import { Upload } from 'lucide-react';

import { applyStageReadinessRefusal, type LocalModelEntry } from '../../../../aio-stages/readiness';
import {
  getAioPipelineStageLabels,
  getAioStageLabels,
} from '../../../../constants/dashboard.constants';
import { useI18n } from '../../../../i18n';
import type { TranslationKey } from '../../../../i18n/messages';
import type { AioStageOption } from '../../../../models/aioStageCatalog.types';
import { isEditableShortcutTarget } from '../../../../shortcuts/keyboardShortcuts';
import type { AioStageKey } from '../../../../types/aioModelPresets';
import type {
  AioTextRegion,
  LoadedImage,
  ProcessableMode,
} from '../../../../types/dashboard.types';
import type { CustomLlmProfile } from '../../../../utils/customLlm';
import { getImageExtensionFromMime } from '../../../../utils/dashboard.utils';
import type { useDashboardUploads } from '../../hooks/image-collection';
import { useFocusMode } from '../../hooks/use-focus-mode';
import {
  buildFocusFlowState,
  findDisabledFocusStages,
  findNextUnreviewedPageId,
  FULL_FOCUS_STAGE_TOGGLES,
} from '../../lib/focus-flow';
import { deriveFocusReadiness } from '../../lib/focus-readiness';
import { useAioPipelineStore } from '../../stores/aio-pipeline-store';
import { useExportStore } from '../../stores/export-store';
import { useFocusModeStore } from '../../stores/focus-mode-store';
import { useImageCollectionStore } from '../../stores/image-collection-store';
import { useRegionEditorStore } from '../../stores/region-editor-store';
import { useStatusStore } from '../../stores/status-store';
import { useUiShellStore } from '../../stores/ui-shell-store';
import { useWorkspacePersistenceStore } from '../../stores/workspace-persistence-store';
import FocusActionBar from './FocusActionBar';
import FocusCorrectionPanel from './FocusCorrectionPanel';
import FocusPageRail, { type FocusRailItem } from './FocusPageRail';
import FocusStage from './FocusStage';
import FocusTopBar from './FocusTopBar';
import './focus-mode.css';

type UploadsApi = ReturnType<typeof useDashboardUploads>;

const EMPTY_REGIONS: AioTextRegion[] = [];

export interface FocusLayoutProps {
  /* ── Pipeline (page-owned execution callbacks) ── */
  processAIO: () => Promise<void>;
  stopAioExecution: () => void;

  /* ── Uploads (shared dropzone + window drop/paste funnel) ── */
  getRootProps: UploadsApi['getRootProps'];
  getInputProps: UploadsApi['getInputProps'];
  onDropFiles: UploadsApi['onDrop'];
  removeImage: (imageId: string) => void;

  /* ── Stage / regions ── */
  getPreviewSrc: (image: LoadedImage) => string;
  selectAioRegionForImage: (imageId: string, regionId: string | null) => void;
  updateAioRegionsForImage: (
    imageId: string,
    nextRegions: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  refineActiveTypographerShape: () => Promise<void>;
  renderFontRefreshToken: number;
  availableRenderFonts: string[];
  translationNotesEnabled: boolean;
  isCompactViewport: boolean;
  handleStageWheelZoom: (event: WheelEvent<HTMLElement>) => void;

  /* ── Export ── */
  handleDownload: (scope: ProcessableMode | null) => Promise<void>;

  /* ── Readiness preflight (processAIO stays the authority) ── */
  modelEntries: Readonly<Record<string, LocalModelEntry | null | undefined>>;
  getAioStageOption: (
    stage: AioStageKey,
    modelKey: string,
  ) => AioStageOption | null;
  openModelManagerForStage: (
    stage: AioStageKey,
    options?: Record<string, unknown>,
  ) => void;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  modelManagerOpen: boolean;

  /* ── Shell escapes ── */
  onOpenSettings?: () => void;
  /** Studio model-manager modals, kept mountable for readiness refusals. */
  modelManagers: ReactNode;
}

/**
 * Focus Mode layout: pages → run AIO → fix → export on one calm screen.
 *
 * Everything pipeline-shaped is delegated to the page callbacks and the
 * shared stores — this component only derives the linear flow, wires
 * window-level drop/paste/Esc, and renders the minimal chrome.
 */
export default memo(function FocusLayout({
  processAIO,
  stopAioExecution,
  getRootProps,
  getInputProps,
  onDropFiles,
  removeImage,
  getPreviewSrc,
  selectAioRegionForImage,
  updateAioRegionsForImage,
  refineActiveTypographerShape,
  renderFontRefreshToken,
  availableRenderFonts,
  translationNotesEnabled,
  isCompactViewport,
  handleStageWheelZoom,
  handleDownload,
  modelEntries,
  getAioStageOption,
  openModelManagerForStage,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  modelManagerOpen,
  onOpenSettings,
  modelManagers,
}: FocusLayoutProps) {
  const { t, localeTag } = useI18n();
  const { exitFocusMode } = useFocusMode();
  const [windowDragActive, setWindowDragActive] = useState(false);
  const dragCounterRef = useRef(0);

  /* ── Store slices ── */
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const processing = useUiShellStore((s) => s.processing);
  const progress = useUiShellStore((s) => s.progress);
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const setAioSteps = useAioPipelineStore((s) => s.setAioSteps);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const aioAutoProcessedImageById = useAioPipelineStore(
    (s) => s.aioAutoProcessedImageById,
  );
  const aioExecutionStatus = useAioPipelineStore((s) => s.aioExecutionStatus);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
  const downloadItems = useExportStore((s) => s.downloadItems);
  const outFormat = useExportStore((s) => s.outFormat);
  const downloadBundleFormat = useExportStore((s) => s.downloadBundleFormat);
  const setDownloadBundleFormat = useExportStore(
    (s) => s.setDownloadBundleFormat,
  );
  const statusMessage = useStatusStore((s) => s.statusMessage);
  const statusMessageTone = useStatusStore((s) => s.statusMessageTone);
  const runtimeExecutionNotice = useStatusStore(
    (s) => s.runtimeExecutionNotice,
  );
  const reviewedImageIds = useFocusModeStore((s) => s.reviewedImageIds);
  const setImageReviewed = useFocusModeStore((s) => s.setImageReviewed);
  const pruneReviewedImages = useFocusModeStore((s) => s.pruneReviewedImages);
  const workspaceLastSavedAt = useWorkspacePersistenceStore(
    (s) => s.workspaceLastSavedAt,
  );

  /* ── Derivations ── */
  const activeImage = useMemo(
    () => images.find((img) => img.id === activeId) ?? images[0] ?? null,
    [images, activeId],
  );
  const activeIndex = activeImage
    ? images.findIndex((img) => img.id === activeImage.id)
    : -1;

  const downloadImageIds = useMemo(
    () =>
      new Set(
        downloadItems
          .filter((item) => item.scope === 'aio')
          .map((item) => item.sourceImageId),
      ),
    [downloadItems],
  );

  const flow = useMemo(
    () =>
      buildFocusFlowState({
        images,
        processedById: aioAutoProcessedImageById,
        detectionsByImage: aioDetectionsByImage,
        downloadImageIds,
        reviewedImageIds,
      }),
    [
      images,
      aioAutoProcessedImageById,
      aioDetectionsByImage,
      downloadImageIds,
      reviewedImageIds,
    ],
  );

  const activePageFlow = useMemo(
    () =>
      activeImage
        ? (flow.pages.find((page) => page.imageId === activeImage.id) ?? null)
        : null,
    [flow, activeImage],
  );

  const railItems = useMemo<FocusRailItem[]>(
    () =>
      images.flatMap((image) => {
        const pageFlow = flow.pages.find((page) => page.imageId === image.id);
        return pageFlow ? [{ image, flow: pageFlow }] : [];
      }),
    [images, flow],
  );

  const activeRegions = activeImage
    ? (aioDetectionsByImage[activeImage.id] ?? EMPTY_REGIONS)
    : EMPTY_REGIONS;
  const activeSelectedRegionId = activeImage
    ? (aioSelectedRegionByImage[activeImage.id] ?? null)
    : null;

  const disabledStages = useMemo(
    () => findDisabledFocusStages(aioSteps),
    [aioSteps],
  );
  const pipelineStageLabels = useMemo(
    () => getAioPipelineStageLabels(t),
    [t],
  );
  const stageLabels = useMemo(() => getAioStageLabels(t), [t]);

  const readiness = useMemo(
    () =>
      deriveFocusReadiness({
        steps: aioSteps,
        selection: aioStageSelection,
        getStageOption: getAioStageOption,
        modelEntries,
        customOcrProfile: selectedCustomOcrProfile,
        customTranslationProfile: selectedCustomTranslationProfile,
        sourceLanguage: aioSrcLang,
        targetLanguage: aioTgtLang,
        stageLabels,
        t,
      }),
    [
      aioSteps,
      aioStageSelection,
      getAioStageOption,
      modelEntries,
      selectedCustomOcrProfile,
      selectedCustomTranslationProfile,
      aioSrcLang,
      aioTgtLang,
      stageLabels,
      t,
    ],
  );

  const displayStatusMessage = useMemo(() => {
    // Some status writers store a raw i18n key (same normalisation the
    // Studio footer applies before rendering).
    if (statusMessage.includes('.')) {
      const translated = t(statusMessage as TranslationKey);
      if (translated !== statusMessage) return translated;
    }
    return statusMessage;
  }, [statusMessage, t]);

  const autosavedLabel = workspaceLastSavedAt
    ? t('focus.status.autosaved', {
        time: new Date(workspaceLastSavedAt).toLocaleTimeString(localeTag, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })
    : null;

  /* ── Review checklist hygiene ── */
  useEffect(() => {
    pruneReviewedImages(images.map((img) => img.id));
  }, [images, pruneReviewedImages]);

  /* ── Window drop / paste / Esc ── */
  const processingRef = useRef(processing);
  processingRef.current = processing;
  const onDropFilesRef = useRef(onDropFiles);
  onDropFilesRef.current = onDropFiles;
  const modelManagerOpenRef = useRef(modelManagerOpen);
  modelManagerOpenRef.current = modelManagerOpen;

  useEffect(() => {
    const hasFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragCounterRef.current += 1;
      setWindowDragActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setWindowDragActive(false);
    };
    const onDrop = (event: DragEvent) => {
      dragCounterRef.current = 0;
      setWindowDragActive(false);
      if (!hasFiles(event)) return;
      event.preventDefault();
      // The dropzone roots (rail add tile / empty card) own their drops.
      const target = event.target as HTMLElement | null;
      if (target?.closest('.koma-focus__rail-add, .koma-focus__empty')) return;
      if (processingRef.current) return;
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) void onDropFilesRef.current(files);
    };
    const onPaste = (event: ClipboardEvent) => {
      if (processingRef.current) return;
      if (isEditableShortcutTarget(event.target)) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void onDropFilesRef.current(files);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (modelManagerOpenRef.current) return;
      if (isEditableShortcutTarget(event.target)) return;
      exitFocusMode();
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exitFocusMode]);

  /* ── Actions ── */
  const handleRun = useCallback(() => {
    void processAIO();
  }, [processAIO]);

  const handleExport = useCallback(() => {
    void handleDownload('aio');
  }, [handleDownload]);

  const handleSelectRegion = useCallback(
    (regionId: string | null) => {
      if (activeImage) selectAioRegionForImage(activeImage.id, regionId);
    },
    [activeImage, selectAioRegionForImage],
  );

  const handleRegionsChange = useCallback(
    (nextRegions: AioTextRegion[], selectedOverride?: string | null) => {
      if (activeImage) {
        updateAioRegionsForImage(activeImage.id, nextRegions, selectedOverride);
      }
    },
    [activeImage, updateAioRegionsForImage],
  );

  const handleUpdateRegionText = useCallback(
    (regionId: string, text: string) => {
      if (!activeImage) return;
      const current =
        useRegionEditorStore.getState().aioDetectionsByImage[activeImage.id] ??
        EMPTY_REGIONS;
      // renderText drives the exported image; translatedText drives the
      // exported text dumps — a correction must land in both.
      const next = current.map((region) =>
        region.id === regionId
          ? { ...region, renderText: text, translatedText: text }
          : region,
      );
      updateAioRegionsForImage(activeImage.id, next, regionId);
    },
    [activeImage, updateAioRegionsForImage],
  );

  const handleDeleteRegion = useCallback(
    (regionId: string) => {
      if (!activeImage) return;
      const current =
        useRegionEditorStore.getState().aioDetectionsByImage[activeImage.id] ??
        EMPTY_REGIONS;
      const index = current.findIndex((region) => region.id === regionId);
      if (index < 0) return;
      const next = current.filter((region) => region.id !== regionId);
      const nextSelected =
        next[Math.min(index, next.length - 1)]?.id ?? null;
      updateAioRegionsForImage(activeImage.id, next, nextSelected);
    },
    [activeImage, updateAioRegionsForImage],
  );

  const handleToggleReviewedActive = useCallback(() => {
    if (activeImage) setImageReviewed(activeImage.id);
  }, [activeImage, setImageReviewed]);

  const handleMarkReviewedAndNext = useCallback(() => {
    if (!activeImage) return;
    setImageReviewed(activeImage.id, true);
    const nextId = findNextUnreviewedPageId(flow, activeImage.id, activeImage.id);
    if (nextId && nextId !== activeImage.id) setActiveId(nextId);
  }, [activeImage, flow, setImageReviewed, setActiveId]);

  const handlePrevPage = useCallback(() => {
    const prev = images[activeIndex - 1];
    if (prev) setActiveId(prev.id);
  }, [images, activeIndex, setActiveId]);

  const handleNextPage = useCallback(() => {
    const next = images[activeIndex + 1];
    if (next) setActiveId(next.id);
  }, [images, activeIndex, setActiveId]);

  const handleReadinessAction = useCallback(() => {
    if (readiness.ready) return;
    if (readiness.refusal.openModelManager) {
      applyStageReadinessRefusal(readiness.refusal, {
        openModelManagerForStage,
      });
      return;
    }
    // Configuration-shaped refusals (API keys, custom profiles, language
    // incompatibility) are solved where the configuration lives.
    exitFocusMode();
  }, [readiness, openModelManagerForStage, exitFocusMode]);

  const showPipelineBanner =
    images.length > 0 && !processing && disabledStages.length > 0;
  const showReadinessBanner =
    images.length > 0 &&
    !processing &&
    !readiness.ready &&
    flow.processedPages < flow.totalPages;

  return (
    <div className="koma-focus" data-step={flow.step}>
      <FocusTopBar
        step={flow.step}
        onExit={exitFocusMode}
        onOpenSettings={onOpenSettings}
      />

      {processing && (
        <div
          className="koma-focus__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(100, Math.max(0, progress)))}
        >
          <div
            className="koma-focus__progress-fill"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
            }}
          />
        </div>
      )}

      <div className="koma-focus__banners">
        {runtimeExecutionNotice && (
          <div className="koma-focus__banner" role="status">
            <span className="koma-focus__banner-text">
              <span className="koma-focus__banner-title">
                {runtimeExecutionNotice.title}
              </span>
              {runtimeExecutionNotice.detail}
            </span>
          </div>
        )}
        {showPipelineBanner && (
          <div className="koma-focus__banner" role="status">
            <span className="koma-focus__banner-text">
              {t('focus.pipeline.incomplete', {
                stages: disabledStages
                  .map((stage) => pipelineStageLabels[stage])
                  .join(', '),
              })}
            </span>
            <button
              type="button"
              className="koma-focus__btn koma-focus__btn--sm"
              onClick={() => setAioSteps({ ...FULL_FOCUS_STAGE_TOGGLES })}
            >
              {t('focus.pipeline.enableAll')}
            </button>
          </div>
        )}
        {showReadinessBanner && !readiness.ready && (
          <div className="koma-focus__banner" role="status">
            <span className="koma-focus__banner-text">
              <span className="koma-focus__banner-title">
                {t('focus.readiness.title')}
              </span>
              {readiness.refusal.message}
            </span>
            <button
              type="button"
              className="koma-focus__btn koma-focus__btn--sm"
              onClick={handleReadinessAction}
            >
              {readiness.refusal.openModelManager
                ? t('focus.readiness.install')
                : t('focus.readiness.configure')}
            </button>
          </div>
        )}
      </div>

      {images.length === 0 || !activeImage ? (
        <main className="koma-focus__main koma-focus__main--empty">
          <div
            {...(getRootProps() as ComponentProps<'div'>)}
            className="koma-focus__empty"
          >
            <input {...(getInputProps() as ComponentProps<'input'>)} />
            <Upload size={30} aria-hidden="true" />
            <h1 className="koma-focus__empty-title">
              {t('focus.pages.emptyTitle')}
            </h1>
            <p className="koma-focus__empty-hint">
              {t('focus.pages.emptyHint')}
            </p>
            <span className="koma-focus__btn koma-focus__btn--primary">
              {t('focus.pages.browse')}
            </span>
          </div>
        </main>
      ) : (
        <main className="koma-focus__main">
          <FocusPageRail
            items={railItems}
            activeId={activeImage.id}
            processing={processing}
            onSelect={setActiveId}
            onRemove={removeImage}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
          />

          <FocusStage
            image={activeImage}
            imageIndex={activeIndex}
            totalImages={images.length}
            processed={activePageFlow?.processed ?? false}
            previewSrc={getPreviewSrc(activeImage)}
            regions={activeRegions}
            selectedRegionId={activeSelectedRegionId}
            editable={!processing}
            onSelectRegion={handleSelectRegion}
            onRegionsChange={handleRegionsChange}
            onRequestRefineRegion={() => {
              void refineActiveTypographerShape();
            }}
            renderFontRefreshToken={renderFontRefreshToken}
            availableRenderFonts={availableRenderFonts}
            isCompactViewport={isCompactViewport}
            translationNotesEnabled={translationNotesEnabled}
            canPrevPage={activeIndex > 0}
            canNextPage={activeIndex >= 0 && activeIndex < images.length - 1}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            onWheelZoom={handleStageWheelZoom}
          />

          <FocusCorrectionPanel
            pageFlow={activePageFlow}
            regions={activeRegions}
            selectedRegionId={activeSelectedRegionId}
            processing={processing}
            reviewedPages={flow.reviewedPages}
            processedPages={flow.processedPages}
            onSelectRegion={handleSelectRegion}
            onUpdateRegionText={handleUpdateRegionText}
            onDeleteRegion={handleDeleteRegion}
            onToggleReviewed={handleToggleReviewedActive}
          />
        </main>
      )}

      <FocusActionBar
        flow={flow}
        activePageFlow={activePageFlow}
        processing={processing}
        executionLabel={aioExecutionStatus?.label ?? null}
        bundleFormat={downloadBundleFormat}
        imageFormatLabel={getImageExtensionFromMime(outFormat).toUpperCase()}
        onBundleFormatChange={setDownloadBundleFormat}
        onRun={handleRun}
        onStop={stopAioExecution}
        onExport={handleExport}
        onMarkReviewedAndNext={handleMarkReviewedAndNext}
      />

      <footer className="koma-focus__status">
        <span
          className={`koma-focus__status-msg koma-focus__status-msg--${statusMessageTone}`}
          aria-live="polite"
          title={displayStatusMessage}
        >
          {displayStatusMessage}
        </span>
        {autosavedLabel && <span>{autosavedLabel}</span>}
        <span>{t('focus.shortcutsHint')}</span>
      </footer>

      {windowDragActive && (
        <div className="koma-focus__drop-overlay" aria-hidden="true">
          {t('focus.pages.dropHint')}
        </div>
      )}

      {modelManagers}
    </div>
  );
});
