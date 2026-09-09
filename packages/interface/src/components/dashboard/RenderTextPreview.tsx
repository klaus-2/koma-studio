import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronLeft,
  ChevronRight,
  Italic,
  Settings,
  Sparkles,
  Underline,
  X,
} from 'lucide-react';
import './ContextMenu.css';
import { v4 as uuidv4 } from 'uuid';
import RenderTextPreviewContextMenu from './render-text-preview/RenderTextPreviewContextMenu';
import { CircularTextPopover } from '../color/CircularTextPopover';
import { FillStylePopover } from '../color/FillStylePopover';
import { RenderEffectPopover } from '../color/RenderEffectPopover';
import { TextEffectPopover } from '../color/TextEffectPopover';
import { useI18n } from '../../i18n';
import {
  MIN_REGION_SIZE,
  TRANSLATION_NOTE_REGION_PREFIX,
} from '../../constants/dashboard.constants';
import type {
  AioPipelineSnapshotKey,
  AioTextRegion,
  LoadedImage,
  ManualImageEditTool,
  RegionCorner,
  RenderOverlayInteraction,
  SegmentEditTool,
  TranslationNoteOverlayConfig,
  ViewMode,
} from '../../types/dashboard.types';
import type {
  TypographyShape,
  TypographyShapeKind,
  TypographyStyleFolder,
  TypographyStylePreset,
} from '../../typography/types';
import type { RenderTextStyleRange } from '../../typography/renderStyle';
import { createDefaultTypographyShape } from '../../typography/types';
import {
  applyNativeTextEffectPreset,
  isNativeTextEffectPresetId,
  NATIVE_TEXT_EFFECT_PRESETS,
} from '../../typography/textEffects';
import { DEFAULT_RENDER_STYLE } from '../../constants/dashboard.constants';
import {
  buildFillPickerValue,
  parseFillPickerValue,
} from '../../utils/textFillPicker';
import { getRenderModePresetStyle } from '../../utils/renderModes';
import {
  computeRenderTextLayout,
  drawRenderedTextInRegion,
  type RenderTextStyle,
} from '../../utils/renderText';
import {
  applyDetectedGradientToStyle,
  applyRenderDefaultsToRegion,
  applyShadowFillPickerValueToStyle,
  areDockAnchorsEqual,
  buildDefaultRegionRenderText,
  buildShadowFillPickerValue,
  buildTranslationNoteOverlayRegions,
  clamp,
  cloneRenderStyle,
  cn,
  createDefaultShadowLayer,
  ensureCanvasFontLoaded,
  getRegionTranslationNotesForDisplay,
  isTranslationNoteOverlayRegion,
  loadImageFromSource,
  maskCanvasHasVisibleContent,
  normalizeDetectedGradientAngle,
  normalizeRenderRotation,
  normalizeRenderSkew,
  normalizeTranslationNotes,
  rebuildRegionShapeForKind,
  resolveRegionShapeKind,
  scaleTypographyShapeForBounds,
} from '../../utils/dashboard.utils';
import {
  applyInlineRenderTextStylePatch,
  cloneRenderTextStyleRanges,
  remapRenderTextStyleRangesAfterTextEdit,
  resolveRenderTextSelectionStyle,
} from '../../utils/renderTextStyleRanges';
import {
  buildInlineSelectionStylePatch,
  readInlineEditorPlainText,
} from '../../utils/inlineEditor';

const normalizeInlineEditorSelectionBounds = (
  start: number,
  end: number,
): { start: number; end: number } => {
  const safeStart = Math.max(0, Math.floor(start));
  const safeEnd = Math.max(0, Math.floor(end));
  return safeStart <= safeEnd
    ? { start: safeStart, end: safeEnd }
    : { start: safeEnd, end: safeStart };
};

const resolveContentEditableSelectionPoint = (
  root: HTMLElement,
  targetOffset: number,
): { node: Node; offset: number } => {
  const safeOffset = Math.max(0, Math.floor(targetOffset));
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node === root) return NodeFilter.FILTER_SKIP;
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (
          node.nodeType === Node.ELEMENT_NODE
          && (node as Element).tagName === 'BR'
        ) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  let remaining = safeOffset;
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const textLength = current.textContent?.length ?? 0;
      if (remaining <= textLength) {
        return { node: current, offset: remaining };
      }
      remaining -= textLength;
    } else {
      const parent = current.parentNode;
      if (!parent) {
        return { node: root, offset: root.childNodes.length };
      }
      const childIndex = Array.prototype.indexOf.call(parent.childNodes, current);
      if (remaining <= 1) {
        return { node: parent, offset: childIndex + 1 };
      }
      remaining -= 1;
    }
    current = walker.nextNode();
  }

  const lastChild = root.lastChild;
  if (lastChild?.nodeType === Node.TEXT_NODE) {
    return {
      node: lastChild,
      offset: lastChild.textContent?.length ?? 0,
    };
  }

  return { node: root, offset: root.childNodes.length };
};

