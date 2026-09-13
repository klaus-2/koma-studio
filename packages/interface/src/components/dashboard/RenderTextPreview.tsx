import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './ContextMenu.css';
import { useI18n } from '../../i18n';
import type {
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  ManualImageEditTool,
  RenderOverlayInteraction,
  ViewMode,
} from '../../types/dashboard.types';
import type {
  TypographyShapeKind,
  TypographyStyleFolder,
  TypographyStylePreset,
} from '../../typography/types';
import type { RenderTextStyle } from '../../utils/renderText';
import {
  buildDefaultRegionRenderText,
  cloneRenderStyle,
  cn,
  isTranslationNoteOverlayRegion,
} from '../../utils/dashboard.utils';
import { readInlineEditorPlainText } from '../../utils/inlineEditor';
import RenderTextPreviewContextMenu, {
  type RenderTextPreviewContextMenuState,
} from './render-text-preview/RenderTextPreviewContextMenu';
import RenderTextPreviewTypeDock from './render-text-preview/RenderTextPreviewTypeDock';
import type { RenderTextPreviewDockAnchor } from './render-text-preview/useRenderTextPreviewTypeDock';
import type { RenderTextPreviewInlineEditorState } from './render-text-preview/useRenderTextPreviewInlineEditor';
import { useRenderTextPreviewToolFlags } from './render-text-preview/useRenderTextPreviewToolFlags';
import { useRenderTextPreviewRegionModel } from './render-text-preview/useRenderTextPreviewRegionModel';
import { useRenderTextPreviewManualCanvas } from './render-text-preview/useRenderTextPreviewManualCanvas';
import { useRenderTextPreviewRegionOps } from './render-text-preview/useRenderTextPreviewRegionOps';
import { useRenderTextPreviewInlineEditor } from './render-text-preview/useRenderTextPreviewInlineEditor';
import { useRenderTextPreviewContextMenu } from './render-text-preview/useRenderTextPreviewContextMenu';
import { useRenderTextPreviewPointer } from './render-text-preview/useRenderTextPreviewPointer';
import { useRenderTextPreviewSelection } from './render-text-preview/useRenderTextPreviewSelection';
import { useRenderTextPreviewTypeDock } from './render-text-preview/useRenderTextPreviewTypeDock';
import { getRegionRotation } from './render-text-preview/regionGeometry';
import {
  drawRegionsToCanvas,
  preloadRegionCanvasFonts,
} from './render-text-preview/canvasDrawing';

// Stable module-scope defaults: inline `= []` prop defaults created a new
// array every render and defeated downstream memo deps (react-doctor
// rerender-memo-with-default-value).
const EMPTY_TYPOGRAPHY_PRESETS: TypographyStylePreset[] = [];
const EMPTY_TYPOGRAPHY_FOLDERS: TypographyStyleFolder[] = [];
const EMPTY_MULTI_SELECTED_REGION_IDS: string[] = [];

