import { useCallback, useEffect } from 'react';

import { clamp } from '../../../utils/dashboard.utils';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../../constants/dashboard.constants';
import {
  collectShortcutStateFromKeyboardEvent,
  findMatchingShortcutAction,
  isEditableShortcutTarget,
  type ShortcutActionId,
} from '../../../shortcuts/keyboardShortcuts';
import type {
  ToolMode,
  TranslatorWorkspaceMode,
} from '../../../types/dashboard.types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import {
  readActiveAioSelectedRegion,
  readActiveSelectedRegionIdForMode,
} from './region-editor';
import { useAioManualEdits, useManualToolToggles } from './manual-tools';
import { useAioRegionEditing } from './region-editor';
import { useCleanerManualEdits } from './cleaner';
import { useTypographerControls } from './typographer';
import { useWorkspacePersistence } from './workspace-persistence';

export interface UseDashboardKeyboardArgs {
  /* Values still owned by the page */
  activeId: string | null;
  shortcutCenterOpen: boolean;
  translatorWorkspaceMode: TranslatorWorkspaceMode;

  /* Page callbacks */
  handleModeChange: (newMode: ToolMode) => void;
  handleToolsToggle: () => void;
  openShortcutCenter: () => void;

  /* Workspace persistence (T11a) */
  handleWorkspaceManualSave: ReturnType<
    typeof useWorkspacePersistence
  >['handleWorkspaceManualSave'];
  handleWorkspaceRedo: ReturnType<
    typeof useWorkspacePersistence
  >['handleWorkspaceRedo'];
  handleWorkspaceUndo: ReturnType<
    typeof useWorkspacePersistence
  >['handleWorkspaceUndo'];

  /* Region editor */
  applyActiveTypographyPresetToSelection: ReturnType<
    typeof useAioRegionEditing
  >['applyActiveTypographyPresetToSelection'];
  applyAutoDetectedShapeToActiveRegion: ReturnType<
    typeof useAioRegionEditing
  >['applyAutoDetectedShapeToActiveRegion'];
  applyLegacyTypographyPresetToSelection: ReturnType<
    typeof useAioRegionEditing
  >['applyLegacyTypographyPresetToSelection'];
  clearAioRegionsForActiveImage: ReturnType<
    typeof useAioRegionEditing
  >['clearAioRegionsForActiveImage'];
  convertActiveTypographerShape: ReturnType<
    typeof useAioRegionEditing
  >['convertActiveTypographerShape'];
  duplicateSelectedTypographerRegion: ReturnType<
    typeof useAioRegionEditing
  >['duplicateSelectedTypographerRegion'];
  navigateActiveTypographerRegion: ReturnType<
    typeof useAioRegionEditing
  >['navigateActiveTypographerRegion'];
  removeSelectedAioRegion: ReturnType<
    typeof useAioRegionEditing
  >['removeSelectedAioRegion'];

  /* Typographer controls */
  applySelectedTypographerQueueItem: ReturnType<
    typeof useTypographerControls
  >['applySelectedTypographerQueueItem'];
  handleTypographerSaveSnapshot: ReturnType<
    typeof useTypographerControls
  >['handleTypographerSaveSnapshot'];
  handleTypographerToggleMultiBubble: ReturnType<
    typeof useTypographerControls
  >['handleTypographerToggleMultiBubble'];
  refineActiveTypographerShape: ReturnType<
    typeof useTypographerControls
  >['refineActiveTypographerShape'];

