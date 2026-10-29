import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../ContextMenu.css';
import { useI18n } from '../../../i18n';
import type {
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  ManualImageEditTool,
  RenderOverlayInteraction,
  ViewMode,
} from '../../../types/dashboard.types';
import type {
  TypographyShapeKind,
  TypographyStyleFolder,
  TypographyStylePreset,
} from '../../../typography/types';
import type { RenderTextStyle } from '../../../utils/renderText';
import { cn } from '../../../utils/dashboard.utils';
import type { RenderTextPreviewContextMenuState } from '../render-text-preview/RenderTextPreviewContextMenu';
import RenderTextPreviewContextMenuNoir from './RenderTextPreviewContextMenuNoir';
import RenderRegionOverlayBoxNoir from './RenderRegionOverlayBoxNoir';
import RenderTextPreviewTypeDockNoir from './RenderTextPreviewTypeDockNoir';
import type { RenderTextPreviewDockAnchor } from '../render-text-preview/useRenderTextPreviewTypeDock';
import type { RenderTextPreviewInlineEditorState } from '../render-text-preview/useRenderTextPreviewInlineEditor';
import { useRenderTextPreviewToolFlags } from '../render-text-preview/useRenderTextPreviewToolFlags';
import { useRenderTextPreviewRegionModel } from '../render-text-preview/useRenderTextPreviewRegionModel';
import { useRenderTextPreviewManualCanvas } from '../render-text-preview/useRenderTextPreviewManualCanvas';
import { useRenderTextPreviewRegionOps } from '../render-text-preview/useRenderTextPreviewRegionOps';
import { useRenderTextPreviewInlineEditor } from '../render-text-preview/useRenderTextPreviewInlineEditor';
import { useRenderTextPreviewContextMenu } from '../render-text-preview/useRenderTextPreviewContextMenu';
import { useRenderTextPreviewPointer } from '../render-text-preview/useRenderTextPreviewPointer';
import { useRenderTextPreviewSelection } from '../render-text-preview/useRenderTextPreviewSelection';
import { useRenderTextPreviewTypeDock } from '../render-text-preview/useRenderTextPreviewTypeDock';
import { useInlineEditorSpanSync } from '../render-text-preview/useInlineEditorSpanSync';
import { buildInlineEditorHandle } from '../render-text-preview/inlineEditorHandle';
import RenderRegionOverlayList from '../render-text-preview/RenderRegionOverlayList';
import { renderRegionsToCanvas } from '../render-text-preview/canvasDrawing';
import { useRenderTextPreviewCanvasRegions } from '../render-text-preview/useRenderTextPreviewCanvasRegions';
import { useRenderTextPreviewOverlayWheel } from '../render-text-preview/useRenderTextPreviewOverlayWheel';

const EMPTY_TYPOGRAPHY_PRESETS: TypographyStylePreset[] = [];
const EMPTY_TYPOGRAPHY_FOLDERS: TypographyStyleFolder[] = [];
const EMPTY_MULTI_SELECTED_REGION_IDS: string[] = [];