const RenderTextPreview = ({
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
  onRequestAutoShapeRegion?: () => void;
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
    syncInlineEditorSelection,
    saveCurrentSelection,
    clearPickerState,
  } = useRenderTextPreviewInlineEditor({
    inlineEditor,
    setInlineEditor,
    setContextMenu,
    inlineEditorContentEditableRef,
    savedSelectionRef,
    isPickerOpenRef,
    dockPointerDownRef,
    displayRegionsWithDefaults,
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

  // Paint the rendered text of every display region onto the preview canvas.
  useEffect(() => {
    let cancelled = false;
    const renderPreview = async (): Promise<void> => {
      const canvas = renderCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await preloadRegionCanvasFonts(displayRegionsWithDefaults, fallbackStyle);
      if (cancelled) return;

      drawRegionsToCanvas(
        ctx,
        image.width,
        image.height,
        displayRegionsWithDefaults,
        fallbackStyle,
        renderStageActive,
      );
    };

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, [
    displayRegionsWithDefaults,
    fallbackStyle,
    fontRefreshToken,
    image.height,
    image.width,
    renderStageActive,
  ]);

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
    setInlineEditor,
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
  });

  const {
    segmentOverlayBoxes,
    hoveredRegion,
    contextMenuTargetRegion,
    typographyFolderNameById,
    filteredTypographyPresets,
    groupedTypographyPresets,
    inlineEditorContentEditableStyle,
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
    openInlineEditorForRegion,
  });

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
    updateRegionStyle,
    updateRegionTextStyleRanges,
    updateRegions,
  });

  const handleOverlayWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!editable || !renderStageActive || !areaSelectionEnabled) return;
      if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)
        return;
      if (!selectedRegionId) return;

      const dominantDelta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (Math.abs(dominantDelta) < 0.5) return;

      event.preventDefault();
      event.stopPropagation();

      const direction = dominantDelta < 0 ? 1 : -1;
      const steps = Math.max(
        1,
        Math.min(12, Math.round(Math.abs(dominantDelta) / 90)),
      );
      const rotationDelta = direction * steps * 2;
      updateRegionRotation(selectedRegionId, rotationDelta);
    },
    [
      areaSelectionEnabled,
      editable,
      renderStageActive,
      selectedRegionId,
      updateRegionRotation,
    ],
  );

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

  return (
    <>
    <div
      onClick={onCardSelect}
      data-tour={active ? 'dashboard-active-preview-card' : undefined}
      className={cn('koma-preview-card', active && 'koma-preview-card--active')}
      style={{ zoom }}
    >
      <div className="koma-preview-card__labelRow">
        <div className="koma-preview-card__label">{label}</div>
        <span
          className={cn(
            'koma-preview-card__stageBadge',
            `koma-preview-card__stageBadge--${stageBadgeKey}`,
          )}
        >
          {stageBadgeLabel}
        </span>
        <div className="koma-preview-card__labelActions">
          <button
            type="button"
            className="koma-iconbtn koma-iconbtn--xs koma-preview-card__historyBtn"
            onClick={(event) => {
              event.stopPropagation();
              onRewind();
            }}
            disabled={!canRewind}
            title={t('dashboard.renderText.rewind.title')}
            aria-label={t('dashboard.renderText.rewind.title')}
          >
            <ChevronLeft size={11} />
          </button>
          <button
            type="button"
            className="koma-iconbtn koma-iconbtn--xs koma-preview-card__historyBtn"
            onClick={(event) => {
              event.stopPropagation();
              onForward();
            }}
            disabled={!canForward}
            title={t('dashboard.renderText.forward.title')}
            aria-label={t('dashboard.renderText.forward.title')}
          >
            <ChevronRight size={11} />
          </button>
        </div>
      </div>
      <div className="koma-preview-card__labelHint">
        {historyHint ?? t('dashboard.renderText.noHistory')}
      </div>
      <div
        className="koma-preview-card__rotateWrap"
        style={{ width: canvasWrapW, height: canvasWrapH }}
      >
        <div
          className="koma-preview-card__canvasWrap"
          style={{
            width: imgElemW,
            position: 'absolute',
            left: (canvasWrapW - imgElemW) / 2,
            top: (canvasWrapH - imgElemH) / 2,
            transform: image.rotation
              ? `rotate(${image.rotation}deg)`
              : undefined,
          }}
        >
          <img
            src={previewSrc}
            className="koma-preview-card__img"
            style={{ maxWidth: `${imgElemW}px` }}
            alt={image.file.name}
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
            'koma-render-overlay',
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
          onWheel={handleOverlayWheel}
        >
          {showRegionOverlays && displayRegionsWithDefaults.map((region) => {
            const [x1, y1, x2, y2] = region.bbox;
            const isNoteOverlay = isTranslationNoteOverlayRegion(region);
            const selected = region.id === selectedRegionId;
            const multiSelectIndex = multiSelectedRegionIds.indexOf(region.id);
            const isMultiSelected = multiSelectIndex >= 0;
            const previewText = renderStageActive
              ? (region.renderText ?? '').trim()
              : buildDefaultRegionRenderText(region);
            const regionRotation = getRegionRotation(region, fallbackStyle);
            const regionSkewStyle = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
            return (
              <React.Fragment key={region.id}>
                <div
                  className={cn(
                    'koma-render-box',
                    region.source === 'manual' && 'koma-render-box--manual',
                    isNoteOverlay && 'koma-render-box--note',
                    selected && 'koma-render-box--selected',
                    isMultiSelected && 'koma-render-box--multi-selected',
                  )}
                  style={{
                    left: `${(x1 / image.width) * 100}%`,
                    top: `${(y1 / image.height) * 100}%`,
                    width: `${((x2 - x1) / image.width) * 100}%`,
                    height: `${((y2 - y1) / image.height) * 100}%`,
                    transform: `rotate(${regionRotation}deg) skew(${regionSkewStyle.skewX || 0}deg, ${regionSkewStyle.skewY || 0}deg)`,
                    transformOrigin: 'center center',
                    borderRadius:
                      region.shape?.kind === 'rounded' ? '999px' : '14px',
                  }}
                  data-region-id={region.id}
                >
                  {isMultiSelected && (
                    <span className="koma-render-box__multi-badge">
                      {multiSelectIndex + 1}
                    </span>
                  )}
                  <span className="koma-render-box__meta">
                    {isNoteOverlay
                      ? 'NT'
                      : previewText.trim().length > 0
                        ? previewText.slice(0, 32)
                        : renderStageActive
                          ? t('dashboard.renderText.dblClickToEdit')
                          : t('dashboard.renderText.renderNotApplied')}
                  </span>
                  {inlineEditor?.regionId === region.id && (
                    <div
                      ref={inlineEditorContentEditableRef}
                      className="koma-render-inline-editor"
                      contentEditable
                      suppressContentEditableWarning
                      style={inlineEditorContentEditableStyle}
                      onPointerDown={(event) => event.stopPropagation()}
                      data-empty={inlineEditor.value.length === 0 ? 'true' : undefined}
                      data-placeholder={t('dashboard.renderText.editPlaceholder')}
                      onInput={(event) => {
                        const nextValue = readInlineEditorPlainText(
                          event.currentTarget,
                        );
                        if (nextValue.length > 0) {
                          event.currentTarget.removeAttribute('data-empty');
                        } else {
                          event.currentTarget.setAttribute('data-empty', 'true');
                        }
                        handleInlineEditorInput(nextValue);
                        syncInlineEditorSelection();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          event.stopPropagation();
                          cancelInlineEditor();
                          return;
                        }
                        if (event.key === 'Enter' && event.ctrlKey) {
                          event.preventDefault();
                          event.stopPropagation();
                          saveInlineEditor();
                        }
                      }}
                      onBlur={(event) => {
                        if (dockPointerDownRef.current) {
                          return;
                        }
                        const nextTarget = event.relatedTarget as Node | null;
                        if (nextTarget && dockRef.current?.contains(nextTarget)) {
                          return;
                        }
                        if (!inlineEditor?.isDirty) {
                          setInlineEditor(null);
                          return;
                        }
                        saveInlineEditor();
                      }}
                      onSelect={syncInlineEditorSelection}
                      onKeyUp={syncInlineEditorSelection}
                      onMouseUp={syncInlineEditorSelection}
                      aria-label={t('dashboard.renderText.editAria')}
                    />
                  )}
                  {selected && editable && areaSelectionEnabled && (
                    <>
                      <button
                        type="button"
                        className="koma-render-box__close koma-render-handle"
                        title={t('dashboard.renderText.removeSelection.title')}
                        aria-label={t('dashboard.renderText.removeSelection.title')}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeRegionById(region.id);
                        }}
                      >
                        <X size={11} />
                      </button>
                      <span className="koma-render-rotate-arm" />
                      <span
                        className="koma-render-rotate-handle koma-render-handle"
                        data-render-handle="rotate"
                        data-region-id={region.id}
                      />
                      <span
                        className="koma-detect-handle koma-detect-handle--nw koma-render-handle"
                        data-render-handle="corner"
                        data-corner="nw"
                        data-region-id={region.id}
                      />
                      <span
                        className="koma-detect-handle koma-detect-handle--ne koma-render-handle"
                        data-render-handle="corner"
                        data-corner="ne"
                        data-region-id={region.id}
                      />
                      <span
                        className="koma-detect-handle koma-detect-handle--sw koma-render-handle"
                        data-render-handle="corner"
                        data-corner="sw"
                        data-region-id={region.id}
                      />
                      <span
                        className="koma-detect-handle koma-detect-handle--se koma-render-handle"
                        data-render-handle="corner"
                        data-corner="se"
                        data-region-id={region.id}
                      />
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {showRegionOverlays && showSegmentOverlay &&
            segmentOverlayBoxes.map(({ key, box }) => {
              const [sx1, sy1, sx2, sy2] = box;
              return (
                <div
                  key={key}
                  className="koma-detect-seg-box"
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
                  className="koma-detect-tooltip"
                  style={{
                    left: `${centerX}%`,
                    top: `${Math.max(1.5, topY)}%`,
                  }}
                >
                  <div className="koma-detect-tooltip__line">
                    <span className="koma-detect-tooltip__label">
                      {t('detectionPreview.recognized')}
                    </span>
                    <span className="koma-detect-tooltip__value">
                      {tooltip.recognized}
                    </span>
                  </div>
                  <div className="koma-detect-tooltip__line">
                    <span className="koma-detect-tooltip__label">
                      {t('detectionPreview.translated')}
                    </span>
                    <span className="koma-detect-tooltip__value">
                      {tooltip.translated}
                    </span>
                  </div>
                  {translationNotesEnabled && (
                    <div className="koma-detect-tooltip__line">
                      <span className="koma-detect-tooltip__label">{t('detectionPreview.note')}</span>
                      <span className="koma-detect-tooltip__value">
                        {tooltip.notes}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

          <RenderTextPreviewContextMenu
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
            const stageEl = overlay?.closest('.koma-stage');
            const overlayRect = overlay?.getBoundingClientRect();
            const stageRect = stageEl?.getBoundingClientRect();
            if (!overlayRect || !stageRect || !stageEl) {
              return <div ref={dockRef} className="koma-type-dock" style={{ display: 'none' }} />;
            }
            const stageScrollLeft = stageEl.scrollLeft;
            const stageScrollTop = stageEl.scrollTop;
            const dockLeft = overlayRect.left - stageRect.left + stageScrollLeft + dockAnchor.x;
            const dockTop = overlayRect.top - stageRect.top + stageScrollTop + dockAnchor.y;
            return (
              <RenderTextPreviewTypeDock
                dockLeft={dockLeft}
                dockTop={dockTop}
                dockAnchor={dockAnchor}
                dockRef={dockRef}
                dockPointerDownRef={dockPointerDownRef}
                isCompactViewport={isCompactViewport}
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
          })(), overlayRef.current?.closest('.koma-stage') ?? document.body)}

          {draftBox && (
            <div
              className="koma-render-box koma-render-box--draft"
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

// ── Main Component ──

// Targeted comparator: compares stable data props that determine what the
// component renders. Callback props are intentionally EXCLUDED because the
// parent (Dashboard.tsx) passes inline arrow functions that create new
// references on every render. Including them would defeat the memo entirely.
//
// This means the memo will skip re-renders when:
// - Only irrelevant parent state changes (auth, settings, etc.)
// - The preview-relevant data props are unchanged
//
// For full memo benefit, the parent should wrap callbacks in useCallback.
function areEqual(
  prev: Parameters<typeof RenderTextPreview>[0],
  next: Parameters<typeof RenderTextPreview>[0],
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

export default React.memo(RenderTextPreview, areEqual);