  /* Manual tools */
  clearAioManualPaintForImage: ReturnType<
    typeof useAioManualEdits
  >['clearAioManualPaintForImage'];
  resetAioManualImageEditsForImage: ReturnType<
    typeof useAioManualEdits
  >['resetAioManualImageEditsForImage'];
  toggleManualImageTool: ReturnType<
    typeof useManualToolToggles
  >['toggleManualImageTool'];
  toggleManualToolsConfig: ReturnType<
    typeof useManualToolToggles
  >['toggleManualToolsConfig'];
  setSegmentEditTool: ReturnType<
    typeof useManualToolsStore.getState
  >['setSegmentEditTool'];
  setManualImageTool: ReturnType<
    typeof useManualToolsStore.getState
  >['setManualImageTool'];
  setManualToolsConfigOpen: ReturnType<
    typeof useManualToolsStore.getState
  >['setManualToolsConfigOpen'];

  /* Cleaner */
  clearCleanerManualPaintForImage: ReturnType<
    typeof useCleanerManualEdits
  >['clearCleanerManualPaintForImage'];
  resetCleanerManualImageEditsForImage: ReturnType<
    typeof useCleanerManualEdits
  >['resetCleanerManualImageEditsForImage'];

  /* Image collection */
  rotateImage: ReturnType<typeof useImageCollectionStore.getState>['rotateImage'];
}