const RenderTextPreviewNoir = ({
  label,
  image,
  previewSrc,
  zoom,
  viewMode,
  active,
  regions,
  selectedRegionId,
  onCardSelect,
  onSelectRegion,
  onRegionsChange,
  editable,
  areaSelectionEnabled,
  allowRegionCreation = true,
  newRegionShapeKind,
  fallbackStyle,
  fontRefreshToken,
  availableRenderFonts,
  isCompactViewport,
  stageBadgeKey,
  stageBadgeLabel,
  canRewind,
  canForward,
  onRewind,
  onForward,
  historyHint,
  renderStageActive,
  onRequestRefineRegion,
  availableTypographyPresets = EMPTY_TYPOGRAPHY_PRESETS,
  availableTypographyFolders = EMPTY_TYPOGRAPHY_FOLDERS,
  onRequestApplyPresetById,
  onRequestConvertShapeRegion,
  manualEditEnabled,
  enableManualImageTools = false,
  manualImageTool,
  manualPaintColor,
  manualBrushSize,
  manualBrushOpacity,
  manualBrushBlur,
  manualPaintLayerDataUrl,
  manualWandMaskDataUrl,
  manualHealingPending,
  textFillSwatches,
  segmentEditEnabled = false,
  segmentEditTool = 'select',
  segmentBrushSize = 28,
  segmentBrushDataUrl = null,
  onSegmentBrushChange,
  onManualPaintLayerChange,
  onManualWandMaskChange,
  onManualWandRequest,
  onManualHealingMaskCommit,
  translationNotesEnabled,
  inlineEditorRequestKey = null,
  multiSelectedRegionIds = EMPTY_MULTI_SELECTED_REGION_IDS,
  onMultiSelectToggle,
  showRegionOverlays = true,
}: {
  label: string;
  image: LoadedImage;
  previewSrc: string;
  zoom: number;
  viewMode: ViewMode;
  active: boolean;
  regions: AioTextRegion[];
  selectedRegionId: string | null;
  onCardSelect: () => void;
  onSelectRegion: (regionId: string | null) => void;
  onRegionsChange: (
    next: AioTextRegion[],
    selectedRegionIdOverride?: string | null,
  ) => void;
  editable: boolean;
  areaSelectionEnabled: boolean;
  allowRegionCreation?: boolean;
  newRegionShapeKind: TypographyShapeKind;
  fallbackStyle: RenderTextStyle;
  fontRefreshToken: number;
  availableRenderFonts: string[];
  isCompactViewport: boolean;
  stageBadgeKey: AioPipelineSnapshotKey;
  stageBadgeLabel: string;
  canRewind: boolean;
  canForward: boolean;
  onRewind: () => void;
  onForward: () => void;
  historyHint: string | null;
  renderStageActive: boolean;
  onRequestRefineRegion?: () => void;
  availableTypographyPresets?: TypographyStylePreset[];
  availableTypographyFolders?: TypographyStyleFolder[];
  onRequestApplyPresetById?: (regionId: string, presetId: string) => void;
  onRequestConvertShapeRegion?: (
    regionId: string,
    kind: 'auto' | TypographyShapeKind,
  ) => void;
  manualEditEnabled: boolean;
  enableManualImageTools?: boolean;
  manualImageTool: ManualImageEditTool;
  manualPaintColor: string;
  manualBrushSize: number;
  manualBrushOpacity: number;
  manualBrushBlur: number;
  manualPaintLayerDataUrl: string | null;
  manualWandMaskDataUrl: string | null;
  manualHealingPending: boolean;
  textFillSwatches: string[];
  segmentEditEnabled?: boolean;
  segmentEditTool?: 'select' | 'brush' | 'eraser';
  segmentBrushSize?: number;
  segmentBrushDataUrl?: string | null;
  onSegmentBrushChange?: (dataUrl: string | null) => void;
  onManualPaintLayerChange: (nextLayer: string | null) => void;
  onManualWandMaskChange: (nextMask: string | null) => void;
  onManualWandRequest: (x: number, y: number) => Promise<void>;
  onManualHealingMaskCommit: (maskDataUrl: string) => Promise<void>;
  translationNotesEnabled: boolean;
  inlineEditorRequestKey?: string | null;
  multiSelectedRegionIds?: string[];
  onMultiSelectToggle?: (regionId: string) => void;
  showRegionOverlays?: boolean;
}) => {
  const { t } = useI18n();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const renderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wandMaskOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const healingMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wandMaskAnimationTimerRef = useRef<number | null>(null);
  const wandMaskSelectedRef = useRef<Uint8Array | null>(null);
  const segBrushCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const segBrushLastRef = useRef<{ x: number; y: number } | null>(null);
  const segBrushDataUrlRef = useRef<string | null>(null);
  const brushCursorRef = useRef<HTMLDivElement | null>(null);
  const lastHoveredRegionIdRef = useRef<string | null>(null);
  const manualInteractionRef = useRef<{
    pointerId: number;
    tool: 'paint' | 'paint_eraser' | 'healing_brush';
    lastX: number;
    lastY: number;
  } | null>(null);
  const [interaction, setInteraction] =
    useState<RenderOverlayInteraction | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] =
    useState<RenderTextPreviewContextMenuState | null>(null);
  const [contextSubmenu, setContextSubmenu] = useState<'presets' | null>(null);
  const [presetSearch, setPresetSearch] = useState("");
  const [presetFolderFilter, setPresetFolderFilter] = useState<string | null>(null);
  const [inlineEditor, setInlineEditor] =
    useState<RenderTextPreviewInlineEditorState | null>(null);
  const [dockExpanded, setDockExpanded] = useState(false);
  const [dockAnchor, setDockAnchor] = useState<RenderTextPreviewDockAnchor | null>(null);
  const inlineEditorContentEditableRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const dockPointerDownRef = useRef(false);
  const [dockSizeRevision, setDockSizeRevision] = useState(0);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const isPickerOpenRef = useRef(false);

  const imageMaxWidth = viewMode === 'paginated' ? 420 : 960;

  const isRotationSwapped = image.rotation === 90 || image.rotation === 270;
  const rotationScaleFactor = useMemo(
    () =>
      isRotationSwapped
        ? image.height > imageMaxWidth
          ? imageMaxWidth / image.height
          : 1
        : image.width > imageMaxWidth
          ? imageMaxWidth / image.width
          : 1,
    [isRotationSwapped, image.width, image.height, imageMaxWidth],
  );
  const imgElemW = image.width * rotationScaleFactor;
  const imgElemH = image.height * rotationScaleFactor;
  const canvasWrapW = isRotationSwapped ? imgElemH : imgElemW;
  const canvasWrapH = isRotationSwapped ? imgElemW : imgElemH;

  const {
    showSegmentOverlay,
    isBrushCursorActive,
    manualOverlayCursor,
    activeManualImageTool,
    updateBrushCursor,
    hideBrushCursor,
  } = useRenderTextPreviewToolFlags({
    manualEditEnabled,
    editable,
    areaSelectionEnabled,
    enableManualImageTools,
    stageBadgeKey,
    manualImageTool,
    segmentEditEnabled,
    segmentEditTool,
    segmentBrushSize,
    manualBrushSize,
    rotationScaleFactor,
    zoom,
    brushCursorRef,
  });

  const {
    regionsWithDefaultsRef,
    displayRegionsWithDefaults,
    regionsWithDefaultsById,
    displayRegionById,
    getTranslationNoteOverlayParentId,
    resolveTranslationNoteOverlayConfig,
    updateRegions,
  } = useRenderTextPreviewRegionModel({
    regions,
    fallbackStyle,
    imageWidth: image.width,
    imageHeight: image.height,
    translationNotesEnabled,
    onRegionsChange,
  });

  const {
    toImagePoint,
    drawSegBrushOnCanvas,
    redrawSegBrushCanvas,
    commitPaintLayer,
    commitHealingMask,
  } = useRenderTextPreviewManualCanvas({
    overlayRef,
    paintCanvasRef,
    healingMaskCanvasRef,
    wandMaskOverlayCanvasRef,
    segBrushCanvasRef,
    segBrushLastRef,
    segBrushDataUrlRef,
    wandMaskAnimationTimerRef,
    wandMaskSelectedRef,
    image,
    manualPaintLayerDataUrl,
    manualWandMaskDataUrl,
    onManualPaintLayerChange,
    onManualHealingMaskCommit,
    contextSubmenu,
    setPresetSearch,
    setPresetFolderFilter,
  });

  const {
    updateRegionBox,
    updateRegionText,
    setRegionSkew,
    setRegionRotation,
    updateRegionRotation,
    updateRegionStyle,
    updateRegionTextStyleRanges,
  } = useRenderTextPreviewRegionOps({
    updateRegions,
    getTranslationNoteOverlayParentId,
    resolveTranslationNoteOverlayConfig,
    fallbackStyle,
  });

  const {
    restoreInlineEditorSelection,
    openInlineEditorForRegion,
    saveInlineEditor,
    cancelInlineEditor,
    handleInlineEditorInput,
    closeInlineEditor,
    syncInlineEditorSelection,
    saveCurrentSelection,
    clearPickerState,
    beginComposition,
    endComposition,
    isComposingRef,
    compositionStyleRevision,
    setInlineEditorSelection,
    applyInlineEditorDraftStyle,
  } = useRenderTextPreviewInlineEditor({
    inlineEditor,
    setInlineEditor,
    setContextMenu,
    inlineEditorContentEditableRef,
    savedSelectionRef,
    isPickerOpenRef,
    dockPointerDownRef,
    displayRegionsWithDefaults,
    fallbackStyle,
    editable,
    renderStageActive,
    areaSelectionEnabled,
    onSelectRegion,
    updateRegionText,
    updateRegions,
    getTranslationNoteOverlayParentId,
    resolveTranslationNoteOverlayConfig,
  });

  const {
    getTooltipContent,
    handleRegionContextMenu,
    handleContextCopyRecognized,
    handleContextCopyTranslated,
    handleContextEditRendered,
    handleContextApplyPresetById,
    handleContextConvertShape,
    removeRegionById,
    handleContextRemoveRegion,
  } = useRenderTextPreviewContextMenu({
    overlayRef,
    segBrushDataUrlRef,
    redrawSegBrushCanvas,
    segmentBrushDataUrl,
    contextMenu,
    setContextMenu,
    setContextSubmenu,
    setHoveredRegionId,
    setInlineEditor,
    displayRegionsWithDefaults,
    regionsWithDefaultsRef,
    editable,
    renderStageActive,
    areaSelectionEnabled,
    selectedRegionId,
    translationNotesEnabled,
    t,
    onCardSelect,
    onSelectRegion,
    onRegionsChange,
    onRequestApplyPresetById,
    onRequestConvertShapeRegion,
    openInlineEditorForRegion,
    getTranslationNoteOverlayParentId,
    updateRegions,
  });

  const canvasDrawRegions = useRenderTextPreviewCanvasRegions({
    displayRegionsWithDefaults,
    interaction,
    inlineEditor,
    fallbackStyle,
  });

  const {
    handlePointerDown,
    handlePointerUp,
    handleRegionContextMenuDelegated,
    handleRegionDoubleClickDelegated,
    handleOverlayPointerMove,
    handleOverlayPointerEnter,
    handleOverlayPointerLeave,
    handleOverlayPointerCancel,
  } = useRenderTextPreviewPointer({
    interaction,
    setInteraction,
    setContextMenu,
    setHoveredRegionId,
    paintCanvasRef,
    healingMaskCanvasRef,
    segBrushCanvasRef,
    segBrushLastRef,
    segBrushDataUrlRef,
    wandMaskSelectedRef,
    manualInteractionRef,
    lastHoveredRegionIdRef,
    regionsWithDefaultsRef,
    image,
    displayRegionsWithDefaults,
    regionsWithDefaultsById,
    fallbackStyle,
    selectedRegionId,
    editable,
    areaSelectionEnabled,
    allowRegionCreation,
    renderStageActive,
    segmentEditEnabled,
    segmentEditTool,
    segmentBrushSize,
    activeManualImageTool,
    manualHealingPending,
    isBrushCursorActive,
    manualBrushSize,
    manualPaintColor,
    manualBrushOpacity,
    manualBrushBlur,
    newRegionShapeKind,
    onCardSelect,
    onSelectRegion,
    onRegionsChange,
    onMultiSelectToggle,
    onManualWandMaskChange,
    onManualWandRequest,
    onSegmentBrushChange,
    toImagePoint,
    drawSegBrushOnCanvas,
    commitPaintLayer,
    commitHealingMask,
    updateRegionBox,
    setRegionSkew,
    setRegionRotation,
    updateRegionRotation,
    updateBrushCursor,
    hideBrushCursor,
    handleRegionContextMenu,
    openInlineEditorForRegion,
    closeInlineEditor,
  });

  const {
    segmentOverlayBoxes,
    hoveredRegion,
    contextMenuTargetRegion,
    typographyFolderNameById,
    filteredTypographyPresets,
    groupedTypographyPresets,
    inlineEditorContentEditableStyle,
    inlineEditorLineBoxes,
    inlineEditorPaint,
    inlineEditorUsesCanvasSelection,
    selectedInlineSelectionActive,
    selectedRegionStyle,
    selectedRegionIsNoteOverlay,
    showRenderDock,
    selectedRegion,
  } = useRenderTextPreviewSelection({
    selectedRegionId,
    hoveredRegionId,
    contextMenu,
    inlineEditor,
    displayRegionById,
    displayRegionsWithDefaults,
    fallbackStyle,
    availableTypographyPresets,
    availableTypographyFolders,
    presetSearch,
    presetFolderFilter,
    renderStageActive,
    active,
    editable,
    areaSelectionEnabled,
    inlineEditorRequestKey,
    inlineEditorDisplayScale: rotationScaleFactor,
    openInlineEditorForRegion,
  });

  // Keeps the contentEditable's DOM (native formatting spans, trailing <br>
  // sentinel) in sync with the draft; needs the layout-aware selection mode.
  useInlineEditorSpanSync({
    inlineEditor,
    canvasSelection: inlineEditorUsesCanvasSelection,
    isComposingRef,
    compositionStyleRevision,
    contentEditableRef: inlineEditorContentEditableRef,
    displayRegionsWithDefaults,
    fallbackStyle,
    inlineEditorDisplayScale: rotationScaleFactor,
  });

  // Paint the rendered text of every display region onto the preview canvas.
  // Coalesced onto one animation frame: a style click can commit more than once
  // and every draw re-runs the effect layers.
  const renderFrameRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const renderPreview = async (): Promise<void> => {
      const canvas = renderCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await renderRegionsToCanvas(ctx, {
        imageWidth: image.width,
        imageHeight: image.height,
        regions: canvasDrawRegions,
        fallbackStyle,
        renderStageActive,
        skipRegionId: inlineEditor && !inlineEditorUsesCanvasSelection
          ? inlineEditor.regionId
          : null,
        isCancelled: () => cancelled,
      });
    };

    if (renderFrameRef.current) {
      cancelAnimationFrame(renderFrameRef.current);
    }
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = 0;
      void renderPreview();
    });
    return () => {
      cancelled = true;
      if (renderFrameRef.current) {
        cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = 0;
      }
    };
  }, [
    canvasDrawRegions,
    fallbackStyle,
    fontRefreshToken,
    image.height,
    image.width,
    inlineEditor?.regionId,
    inlineEditorUsesCanvasSelection,
    renderStageActive,
  ]);

  const {
    updateSelectedRegionStyle,
    updateSelectedRegionShapeKind,
    normalizeSelectedRegionShape,
    adjustSelectedFontSize,
    adjustSelectedRotation,
    dockVisible,
  } = useRenderTextPreviewTypeDock({
    showRenderDock,
    dockAnchor,
    setDockAnchor,
    dockRef,
    overlayRef,
    dockSizeRevision,
    setDockSizeRevision,
    dockExpanded,
    isCompactViewport,
    selectedRegion,
    selectedRegionId,
    selectedRegionStyle,
    selectedRegionIsNoteOverlay,
    selectedInlineSelectionActive,
    inlineEditor,
    image,
    fallbackStyle,
    savedSelectionRef,
    restoreInlineEditorSelection,
    applyInlineEditorDraftStyle,
    updateRegionStyle,
    updateRegionTextStyleRanges,
    updateRegions,
  });

  const inlineEditorHandle = inlineEditor
    ? buildInlineEditorHandle({
      inlineEditor,
      selection: {
        contentEditableStyle: inlineEditorContentEditableStyle,
        lineBoxes: inlineEditorLineBoxes,
        caretColor: inlineEditorPaint.color,
        canvasSelection: inlineEditorUsesCanvasSelection,
      },
      refs: {
        contentEditableRef: inlineEditorContentEditableRef,
        dockRef,
        dockPointerDownRef,
      },
      actions: {
        onInput: handleInlineEditorInput,
        syncSelection: syncInlineEditorSelection,
        cancel: cancelInlineEditor,
        save: saveInlineEditor,
        toggleRegionStyle: updateSelectedRegionStyle,
        setState: setInlineEditor,
        beginComposition,
        endComposition,
        setSelection: setInlineEditorSelection,
      },
    })
    : null;

  useRenderTextPreviewOverlayWheel({
    overlayRef,
    editable,
    renderStageActive,
    areaSelectionEnabled,
    selectedRegionId,
    updateRegionRotation,
  });

  const draftBox = useMemo<[number, number, number, number] | null>(
    () =>
      interaction && interaction.kind === 'draw'
        ? [
          Math.min(interaction.startX, interaction.currentX),
          Math.min(interaction.startY, interaction.currentY),
          Math.max(interaction.startX, interaction.currentX),
          Math.max(interaction.startY, interaction.currentY),
        ]
        : null,
    [interaction],
  );

  const stageBadgeTone: Record<string, string> = {
    detectText: 'border-azure/40 bg-azure/10 text-azure',
    recognizeText: 'border-azure/40 bg-azure/10 text-azure',
    segmentText: 'border-azure/40 bg-azure/10 text-azure',
    cleanImage: 'border-gold/40 bg-gold/10 text-gold',
    getTranslations: 'border-mint/40 bg-mint/10 text-mint',
    render: 'border-crimson/40 bg-crimson/10 text-crimson',
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onCardSelect}
        onKeyDown={(event) => {
          const target = event.target;
          if (
            target instanceof HTMLElement
            && (target.isContentEditable
              || target.tagName === 'INPUT'
              || target.tagName === 'TEXTAREA'
              || target.tagName === 'SELECT')
          ) {
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCardSelect();
          }
        }}
        aria-label={label}
        aria-pressed={active}
        data-tour={active ? 'dashboard-active-preview-card' : undefined}
        className={cn(
          'group/card relative flex flex-col gap-2 p-2 transition-all',
          active && 'z-10',
        )}
        style={{ zoom }}
      >
        <div className="glass panel-cut-sm relative flex items-center gap-2 px-2.5 py-1.5">
          <div className="halftone-red pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
          {active && <span className="relative h-1.5 w-1.5 bg-crimson blink-noir" aria-hidden="true" />}
          <span className="relative truncate font-display text-xs font-black uppercase tracking-tight text-paper">
            {label}
          </span>
          <span
            className={cn(
              'panel-cut-sm relative shrink-0 border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest',
              stageBadgeTone[stageBadgeKey] ?? 'border-paper/20 bg-ink-3 text-paper-dim',
            )}
          >
            {stageBadgeLabel}
          </span>
          <div className="relative ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onRewind(); }}
              disabled={!canRewind}
              title={t('dashboard.renderText.rewind.title')}
              aria-label={t('dashboard.renderText.rewind.title')}
              className="panel-cut-sm grid h-6 w-6 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-paper-dim"
            >
              <ChevronLeft size={11} />
            </button>
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onForward(); }}
              disabled={!canForward}
              title={t('dashboard.renderText.forward.title')}
              aria-label={t('dashboard.renderText.forward.title')}
              className="panel-cut-sm grid h-6 w-6 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-paper-dim"
            >
              <ChevronRight size={11} />
            </button>
          </div>
        </div>

        {/* history hint */}
        <div className="flex items-center gap-1.5 px-1 font-mono text-[9px] uppercase tracking-wider text-paper-dim">
          <span className="h-px w-3 bg-crimson/40" aria-hidden="true" />
          {historyHint ?? t('dashboard.renderText.noHistory')}
        </div>

        {/* ═══ CANVAS FRAME — panel-cut manga panel ═══ */}
        <div
          className={cn(
            'panel-cut relative overflow-hidden bg-ink transition-all',
            active
              ? 'shadow-hard-crimson ring-1 ring-crimson/50'
              : 'ring-1 ring-paper/8 group-hover/card:shadow-hard-paper',
          )}
          style={{ width: canvasWrapW, height: canvasWrapH }}
        >
          <div
            className="absolute"
            style={{
              width: imgElemW,
              left: (canvasWrapW - imgElemW) / 2,
              top: (canvasWrapH - imgElemH) / 2,
              transform: image.rotation
                ? `rotate(${image.rotation}deg)`
                : undefined,
            }}
          >
            <img
              src={previewSrc}
              className="block h-auto w-full select-none"
              style={{ maxWidth: `${imgElemW}px` }}
              alt={image.file.name}
              decoding="async"
              draggable={false}
            />
            <canvas ref={paintCanvasRef} className="koma-manual-paint-canvas" />
            <canvas
              ref={wandMaskOverlayCanvasRef}
              className="koma-manual-mask-overlay"
            />
            <canvas
              ref={healingMaskCanvasRef}
              className={cn(
                'koma-manual-mask-canvas',
                manualHealingPending && 'koma-manual-mask-canvas--busy',
              )}
            />
            <canvas ref={renderCanvasRef} className="koma-render-canvas" />
            <div
              ref={overlayRef}
              className={cn(
                'koma-render-overlay absolute inset-0',
                editable && areaSelectionEnabled && 'koma-render-overlay--editable',
                inlineEditor && 'koma-render-overlay--inline-editing',
              )}
              style={{ cursor: manualOverlayCursor }}
              onPointerDown={handlePointerDown}
              onPointerMove={handleOverlayPointerMove}
              onPointerUp={handlePointerUp}
              onPointerEnter={handleOverlayPointerEnter}
              onPointerCancel={handleOverlayPointerCancel}
              onPointerLeave={handleOverlayPointerLeave}
              onContextMenu={handleRegionContextMenuDelegated}
              onDoubleClick={handleRegionDoubleClickDelegated}
            >
              {showRegionOverlays && (
                <RenderRegionOverlayList
                  BoxComponent={RenderRegionOverlayBoxNoir}
                  regions={displayRegionsWithDefaults}
                  imageWidth={image.width}
                  imageHeight={image.height}
                  renderStageActive={renderStageActive}
                  fallbackStyle={fallbackStyle}
                  editable={editable}
                  areaSelectionEnabled={areaSelectionEnabled}
                  selectedRegionId={selectedRegionId}
                  multiSelectedRegionIds={multiSelectedRegionIds}
                  interaction={interaction}
                  removeRegionById={removeRegionById}
                  editorHandle={inlineEditorHandle}
                />
              )}

              {showRegionOverlays && showSegmentOverlay &&
                segmentOverlayBoxes.map(({ key, box }) => {
                  const [sx1, sy1, sx2, sy2] = box;
                  return (
                    <div
                      key={key}
                      className="koma-detect-seg-box absolute border border-dashed border-mint/60 bg-mint/5"
                      style={{
                        left: `${(sx1 / image.width) * 100}%`,
                        top: `${(sy1 / image.height) * 100}%`,
                        width: `${((sx2 - sx1) / image.width) * 100}%`,
                        height: `${((sy2 - sy1) / image.height) * 100}%`,
                      }}
                    />
                  );
                })}
              {showRegionOverlays && showSegmentOverlay && (
                <canvas
                  ref={segBrushCanvasRef}
                  className="koma-segment-brush-canvas"
                />
              )}

              {showRegionOverlays && hoveredRegion &&
                (() => {
                  const [hx1, hy1, hx2] = hoveredRegion.bbox;
                  const centerX = ((hx1 + hx2) / 2 / image.width) * 100;
                  const topY = (hy1 / image.height) * 100;
                  const tooltip = getTooltipContent(hoveredRegion);
                  return (
                    <div
                      className="glass panel-cut-sm absolute z-30 flex w-52 flex-col gap-1 border-crimson/30 p-2 shadow-hard-crimson"
                      style={{ left: `${centerX}%`, top: `${Math.max(1.5, topY)}%`, transform: 'translate(-50%, calc(-100% - 8px))' }}
                    >
                      <div className="halftone-red pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
                      <TooltipLine label={t('detectionPreview.recognized')} value={tooltip.recognized} tone="azure" />
                      <TooltipLine label={t('detectionPreview.translated')} value={tooltip.translated} tone="mint" />
                      {translationNotesEnabled && (
                        <TooltipLine label={t('detectionPreview.note')} value={tooltip.notes} tone="gold" />
                      )}
                    </div>
                  );
                })()}

              <RenderTextPreviewContextMenuNoir
                contextMenu={contextMenu}
                targetRegion={contextMenuTargetRegion}
                editable={editable}
                contextSubmenu={contextSubmenu}
                presetSearch={presetSearch}
                presetFolderFilter={presetFolderFilter}
                availableTypographyPresets={availableTypographyPresets}
                availableTypographyFolders={availableTypographyFolders}
                filteredTypographyPresets={filteredTypographyPresets}
                groupedTypographyPresets={groupedTypographyPresets}
                typographyFolderNameById={typographyFolderNameById}
                canApplyPreset={Boolean(onRequestApplyPresetById)}
                canConvertShape={Boolean(onRequestConvertShapeRegion)}
                onContextSubmenuChange={setContextSubmenu}
                onPresetSearchChange={setPresetSearch}
                onPresetFolderFilterChange={setPresetFolderFilter}
                onCopyRecognized={handleContextCopyRecognized}
                onCopyTranslated={handleContextCopyTranslated}
                onEditRendered={handleContextEditRendered}
                onApplyPresetById={handleContextApplyPresetById}
                onConvertShape={handleContextConvertShape}
                onRemoveRegion={handleContextRemoveRegion}
              />

              {showRenderDock && dockAnchor && selectedRegion && dockVisible && createPortal((() => {
                const overlay = overlayRef.current;
                const overlayRect = overlay?.getBoundingClientRect();
                if (!overlayRect) {
                  return <div ref={dockRef} className="koma-type-dock" style={{ display: 'none' }} />;
                }
                // Viewport coordinates: the dock is portaled to <body> so the
                // stage's overflow cannot clip it against the sidebars.
                const dockLeft = overlayRect.left + dockAnchor.x;
                const dockTop = overlayRect.top + dockAnchor.y;
                return (
                  <RenderTextPreviewTypeDockNoir
                    dockLeft={dockLeft}
                    dockTop={dockTop}
                    dockAnchor={dockAnchor}
                    dockRef={dockRef}
                    dockPointerDownRef={dockPointerDownRef}
                    isCompactViewport={isCompactViewport}
                    selectedRegionId={selectedRegionId}
                    selectedRegion={selectedRegion}
                    selectedRegionStyle={selectedRegionStyle}
                    selectedRegionIsNoteOverlay={selectedRegionIsNoteOverlay}
                    dockExpanded={dockExpanded}
                    setDockExpanded={setDockExpanded}
                    availableRenderFonts={availableRenderFonts}
                    textFillSwatches={textFillSwatches}
                    onRequestRefineRegion={onRequestRefineRegion}
                    updateSelectedRegionStyle={updateSelectedRegionStyle}
                    updateSelectedRegionShapeKind={updateSelectedRegionShapeKind}
                    normalizeSelectedRegionShape={normalizeSelectedRegionShape}
                    adjustSelectedFontSize={adjustSelectedFontSize}
                    adjustSelectedRotation={adjustSelectedRotation}
                    saveCurrentSelection={saveCurrentSelection}
                    clearPickerState={clearPickerState}
                    syncInlineEditorSelection={syncInlineEditorSelection}
                  />
                );
              })(), document.body)}

              {draftBox && (
                <div
                  className="absolute border-2 border-dashed border-crimson bg-crimson/10"
                  style={{
                    left: `${(draftBox[0] / image.width) * 100}%`,
                    top: `${(draftBox[1] / image.height) * 100}%`,
                    width: `${((draftBox[2] - draftBox[0]) / image.width) * 100}%`,
                    height: `${((draftBox[3] - draftBox[1]) / image.height) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {createPortal(<div ref={brushCursorRef} className="koma-brush-cursor" />, document.body)}
    </>
  );
};

/* ── Tooltip line ── */
function TooltipLine({ label, value, tone }: { label: string; value: string; tone: 'azure' | 'mint' | 'gold' }) {
  const toneCls = { azure: 'text-azure', mint: 'text-mint', gold: 'text-gold' }[tone];
  return (
    <div className="relative flex flex-col gap-0.5">
      <span className={cn('font-mono text-[8px] font-bold uppercase tracking-widest', toneCls)}>{label}</span>
      <span className="line-clamp-2 font-mono text-[10px] leading-tight text-paper">{value}</span>
    </div>
  );
}

// ── Main Component ──

function areEqual(
  prev: Parameters<typeof RenderTextPreviewNoir>[0],
  next: Parameters<typeof RenderTextPreviewNoir>[0],
): boolean {
  return (
    prev.regions === next.regions &&
    prev.selectedRegionId === next.selectedRegionId &&
    prev.image === next.image &&
    prev.previewSrc === next.previewSrc &&
    prev.zoom === next.zoom &&
    prev.editable === next.editable &&
    prev.active === next.active &&
    prev.viewMode === next.viewMode &&
    prev.renderStageActive === next.renderStageActive &&
    prev.manualEditEnabled === next.manualEditEnabled &&
    prev.manualImageTool === next.manualImageTool &&
    prev.manualPaintColor === next.manualPaintColor &&
    prev.manualBrushSize === next.manualBrushSize &&
    prev.manualBrushOpacity === next.manualBrushOpacity &&
    prev.manualBrushBlur === next.manualBrushBlur &&
    prev.segmentEditEnabled === next.segmentEditEnabled &&
    prev.fallbackStyle === next.fallbackStyle &&
    prev.fontRefreshToken === next.fontRefreshToken &&
    prev.newRegionShapeKind === next.newRegionShapeKind &&
    prev.stageBadgeKey === next.stageBadgeKey &&
    prev.stageBadgeLabel === next.stageBadgeLabel &&
    prev.translationNotesEnabled === next.translationNotesEnabled &&
    prev.availableRenderFonts === next.availableRenderFonts &&
    prev.availableTypographyPresets === next.availableTypographyPresets &&
    prev.availableTypographyFolders === next.availableTypographyFolders &&
    prev.isCompactViewport === next.isCompactViewport &&
    prev.allowRegionCreation === next.allowRegionCreation &&
    prev.textFillSwatches === next.textFillSwatches &&
    prev.manualPaintLayerDataUrl === next.manualPaintLayerDataUrl &&
    prev.manualWandMaskDataUrl === next.manualWandMaskDataUrl &&
    prev.manualHealingPending === next.manualHealingPending &&
    prev.segmentBrushDataUrl === next.segmentBrushDataUrl &&
    prev.segmentBrushSize === next.segmentBrushSize &&
    prev.segmentEditTool === next.segmentEditTool &&
    prev.historyHint === next.historyHint &&
    prev.canRewind === next.canRewind &&
    prev.canForward === next.canForward &&
    prev.multiSelectedRegionIds === next.multiSelectedRegionIds &&
    prev.showRegionOverlays === next.showRegionOverlays &&
    prev.inlineEditorRequestKey === next.inlineEditorRequestKey
  );
}

export default React.memo(RenderTextPreviewNoir, areEqual);