const restoreContentEditableSelection = (
  root: HTMLElement,
  start: number,
  end: number,
): void => {
  const selection = window.getSelection();
  if (!selection) return;

  const bounds = normalizeInlineEditorSelectionBounds(start, end);
  const startPoint = resolveContentEditableSelectionPoint(root, bounds.start);
  const endPoint = resolveContentEditableSelectionPoint(root, bounds.end);
  const range = document.createRange();

  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  selection.removeAllRanges();
  selection.addRange(range);
};

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
  availableTypographyPresets = [],
  availableTypographyFolders = [],
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
  multiSelectedRegionIds = [],
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
  segmentEditTool?: SegmentEditTool;
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
  const regionsWithDefaultsRef = useRef<AioTextRegion[]>([]);
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
  const [contextMenu, setContextMenu] = useState<{
    regionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [contextSubmenu, setContextSubmenu] = useState<'presets' | null>(null);
  const [presetSearch, setPresetSearch] = useState("");
  const [presetFolderFilter, setPresetFolderFilter] = useState<string | null>(null);
  const [inlineEditor, setInlineEditor] = useState<{
    regionId: string;
    value: string;
    originalValue: string;
    originalStyleRanges?: RenderTextStyleRange[];
    isDirty: boolean;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const [dockExpanded, setDockExpanded] = useState(false);
  const [dockAnchor, setDockAnchor] = useState<{
    x: number;
    y: number;
    placement: 'right' | 'left' | 'top' | 'bottom';
  } | null>(null);
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

  const canUseManualImageTools = useMemo(
    () =>
      manualEditEnabled &&
      editable &&
      (enableManualImageTools || stageBadgeKey === 'render'),
    [manualEditEnabled, editable, enableManualImageTools, stageBadgeKey],
  );
  const activeManualImageTool: ManualImageEditTool = useMemo(
    () => (canUseManualImageTools ? manualImageTool : 'none'),
    [canUseManualImageTools, manualImageTool],
  );
  const showSegmentOverlay = useMemo(
    () => segmentEditEnabled || stageBadgeKey === 'segmentText',
    [segmentEditEnabled, stageBadgeKey],
  );
  const isBrushCursorActive = useMemo(
    () =>
      (segmentEditEnabled && editable && (segmentEditTool === 'brush' || segmentEditTool === 'eraser')) ||
      activeManualImageTool === 'paint' ||
      activeManualImageTool === 'paint_eraser' ||
      activeManualImageTool === 'healing_brush',
    [segmentEditEnabled, editable, segmentEditTool, activeManualImageTool],
  );

  const activeBrushCursorSize = useMemo(
    () =>
      segmentEditEnabled && editable && segmentEditTool !== 'select'
        ? (segmentBrushSize ?? 28)
        : manualBrushSize,
    [segmentEditEnabled, editable, segmentEditTool, segmentBrushSize, manualBrushSize],
  );

  const manualOverlayCursor = useMemo(
    () =>
      isBrushCursorActive
        ? 'none'
        : segmentEditEnabled && editable && segmentEditTool !== 'select'
          ? segmentEditTool === 'brush'
            ? 'crosshair'
            : 'cell'
          : activeManualImageTool === 'magic_wand'
            ? 'copy'
            : editable && areaSelectionEnabled
              ? 'crosshair'
              : 'default',
    [isBrushCursorActive, segmentEditEnabled, editable, segmentEditTool, activeManualImageTool, areaSelectionEnabled],
  );

  const updateBrushCursor = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const cursor = brushCursorRef.current;
      if (!cursor) return;
      const diameter = activeBrushCursorSize * rotationScaleFactor * zoom;
      const r = diameter / 2;
      // Size: only update if changed (avoids layout thrash)
      if (cursor.dataset.size !== String(diameter)) {
        cursor.style.width = `${diameter}px`;
        cursor.style.height = `${diameter}px`;
        cursor.dataset.size = String(diameter);
      }
      // Position: use transform for GPU-composited movement
      cursor.style.transform = `translate(${e.clientX - r}px, ${e.clientY - r}px)`;
      cursor.style.display = 'block';
    },
    [activeBrushCursorSize, rotationScaleFactor, zoom],
  );

  const hideBrushCursor = useCallback(() => {
    if (brushCursorRef.current) brushCursorRef.current.style.display = 'none';
  }, []);

  const regionsWithDefaults = useMemo(
    () =>
      regions.map((region) =>
        applyRenderDefaultsToRegion(
          region,
          fallbackStyle,
          applyDetectedGradientToStyle,
        ),
      ),
    [fallbackStyle, regions],
  );
  regionsWithDefaultsRef.current = regionsWithDefaults;
  const noteOverlayRegions = useMemo(
    () =>
      buildTranslationNoteOverlayRegions(
        regionsWithDefaults,
        image.width,
        image.height,
        fallbackStyle,
        translationNotesEnabled,
      ),
    [
      fallbackStyle,
      image.height,
      image.width,
      regionsWithDefaults,
      translationNotesEnabled,
    ],
  );
  const displayRegionsWithDefaults = useMemo(
    () => [...regionsWithDefaults, ...noteOverlayRegions],
    [noteOverlayRegions, regionsWithDefaults],
  );
  const regionsWithDefaultsById = useMemo(() => {
    const next = new Map<string, AioTextRegion>();
    regionsWithDefaults.forEach((region) => {
      next.set(region.id, region);
    });
    return next;
  }, [regionsWithDefaults]);
  const displayRegionById = useMemo(() => {
    const next = new Map<string, AioTextRegion>();
    displayRegionsWithDefaults.forEach((region) => {
      next.set(region.id, region);
    });
    return next;
  }, [displayRegionsWithDefaults]);
  const getTranslationNoteOverlayParentId = useCallback(
    (regionId: string): string | null =>
      regionId.startsWith(TRANSLATION_NOTE_REGION_PREFIX)
        ? regionId.slice(TRANSLATION_NOTE_REGION_PREFIX.length)
        : null,
    [],
  );
  const resolveTranslationNoteOverlayConfig = useCallback(
    (region: AioTextRegion): TranslationNoteOverlayConfig | null => {
      const notes = normalizeTranslationNotes(region.translationNotes);
      if (!notes || notes.length === 0) return null;
      if (region.translationNoteOverlay) {
        return {
          bbox: [...region.translationNoteOverlay.bbox] as [
            number,
            number,
            number,
            number,
          ],
          renderText: region.translationNoteOverlay.renderText,
          renderStyle: region.translationNoteOverlay.renderStyle
            ? cloneRenderStyle(region.translationNoteOverlay.renderStyle)
            : undefined,
          renderTextStyleRanges: cloneRenderTextStyleRanges(
            region.translationNoteOverlay.renderTextStyleRanges,
          ),
        };
      }
      const defaultOverlay = buildTranslationNoteOverlayRegions(
        [
          applyRenderDefaultsToRegion(
            region,
            fallbackStyle,
            applyDetectedGradientToStyle,
          ),
        ],
        image.width,
        image.height,
        fallbackStyle,
        true,
      )[0];
      if (!defaultOverlay) return null;
      return {
        bbox: [...defaultOverlay.bbox] as [number, number, number, number],
        renderText: defaultOverlay.renderText ?? '',
        renderStyle: defaultOverlay.renderStyle
          ? cloneRenderStyle(defaultOverlay.renderStyle)
          : undefined,
        renderTextStyleRanges: cloneRenderTextStyleRanges(
          defaultOverlay.renderTextStyleRanges,
        ),
      };
    },
    [fallbackStyle, image.height, image.width],
  );

  const updateRegions = useCallback(
    (updater: (region: AioTextRegion) => AioTextRegion) => {
      onRegionsChange(regionsWithDefaultsRef.current.map(updater));
    },
    [onRegionsChange],
  );

  const toImagePoint = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const node = overlayRef.current;
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const normalizedX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const normalizedY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const rotation = ((image.rotation % 360) + 360) % 360;
      let localX = normalizedX;
      let localY = normalizedY;
      if (rotation === 90) {
        localX = 1 - normalizedY;
        localY = normalizedX;
      } else if (rotation === 180) {
        localX = 1 - normalizedX;
        localY = 1 - normalizedY;
      } else if (rotation === 270) {
        localX = normalizedY;
        localY = 1 - normalizedX;
      }
      const isSideways = rotation === 90 || rotation === 270;
      const scaleX = isSideways
        ? image.width / rect.height
        : image.width / rect.width;
      const scaleY = isSideways
        ? image.height / rect.width
        : image.height / rect.height;
      return {
        x: localX * image.width,
        y: localY * image.height,
        scale: Math.max(scaleX, scaleY),
      };
    },
    [image.height, image.rotation, image.width],
  );

  const drawSegBrushOnCanvas = useCallback(
    (x: number, y: number, radius: number, erase: boolean) => {
      const canvas = segBrushCanvasRef.current;
      const container = overlayRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scaleX = canvas.width / image.width;
      const scaleY = canvas.height / image.height;
      const r = Math.max(1, radius * scaleX);
      const cx = x * scaleX;
      const cy = y * scaleY;
      const last = segBrushLastRef.current;
      ctx.save();
      if (erase) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(248,113,113,0.55)';
        ctx.strokeStyle = 'rgba(248,113,113,0.55)';
      }
      if (last) {
        ctx.lineWidth = r * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(last.x * scaleX, last.y * scaleY);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      segBrushLastRef.current = { x, y };
    },
    [image.width, image.height],
  );

  const redrawSegBrushCanvas = useCallback(() => {
    const canvas = segBrushCanvasRef.current;
    const container = overlayRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const newW = Math.round(rect.width);
    const newH = Math.round(rect.height);
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, newW, newH);
    const savedUrl = segBrushDataUrlRef.current;
    if (!savedUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, newW, newH);
    img.src = savedUrl;
  }, []);

  const drawManualStroke = useCallback(
    (
      canvas: HTMLCanvasElement | null,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      options: {
        size: number;
        color: string;
        erase: boolean;
        opacity: number;
        blur: number;
      },
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, options.size);
      ctx.globalAlpha = clamp(options.opacity, 0.01, 1);
      ctx.filter =
        options.blur > 0
          ? `blur(${Math.max(0, options.blur).toFixed(1)}px)`
          : 'none';
      if (options.erase) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.fillStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = options.color;
        ctx.fillStyle = options.color;
      }
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(toX, toY, Math.max(0.5, options.size / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    [],
  );

  const commitPaintLayer = useCallback(() => {
    const paintCanvas = paintCanvasRef.current;
    if (!paintCanvas) return;
    const hasContent = maskCanvasHasVisibleContent(paintCanvas);
    if (!hasContent) {
      onManualPaintLayerChange(null);
      return;
    }
    onManualPaintLayerChange(paintCanvas.toDataURL('image/png'));
  }, [onManualPaintLayerChange]);

  const clearHealingMaskCanvas = useCallback(() => {
    const maskCanvas = healingMaskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, []);

  const commitHealingMask = useCallback(() => {
    const maskCanvas = healingMaskCanvasRef.current;
    if (!maskCanvas) return;
    if (!maskCanvasHasVisibleContent(maskCanvas)) {
      clearHealingMaskCanvas();
      return;
    }
    const maskDataUrl = maskCanvas.toDataURL('image/png');
    void onManualHealingMaskCommit(maskDataUrl).finally(() => {
      clearHealingMaskCanvas();
    });
  }, [clearHealingMaskCanvas, onManualHealingMaskCommit]);

  const stopWandMaskAnimation = useCallback(() => {
    if (wandMaskAnimationTimerRef.current !== null) {
      cancelAnimationFrame(wandMaskAnimationTimerRef.current);
      wandMaskAnimationTimerRef.current = null;
    }
  }, []);

  // Pause wand mask animation when the component is off-screen to save GPU/CPU.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          stopWandMaskAnimation();
        }
      },
      { threshold: 0.01 },
    );
    observer.observe(overlay);
    return () => {
      observer.disconnect();
      stopWandMaskAnimation();
    };
  }, [stopWandMaskAnimation]);

  useEffect(() => {
    if (contextSubmenu !== 'presets') {
      setPresetSearch('');
      setPresetFolderFilter(null);
    }
  }, [contextSubmenu]);

  useEffect(() => {
    const paintCanvas = paintCanvasRef.current;
    if (!paintCanvas) return;
    paintCanvas.width = image.width;
    paintCanvas.height = image.height;
    const ctx = paintCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    if (!manualPaintLayerDataUrl) return;
    let cancelled = false;
    void loadImageFromSource(manualPaintLayerDataUrl)
      .then((layerImage) => {
        if (cancelled) return;
        ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
        ctx.drawImage(layerImage, 0, 0, paintCanvas.width, paintCanvas.height);
      })
      .catch(() => {
        if (cancelled) return;
        ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
      });
    return () => {
      cancelled = true;
    };
  }, [image.height, image.width, manualPaintLayerDataUrl]);

  useEffect(() => {
    const maskCanvas = healingMaskCanvasRef.current;
    if (!maskCanvas) return;
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, [image.height, image.width]);

  useEffect(() => {
    const overlayCanvas = wandMaskOverlayCanvasRef.current;
    if (!overlayCanvas) return;
    overlayCanvas.width = image.width;
    overlayCanvas.height = image.height;
    const overlayCtx = overlayCanvas.getContext('2d', { willReadFrequently: true });
    if (!overlayCtx) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }, [image.height, image.width]);

  useEffect(() => {
    const overlayCanvas = wandMaskOverlayCanvasRef.current;
    if (!overlayCanvas) return;
    const overlayCtx = overlayCanvas.getContext('2d', { willReadFrequently: true });
    if (!overlayCtx) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!manualWandMaskDataUrl) return;
    let cancelled = false;
    void loadImageFromSource(manualWandMaskDataUrl)
      .then((maskImage) => {
        if (cancelled) return;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = overlayCanvas.width;
        maskCanvas.height = overlayCanvas.height;
        const maskCtx = maskCanvas.getContext('2d', {
          willReadFrequently: true,
        });
        if (!maskCtx) return;
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);

        const maskImageData = maskCtx.getImageData(
          0,
          0,
          maskCanvas.width,
          maskCanvas.height,
        );
        // Free GPU texture memory immediately after extracting pixel data.
        maskCanvas.width = 0;
        maskCanvas.height = 0;

        const { width, height, data } = maskImageData;
        const totalPixels = width * height;
        const selected = new Uint8Array(totalPixels);
        for (let pixel = 0; pixel < totalPixels; pixel += 1) {
          const offset = pixel * 4;
          const alpha = data[offset + 3] ?? 0;
          const rgbSum =
            (data[offset] ?? 0) +
            (data[offset + 1] ?? 0) +
            (data[offset + 2] ?? 0);
          if (alpha > 18 || rgbSum > 18) {
            selected[pixel] = 1;
          }
        }

        wandMaskSelectedRef.current = selected;

        const border = new Uint8Array(totalPixels);
        for (let pixel = 0; pixel < totalPixels; pixel += 1) {
          if (selected[pixel] === 0) continue;
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          if (
            x === 0 ||
            y === 0 ||
            x === width - 1 ||
            y === height - 1 ||
            selected[pixel - 1] === 0 ||
            selected[pixel + 1] === 0 ||
            selected[pixel - width] === 0 ||
            selected[pixel + width] === 0
          ) {
            border[pixel] = 1;
          }
        }

        const thickBorder = new Uint8Array(totalPixels);
        for (let pixel = 0; pixel < totalPixels; pixel += 1) {
          if (selected[pixel] === 0) continue;
          const x = pixel % width;
          const y = Math.floor(pixel / width);
          if (border[pixel] === 1) {
            thickBorder[pixel] = 1;
            continue;
          }
          if (
            (x > 0 && border[pixel - 1] === 1) ||
            (x < width - 1 && border[pixel + 1] === 1) ||
            (y > 0 && border[pixel - width] === 1) ||
            (y < height - 1 && border[pixel + width] === 1)
          ) {
            thickBorder[pixel] = 1;
          }
        }

        const buildFrame = (phase: number): ImageData => {
          const frame = overlayCtx.createImageData(width, height);
          const frameData = frame.data;
          for (let pixel = 0; pixel < totalPixels; pixel += 1) {
            if (selected[pixel] === 0) continue;
            const offset = pixel * 4;
            const x = pixel % width;
            const y = Math.floor(pixel / width);

            if (thickBorder[pixel] === 1) {
              const dashOn = (x + y + phase) % 12 < 6;
              const dashColor = dashOn ? 255 : 12;
              frameData[offset] = dashColor;
              frameData[offset + 1] = dashColor;
              frameData[offset + 2] = dashColor;
              frameData[offset + 3] = 255;
              continue;
            }

            const stripe = (x + y * 2 + phase * 2) % 20 < 10;
            frameData[offset] = stripe ? 18 : 8;
            frameData[offset + 1] = stripe ? 176 : 146;
            frameData[offset + 2] = stripe ? 255 : 248;
            frameData[offset + 3] = stripe ? 150 : 124;
          }
          return frame;
        };

        const frameA = buildFrame(0);
        const frameB = buildFrame(6);
        overlayCtx.putImageData(frameA, 0, 0);
        let useFrameA = false;
        const ANIMATION_INTERVAL_MS = 120;
        let lastFrameTime = 0;
        const animate = (timestamp: number) => {
          if (cancelled) return;
          if (timestamp - lastFrameTime >= ANIMATION_INTERVAL_MS) {
            overlayCtx.putImageData(useFrameA ? frameA : frameB, 0, 0);
            useFrameA = !useFrameA;
            lastFrameTime = timestamp;
          }
          wandMaskAnimationTimerRef.current = requestAnimationFrame(animate);
        };
        wandMaskAnimationTimerRef.current = requestAnimationFrame(animate);
      })
      .catch(() => {
        if (cancelled) return;
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      });

    return () => {
      cancelled = true;
      stopWandMaskAnimation();
      wandMaskSelectedRef.current = null;
    };
  }, [image.height, image.width, manualWandMaskDataUrl, stopWandMaskAnimation]);

  const findRegionAtPoint = useCallback(
    (x: number, y: number): AioTextRegion | null => {
      for (
        let idx = displayRegionsWithDefaults.length - 1;
        idx >= 0;
        idx -= 1
      ) {
        const region = displayRegionsWithDefaults[idx];
        if (!region) continue;
        const [x1, y1, x2, y2] = region.bbox;
        if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return region;
      }
      return null;
    },
    [displayRegionsWithDefaults],
  );

  const getRegionRotation = useCallback(
    (region: AioTextRegion): number =>
      normalizeRenderRotation(
        cloneRenderStyle(region.renderStyle ?? fallbackStyle).rotation || 0,
      ),
    [fallbackStyle],
  );

  const rotatePoint = useCallback(
    (
      px: number,
      py: number,
      centerX: number,
      centerY: number,
      angleDeg: number,
    ): { x: number; y: number } => {
      if (Math.abs(angleDeg) <= 0.001) return { x: px, y: py };
      const radians = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const dx = px - centerX;
      const dy = py - centerY;
      return {
        x: centerX + (dx * cos - dy * sin),
        y: centerY + (dx * sin + dy * cos),
      };
    },
    [],
  );

  const getOppositeCorner = useCallback(
    (corner: RegionCorner): RegionCorner => {
      if (corner === 'nw') return 'se';
      if (corner === 'ne') return 'sw';
      if (corner === 'sw') return 'ne';
      return 'nw';
    },
    [],
  );

  const getRegionCornerPoint = useCallback(
    (region: AioTextRegion, corner: RegionCorner): { x: number; y: number } => {
      const [x1, y1, x2, y2] = region.bbox;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const rotation = getRegionRotation(region);
      if (corner === 'nw')
        return rotatePoint(x1, y1, centerX, centerY, rotation);
      if (corner === 'ne')
        return rotatePoint(x2, y1, centerX, centerY, rotation);
      if (corner === 'sw')
        return rotatePoint(x1, y2, centerX, centerY, rotation);
      return rotatePoint(x2, y2, centerX, centerY, rotation);
    },
    [getRegionRotation, rotatePoint],
  );

  const detectCornerHit = useCallback(
    (
      region: AioTextRegion,
      x: number,
      y: number,
      radius: number,
    ): RegionCorner | null => {
      const corners: Array<{ key: RegionCorner; cx: number; cy: number }> = [
        (() => {
          const point = getRegionCornerPoint(region, 'nw');
          return { key: 'nw' as const, cx: point.x, cy: point.y };
        })(),
        (() => {
          const point = getRegionCornerPoint(region, 'ne');
          return { key: 'ne' as const, cx: point.x, cy: point.y };
        })(),
        (() => {
          const point = getRegionCornerPoint(region, 'sw');
          return { key: 'sw' as const, cx: point.x, cy: point.y };
        })(),
        (() => {
          const point = getRegionCornerPoint(region, 'se');
          return { key: 'se' as const, cx: point.x, cy: point.y };
        })(),
      ];
      for (const corner of corners) {
        if (
          Math.abs(x - corner.cx) <= radius &&
          Math.abs(y - corner.cy) <= radius
        )
          return corner.key;
      }
      return null;
    },
    [getRegionCornerPoint],
  );

  const detectRotateHandleHit = useCallback(
    (
      region: AioTextRegion,
      x: number,
      y: number,
      radius: number,
      offset: number,
    ): { centerX: number; centerY: number } | null => {
      const [x1, y1, x2, y2] = region.bbox;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const rotation = getRegionRotation(region);
      const handle = rotatePoint(
        (x1 + x2) / 2,
        y1 - offset,
        centerX,
        centerY,
        rotation,
      );
      const dx = x - handle.x;
      const dy = y - handle.y;
      if (dx * dx + dy * dy <= radius * radius) {
        return { centerX, centerY };
      }
      return null;
    },
    [getRegionRotation, rotatePoint],
  );

  const updateRegionBox = useCallback(
    (regionId: string, nextBox: [number, number, number, number]) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          return {
            ...region,
            bbox: nextBox,
            shape: scaleTypographyShapeForBounds(
              region.shape,
              region.bbox,
              nextBox,
            ),
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            bbox: nextBox,
          },
        };
      });
    },
    [
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const updateRegionText = useCallback(
    (regionId: string, nextText: string) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const baseStyle = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderText: nextText,
            renderStyle: baseStyle,
            renderTextStyleRanges: remapRenderTextStyleRangesAfterTextEdit(
              region.renderText ?? '',
              nextText,
              baseStyle,
              region.renderTextStyleRanges,
            ),
            source: region.source ?? 'manual',
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const baseStyle = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderText: nextText,
            renderStyle: baseStyle,
            renderTextStyleRanges: remapRenderTextStyleRangesAfterTextEdit(
              overlay.renderText ?? '',
              nextText,
              baseStyle,
              overlay.renderTextStyleRanges,
            ),
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const setRegionSkew = useCallback(
    (regionId: string, nextSkewX: number, nextSkewY: number) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderStyle: {
              ...style,
              skewX: normalizeRenderSkew(nextSkewX),
              skewY: normalizeRenderSkew(nextSkewY),
            },
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const style = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderStyle: {
              ...style,
              skewX: normalizeRenderSkew(nextSkewX),
              skewY: normalizeRenderSkew(nextSkewY),
            },
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const setRegionRotation = useCallback(
    (regionId: string, nextRotation: number) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(nextRotation),
            },
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const style = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(nextRotation),
            },
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const updateRegionRotation = useCallback(
    (regionId: string, deltaDegrees: number) => {
      if (!Number.isFinite(deltaDegrees) || Math.abs(deltaDegrees) < 0.001)
        return;
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(
                (style.rotation || 0) + deltaDegrees,
              ),
            },
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const style = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderStyle: {
              ...style,
              rotation: normalizeRenderRotation(
                (style.rotation || 0) + deltaDegrees,
              ),
            },
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const updateRegionStyle = useCallback(
    (
      regionId: string,
      updater: (style: RenderTextStyle) => RenderTextStyle,
    ) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId && region.id !== regionId) return region;
        if (parentId && region.id !== parentId) return region;
        const overlay = parentId
          ? resolveTranslationNoteOverlayConfig(region)
          : null;
        const currentStyle = cloneRenderStyle(
          parentId
            ? (overlay?.renderStyle ?? fallbackStyle)
            : (region.renderStyle ?? fallbackStyle),
        );
        const nextStyle = cloneRenderStyle(updater(currentStyle));
        const nextFontSize = Math.max(6, Math.round(nextStyle.fontSize));
        const nextMinFontSize = clamp(
          Math.round(nextStyle.minFontSize),
          6,
          nextFontSize,
        );
        const nextOpacity = clamp(Number(nextStyle.opacity), 0, 1);
        const nextOutlineOpacity = clamp(
          Number(nextStyle.outlineOpacity ?? 1),
          0,
          1,
        );
        const nextShadowOpacity = clamp(
          Number(nextStyle.shadowOpacity ?? 1),
          0,
          1,
        );
        const nextShadowBlur = clamp(Number(nextStyle.shadowBlur), 0, 40);
        const nextShadowOffsetX = clamp(
          Number(nextStyle.shadowOffsetX),
          -40,
          40,
        );
        const nextShadowOffsetY = clamp(
          Number(nextStyle.shadowOffsetY),
          -40,
          40,
        );
        const sanitizedStyle: RenderTextStyle = {
          ...nextStyle,
          fontSize: nextFontSize,
          minFontSize: nextMinFontSize,
          autoFontSize: nextStyle.autoFontSize !== false,
          lineSpacing: clamp(nextStyle.lineSpacing, 0.6, 2.5),
          textOrientation:
            nextStyle.textOrientation === 'vertical'
              ? 'vertical'
              : 'horizontal',
          textPathMode:
            nextStyle.textPathMode === 'circular' ? 'circular' : 'normal',
          circularRadiusScale: clamp(
            Number(nextStyle.circularRadiusScale ?? 0.78),
            0.2,
            1.2,
          ),
          circularStartAngle: normalizeRenderRotation(
            Number(nextStyle.circularStartAngle ?? -90),
          ),
          circularLetterSpacing: clamp(
            Number(nextStyle.circularLetterSpacing ?? 1),
            0.5,
            2.5,
          ),
          outlineWidth: clamp(nextStyle.outlineWidth, 0, 10),
          opacity: Number.isFinite(nextOpacity) ? nextOpacity : 1,
          outlineOpacity: Number.isFinite(nextOutlineOpacity)
            ? nextOutlineOpacity
            : 1,
          shadowEnabled: Boolean(nextStyle.shadowEnabled),
          shadowFillCssValue: nextStyle.shadowFillCssValue
            ? String(nextStyle.shadowFillCssValue).trim()
            : String(nextStyle.shadowColor || '#000000'),
          shadowGradientEnabled: Boolean(nextStyle.shadowGradientEnabled),
          shadowGradientStartColor: String(
            nextStyle.shadowGradientStartColor ||
              nextStyle.shadowColor ||
              '#000000',
          ),
          shadowGradientEndColor: String(
            nextStyle.shadowGradientEndColor ||
              nextStyle.shadowColor ||
              '#000000',
          ),
          shadowGradientAngle: normalizeDetectedGradientAngle(
            nextStyle.shadowGradientAngle ?? 90,
          ),
          shadowOpacity: Number.isFinite(nextShadowOpacity)
            ? nextShadowOpacity
            : 1,
          shadowBlur: Number.isFinite(nextShadowBlur) ? nextShadowBlur : 0,
          shadowOffsetX: Number.isFinite(nextShadowOffsetX)
            ? nextShadowOffsetX
            : 0,
          shadowOffsetY: Number.isFinite(nextShadowOffsetY)
            ? nextShadowOffsetY
            : 0,
          skewX: normalizeRenderSkew(nextStyle.skewX),
          skewY: normalizeRenderSkew(nextStyle.skewY),
          gradientEnabled: Boolean(nextStyle.gradientEnabled),
          gradientStartColor: String(
            nextStyle.gradientStartColor || nextStyle.color || '#111111',
          ),
          gradientEndColor: String(
            nextStyle.gradientEndColor || nextStyle.color || '#111111',
          ),
          gradientAngle: normalizeDetectedGradientAngle(
            nextStyle.gradientAngle,
          ),
          detectGradient: nextStyle.detectGradient !== false,
          textEffectPreset: isNativeTextEffectPresetId(
            nextStyle.textEffectPreset,
          )
            ? nextStyle.textEffectPreset
            : 'none',
          textEffectIntensity: clamp(
            Number(nextStyle.textEffectIntensity ?? 1),
            0,
            2,
          ),
          hyphenationEnabled: nextStyle.hyphenationEnabled === true,
          rotation: normalizeRenderRotation(nextStyle.rotation),
        };
        if (parentId) {
          if (!overlay) return region;
          return {
            ...region,
            translationNoteOverlay: {
              ...overlay,
              renderStyle: sanitizedStyle,
            },
          };
        }
        return {
          ...region,
          renderStyle: sanitizedStyle,
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const updateRegionTextStyleRanges = useCallback(
    (
      regionId: string,
      start: number,
      end: number,
      patch: Partial<RenderTextStyle>,
    ) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      updateRegions((region) => {
        if (!parentId) {
          if (region.id !== regionId) return region;
          const baseStyle = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          return {
            ...region,
            renderTextStyleRanges: applyInlineRenderTextStylePatch(
              region.renderText ?? '',
              baseStyle,
              region.renderTextStyleRanges,
              start,
              end,
              patch,
            ),
          };
        }
        if (region.id !== parentId) return region;
        const overlay = resolveTranslationNoteOverlayConfig(region);
        if (!overlay) return region;
        const baseStyle = cloneRenderStyle(overlay.renderStyle ?? fallbackStyle);
        return {
          ...region,
          translationNoteOverlay: {
            ...overlay,
            renderTextStyleRanges: applyInlineRenderTextStylePatch(
              overlay.renderText ?? '',
              baseStyle,
              overlay.renderTextStyleRanges,
              start,
              end,
              patch,
            ),
          },
        };
      });
    },
    [
      fallbackStyle,
      getTranslationNoteOverlayParentId,
      resolveTranslationNoteOverlayConfig,
      updateRegions,
    ],
  );

  const restoreInlineEditorSelection = useCallback(() => {
    if (!inlineEditor) return;
    requestAnimationFrame(() => {
      const node = inlineEditorContentEditableRef.current;
      if (!node) return;
      node.focus();
      restoreContentEditableSelection(
        node,
        inlineEditor.selectionStart,
        inlineEditor.selectionEnd,
      );
    });
  }, [inlineEditor]);

  const openInlineEditorForRegion = useCallback(
    (region: AioTextRegion) => {
      if (!editable || !renderStageActive) return;
      const initialText = region.renderText ?? '';
      onSelectRegion(region.id);
      setContextMenu(null);
      setInlineEditor({
        regionId: region.id,
        value: initialText,
        originalValue: initialText,
        originalStyleRanges: cloneRenderTextStyleRanges(
          region.renderTextStyleRanges,
        ),
        isDirty: false,
        selectionStart: initialText.length,
        selectionEnd: initialText.length,
      });
    },
    [editable, onSelectRegion, renderStageActive],
  );

  const saveInlineEditor = useCallback(() => {
    if (!inlineEditor) return;
    savedSelectionRef.current = null;
    isPickerOpenRef.current = false;
    updateRegionText(inlineEditor.regionId, inlineEditor.value);
    setInlineEditor(null);
  }, [inlineEditor, updateRegionText]);

  const cancelInlineEditor = useCallback(() => {
    if (!inlineEditor) return;
    savedSelectionRef.current = null;
    isPickerOpenRef.current = false;
    const parentId = getTranslationNoteOverlayParentId(inlineEditor.regionId);
    updateRegions((region) => {
      if (!parentId) {
        if (region.id !== inlineEditor.regionId) return region;
        return {
          ...region,
          renderText: inlineEditor.originalValue,
          renderTextStyleRanges: cloneRenderTextStyleRanges(
            inlineEditor.originalStyleRanges,
          ),
        };
      }
      if (region.id !== parentId) return region;
      const overlay = resolveTranslationNoteOverlayConfig(region);
      if (!overlay) return region;
      return {
        ...region,
        translationNoteOverlay: {
          ...overlay,
          renderText: inlineEditor.originalValue,
          renderTextStyleRanges: cloneRenderTextStyleRanges(
            inlineEditor.originalStyleRanges,
          ),
        },
      };
    });
    setInlineEditor(null);
  }, [
    getTranslationNoteOverlayParentId,
    inlineEditor,
    resolveTranslationNoteOverlayConfig,
    updateRegions,
  ]);

  const handleInlineEditorInput = useCallback(
    (nextValue: string) => {
      if (!inlineEditor) return;
      updateRegionText(inlineEditor.regionId, nextValue);
      setInlineEditor((prev) =>
        prev
          ? {
              ...prev,
              value: nextValue,
              isDirty: nextValue !== prev.originalValue,
            }
          : prev,
      );
    },
    [inlineEditor, updateRegionText],
  );

  const getInlineEditorSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const contentEditable = inlineEditorContentEditableRef.current;
    if (!contentEditable || !contentEditable.contains(range.startContainer)) return null;

    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(contentEditable);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + range.toString().length;
    return { start, end };
  }, []);

  const syncInlineEditorSelection = useCallback(() => {
    const selection = getInlineEditorSelection();
    if (!selection) return;
    
    // Don't clear saved selection while picker is open
    if (!isPickerOpenRef.current) {
      savedSelectionRef.current = null;
    } else {
    }
    
    setInlineEditor((prev) =>
      prev
        ? {
            ...prev,
            selectionStart: Math.min(selection.start, prev.value.length),
            selectionEnd: Math.min(selection.end, prev.value.length),
          }
        : prev,
    );
  }, [getInlineEditorSelection]);

  const saveCurrentSelection = useCallback(() => {
    const selection = getInlineEditorSelection();
    isPickerOpenRef.current = true;
    if (selection && selection.start !== selection.end) {
      savedSelectionRef.current = selection;
    } else {
    }
    return savedSelectionRef.current;
  }, [getInlineEditorSelection]);

  const clearPickerState = useCallback(() => {
    isPickerOpenRef.current = false;
    savedSelectionRef.current = null;
  }, []);

  useEffect(() => {
    if (!inlineEditor) return;
    const exists = displayRegionsWithDefaults.some(
      (region) => region.id === inlineEditor.regionId,
    );
    if (!exists) {
      setInlineEditor(null);
    }
  }, [displayRegionsWithDefaults, inlineEditor]);

  useEffect(() => {
    if (!inlineEditor) return;
    if (!editable || !renderStageActive || !areaSelectionEnabled) {
      setInlineEditor(null);
    }
  }, [areaSelectionEnabled, editable, inlineEditor, renderStageActive]);

  useEffect(() => {
    if (!inlineEditor) return;
    requestAnimationFrame(() => {
      const node = inlineEditorContentEditableRef.current;
      if (!node) return;
      node.focus();
      restoreContentEditableSelection(
        node,
        inlineEditor.selectionStart,
        inlineEditor.selectionEnd,
      );
    });
  }, [
    inlineEditor?.regionId,
  ]);

  useLayoutEffect(() => {
    if (!inlineEditor) return;
    const node = inlineEditorContentEditableRef.current;
    if (!node) return;
    const currentValue = readInlineEditorPlainText(node);
    if (currentValue === inlineEditor.value) return;
    node.textContent = inlineEditor.value;
    restoreContentEditableSelection(
      node,
      inlineEditor.selectionStart,
      inlineEditor.selectionEnd,
    );
  }, [
    inlineEditor?.regionId,
    inlineEditor?.selectionEnd,
    inlineEditor?.selectionStart,
    inlineEditor?.value,
  ]);

  useEffect(() => {
    const clearDockPointerState = () => {
      dockPointerDownRef.current = false;
    };
    window.addEventListener('pointerup', clearDockPointerState);
    window.addEventListener('pointercancel', clearDockPointerState);
    return () => {
      window.removeEventListener('pointerup', clearDockPointerState);
      window.removeEventListener('pointercancel', clearDockPointerState);
    };
  }, []);

  const getTooltipContent = useCallback(
    (
      region: AioTextRegion,
    ): { recognized: string; translated: string; notes: string } => {
      const recognized = (region.recognizedText ?? '').trim();
      const translated = (region.translatedText ?? '').trim();
      const notes = getRegionTranslationNotesForDisplay(
        region,
        translationNotesEnabled,
      );
      return {
        recognized:
          recognized.length > 0 ? recognized : t('dashboard.render.noRecognizedText'),
        translated:
          translated.length > 0 ? translated : t('dashboard.render.noTranslation'),
        notes: notes.length > 0 ? notes.join(' | ') : t('dashboard.render.noNotes'),
      };
    },
    [translationNotesEnabled, t],
  );

  useEffect(() => {
    const container = overlayRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => redrawSegBrushCanvas());
    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawSegBrushCanvas]);

  useEffect(() => {
    segBrushDataUrlRef.current = segmentBrushDataUrl ?? null;
    redrawSegBrushCanvas();
  }, [segmentBrushDataUrl, redrawSegBrushCanvas]);

  const copyTextToClipboard = useCallback(async (text: string) => {
    const normalized = text.trim();
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized);
      return;
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = normalized;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, []);

  const handleRegionContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, region: AioTextRegion) => {
      event.preventDefault();
      event.stopPropagation();
      onCardSelect();
      if (!areaSelectionEnabled) return;
      onSelectRegion(region.id);
      const node = overlayRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const x = clamp(
        event.clientX - rect.left,
        6,
        Math.max(6, rect.width - 6),
      );
      const y = clamp(
        event.clientY - rect.top,
        6,
        Math.max(6, rect.height - 6),
      );
      setContextMenu({ regionId: region.id, x, y });
      setContextSubmenu(null);
      setHoveredRegionId(region.id);
    },
    [areaSelectionEnabled, onCardSelect, onSelectRegion],
  );

  const handleContextCopyRecognized = useCallback(() => {
    if (!contextMenu) return;
    const region = displayRegionsWithDefaults.find(
      (item) => item.id === contextMenu.regionId,
    );
    if (!region) return;
    void copyTextToClipboard(region.recognizedText ?? '');
    setContextMenu(null);
    setContextSubmenu(null);
  }, [contextMenu, copyTextToClipboard, displayRegionsWithDefaults]);

  const handleContextCopyTranslated = useCallback(() => {
    if (!contextMenu) return;
    const region = displayRegionsWithDefaults.find(
      (item) => item.id === contextMenu.regionId,
    );
    if (!region) return;
    void copyTextToClipboard(region.translatedText ?? '');
    setContextMenu(null);
    setContextSubmenu(null);
  }, [contextMenu, copyTextToClipboard, displayRegionsWithDefaults]);

  const handleContextEditRendered = useCallback(() => {
    if (!contextMenu || !editable || !renderStageActive) return;
    const region = displayRegionsWithDefaults.find(
      (item) => item.id === contextMenu.regionId,
    );
    if (!region) return;
    openInlineEditorForRegion(region);
    setContextSubmenu(null);
  }, [
    contextMenu,
    displayRegionsWithDefaults,
    editable,
    openInlineEditorForRegion,
    renderStageActive,
  ]);

  const handleContextApplyPresetById = useCallback(
    (presetId: string) => {
      if (!contextMenu || !onRequestApplyPresetById) return;
      if (!presetId) return;
      onRequestApplyPresetById(contextMenu.regionId, presetId);
      setContextMenu(null);
      setContextSubmenu(null);
    },
    [contextMenu, onRequestApplyPresetById],
  );

  const handleContextConvertShape = useCallback(
    (kind: 'auto' | TypographyShapeKind) => {
      if (!contextMenu || !onRequestConvertShapeRegion) return;
      onRequestConvertShapeRegion(contextMenu.regionId, kind);
      setContextMenu(null);
      setContextSubmenu(null);
    },
    [contextMenu, onRequestConvertShapeRegion],
  );

  const removeRegionById = useCallback(
    (regionId: string) => {
      const parentId = getTranslationNoteOverlayParentId(regionId);
      if (parentId) {
        updateRegions((region) =>
          region.id === parentId
            ? {
                ...region,
                translationNotes: undefined,
                translationNoteOverlay: undefined,
              }
            : region,
        );
        onSelectRegion(parentId);
        setContextMenu(null);
        setInlineEditor((prev) => (prev?.regionId === regionId ? null : prev));
        return;
      }
      const nextRegions = regionsWithDefaultsRef.current.filter(
        (region) => region.id !== regionId,
      );
      onRegionsChange(nextRegions);
      if (selectedRegionId === regionId) {
        onSelectRegion(nextRegions[0]?.id ?? null);
      }
      setContextMenu(null);
      setInlineEditor((prev) => (prev?.regionId === regionId ? null : prev));
    },
    [
      getTranslationNoteOverlayParentId,
      onRegionsChange,
      onSelectRegion,
      selectedRegionId,
      updateRegions,
    ],
  );

  const handleContextRemoveRegion = useCallback(() => {
    if (!contextMenu || !editable) return;
    removeRegionById(contextMenu.regionId);
  }, [contextMenu, editable, removeRegionById]);

  useEffect(() => {
    let cancelled = false;
    const renderPreview = async (): Promise<void> => {
      const canvas = renderCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await Promise.all(
        displayRegionsWithDefaults.map(async (region) => {
          const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
          await ensureCanvasFontLoaded(style, region.renderTextStyleRanges);
        }),
      );
      if (cancelled) return;

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const region of displayRegionsWithDefaults) {
        const [x1, y1, x2, y2] = region.bbox;
        const width = Math.max(1, x2 - x1);
        const height = Math.max(1, y2 - y1);
        const style = cloneRenderStyle(region.renderStyle ?? fallbackStyle);
        const text = renderStageActive ? (region.renderText ?? '').trim() : '';
        if (!text.trim()) continue;
        const layout = computeRenderTextLayout(
          ctx,
          text,
          width,
          height,
          style,
          region.shape,
          region.renderTextStyleRanges,
        );
        drawRenderedTextInRegion(ctx, region.bbox, layout, style, region.shape);
      }
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

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onCardSelect();
      setContextMenu(null);
      setInlineEditor(null);
      setHoveredRegionId(null);
      if (event.button !== 0) return;
      event.preventDefault();
      const point = toImagePoint(event);
      if (!point) return;

      if (segmentEditEnabled && editable && segmentEditTool !== 'select') {
        const erase = segmentEditTool === 'eraser';
        segBrushLastRef.current = null;
        drawSegBrushOnCanvas(point.x, point.y, Math.max(2, segmentBrushSize / 2), erase);
        setInteraction({
          kind: 'segment_paint',
          pointerId: event.pointerId,
          regionId: '',
          erase,
          brushSize: segmentBrushSize,
        });
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      if (activeManualImageTool !== 'none') {
        if (
          manualHealingPending &&
          (activeManualImageTool === 'healing_brush' ||
            activeManualImageTool === 'magic_wand')
        ) {
          return;
        }
        onSelectRegion(null);
        setInteraction(null);
        if (activeManualImageTool === 'magic_wand') {
          const selectedArr = wandMaskSelectedRef.current;
          if (selectedArr) {
            const px = Math.round(point.x);
            const py = Math.round(point.y);
            if (px >= 0 && py >= 0 && px < image.width && py < image.height) {
              if (selectedArr[py * image.width + px] === 1) {
                onManualWandMaskChange(null);
                return;
              }
            }
          }
          void onManualWandRequest(point.x, point.y);
          return;
        }

        if (
          activeManualImageTool === 'paint' ||
          activeManualImageTool === 'paint_eraser'
        ) {
          const erase = activeManualImageTool === 'paint_eraser';
          drawManualStroke(
            paintCanvasRef.current,
            point.x,
            point.y,
            point.x,
            point.y,
            {
              size: manualBrushSize,
              color: manualPaintColor,
              erase,
              opacity: manualBrushOpacity,
              blur: manualBrushBlur,
            },
          );
          manualInteractionRef.current = {
            pointerId: event.pointerId,
            tool: activeManualImageTool,
            lastX: point.x,
            lastY: point.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }

        if (activeManualImageTool === 'healing_brush') {
          onManualWandMaskChange(null);
          drawManualStroke(
            healingMaskCanvasRef.current,
            point.x,
            point.y,
            point.x,
            point.y,
            {
              size: manualBrushSize,
              color: 'rgba(248, 113, 113, 0.96)',
              erase: false,
              opacity: manualBrushOpacity,
              blur: manualBrushBlur,
            },
          );
          manualInteractionRef.current = {
            pointerId: event.pointerId,
            tool: 'healing_brush',
            lastX: point.x,
            lastY: point.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }

      if (!areaSelectionEnabled) return;

      const targetElement = event.target as HTMLElement | null;
      const handleElement = targetElement?.closest<HTMLElement>(
        '.koma-render-handle',
      );
      if (editable && handleElement) {
        const handleRegionId = handleElement.dataset.regionId ?? '';
        const handleRegion =
          displayRegionsWithDefaults.find(
            (region) => region.id === handleRegionId,
          ) ?? null;
        if (handleRegion) {
          onSelectRegion(handleRegion.id);
          const [x1, y1, x2, y2] = handleRegion.bbox;
          const handleType = handleElement.dataset.renderHandle;

          if (handleType === 'rotate') {
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            const startRotation = getRegionRotation(handleRegion);
            setInteraction({
              kind: 'rotate',
              pointerId: event.pointerId,
              regionId: handleRegion.id,
              centerX,
              centerY,
              startPointerAngle: Math.atan2(
                point.y - centerY,
                point.x - centerX,
              ),
              startRotation,
            });
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
          }

          if (handleType === 'corner') {
            const cornerRaw = handleElement.dataset.corner;
            const corner: RegionCorner | null =
              cornerRaw === 'nw' ||
              cornerRaw === 'ne' ||
              cornerRaw === 'sw' ||
              cornerRaw === 'se'
                ? cornerRaw
                : null;
            if (corner) {
              const oppositeCorner = getOppositeCorner(corner);
              const anchor = getRegionCornerPoint(handleRegion, oppositeCorner);
              setInteraction({
                kind: 'resize',
                pointerId: event.pointerId,
                regionId: handleRegion.id,
                corner,
                anchorX: anchor.x,
                anchorY: anchor.y,
                rotation: getRegionRotation(handleRegion),
                startPointerX: point.x,
                startPointerY: point.y,
                startSkewX:
                  cloneRenderStyle(handleRegion.renderStyle ?? fallbackStyle)
                    .skewX || 0,
                startSkewY:
                  cloneRenderStyle(handleRegion.renderStyle ?? fallbackStyle)
                    .skewY || 0,
                boxWidth: handleRegion.bbox[2] - handleRegion.bbox[0],
                boxHeight: handleRegion.bbox[3] - handleRegion.bbox[1],
              });
              event.currentTarget.setPointerCapture(event.pointerId);
              return;
            }
          }
        }
      }

      const selectedRegion = selectedRegionId
        ? (displayRegionsWithDefaults.find(
            (region) => region.id === selectedRegionId,
          ) ?? null)
        : null;
      const handleRadius = 15 * point.scale;
      const rotateHandleRadius = 16 * point.scale;
      const rotateHandleOffset = 20 * point.scale;

      if (editable && selectedRegion) {
        const rotateHit = detectRotateHandleHit(
          selectedRegion,
          point.x,
          point.y,
          rotateHandleRadius,
          rotateHandleOffset,
        );
        if (rotateHit) {
          const startRotation = getRegionRotation(selectedRegion);
          setInteraction({
            kind: 'rotate',
            pointerId: event.pointerId,
            regionId: selectedRegion.id,
            centerX: rotateHit.centerX,
            centerY: rotateHit.centerY,
            startPointerAngle: Math.atan2(
              point.y - rotateHit.centerY,
              point.x - rotateHit.centerX,
            ),
            startRotation,
          });
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }

        const selectedCorner = detectCornerHit(
          selectedRegion,
          point.x,
          point.y,
          handleRadius,
        );
        if (selectedCorner) {
          const oppositeCorner = getOppositeCorner(selectedCorner);
          const anchor = getRegionCornerPoint(selectedRegion, oppositeCorner);
          setInteraction({
            kind: 'resize',
            pointerId: event.pointerId,
            regionId: selectedRegion.id,
            corner: selectedCorner,
            anchorX: anchor.x,
            anchorY: anchor.y,
            rotation: getRegionRotation(selectedRegion),
            startPointerX: point.x,
            startPointerY: point.y,
            startSkewX:
              cloneRenderStyle(selectedRegion.renderStyle ?? fallbackStyle)
                .skewX || 0,
            startSkewY:
              cloneRenderStyle(selectedRegion.renderStyle ?? fallbackStyle)
                .skewY || 0,
            boxWidth: selectedRegion.bbox[2] - selectedRegion.bbox[0],
            boxHeight: selectedRegion.bbox[3] - selectedRegion.bbox[1],
          });
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }

      const region = findRegionAtPoint(point.x, point.y);
      const regionIsSelected = Boolean(
        region && region.id === selectedRegionId,
      );
      if (region) {
        if ((event.ctrlKey || event.metaKey) && onMultiSelectToggle && areaSelectionEnabled) {
          onMultiSelectToggle(region.id);
          return;
        }
        onSelectRegion(region.id);
        if (!editable) return;
        if (!regionIsSelected) return;

        const corner = detectCornerHit(region, point.x, point.y, handleRadius);
        if (corner) {
          const oppositeCorner = getOppositeCorner(corner);
          const anchor = getRegionCornerPoint(region, oppositeCorner);
          setInteraction({
            kind: 'resize',
            pointerId: event.pointerId,
            regionId: region.id,
            corner,
            anchorX: anchor.x,
            anchorY: anchor.y,
            rotation: getRegionRotation(region),
            startPointerX: point.x,
            startPointerY: point.y,
            startSkewX:
              cloneRenderStyle(region.renderStyle ?? fallbackStyle).skewX || 0,
            startSkewY:
              cloneRenderStyle(region.renderStyle ?? fallbackStyle).skewY || 0,
            boxWidth: region.bbox[2] - region.bbox[0],
            boxHeight: region.bbox[3] - region.bbox[1],
          });
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }

        const [x1, y1, x2, y2] = region.bbox;
        setInteraction({
          kind: 'move',
          pointerId: event.pointerId,
          regionId: region.id,
          offsetX: point.x - x1,
          offsetY: point.y - y1,
          boxWidth: x2 - x1,
          boxHeight: y2 - y1,
          startPointerX: point.x,
          startPointerY: point.y,
          hasMoved: false,
        });
        return;
      }

      onSelectRegion(null);
      if (!editable || !allowRegionCreation) return;
      setInteraction({
        kind: 'draw',
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      activeManualImageTool,
      allowRegionCreation,
      areaSelectionEnabled,
      drawManualStroke,
      drawSegBrushOnCanvas,
      detectCornerHit,
      detectRotateHandleHit,
      editable,
      findRegionAtPoint,
      getOppositeCorner,
      getRegionCornerPoint,
      getRegionRotation,
      manualBrushSize,
      manualBrushOpacity,
      manualBrushBlur,
      manualHealingPending,
      manualPaintColor,
      onManualWandMaskChange,
      onManualWandRequest,
      onCardSelect,
      onSelectRegion,
      displayRegionsWithDefaults,
      segmentBrushSize,
      segmentEditEnabled,
      segmentEditTool,
      selectedRegionId,
      toImagePoint,
      onMultiSelectToggle,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const manualInteraction = manualInteractionRef.current;
      if (
        manualInteraction &&
        manualInteraction.pointerId === event.pointerId
      ) {
        const point = toImagePoint(event);
        if (!point) return;
        event.preventDefault();
        if (
          manualInteraction.tool === 'paint' ||
          manualInteraction.tool === 'paint_eraser'
        ) {
          drawManualStroke(
            paintCanvasRef.current,
            manualInteraction.lastX,
            manualInteraction.lastY,
            point.x,
            point.y,
            {
              size: manualBrushSize,
              color: manualPaintColor,
              erase: manualInteraction.tool === 'paint_eraser',
              opacity: manualBrushOpacity,
              blur: manualBrushBlur,
            },
          );
        } else if (manualInteraction.tool === 'healing_brush') {
          drawManualStroke(
            healingMaskCanvasRef.current,
            manualInteraction.lastX,
            manualInteraction.lastY,
            point.x,
            point.y,
            {
              size: manualBrushSize,
              color: 'rgba(248, 113, 113, 0.96)',
              erase: false,
              opacity: manualBrushOpacity,
              blur: manualBrushBlur,
            },
          );
        }
        manualInteractionRef.current = {
          ...manualInteraction,
          lastX: point.x,
          lastY: point.y,
        };
        return;
      }

      if (!interaction || interaction.pointerId !== event.pointerId) return;
      const point = toImagePoint(event);
      if (!point) return;
      event.preventDefault();

      if (interaction.kind === 'segment_paint') {
        drawSegBrushOnCanvas(
          point.x,
          point.y,
          Math.max(2, interaction.brushSize / 2),
          interaction.erase,
        );
        return;
      }

      if (interaction.kind === 'draw') {
        setInteraction({
          ...interaction,
          currentX: point.x,
          currentY: point.y,
        });
        return;
      }

      if (interaction.kind === 'move') {
        const pointerTravel = Math.hypot(
          point.x - interaction.startPointerX,
          point.y - interaction.startPointerY,
        );
        const dragThreshold = Math.max(3, point.scale * 4);
        if (!interaction.hasMoved && pointerTravel < dragThreshold) {
          return;
        }
        if (!interaction.hasMoved) {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          setInteraction((prev) =>
            prev && prev.kind === 'move' && prev.pointerId === event.pointerId
              ? { ...prev, hasMoved: true }
              : prev,
          );
        }
        const bleedX = interaction.boxWidth;
        const bleedY = interaction.boxHeight;
        const x1 = clamp(
          point.x - interaction.offsetX,
          -bleedX,
          image.width,
        );
        const y1 = clamp(
          point.y - interaction.offsetY,
          -bleedY,
          image.height,
        );
        const x2 = x1 + interaction.boxWidth;
        const y2 = y1 + interaction.boxHeight;
        updateRegionBox(interaction.regionId, [x1, y1, x2, y2]);
        return;
      }

      if (interaction.kind === 'rotate') {
        const currentPointerAngle = Math.atan2(
          point.y - interaction.centerY,
          point.x - interaction.centerX,
        );
        let deltaDegrees =
          ((currentPointerAngle - interaction.startPointerAngle) * 180) /
          Math.PI;
        if (deltaDegrees > 180) deltaDegrees -= 360;
        if (deltaDegrees < -180) deltaDegrees += 360;
        setRegionRotation(
          interaction.regionId,
          interaction.startRotation + deltaDegrees,
        );
        return;
      }

      if (interaction.kind === 'resize') {
        if (event.ctrlKey) {
          const deltaX = point.x - interaction.startPointerX;
          const deltaY = point.y - interaction.startPointerY;
          const horizontalSign =
            interaction.corner === 'nw' || interaction.corner === 'sw' ? -1 : 1;
          const verticalSign =
            interaction.corner === 'nw' || interaction.corner === 'ne' ? -1 : 1;
          const skewXDelta =
            (deltaX / Math.max(40, interaction.boxWidth)) * 30 * horizontalSign;
          const skewYDelta =
            (deltaY / Math.max(40, interaction.boxHeight)) * 30 * verticalSign;
          setRegionSkew(
            interaction.regionId,
            interaction.startSkewX + skewXDelta,
            interaction.startSkewY + skewYDelta,
          );
          return;
        }
        if (Math.abs(interaction.rotation) > 0.001) {
          const radians = (interaction.rotation * Math.PI) / 180;
          const cosNeg = Math.cos(-radians);
          const sinNeg = Math.sin(-radians);
          const worldDeltaX = point.x - interaction.anchorX;
          const worldDeltaY = point.y - interaction.anchorY;
          const localDeltaX = worldDeltaX * cosNeg - worldDeltaY * sinNeg;
          const localDeltaY = worldDeltaX * sinNeg + worldDeltaY * cosNeg;
          const nextWidth = Math.abs(localDeltaX);
          const nextHeight = Math.abs(localDeltaY);
          if (nextWidth < MIN_REGION_SIZE || nextHeight < MIN_REGION_SIZE)
            return;

          const halfLocalX = localDeltaX / 2;
          const halfLocalY = localDeltaY / 2;
          const cosPos = Math.cos(radians);
          const sinPos = Math.sin(radians);
          const centerOffsetX = halfLocalX * cosPos - halfLocalY * sinPos;
          const centerOffsetY = halfLocalX * sinPos + halfLocalY * cosPos;
          const centerX = interaction.anchorX + centerOffsetX;
          const centerY = interaction.anchorY + centerOffsetY;

          const [x1, y1, x2, y2] = [
            centerX - nextWidth / 2,
            centerY - nextHeight / 2,
            centerX + nextWidth / 2,
            centerY + nextHeight / 2,
          ];
          if (x2 - x1 < MIN_REGION_SIZE || y2 - y1 < MIN_REGION_SIZE) return;
          updateRegionBox(interaction.regionId, [x1, y1, x2, y2]);
          return;
        }

        const rawX1 = Math.min(interaction.anchorX, point.x);
        const rawY1 = Math.min(interaction.anchorY, point.y);
        const rawX2 = Math.max(interaction.anchorX, point.x);
        const rawY2 = Math.max(interaction.anchorY, point.y);
        if (rawX2 - rawX1 < MIN_REGION_SIZE || rawY2 - rawY1 < MIN_REGION_SIZE)
          return;
        updateRegionBox(interaction.regionId, [rawX1, rawY1, rawX2, rawY2]);
      }
    },
    [
      drawManualStroke,
      drawSegBrushOnCanvas,
      image.height,
      image.width,
      interaction,
      manualBrushSize,
      manualBrushOpacity,
      manualBrushBlur,
      manualPaintColor,
      newRegionShapeKind,
      setRegionSkew,
      setRegionRotation,
      toImagePoint,
      updateRegionBox,
    ],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const manualInteraction = manualInteractionRef.current;
      if (
        manualInteraction &&
        manualInteraction.pointerId === event.pointerId
      ) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (
          manualInteraction.tool === 'paint' ||
          manualInteraction.tool === 'paint_eraser'
        ) {
          commitPaintLayer();
        } else if (manualInteraction.tool === 'healing_brush') {
          commitHealingMask();
        }
        manualInteractionRef.current = null;
        return;
      }

      if (!interaction || interaction.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (interaction.kind === 'move' && !interaction.hasMoved) {
        setInteraction(null);
        return;
      }

      if (interaction.kind === 'segment_paint') {
        const canvas = segBrushCanvasRef.current;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          segBrushDataUrlRef.current = canvas.toDataURL();
          // Scale to image dimensions for persistence
          const offscreen = document.createElement('canvas');
          offscreen.width = image.width;
          offscreen.height = image.height;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.drawImage(canvas, 0, 0, image.width, image.height);
            const imageScaleUrl = offscreen.toDataURL();
            onSegmentBrushChange?.(imageScaleUrl);
          }
          // Free GPU texture memory immediately.
          offscreen.width = 0;
          offscreen.height = 0;
        }
        segBrushLastRef.current = null;
        setInteraction(null);
        return;
      }

      if (interaction.kind === 'draw') {
        const rawX1 = Math.min(interaction.startX, interaction.currentX);
        const rawY1 = Math.min(interaction.startY, interaction.currentY);
        const rawX2 = Math.max(interaction.startX, interaction.currentX);
        const rawY2 = Math.max(interaction.startY, interaction.currentY);
        if (rawX2 - rawX1 >= MIN_REGION_SIZE && rawY2 - rawY1 >= MIN_REGION_SIZE) {
          const manualRegion: AioTextRegion = {
            id: `manual-${uuidv4()}`,
            bbox: [rawX1, rawY1, rawX2, rawY2],
            score: 1,
            source: 'manual',
            modelKey: 'manual',
            detectorModelKey: 'manual',
            detectedRenderMode: 'text_bubble',
            renderMode: 'auto',
            renderStyle: {
              ...getRenderModePresetStyle('auto', fallbackStyle, 'text_bubble'),
              hyphenationEnabled: false,
            },
            shape: createDefaultTypographyShape(
              rawX2 - rawX1,
              rawY2 - rawY1,
              newRegionShapeKind,
              'manual',
            ),
            stylePresetId: null,
            queueIndex: null,
            hidden: false,
            locked: false,
          };
          onRegionsChange(
            [...regionsWithDefaultsRef.current, manualRegion],
            manualRegion.id,
          );
        }
      }
      if (interaction.kind === 'rotate') {
        const point = toImagePoint(event);
        if (point) {
          const currentPointerAngle = Math.atan2(
            point.y - interaction.centerY,
            point.x - interaction.centerX,
          );
          let deltaDegrees =
            ((currentPointerAngle - interaction.startPointerAngle) * 180) /
            Math.PI;
          if (deltaDegrees > 180) deltaDegrees -= 360;
          if (deltaDegrees < -180) deltaDegrees += 360;
          if (Math.abs(deltaDegrees) < 1) {
            updateRegionRotation(interaction.regionId, 15);
          }
        }
      }
      setInteraction(null);
    },
    [
      commitHealingMask,
      commitPaintLayer,
      fallbackStyle,
      image.height,
      image.width,
      interaction,
      allowRegionCreation,
      onRegionsChange,
      onSelectRegion,
      toImagePoint,
      updateRegionRotation,
    ],
  );

  // Resolve the region under the pointer from the closest data-region-id ancestor
  // before dispatching context-menu actions, so each region doesn't carry its
  // own inline handler.
  const handleRegionContextMenuDelegated = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const box = (event.target as HTMLElement).closest<HTMLElement>('[data-region-id]');
      if (!box) return;
      const region = box.dataset.regionId
        ? regionsWithDefaultsById.get(box.dataset.regionId) ?? null
        : null;
      if (region) handleRegionContextMenu(event, region);
    },
    [handleRegionContextMenu, regionsWithDefaultsById],
  );

  const handleRegionDoubleClickDelegated = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const box = (event.target as HTMLElement).closest<HTMLElement>('[data-region-id]');
      if (!box) return;
      const region = box.dataset.regionId
        ? regionsWithDefaultsById.get(box.dataset.regionId) ?? null
        : null;
      if (!region) return;
      event.preventDefault();
      event.stopPropagation();
      setContextMenu(null);
      if (!editable || !renderStageActive || !areaSelectionEnabled) return;
      openInlineEditorForRegion(region);
    },
    [
      areaSelectionEnabled,
      editable,
      openInlineEditorForRegion,
      regionsWithDefaultsById,
      renderStageActive,
    ],
  );

  const handleOverlayPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      handlePointerMove(event);
      if (isBrushCursorActive) updateBrushCursor(event);
      // Track region hover via event delegation — skip if unchanged
      const box = (event.target as HTMLElement).closest<HTMLElement>('[data-region-id]');
      const rid = box?.dataset.regionId ?? null;
      if (rid !== lastHoveredRegionIdRef.current) {
        lastHoveredRegionIdRef.current = rid;
        setHoveredRegionId(rid);
      }
    },
    [handlePointerMove, isBrushCursorActive, updateBrushCursor],
  );

  const handleOverlayPointerEnter = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBrushCursorActive) updateBrushCursor(event);
    },
    [isBrushCursorActive, updateBrushCursor],
  );

  const handleOverlayPointerLeave = useCallback(() => {
    setHoveredRegionId(null);
    hideBrushCursor();
  }, [hideBrushCursor]);

  const handleOverlayPointerCancel = useCallback(() => {
    setInteraction(null);
    setHoveredRegionId(null);
    setContextMenu(null);
    setInlineEditor(null);
    hideBrushCursor();
  }, [hideBrushCursor]);

  const selectedRegion = useMemo(
    () =>
      selectedRegionId
        ? (displayRegionById.get(selectedRegionId) ?? null)
        : null,
    [displayRegionById, selectedRegionId],
  );

  const inlineEditorRegion = useMemo(
    () =>
      inlineEditor
        ? (displayRegionById.get(inlineEditor.regionId) ?? null)
        : null,
    [displayRegionById, inlineEditor],
  );

  const selectedRegionTextStyleRanges = useMemo(
    () => cloneRenderTextStyleRanges(selectedRegion?.renderTextStyleRanges),
    [selectedRegion],
  );
  const inlineEditorBaseStyle = useMemo(
    () =>
      cloneRenderStyle(inlineEditorRegion?.renderStyle ?? fallbackStyle),
    [fallbackStyle, inlineEditorRegion],
  );
  const inlineEditorDisplayMetrics = useMemo(() => {
    if (
      !inlineEditor
      || !inlineEditorRegion
      || typeof document === 'undefined'
    ) {
      return { fontSize: 12, lineHeight: 17 };
    }
    const [x1, y1, x2, y2] = inlineEditorRegion.bbox;
    const width = Math.max(1, x2 - x1);
    const height = Math.max(1, y2 - y1);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { fontSize: 12, lineHeight: 17 };
    }
    const layout = computeRenderTextLayout(
      ctx,
      inlineEditor.value,
      width,
      height,
      inlineEditorBaseStyle,
      inlineEditorRegion.shape,
      inlineEditorRegion.renderTextStyleRanges,
    );
    // Free GPU texture memory immediately.
    canvas.width = 0;
    canvas.height = 0;
    return {
      fontSize: layout.fontSize,
      lineHeight: Math.max(layout.lineHeight, layout.fontSize * 1.05),
    };
  }, [
    inlineEditor?.value,
    inlineEditorBaseStyle,
    inlineEditorRegion?.bbox,
    inlineEditorRegion?.renderTextStyleRanges,
    inlineEditorRegion?.shape,
  ]);
  const segmentOverlayBoxes = useMemo(
    () =>
      displayRegionsWithDefaults.flatMap((region) => {
        const boxes = region.mergedSegmentBoxes?.length
          ? region.mergedSegmentBoxes
          : (region.segmentBoxes ?? []);

        return boxes.map((segmentBox, idx) => ({
          key: `render-seg-${region.id}-${idx}`,
          box: segmentBox,
        }));
      }),
    [displayRegionsWithDefaults],
  );
  const hoveredRegion = useMemo(
    () => (hoveredRegionId ? displayRegionById.get(hoveredRegionId) ?? null : null),
    [displayRegionById, hoveredRegionId],
  );
  const contextMenuTargetRegion = useMemo(
    () =>
      contextMenu?.regionId
        ? displayRegionById.get(contextMenu.regionId) ?? null
        : null,
    [contextMenu?.regionId, displayRegionById],
  );
  const typographyFolderNameById = useMemo(() => {
    const next = new Map<string, string>();
    availableTypographyFolders.forEach((folder) => {
      next.set(folder.id, folder.name);
    });
    return next;
  }, [availableTypographyFolders]);
  const filteredTypographyPresets = useMemo(() => {
    const searchLower = presetSearch.toLowerCase();

    return availableTypographyPresets.filter((preset) => {
      const matchesSearch =
        !searchLower || preset.name.toLowerCase().includes(searchLower);
      const matchesFolder =
        presetFolderFilter === null
          ? true
          : presetFolderFilter === '__none'
            ? preset.folderId === null
            : preset.folderId === presetFolderFilter;

      return matchesSearch && matchesFolder;
    });
  }, [availableTypographyPresets, presetFolderFilter, presetSearch]);
  const groupedTypographyPresets = useMemo(() => {
    const grouped = new Map<string | null, TypographyStylePreset[]>();

    filteredTypographyPresets.forEach((preset) => {
      const key = preset.folderId ?? null;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(preset);
    });

    return Array.from(grouped.entries());
  }, [filteredTypographyPresets]);
  const inlineEditorTypographyStyle = useMemo<React.CSSProperties>(
    () => ({
      fontFamily: inlineEditorBaseStyle.fontFamily,
      fontSize: `${inlineEditorDisplayMetrics.fontSize}px`,
      lineHeight: `${inlineEditorDisplayMetrics.lineHeight}px`,
      fontWeight: inlineEditorBaseStyle.bold ? 700 : 400,
      fontStyle: inlineEditorBaseStyle.italic ? 'italic' : 'normal',
      textTransform: inlineEditorBaseStyle.uppercase ? 'uppercase' : 'none',
    }),
    [inlineEditorBaseStyle, inlineEditorDisplayMetrics],
  );
  const inlineEditorContentEditableStyle = useMemo<React.CSSProperties>(
    () => ({
      ...inlineEditorTypographyStyle,
      color: inlineEditorBaseStyle.color || 'var(--auth-text)',
      caretColor: inlineEditorBaseStyle.color || 'var(--auth-text)',
      outline: 'none',
      overflow: 'auto',
    }),
    [inlineEditorTypographyStyle, inlineEditorBaseStyle],
  );
  const selectedInlineSelectionActive = Boolean(
    inlineEditor
      && selectedRegion
      && inlineEditor.regionId === selectedRegion.id
      && inlineEditor.selectionEnd > inlineEditor.selectionStart,
  );
  const selectedRegionStyle = useMemo(
    () => {
      const baseStyle = cloneRenderStyle(selectedRegion?.renderStyle ?? fallbackStyle);
      if (!selectedRegion || !selectedInlineSelectionActive || !inlineEditor) {
        return baseStyle;
      }
      return resolveRenderTextSelectionStyle(
        selectedRegion.renderText ?? '',
        baseStyle,
        selectedRegionTextStyleRanges,
        inlineEditor.selectionStart,
        inlineEditor.selectionEnd,
      );
    },
    [
      fallbackStyle,
      inlineEditor,
      selectedInlineSelectionActive,
      selectedRegion,
      selectedRegionTextStyleRanges,
    ],
  );
  const selectedRegionIsNoteOverlay = Boolean(
    selectedRegion && isTranslationNoteOverlayRegion(selectedRegion),
  );

  const selectedRegionHasText = useMemo(
    () =>
      renderStageActive && (selectedRegion?.renderText ?? '').trim().length > 0,
    [renderStageActive, selectedRegion],
  );
  const inlineEditorIsActiveForSelected = useMemo(
    () =>
      Boolean(
        inlineEditor &&
        selectedRegion &&
        inlineEditor.regionId === selectedRegion.id,
      ),
    [inlineEditor, selectedRegion],
  );
  useEffect(() => {
    if (!inlineEditorRequestKey || !active || !selectedRegion) return;
    const [requestedRegionId] = inlineEditorRequestKey.split('::');
    if (!requestedRegionId || requestedRegionId !== selectedRegion.id) return;
    openInlineEditorForRegion(selectedRegion);
  }, [
    active,
    inlineEditorRequestKey,
    openInlineEditorForRegion,
    selectedRegion,
  ]);
  const showRenderDock = useMemo(
    () =>
      Boolean(
        editable &&
        renderStageActive &&
        areaSelectionEnabled &&
        selectedRegion &&
        (selectedRegionHasText || inlineEditorIsActiveForSelected),
      ),
    [editable, renderStageActive, areaSelectionEnabled, selectedRegion, selectedRegionHasText, inlineEditorIsActiveForSelected],
  );

  useEffect(() => {
    if (!showRenderDock || !dockAnchor) return;
    const node = dockRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setDockSizeRevision((value) => value + 1);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [dockAnchor, showRenderDock]);

  const [dockVisible, setDockVisible] = useState(true);

  useEffect(() => {
    if (!showRenderDock || !dockAnchor) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const updateDockVisibility = () => {
      const rect = overlay.getBoundingClientRect();
      const dockHeight = dockRef.current?.offsetHeight ?? 120;
      const dockBottom = rect.top + dockAnchor.y + dockHeight;
      const dockTop = rect.top + dockAnchor.y;
      const cardBottom = rect.bottom;
      const cardTop = rect.top;
      const dockWithinCard = dockTop >= cardTop && dockBottom <= cardBottom;
      const cardInViewport = cardTop < window.innerHeight && cardBottom > 0;
      setDockVisible(dockWithinCard && cardInViewport);
    };

    const stageEl = overlay.closest('.koma-stage');
    if (stageEl) {
      stageEl.addEventListener('scroll', updateDockVisibility, { passive: true });
      window.addEventListener('resize', updateDockVisibility, { passive: true });
      updateDockVisibility();
    }
    return () => {
      const stageEl2 = overlayRef.current?.closest('.koma-stage');
      if (stageEl2) stageEl2.removeEventListener('scroll', updateDockVisibility);
      window.removeEventListener('resize', updateDockVisibility);
    };
  }, [showRenderDock, dockAnchor, dockSizeRevision]);

  const updateSelectedRegionStyle = useCallback(
    (updater: (style: RenderTextStyle) => RenderTextStyle) => {
      if (!selectedRegionId) return;

      const hasInlineSelection = selectedInlineSelectionActive
        && inlineEditor
        && selectedRegion
        && inlineEditor.regionId === selectedRegionId;
      
      // Check if we have a saved selection from before the popover opened
      const saved = savedSelectionRef.current;
      const hasSavedSelection = saved
        && saved.start !== saved.end
        && inlineEditor
        && selectedRegion
        && inlineEditor.regionId === selectedRegionId;
      
      if (hasInlineSelection || hasSavedSelection) {
        const selectionStart = hasInlineSelection
          ? inlineEditor.selectionStart
          : saved!.start;
        const selectionEnd = hasInlineSelection
          ? inlineEditor.selectionEnd
          : saved!.end;
        
        // CRITICAL: Use the ORIGINAL style (not selectedRegionStyle which may already be modified)
        // to compute the diff correctly
        const selectionPatch = buildInlineSelectionStylePatch(
          selectedRegionStyle,
          updater,
        );
        if (selectionPatch) {
          updateRegionTextStyleRanges(
            selectedRegionId,
            selectionStart,
            selectionEnd,
            selectionPatch,
          );
          restoreInlineEditorSelection();
          return;
        }
      }
      updateRegionStyle(selectedRegionId, updater);
    },
    [
      inlineEditor,
      restoreInlineEditorSelection,
      selectedInlineSelectionActive,
      selectedRegion,
      selectedRegionId,
      selectedRegionStyle,
      updateRegionStyle,
      updateRegionTextStyleRanges,
    ],
  );

  const updateSelectedRegionShapeKind = useCallback(
    (kind: TypographyShapeKind) => {
      if (!selectedRegion || !selectedRegionId || selectedRegionIsNoteOverlay)
        return;
      const [x1, y1, x2, y2] = selectedRegion.bbox;
      updateRegions((region) =>
        region.id === selectedRegionId
          ? {
              ...region,
              shape: createDefaultTypographyShape(
                x2 - x1,
                y2 - y1,
                kind,
                'converted',
              ),
            }
          : region,
      );
    },
    [
      selectedRegion,
      selectedRegionId,
      selectedRegionIsNoteOverlay,
      updateRegions,
    ],
  );

  const normalizeSelectedRegionShape = useCallback(
    (
      options: {
        kind?: TypographyShapeKind;
        centerText?: boolean;
        source?: TypographyShape['source'];
      } = {},
    ) => {
      if (!selectedRegion || !selectedRegionId || selectedRegionIsNoteOverlay)
        return;
      const shapeKind = options.kind ?? resolveRegionShapeKind(selectedRegion);
      updateRegions((region) => {
        if (region.id !== selectedRegionId) return region;
        const nextRegion = rebuildRegionShapeForKind(
          region,
          shapeKind,
          options.source ?? 'converted',
        );
        if (options.centerText) {
          return {
            ...nextRegion,
            renderStyle: {
              ...cloneRenderStyle(nextRegion.renderStyle ?? fallbackStyle),
              alignment: 'center',
            },
          };
        }
        return nextRegion;
      });
    },
    [
      selectedRegion,
      selectedRegionId,
      selectedRegionIsNoteOverlay,
      updateRegions,
    ],
  );

  const adjustSelectedFontSize = useCallback(
    (delta: number) => {
      updateSelectedRegionStyle((style) => {
        const nextFontSize = clamp(Math.round(style.fontSize + delta), 8, 160);
        return {
          ...style,
          fontSize: nextFontSize,
          minFontSize: clamp(Math.round(style.minFontSize), 6, nextFontSize),
        };
      });
    },
    [updateSelectedRegionStyle],
  );

  const adjustSelectedRotation = useCallback(
    (deltaDegrees: number) => {
      updateSelectedRegionStyle((style) => ({
        ...style,
        rotation: normalizeRenderRotation((style.rotation || 0) + deltaDegrees),
      }));
    },
    [updateSelectedRegionStyle],
  );

  useEffect(() => {
    if (!showRenderDock || !selectedRegion) {
      setDockAnchor((current) => (current === null ? current : null));
      return;
    }
    const overlay = overlayRef.current;
    if (!overlay) {
      setDockAnchor((current) => (current === null ? current : null));
      return;
    }
    const width = overlay.clientWidth;
    const height = overlay.clientHeight;
    if (width <= 0 || height <= 0) {
      setDockAnchor((current) => (current === null ? current : null));
      return;
    }

    const margin = 8;
    const gap = 12;
    const estimatedDockWidth = isCompactViewport
      ? 272
      : dockExpanded
        ? 500
        : 430;
    const estimatedDockHeight = isCompactViewport
      ? dockExpanded
        ? 206
        : 148
      : dockExpanded
        ? 186
        : 114;
    const measuredDockWidth = dockRef.current?.offsetWidth ?? 0;
    const measuredDockHeight = dockRef.current?.offsetHeight ?? 0;
    const dockWidth =
      measuredDockWidth > 0 ? measuredDockWidth : estimatedDockWidth;
    const dockHeight =
      measuredDockHeight > 0 ? measuredDockHeight : estimatedDockHeight;

    const [x1, y1, x2, y2] = selectedRegion.bbox;
    const left = (x1 / image.width) * width;
    const right = (x2 / image.width) * width;
    const top = (y1 / image.height) * height;
    const bottom = (y2 / image.height) * height;
    const boxCenterX = (left + right) / 2;
    const boxCenterY = (top + bottom) / 2;

    const blockedRect = {
      left: left - gap,
      right: right + gap,
      top: top - gap,
      bottom: bottom + gap,
    };

    const minVisible = 14;

    // On desktop the tools panel sits immediately to the right of the
    // overlay, so the dock must not overflow past the overlay width.
    // On compact/mobile the tools panel is a fixed overlay — full
    // freedom to the right.
    const maxDockRightEdge = isCompactViewport
      ? width + dockWidth - minVisible
      : width;

    const isInsidePlacementEnvelope = (x: number, y: number): boolean =>
      x >= -dockWidth + minVisible &&
      y >= -dockHeight + minVisible &&
      x + dockWidth <= maxDockRightEdge &&
      y + dockHeight <= height + minVisible;

    const overlapsSelection = (x: number, y: number): boolean => {
      const dockLeft = x;
      const dockRight = x + dockWidth;
      const dockTop = y;
      const dockBottom = y + dockHeight;
      return !(
        dockRight <= blockedRect.left ||
        dockLeft >= blockedRect.right ||
        dockBottom <= blockedRect.top ||
        dockTop >= blockedRect.bottom
      );
    };

    // Clamp helpers — keep the dock within the safe area.
    const clampX = (x: number): number =>
      Math.max(-dockWidth + minVisible, Math.min(x, maxDockRightEdge - dockWidth));
    const clampY = (y: number): number =>
      Math.max(margin, Math.min(y, Math.max(margin, height - dockHeight)));

    const candidatePool: Array<{
      x: number;
      y: number;
      placement: 'right' | 'left' | 'top' | 'bottom';
    }> = [
      {
        placement: 'right',
        x: right + gap,
        y: boxCenterY - dockHeight / 2,
      },
      {
        placement: 'left',
        x: left - dockWidth - gap,
        y: boxCenterY - dockHeight / 2,
      },
      {
        placement: 'top',
        x: boxCenterX - dockWidth / 2,
        y: top - dockHeight - gap,
      },
      {
        placement: 'bottom',
        x: boxCenterX - dockWidth / 2,
        y: bottom + gap,
      },
    ];

    const orderedCandidates = isCompactViewport
      ? [candidatePool[3], candidatePool[2], candidatePool[0], candidatePool[1]]
      : [
          candidatePool[0],
          candidatePool[1],
          candidatePool[2],
          candidatePool[3],
        ];

    const safeCandidate = orderedCandidates.find(
      (candidate) =>
        candidate &&
        isInsidePlacementEnvelope(clampX(candidate.x), clampY(candidate.y)) &&
        !overlapsSelection(clampX(candidate.x), clampY(candidate.y)),
    );
    if (safeCandidate) {
      const nextAnchor = {
        x: clampX(safeCandidate.x),
        y: clampY(safeCandidate.y),
        placement: safeCandidate.placement,
      };
      setDockAnchor((current) =>
        areDockAnchorsEqual(current, nextAnchor) ? current : nextAnchor,
      );
      return;
    }

    const corners: Array<{
      x: number;
      y: number;
      placement: 'top' | 'bottom';
    }> = [
      { x: margin, y: margin, placement: 'top' },
      {
        x: Math.max(margin, Math.min(width - dockWidth - margin, maxDockRightEdge - dockWidth)),
        y: margin,
        placement: 'top',
      },
      {
        x: margin,
        y: Math.max(margin, height - dockHeight - margin),
        placement: 'bottom',
      },
      {
        x: Math.max(margin, Math.min(width - dockWidth - margin, maxDockRightEdge - dockWidth)),
        y: Math.max(margin, height - dockHeight - margin),
        placement: 'bottom',
      },
    ];
    const safeCorner = corners.find(
      (candidate) =>
        isInsidePlacementEnvelope(candidate.x, candidate.y) &&
        !overlapsSelection(candidate.x, candidate.y),
    );
    if (safeCorner) {
      setDockAnchor((current) =>
        areDockAnchorsEqual(current, safeCorner) ? current : safeCorner,
      );
      return;
    }

    setDockAnchor((current) => (current === null ? current : null));
  }, [
    dockExpanded,
    dockSizeRevision,
    image.height,
    image.width,
    isCompactViewport,
    selectedRegion,
    showRenderDock,
  ]);

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
            const regionRotation = getRegionRotation(region);
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
            <div
              ref={dockRef}
              className={cn(
                'koma-type-dock',
                isCompactViewport && 'koma-type-dock--compact',
                dockAnchor.placement === 'left' && 'koma-type-dock--left',
                dockAnchor.placement === 'right' && 'koma-type-dock--right',
                dockAnchor.placement === 'top' && 'koma-type-dock--top',
                dockAnchor.placement === 'bottom' && 'koma-type-dock--bottom',
              )}
              style={{ left: `${dockLeft}px`, top: `${dockTop}px` }}
              onPointerDown={(e) => {
                dockPointerDownRef.current = true;
                syncInlineEditorSelection();
                e.stopPropagation();
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="koma-type-dock__bar">
                {/* ═══ Row 1: Primary Controls ═══ */}
                <div className="koma-type-dock__row koma-type-dock__row--primary">
                  {/* Font Family */}
                  <select
                    className="koma-type-dock__select koma-type-dock__select--font"
                    value={selectedRegionStyle.fontFamily}
                    onChange={(e) =>
                      updateSelectedRegionStyle((s) => ({
                        ...s,
                        fontFamily: e.target.value,
                      }))
                    }
                    aria-label={t('renderPreview.textFont')}
                  >
                    {availableRenderFonts.map((family) => (
                      <option key={family} value={family}>
                        {family}
                      </option>
                    ))}
                  </select>

                  {/* Shape */}
                  <select
                    className="koma-type-dock__select koma-type-dock__select--shape"
                    value={selectedRegion?.shape?.kind ?? 'rounded'}
                    onChange={(e) =>
                      updateSelectedRegionShapeKind(
                        e.target.value as TypographyShapeKind,
                      )
                    }
                    disabled={selectedRegionIsNoteOverlay}
                    aria-label={t('renderPreview.selectionShape')}
                  >
                    <option value="square">{t('renderPreview.rectangular')}</option>
                    <option value="rounded">{t('renderPreview.elliptic')}</option>
                  </select>

                  {/* Font Size Stepper */}
                  <div
                    className="koma-type-dock__stepper"
                    role="group"
                    aria-label={t('renderPreview.fontSize')}
                  >
                    <button
                      type="button"
                      className="koma-type-dock__step-btn"
                      onClick={() => adjustSelectedFontSize(-1)}
                      aria-label={t('renderPreview.decreaseFont')}
                    >
                      −
                    </button>
                    <span className="koma-type-dock__step-val">
                      {Math.round(selectedRegionStyle.fontSize)}
                    </span>
                    <button
                      type="button"
                      className="koma-type-dock__step-btn"
                      onClick={() => adjustSelectedFontSize(1)}
                      aria-label={t('renderPreview.increaseFont')}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="koma-type-dock__row-sep" aria-hidden="true" />

                {/* ═══ Row 2: Format Controls ═══ */}
                <div className="koma-type-dock__row koma-type-dock__row--format">
                  {/* Alignment */}
                  <div
                    className="koma-type-dock__icon-group"
                    role="group"
                    aria-label={t('renderPreview.alignment')}
                  >
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.alignment === 'left' &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          alignment: 'left',
                        }))
                      }
                      aria-label={t('renderPreview.alignLeft')}
                    >
                      <AlignLeft size={12} />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.alignment === 'center' &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        normalizeSelectedRegionShape({
                          centerText: true,
                          source: 'refined',
                        })
                      }
                      aria-label={t('renderPreview.alignCenter')}
                    >
                      <AlignCenter size={12} />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.alignment === 'right' &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          alignment: 'right',
                        }))
                      }
                      aria-label={t('renderPreview.alignRight')}
                    >
                      <AlignRight size={12} />
                    </button>
                  </div>

                  <span className="koma-type-dock__pipe" aria-hidden="true" />

                  {/* Typography Style */}
                  <div
                    className="koma-type-dock__icon-group"
                    role="group"
                    aria-label={t('renderPreview.typographyStyle')}
                  >
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.bold &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          bold: !s.bold,
                        }))
                      }
                      aria-label={t('renderPreview.bold')}
                    >
                      <Bold size={12} />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.italic &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          italic: !s.italic,
                        }))
                      }
                      aria-label={t('renderPreview.italic')}
                    >
                      <Italic size={12} />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.underline &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          underline: !s.underline,
                        }))
                      }
                      aria-label={t('renderPreview.underline')}
                    >
                      <Underline size={12} />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.uppercase &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          uppercase: !s.uppercase,
                        }))
                      }
                      aria-label={t('renderPreview.uppercase')}
                      title={t('renderPreview.uppercase')}
                    >
                      <span className="koma-type-dock__icon-text">{t('renderPreview.iconUppercase')}</span>
                    </button>
                  </div>

                  <span className="koma-type-dock__pipe" aria-hidden="true" />

                  {/* Orientation */}
                  <div
                    className="koma-type-dock__icon-group"
                    role="group"
                    aria-label={t('renderPreview.textOrientation')}
                  >
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.textOrientation !== 'vertical' &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          textOrientation: 'horizontal',
                        }))
                      }
                      aria-label={t('renderPreview.horizontal')}
                      title={t('renderPreview.horizontal')}
                    >
                      <span className="koma-type-dock__icon-text">{t('renderPreview.iconHorizontal')}</span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.textOrientation === 'vertical' &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          textOrientation: 'vertical',
                        }))
                      }
                      aria-label={t('renderPreview.vertical')}
                      title={t('renderPreview.vertical')}
                    >
                      <span className="koma-type-dock__icon-text">{t('renderPreview.iconVertical')}</span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'koma-type-dock__icon-btn',
                        selectedRegionStyle.textPathMode === 'circular' &&
                          'koma-type-dock__icon-btn--active',
                      )}
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          textPathMode:
                            s.textPathMode === 'circular'
                              ? 'normal'
                              : 'circular',
                        }))
                      }
                      aria-label={t('renderPreview.circular')}
                      title={t('renderPreview.circularText')}
                    >
                      <span className="koma-type-dock__icon-text">{t('renderPreview.iconCircular')}</span>
                    </button>
                  </div>

                  <span className="koma-type-dock__pipe" aria-hidden="true" />

                  {/* Rotation Stepper */}
                  <div
                    className="koma-type-dock__stepper"
                    role="group"
                    aria-label={t('renderPreview.rotation')}
                  >
                    <button
                      type="button"
                      className="koma-type-dock__step-btn"
                      onClick={() => adjustSelectedRotation(-5)}
                      aria-label={t('renderPreview.rotateMinus5')}
                    >
                      −
                    </button>
                    <span className="koma-type-dock__step-val">
                      {Math.round(selectedRegionStyle.rotation)}°
                    </span>
                    <button
                      type="button"
                      className="koma-type-dock__step-btn"
                      onClick={() => adjustSelectedRotation(5)}
                      aria-label={t('renderPreview.rotatePlus5')}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* ═══ Row 3: Transform + Actions ═══ */}
                <div className="koma-type-dock__row koma-type-dock__row--actions">
                  {/* Skew X */}
                  <div
                    className="koma-type-dock__stepper koma-type-dock__stepper--labeled"
                    role="group"
                    aria-label={t('renderPreview.skewX')}
                  >
                    <button
                      type="button"
                      className="koma-type-dock__step-btn"
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          skewX: normalizeRenderSkew((s.skewX || 0) - 2),
                        }))
                      }
                      aria-label={t('renderPreview.skewXMinus2')}
                    >
                      −
                    </button>
                    <span className="koma-type-dock__step-val">
                      {Math.round(selectedRegionStyle.skewX || 0)}°
                      <span className="koma-type-dock__step-unit">{t('dashboard.render.skewXLabel')}</span>
                    </span>
                    <button
                      type="button"
                      className="koma-type-dock__step-btn"
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          skewX: normalizeRenderSkew((s.skewX || 0) + 2),
                        }))
                      }
                      aria-label={t('renderPreview.skewXPlus2')}
                    >
                      +
                    </button>
                  </div>

                  {/* Skew Y */}
                  <div
                    className="koma-type-dock__stepper koma-type-dock__stepper--labeled"
                    role="group"
                    aria-label={t('renderPreview.skewY')}
                  >
                    <button
                      type="button"
                      className="koma-type-dock__step-btn"
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          skewY: normalizeRenderSkew((s.skewY || 0) - 2),
                        }))
                      }
                      aria-label={t('renderPreview.skewYMinus2')}
                    >
                      −
                    </button>
                    <span className="koma-type-dock__step-val">
                      {Math.round(selectedRegionStyle.skewY || 0)}°
                      <span className="koma-type-dock__step-unit">{t('dashboard.render.skewYLabel')}</span>
                    </span>
                    <button
                      type="button"
                      className="koma-type-dock__step-btn"
                      onClick={() =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          skewY: normalizeRenderSkew((s.skewY || 0) + 2),
                        }))
                      }
                      aria-label={t('renderPreview.skewYPlus2')}
                    >
                      +
                    </button>
                  </div>

                  <span className="koma-type-dock__spacer" />

                  {/* Action Buttons */}
                  <button
                    type="button"
                    className={cn(
                      'koma-type-dock__action',
                      dockExpanded && 'koma-type-dock__action--active',
                    )}
                    onClick={() => setDockExpanded((prev) => !prev)}
                    aria-expanded={dockExpanded}
                  >
                    <Settings size={11} />
                    {t('renderPreview.adjustments')}
                  </button>

                  <button
                    type="button"
                    className="koma-type-dock__action"
                    onClick={() => onRequestRefineRegion?.()}
                    disabled={
                      !onRequestRefineRegion || selectedRegionIsNoteOverlay
                    }
                  >
                    <Sparkles size={11} />
                    {t('renderPreview.refine')}
                  </button>
                </div>
              </div>

              {/* ═══ Expanded Fine-Tune Panel ═══ */}
              {dockExpanded && (
                <div className="koma-type-dock__fine custom-scrollbar">
                  <div className="koma-type-dock__fine-grid">
                    {/* Auto Font Size */}
                    <div className="koma-type-dock__fine-field">
                      <span className="koma-type-dock__fine-label">
                        {t('renderPreview.autoFontSize')}
                      </span>
                      <label className="koma-type-dock__fine-toggle">
                        <input
                          type="checkbox"
                          checked={selectedRegionStyle.autoFontSize}
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              autoFontSize: e.target.checked,
                              fontSize: DEFAULT_RENDER_STYLE.fontSize,
                              minFontSize: DEFAULT_RENDER_STYLE.minFontSize,
                            }))
                          }
                        />
                        <span className="koma-type-dock__fine-toggle-text">
                          {selectedRegionStyle.autoFontSize
                            ? t('renderPreview.autoFit')
                            : t('renderPreview.fixed')}
                        </span>
                      </label>
                    </div>

                    {/* Hyphenation */}
                    <div className="koma-type-dock__fine-field">
                      <span className="koma-type-dock__fine-label">
                        {t('renderPreview.hyphenation')}
                      </span>
                      <label className="koma-type-dock__fine-toggle">
                        <input
                          type="checkbox"
                          checked={selectedRegionStyle.hyphenationEnabled}
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              hyphenationEnabled: e.target.checked,
                            }))
                          }
                        />
                        <span className="koma-type-dock__fine-toggle-text">
                          {selectedRegionStyle.hyphenationEnabled
                            ? t('renderPreview.enabled')
                            : t('renderPreview.disabled')}
                        </span>
                      </label>
                    </div>

                    {/* Max Font Size */}
                    <div className="koma-type-dock__fine-field">
                      <span className="koma-type-dock__fine-label">
                        {t('renderPreview.maxSize')}
                      </span>
                      <div className="koma-type-dock__fine-control">
                        <input
                          type="range"
                          className="koma-type-dock__fine-range"
                          min={8}
                          max={160}
                          step={1}
                          value={Math.round(selectedRegionStyle.fontSize)}
                          onChange={(e) => {
                            const next = Math.round(Number(e.target.value));
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              fontSize: next,
                              minFontSize: Math.min(
                                Math.round(s.minFontSize),
                                next,
                              ),
                            }));
                          }}
                        />
                        <span className="koma-type-dock__fine-value">
                          {Math.round(selectedRegionStyle.fontSize)}px
                        </span>
                      </div>
                    </div>

                    {/* Min Font Size */}
                    <div className="koma-type-dock__fine-field">
                      <span className="koma-type-dock__fine-label">
                        {t('renderPreview.minSize')}
                      </span>
                      <div className="koma-type-dock__fine-control">
                        <input
                          type="range"
                          className="koma-type-dock__fine-range"
                          min={6}
                          max={Math.max(6, Math.round(selectedRegionStyle.fontSize))}
                          step={1}
                          value={Math.round(selectedRegionStyle.minFontSize)}
                          onChange={(e) => {
                            const next = Math.round(Number(e.target.value));
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              minFontSize: clamp(
                                next,
                                6,
                                Math.max(6, Math.round(s.fontSize)),
                              ),
                            }));
                          }}
                        />
                        <span className="koma-type-dock__fine-value">
                          {Math.round(selectedRegionStyle.minFontSize)}px
                        </span>
                      </div>
                    </div>

                    {/* Line Spacing */}
                    <div className="koma-type-dock__fine-field">
                      <span className="koma-type-dock__fine-label">
                        {t('renderPreview.lineSpacing')}
                      </span>
                      <div className="koma-type-dock__fine-control">
                        <input
                          type="range"
                          className="koma-type-dock__fine-range"
                          min={0.65}
                          max={2.2}
                          step={0.05}
                          value={selectedRegionStyle.lineSpacing}
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              lineSpacing: Number(e.target.value),
                            }))
                          }
                        />
                        <span className="koma-type-dock__fine-value">
                          {selectedRegionStyle.lineSpacing.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Text Opacity */}
                    <div className="koma-type-dock__fine-field">
                      <span className="koma-type-dock__fine-label">
                        {t('renderPreview.opacity')}
                      </span>
                      <div className="koma-type-dock__fine-control">
                        <input
                          type="range"
                          className="koma-type-dock__fine-range"
                          min={0.05}
                          max={1}
                          step={0.01}
                          value={selectedRegionStyle.opacity}
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              opacity: Number(e.target.value),
                            }))
                          }
                        />
                        <span className="koma-type-dock__fine-value">
                          {Math.round(selectedRegionStyle.opacity * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Skew X */}
                    <div className="koma-type-dock__fine-field">
                      <span className="koma-type-dock__fine-label">{t('renderPreview.skewX')}</span>
                      <div className="koma-type-dock__fine-control">
                        <input
                          type="range"
                          className="koma-type-dock__fine-range"
                          min={-45}
                          max={45}
                          step={0.5}
                          value={selectedRegionStyle.skewX || 0}
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              skewX: normalizeRenderSkew(
                                Number(e.target.value),
                              ),
                            }))
                          }
                        />
                        <span className="koma-type-dock__fine-value">
                          {(selectedRegionStyle.skewX || 0).toFixed(1)}°
                        </span>
                      </div>
                    </div>

                    {/* Skew Y */}
                    <div className="koma-type-dock__fine-field">
                      <span className="koma-type-dock__fine-label">{t('renderPreview.skewY')}</span>
                      <div className="koma-type-dock__fine-control">
                        <input
                          type="range"
                          className="koma-type-dock__fine-range"
                          min={-45}
                          max={45}
                          step={0.5}
                          value={selectedRegionStyle.skewY || 0}
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              skewY: normalizeRenderSkew(
                                Number(e.target.value),
                              ),
                            }))
                          }
                        />
                        <span className="koma-type-dock__fine-value">
                          {(selectedRegionStyle.skewY || 0).toFixed(1)}°
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Effects Row ═══ */}
                  <div className="koma-type-dock__effects-row">
                    {/* Fill */}
                    <FillStylePopover
                      label={t('renderPreview.fill')}
                      value={buildFillPickerValue(selectedRegionStyle)}
                      swatches={textFillSwatches}
                      onBeforeOpen={saveCurrentSelection}
                      onClose={clearPickerState}
                      onChange={(nextValue) => {
                        updateSelectedRegionStyle((style) => {
                          const nextFill = parseFillPickerValue(
                            nextValue,
                            style.color || '#111111',
                          );
                          // CRITICAL: Do NOT include keys that are not in INLINE_RENDER_STYLE_KEYS
                          // (e.g. detectGradient), otherwise getInlineStylePatchFromStyleDiff returns null
                          // and the style is applied to the entire region instead of the selection.
                          return {
                            ...style,
                            color: nextFill.color,
                            fillCssValue: nextFill.fillCssValue,
                            gradientEnabled: nextFill.gradientEnabled,
                            gradientStartColor: nextFill.gradientStartColor,
                            gradientEndColor: nextFill.gradientEndColor,
                            gradientAngle: nextFill.gradientAngle,
                          };
                        });
                      }}
                    />

                    {/* Outline */}
                    <RenderEffectPopover
                      label={t('renderPreview.outline')}
                      value={selectedRegionStyle.outlineColor}
                      enabled={selectedRegionStyle.outlineWidth > 0}
                      summary={`${selectedRegionStyle.outlineWidth.toFixed(1)}px`}
                      onEnabledChange={(enabled) =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          outlineWidth: enabled
                            ? s.outlineWidth > 0
                              ? s.outlineWidth
                              : 2
                            : 0,
                        }))
                      }
                      onColorChange={(nextValue) =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          outlineColor: nextValue,
                        }))
                      }
                    >
                      <div className="koma-effect-popover__field">
                        <label>{t('renderPreview.opacity')}</label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={selectedRegionStyle.outlineOpacity ?? 1}
                          disabled={selectedRegionStyle.outlineWidth <= 0}
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              outlineOpacity: Number(e.target.value),
                            }))
                          }
                        />
                        <span className="koma-effect-popover__value">
                          {Math.round(
                            (selectedRegionStyle.outlineOpacity ?? 1) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="koma-effect-popover__field">
                        <label>{t('settings.modePresets.outlineWidth')}</label>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={0.25}
                          value={selectedRegionStyle.outlineWidth}
                          disabled={selectedRegionStyle.outlineWidth <= 0}
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              outlineWidth: Number(e.target.value),
                            }))
                          }
                        />
                        <span className="koma-effect-popover__value">
                          {selectedRegionStyle.outlineWidth.toFixed(2)}
                        </span>
                      </div>
                    </RenderEffectPopover>

                    {/* Shadow */}
                    <RenderEffectPopover
                      label={t('renderPreview.shadow')}
                      value={buildShadowFillPickerValue(selectedRegionStyle)}
                      enabled={selectedRegionStyle.shadowEnabled}
                      summary={
                        selectedRegionStyle.shadowLayers?.length
                          ? t('renderPreview.shadowLayersCount', {
                              count: selectedRegionStyle.shadowLayers.length,
                            })
                          : t('renderPreview.shadowBlurSummary', {
                              value: selectedRegionStyle.shadowBlur.toFixed(0),
                            })
                      }
                      allowGradient
                      swatches={textFillSwatches}
                      onEnabledChange={(enabled) =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          shadowEnabled: enabled,
                        }))
                      }
                      onColorChange={(nextValue) =>
                        updateSelectedRegionStyle((s) =>
                          applyShadowFillPickerValueToStyle(s, nextValue),
                        )
                      }
                    >
                      {/* Opacity + Blur side by side */}
                      <div className="koma-effect-popover__field-pair">
                        <div className="koma-effect-popover__field">
                          <label>{t('renderPreview.opacity')}</label>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={selectedRegionStyle.shadowOpacity ?? 1}
                            disabled={!selectedRegionStyle.shadowEnabled}
                            onChange={(e) =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowOpacity: Number(e.target.value),
                              }))
                            }
                          />
                          <span className="koma-effect-popover__value">
                            {Math.round((selectedRegionStyle.shadowOpacity ?? 1) * 100)}%
                          </span>
                        </div>
                        <div className="koma-effect-popover__field">
                          <label>{t('renderPreview.blur')}</label>
                          <input
                            type="range"
                            min={0}
                            max={30}
                            step={0.5}
                            value={selectedRegionStyle.shadowBlur}
                            disabled={!selectedRegionStyle.shadowEnabled}
                            onChange={(e) =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowBlur: Number(e.target.value),
                              }))
                            }
                          />
                          <span className="koma-effect-popover__value">
                            {selectedRegionStyle.shadowBlur.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      {/* Offset X + Offset Y side by side */}
                      <div className="koma-effect-popover__field-pair">
                        <div className="koma-effect-popover__field">
                          <label>{t('renderPreview.offsetX')}</label>
                          <input
                            type="range"
                            min={-24}
                            max={24}
                            step={1}
                            value={selectedRegionStyle.shadowOffsetX}
                            disabled={!selectedRegionStyle.shadowEnabled}
                            onChange={(e) =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowOffsetX: Number(e.target.value),
                              }))
                            }
                          />
                          <span className="koma-effect-popover__value">
                            {selectedRegionStyle.shadowOffsetX.toFixed(0)}px
                          </span>
                        </div>
                        <div className="koma-effect-popover__field">
                          <label>{t('renderPreview.offsetY')}</label>
                          <input
                            type="range"
                            min={-24}
                            max={24}
                            step={1}
                            value={selectedRegionStyle.shadowOffsetY}
                            disabled={!selectedRegionStyle.shadowEnabled}
                            onChange={(e) =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowOffsetY: Number(e.target.value),
                              }))
                            }
                          />
                          <span className="koma-effect-popover__value">
                            {selectedRegionStyle.shadowOffsetY.toFixed(0)}px
                          </span>
                        </div>
                      </div>

                      {/* Shadow Layers */}
                      <div className="koma-effect-popover__layers">
                        <div className="koma-effect-popover__layersHead">
                          <span>{t('renderPreview.shadowLayers')}</span>
                          <button
                            type="button"
                            className="koma-btn koma-btn--ghost koma-btn--sm"
                            onClick={() =>
                              updateSelectedRegionStyle((s) => ({
                                ...s,
                                shadowLayers: [
                                  ...(s.shadowLayers ?? []),
                                  createDefaultShadowLayer(),
                                ],
                              }))
                            }
                          >
                            {t('renderPreview.addLayer')}
                          </button>
                        </div>
                        {(selectedRegionStyle.shadowLayers ?? []).map(
                          (layer, idx) => (
                            <div
                              key={`shadow-layer-${idx}`}
                              className="koma-effect-popover__layerCard"
                            >
                              <div className="koma-effect-popover__layerHead">
                                <strong>{t('renderPreview.layerN', { count: idx + 1 })}</strong>
                                <button
                                  type="button"
                                  className="koma-tool-config__close"
                                  onClick={() =>
                                    updateSelectedRegionStyle((s) => ({
                                      ...s,
                                      shadowLayers: (
                                        s.shadowLayers ?? []
                                      ).filter((_, i) => i !== idx),
                                    }))
                                  }
                                  aria-label={t('renderPreview.removeLayerN', { count: idx + 1 })}
                                >
                                  <X size={10} />
                                </button>
                              </div>
                              {/* Fill – full width, no value column */}
                              <div className="koma-effect-popover__field koma-effect-popover__field--fill">
                                <label>{t('renderPreview.fill')}</label>
                                <FillStylePopover
                                  label={t('renderPreview.shadowLayerN', { count: idx + 1 })}
                                  value={layer.fillCssValue}
                                  allowGradient
                                  swatches={textFillSwatches}
                                  onBeforeOpen={saveCurrentSelection}
                                  onClose={clearPickerState}
                                  onChange={(v) =>
                                    updateSelectedRegionStyle((s) => ({
                                      ...s,
                                      shadowLayers: (s.shadowLayers ?? []).map(
                                        (entry, i) =>
                                          i === idx
                                            ? { ...entry, fillCssValue: v }
                                            : entry,
                                      ),
                                    }))
                                  }
                                />
                              </div>
                              {/* Opacity + Blur side by side */}
                              <div className="koma-effect-popover__field-pair">
                                <div className="koma-effect-popover__field">
                                  <label>{t('renderPreview.opacity')}</label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={layer.opacity}
                                    onChange={(e) =>
                                      updateSelectedRegionStyle((s) => ({
                                        ...s,
                                        shadowLayers: (s.shadowLayers ?? []).map(
                                          (entry, i) =>
                                            i === idx
                                              ? { ...entry, opacity: Number(e.target.value) }
                                              : entry,
                                        ),
                                      }))
                                    }
                                  />
                                  <span className="koma-effect-popover__value">
                                    {Math.round(layer.opacity * 100)}%
                                  </span>
                                </div>
                                <div className="koma-effect-popover__field">
                                  <label>{t('renderPreview.blur')}</label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={40}
                                    step={0.5}
                                    value={layer.blur}
                                    onChange={(e) =>
                                      updateSelectedRegionStyle((s) => ({
                                        ...s,
                                        shadowLayers: (s.shadowLayers ?? []).map(
                                          (entry, i) =>
                                            i === idx
                                              ? { ...entry, blur: Number(e.target.value) }
                                              : entry,
                                        ),
                                      }))
                                    }
                                  />
                                  <span className="koma-effect-popover__value">
                                    {layer.blur.toFixed(1)}
                                  </span>
                                </div>
                              </div>
                              {/* Offset X + Offset Y side by side */}
                              <div className="koma-effect-popover__field-pair">
                                <div className="koma-effect-popover__field">
                                  <label>{t('renderPreview.offsetX')}</label>
                                  <input
                                    type="range"
                                    min={-24}
                                    max={24}
                                    step={1}
                                    value={layer.offsetX}
                                    onChange={(e) =>
                                      updateSelectedRegionStyle((s) => ({
                                        ...s,
                                        shadowLayers: (s.shadowLayers ?? []).map(
                                          (entry, i) =>
                                            i === idx
                                              ? { ...entry, offsetX: Number(e.target.value) }
                                              : entry,
                                        ),
                                      }))
                                    }
                                  />
                                  <span className="koma-effect-popover__value">
                                    {layer.offsetX.toFixed(0)}px
                                  </span>
                                </div>
                                <div className="koma-effect-popover__field">
                                  <label>{t('renderPreview.offsetY')}</label>
                                  <input
                                    type="range"
                                    min={-24}
                                    max={24}
                                    step={1}
                                    value={layer.offsetY}
                                    onChange={(e) =>
                                      updateSelectedRegionStyle((s) => ({
                                        ...s,
                                        shadowLayers: (s.shadowLayers ?? []).map(
                                          (entry, i) =>
                                            i === idx
                                              ? { ...entry, offsetY: Number(e.target.value) }
                                              : entry,
                                        ),
                                      }))
                                    }
                                  />
                                  <span className="koma-effect-popover__value">
                                    {layer.offsetY.toFixed(0)}px
                                  </span>
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </RenderEffectPopover>

                    {/* Text Effect */}
                    <TextEffectPopover
                      value={selectedRegionStyle.textEffectPreset ?? 'none'}
                      presets={NATIVE_TEXT_EFFECT_PRESETS}
                      intensity={selectedRegionStyle.textEffectIntensity ?? 1}
                      onChange={(presetId) =>
                        updateSelectedRegionStyle((s) =>
                          applyNativeTextEffectPreset(s, presetId),
                        )
                      }
                      onIntensityChange={(value) =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          textEffectIntensity: value,
                        }))
                      }
                    />

                    {/* Circular Text */}
                    <CircularTextPopover
                      enabled={selectedRegionStyle.textPathMode === 'circular'}
                      summary={`${((selectedRegionStyle.circularRadiusScale || 0.78) * 100).toFixed(0)}%`}
                      onEnabledChange={(enabled) =>
                        updateSelectedRegionStyle((s) => ({
                          ...s,
                          textPathMode: enabled ? 'circular' : 'normal',
                        }))
                      }
                    >
                      <div className="koma-effect-popover__field">
                        <label>{t('renderPreview.radius')}</label>
                        <input
                          type="range"
                          min={0.2}
                          max={1.2}
                          step={0.01}
                          value={
                            selectedRegionStyle.circularRadiusScale || 0.78
                          }
                          disabled={
                            selectedRegionStyle.textPathMode !== 'circular'
                          }
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              circularRadiusScale: Number(e.target.value),
                            }))
                          }
                        />
                        <span className="koma-effect-popover__value">
                          {(
                            (selectedRegionStyle.circularRadiusScale || 0.78) *
                            100
                          ).toFixed(0)}
                          %
                        </span>
                      </div>
                      <div className="koma-effect-popover__field">
                        <label>{t('renderPreview.startAngle')}</label>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={1}
                          value={selectedRegionStyle.circularStartAngle || -90}
                          disabled={
                            selectedRegionStyle.textPathMode !== 'circular'
                          }
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              circularStartAngle: normalizeRenderRotation(
                                Number(e.target.value),
                              ),
                            }))
                          }
                        />
                        <span className="koma-effect-popover__value">
                          {(
                            selectedRegionStyle.circularStartAngle || -90
                          ).toFixed(0)}
                          °
                        </span>
                      </div>
                      <div className="koma-effect-popover__field">
                        <label>{t('renderPreview.spacing')}</label>
                        <input
                          type="range"
                          min={0.5}
                          max={2.5}
                          step={0.05}
                          value={selectedRegionStyle.circularLetterSpacing || 1}
                          disabled={
                            selectedRegionStyle.textPathMode !== 'circular'
                          }
                          onChange={(e) =>
                            updateSelectedRegionStyle((s) => ({
                              ...s,
                              circularLetterSpacing: Number(e.target.value),
                            }))
                          }
                        />
                        <span className="koma-effect-popover__value">
                          {(
                            selectedRegionStyle.circularLetterSpacing || 1
                          ).toFixed(2)}
                          x
                        </span>
                      </div>
                    </CircularTextPopover>
                  </div>
                </div>
              )}
            </div>
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