export function useDashboardKeyboard({
  activeId,
  shortcutCenterOpen,
  translatorWorkspaceMode,
  handleModeChange,
  handleToolsToggle,
  openShortcutCenter,
  handleWorkspaceManualSave,
  handleWorkspaceRedo,
  handleWorkspaceUndo,
  clearAioRegionsForActiveImage,
  removeSelectedAioRegion,
  applyActiveTypographyPresetToSelection,
  applyAutoDetectedShapeToActiveRegion,
  applyLegacyTypographyPresetToSelection,
  applySelectedTypographerQueueItem,
  convertActiveTypographerShape,
  duplicateSelectedTypographerRegion,
  handleTypographerSaveSnapshot,
  handleTypographerToggleMultiBubble,
  navigateActiveTypographerRegion,
  refineActiveTypographerShape,
  clearAioManualPaintForImage,
  resetAioManualImageEditsForImage,
  toggleManualImageTool,
  toggleManualToolsConfig,
  setSegmentEditTool,
  setManualImageTool,
  setManualToolsConfigOpen,
  clearCleanerManualPaintForImage,
  resetCleanerManualImageEditsForImage,
  rotateImage,
}: UseDashboardKeyboardArgs) {
  // Shell state read at the same cadence as the page's own selectors
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const processing = useUiShellStore((s) => s.processing);
  const keyboardShortcutConfig = useUiShellStore(
    (s) => s.keyboardShortcutConfig,
  );
  const setZoom = useUiShellStore((s) => s.setZoom);
  const setViewMode = useUiShellStore((s) => s.setViewMode);
  const setInlineEditorShortcutRequestKey = useUiShellStore(
    (s) => s.setInlineEditorShortcutRequestKey,
  );

  const dispatchKeyboardShortcutAction = useCallback(
    (actionId: ShortcutActionId) => {
      const getActiveSelectedRegion = () =>
        readActiveAioSelectedRegion(activeId);
      switch (actionId) {
        case 'openShortcutModal':
          openShortcutCenter();
          return true;
        case 'toggleToolsPanel':
          handleToolsToggle();
          return true;
        case 'rotateActiveImage':
          if (!activeId || processing) return false;
          rotateImage(activeId);
          return true;
        case 'workspaceUndo':
          void handleWorkspaceUndo();
          return true;
        case 'workspaceRedo':
          void handleWorkspaceRedo();
          return true;
        case 'workspaceSave':
          void handleWorkspaceManualSave();
          return true;
        case 'zoomIn':
          setZoom((prev) => clamp(prev + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
          return true;
        case 'zoomOut':
          setZoom((prev) => clamp(prev - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
          return true;
        case 'setViewPaginated':
          setViewMode('paginated');
          return true;
        case 'setViewLongStrip':
          setViewMode('long_strip');
          return true;
        case 'setModeOrganize':
          handleModeChange('organize');
          return true;
        case 'setModeAio':
          handleModeChange('aio');
          return true;
        case 'setModeCleaner':
          handleModeChange('cleaner');
          return true;
        case 'setModeTypesetter':
          handleModeChange('typesetter');
          return true;
        case 'setModeTranslator':
          handleModeChange('translator');
          return true;
        case 'setModeRaw':
          handleModeChange('raw');
          return true;
        case 'setModeProofreader':
          handleModeChange('proofreader');
          return true;
        case 'setModeStitch':
          handleModeChange('stitch');
          return true;
        case 'setModeSplit':
          handleModeChange('split');
          return true;
        case 'setModeWatermark':
          handleModeChange('watermark');
          return true;
        case 'setModeEnhance':
          handleModeChange('enhance');
          return true;
        case 'setModeGuides':
          handleModeChange('guides');
          return true;
        case 'setModeResources':
          handleModeChange('resources');
          return true;
        case 'applyText':
          applySelectedTypographerQueueItem();
          return true;
        case 'nextRegion':
          navigateActiveTypographerRegion(1);
          return true;
        case 'previousRegion':
          navigateActiveTypographerRegion(-1);
          return true;
        case 'toggleMultiBubble':
          handleTypographerToggleMultiBubble();
          return true;
        case 'saveSnapshot':
          handleTypographerSaveSnapshot();
          return true;
        case 'detectShapes':
          if (!getActiveSelectedRegion()) return false;
          void refineActiveTypographerShape();
          return true;
        case 'applyActivePreset':
          if (!getActiveSelectedRegion()) return false;
          applyActiveTypographyPresetToSelection();
          return true;
        case 'applyLegacyPresetTextBubble':
          return applyLegacyTypographyPresetToSelection('text_bubble');
        case 'applyLegacyPresetTextFree':
          return applyLegacyTypographyPresetToSelection('text_free');
        case 'applyLegacyPresetTextSfx':
          return applyLegacyTypographyPresetToSelection('text_sfx');
        case 'applyLegacyPresetTextNarration':
          return applyLegacyTypographyPresetToSelection('text_narration');
        case 'applyLegacyPresetTextInsideBlackBubble':
          return applyLegacyTypographyPresetToSelection(
            'text_inside_black_bubble',
          );
        case 'applyAutoShape':
          if (!getActiveSelectedRegion()) return false;
          applyAutoDetectedShapeToActiveRegion();
          return true;
        case 'convertShapeSquare':
          if (!getActiveSelectedRegion()) return false;
          convertActiveTypographerShape('square');
          return true;
        case 'convertShapeRounded':
          if (!getActiveSelectedRegion()) return false;
          convertActiveTypographerShape('rounded');
          return true;
        case 'deleteRegion':
          removeSelectedAioRegion();
          return true;
        case 'editInline': {
          const activeSelectedRegion = getActiveSelectedRegion();
          if (!activeSelectedRegion) return false;
          setInlineEditorShortcutRequestKey(
            `${activeSelectedRegion.id}::${Date.now()}`,
          );
          return true;
        }
        // ── Tool Palette ───────────────────────────────────────────────────
        case 'duplicateRegion':
          if (!getActiveSelectedRegion()) return false;
          duplicateSelectedTypographerRegion();
          return true;
        case 'toolConfigToggle':
          toggleManualToolsConfig();
          return true;
        case 'toolAreaSelect':
          if (!activeId || processing) return false;
          setSegmentEditTool('select');
          setManualImageTool('none');
          setManualToolsConfigOpen(true);
          return true;
        case 'toolClearRegions':
          if (!activeId || processing) return false;
          clearAioRegionsForActiveImage();
          return true;
        case 'toolSegmentBrush':
          if (!activeId || processing) return false;
          setManualImageTool('none');
          setSegmentEditTool('brush');
          setManualToolsConfigOpen(true);
          return true;
        case 'toolSegmentEraser':
          if (!activeId || processing) return false;
          setManualImageTool('none');
          setSegmentEditTool('eraser');
          setManualToolsConfigOpen(true);
          return true;
        case 'toolPaint':
          if (!activeId || processing) return false;
          toggleManualImageTool('paint');
          return true;
        case 'toolPaintEraser':
          if (!activeId || processing) return false;
          toggleManualImageTool('paint_eraser');
          return true;
        case 'toolMagicWand':
          if (!activeId || processing) return false;
          toggleManualImageTool('magic_wand');
          return true;
        case 'toolHealingBrush':
          if (!activeId || processing) return false;
          toggleManualImageTool('healing_brush');
          return true;
        case 'toolClearPaint':
          if (!activeId || processing) return false;
          if (mode === 'cleaner') clearCleanerManualPaintForImage(activeId);
          else clearAioManualPaintForImage(activeId);
          return true;
        case 'toolResetEdits':
          if (!activeId || processing) return false;
          if (mode === 'cleaner') resetCleanerManualImageEditsForImage(activeId);
          else resetAioManualImageEditsForImage(activeId);
          return true;
        default:
          return false;
      }
    },
    [
      activeId,
      applySelectedTypographerQueueItem,
      applyActiveTypographyPresetToSelection,
      applyLegacyTypographyPresetToSelection,
      applyAutoDetectedShapeToActiveRegion,
      convertActiveTypographerShape,
      clearAioManualPaintForImage,
      clearAioRegionsForActiveImage,
      clearCleanerManualPaintForImage,
      duplicateSelectedTypographerRegion,
      handleModeChange,
      handleToolsToggle,
      handleTypographerSaveSnapshot,
      handleTypographerToggleMultiBubble,
      handleWorkspaceManualSave,
      handleWorkspaceRedo,
      handleWorkspaceUndo,
      mode,
      navigateActiveTypographerRegion,
      openShortcutCenter,
      processing,
      refineActiveTypographerShape,
      removeSelectedAioRegion,
      resetAioManualImageEditsForImage,
      resetCleanerManualImageEditsForImage,
      rotateImage,
      setInlineEditorShortcutRequestKey,
      setManualImageTool,
      setManualToolsConfigOpen,
      setSegmentEditTool,
      setViewMode,
      setZoom,
      toggleManualImageTool,
      toggleManualToolsConfig,
    ],
  );

  useEffect(() => {
    if (shortcutCenterOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const pressedShortcut = collectShortcutStateFromKeyboardEvent(event);
      const matchedAction = findMatchingShortcutAction(
        keyboardShortcutConfig,
        pressedShortcut,
        {
          mode,
          subMode,
          translatorWorkspaceMode,
          activeId,
          activeSelectedRegionId: readActiveSelectedRegionIdForMode(
            mode,
            activeId,
          ),
          aioRenderReady: useAioPipelineStore.getState().aioSteps.render,
          processing,
        },
      );
      if (
        isEditableShortcutTarget(event.target)
        && matchedAction?.id !== 'workspaceSave'
      ) {
        return;
      }

      if (event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === 'y') {
          void handleWorkspaceRedo();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (!matchedAction) return;

      const handled = dispatchKeyboardShortcutAction(matchedAction.id);
      if (!handled) return;

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    activeId,
    dispatchKeyboardShortcutAction,
    keyboardShortcutConfig,
    mode,
    processing,
    shortcutCenterOpen,
    subMode,
    handleWorkspaceRedo,
    translatorWorkspaceMode,
  ]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ actionId?: ShortcutActionId }>;
      const actionId = customEvent.detail?.actionId;
      if (!actionId) {
        return;
      }

      const handled = dispatchKeyboardShortcutAction(actionId);
      if (!handled) {
        return;
      }
    };

    window.addEventListener("koma-desktop-shortcut", handler as EventListener);
    return () => {
      window.removeEventListener("koma-desktop-shortcut", handler as EventListener);
    };
  }, [dispatchKeyboardShortcutAction]);
}
