import React from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '../../../i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";
import {
  Wrench,
  X,
  PanelLeftOpen,
  ScanText,
  Trash2,
  Paintbrush,
  Eraser,
  Wand2,
  Sparkles,
  RefreshCcw,
} from 'lucide-react';
import KlSlider from '../../../components/dashboard/KlSlider';
import type {
  AioTextRegion,
  AreaSelectionCreateMode,
  SegmentEditTool,
  ManualImageEditTool,
  ToolMode,
} from '@/types/dashboard.types';
import type { AioStageSelection } from '@/types/aioModelPresets';
import type { KeyboardShortcutConfigV2, ShortcutActionId } from '../../../shortcuts/keyboardShortcuts';
import { getShortcutDisplayLabel } from '../../../shortcuts/keyboardShortcuts';

export interface DashboardManualDockProps {
  manualDockRightOffset: number;
  manualToolsConfigVisible: boolean;
  manualToolsConfigTitle: string;
  setManualToolsConfigOpen: (open: boolean) => void;
  areaSelectionToolHasConfig: boolean;
  areaSelectionCreateMode: AreaSelectionCreateMode;
  setAreaSelectionCreateMode: (mode: AreaSelectionCreateMode) => void;
  resolvedAioAreaSelectionShapeKind: string;
  activeSelectedRegion: AioTextRegion | null;
  duplicateSelectedTypographerRegion: () => void;
  applyAutoDetectedShapeToActiveRegion: () => void;
  convertActiveTypographerShape: (kind: 'square' | 'rounded') => void;

  activeStageAllowsSegmentTools: boolean;
  segmentEditTool: SegmentEditTool;
  segmentBrushSize: number;
  setSegmentBrushSize: (size: number) => void;

  activeStageAllowsManualImageTools: boolean;
  manualImageTool: ManualImageEditTool;
  manualImageBrushSize: number;
  setManualImageBrushSize: (size: number) => void;
  manualImageBrushOpacity: number;
  setManualImageBrushOpacity: (opacity: number) => void;
  manualImageBrushBlur: number;
  setManualImageBrushBlur: (blur: number) => void;
  manualImagePaintColor: string;
  setManualImagePaintColor: (color: string) => void;

  manualImageWandTolerance: number;
  setManualImageWandTolerance: (val: number) => void;
  activeHasManualWandSelection: boolean;
  activeManualHealingBusy: boolean;
  applyHealingFromActiveWandSelection: () => Promise<void>;

  activeId: string | null;
  clearManualWandSelection: (id: string) => void;
  aioStageSelection: AioStageSelection;
  toggleManualToolsConfig: () => void;
  activeDockToolHasConfig: boolean;
  isAioManualMode: boolean;

  areaSelectionToolActive: boolean;
  activeStageAllowsAreaTools: boolean;
  setSegmentEditTool: (tool: SegmentEditTool) => void;
  setManualImageTool: (tool: ManualImageEditTool) => void;
  clearAioRegionsForActiveImage: () => void;
  activeDockRegionsCount: number;
  toggleManualImageTool: (tool: Exclude<ManualImageEditTool, 'none'>) => void;
  mode: ToolMode;

  clearCleanerManualPaintForImage: (id: string) => void;
  clearAioManualPaintForImage: (id: string) => void;
  resetCleanerManualImageEditsForImage: (id: string) => void;
  resetAioManualImageEditsForImage: (id: string) => void;
  activeHasManualPaintLayer: boolean;
  activeHasManualEdits: boolean;
  shortcutConfig: KeyboardShortcutConfigV2;
}

type DockTooltipPreviewKind =
  | 'config'
  | 'area-select'
  | 'clear-page'
  | 'segment-brush'
  | 'segment-eraser'
  | 'paint'
  | 'paint-eraser'
  | 'magic-wand'
  | 'healing'
  | 'clear-paint'
  | 'reset-edits';

interface DockTooltipButtonProps {
  className?: string;
  ariaLabel: string;
  title: string;
  description: string;
  badge: string;
  previewKind: DockTooltipPreviewKind;
  disabled?: boolean;
  disabledReason?: string;
  hotkey?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ size?: number }>;
  iconSize?: number;
}

const renderDockTooltipPreview = (
  previewKind: DockTooltipPreviewKind,
): React.ReactNode => {
  switch (previewKind) {
    case 'config':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--config">
          <span className="koma-tool-rich-tooltip__panel" />
          <span className="koma-tool-rich-tooltip__knob koma-tool-rich-tooltip__knob--a" />
          <span className="koma-tool-rich-tooltip__knob koma-tool-rich-tooltip__knob--b" />
          <span className="koma-tool-rich-tooltip__knob koma-tool-rich-tooltip__knob--c" />
        </div>
      );
    case 'area-select':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--area">
          <span className="koma-tool-rich-tooltip__canvas" />
          <span className="koma-tool-rich-tooltip__selection" />
          <span className="koma-tool-rich-tooltip__cursor" />
        </div>
      );
    case 'clear-page':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--clear">
          <span className="koma-tool-rich-tooltip__bubble koma-tool-rich-tooltip__bubble--one" />
          <span className="koma-tool-rich-tooltip__bubble koma-tool-rich-tooltip__bubble--two" />
          <span className="koma-tool-rich-tooltip__wipe" />
        </div>
      );
    case 'segment-brush':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--segment-brush">
          <span className="koma-tool-rich-tooltip__mask" />
          <span className="koma-tool-rich-tooltip__stroke" />
          <span className="koma-tool-rich-tooltip__cursor koma-tool-rich-tooltip__cursor--brush" />
        </div>
      );
    case 'segment-eraser':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--segment-eraser">
          <span className="koma-tool-rich-tooltip__mask koma-tool-rich-tooltip__mask--filled" />
          <span className="koma-tool-rich-tooltip__eraser-swipe" />
        </div>
      );
    case 'paint':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--paint">
          <span className="koma-tool-rich-tooltip__canvas" />
          <span className="koma-tool-rich-tooltip__paint-stroke" />
        </div>
      );
    case 'paint-eraser':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--paint-eraser">
          <span className="koma-tool-rich-tooltip__paint-layer" />
          <span className="koma-tool-rich-tooltip__erase-track" />
        </div>
      );
    case 'magic-wand':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--wand">
          <span className="koma-tool-rich-tooltip__wand-area" />
          <span className="koma-tool-rich-tooltip__marching-ants" />
          <span className="koma-tool-rich-tooltip__spark koma-tool-rich-tooltip__spark--a" />
          <span className="koma-tool-rich-tooltip__spark koma-tool-rich-tooltip__spark--b" />
        </div>
      );
    case 'healing':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--healing">
          <span className="koma-tool-rich-tooltip__scar" />
          <span className="koma-tool-rich-tooltip__heal-pass" />
          <span className="koma-tool-rich-tooltip__spark koma-tool-rich-tooltip__spark--c" />
        </div>
      );
    case 'clear-paint':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--clear-paint">
          <span className="koma-tool-rich-tooltip__paint-layer koma-tool-rich-tooltip__paint-layer--dense" />
          <span className="koma-tool-rich-tooltip__wipe koma-tool-rich-tooltip__wipe--fast" />
        </div>
      );
    case 'reset-edits':
      return (
        <div className="koma-tool-rich-tooltip__preview koma-tool-rich-tooltip__preview--reset">
          <span className="koma-tool-rich-tooltip__history-ring" />
          <span className="koma-tool-rich-tooltip__history-arrow" />
          <span className="koma-tool-rich-tooltip__history-dot" />
        </div>
      );
  }
};

const DockTooltipButton: React.FC<DockTooltipButtonProps> = React.memo(({
  className,
  ariaLabel,
  title,
  description,
  badge,
  previewKind,
  disabled = false,
  disabledReason,
  hotkey,
  onClick,
  icon: Icon,
  iconSize = 14,
}) => {
  const { t } = useI18n();
  const footerText = disabled && disabledReason
    ? disabledReason
    : t('dashboard.dock.tooltip.hoverHint');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="koma-tool-palette__tooltip-anchor">
          <button
            type="button"
            className={className}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
          >
            <Icon size={iconSize} />
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        align="center"
        sideOffset={18}
        className="koma-tool-rich-tooltip"
      >
        <div className="koma-tool-rich-tooltip__media">
          {renderDockTooltipPreview(previewKind)}
        </div>
        <div className="koma-tool-rich-tooltip__body">
          <div className="koma-tool-rich-tooltip__topline">
            <strong>{title}</strong>
            <span>{badge}</span>
          </div>
          <p>{description}</p>
          <div className="koma-tool-rich-tooltip__footer">
            <span>{footerText}</span>
            {hotkey && !disabled && (
              <kbd className="koma-tool-rich-tooltip__kbd">{hotkey}</kbd>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

export const DashboardManualDock: React.FC<DashboardManualDockProps> = ({
  manualDockRightOffset,
  manualToolsConfigVisible,
  manualToolsConfigTitle,
  setManualToolsConfigOpen,
  areaSelectionToolHasConfig,
  areaSelectionCreateMode,
  setAreaSelectionCreateMode,
  resolvedAioAreaSelectionShapeKind,
  activeSelectedRegion,
  duplicateSelectedTypographerRegion,
  applyAutoDetectedShapeToActiveRegion,
  convertActiveTypographerShape,
  activeStageAllowsSegmentTools,
  segmentEditTool,
  segmentBrushSize,
  setSegmentBrushSize,
  activeStageAllowsManualImageTools,
  manualImageTool,
  manualImageBrushSize,
  setManualImageBrushSize,
  manualImageBrushOpacity,
  setManualImageBrushOpacity,
  manualImageBrushBlur,
  setManualImageBrushBlur,
  manualImagePaintColor,
  setManualImagePaintColor,
  manualImageWandTolerance,
  setManualImageWandTolerance,
  activeHasManualWandSelection,
  activeManualHealingBusy,
  applyHealingFromActiveWandSelection,
  activeId,
  clearManualWandSelection,
  aioStageSelection,
  toggleManualToolsConfig,
  activeDockToolHasConfig,
  isAioManualMode,
  areaSelectionToolActive,
  activeStageAllowsAreaTools,
  setSegmentEditTool,
  setManualImageTool,
  clearAioRegionsForActiveImage,
  activeDockRegionsCount,
  toggleManualImageTool,
  mode,
  clearCleanerManualPaintForImage,
  clearAioManualPaintForImage,
  resetCleanerManualImageEditsForImage,
  resetAioManualImageEditsForImage,
  activeHasManualPaintLayer,
  activeHasManualEdits,
  shortcutConfig,
}) => {
  const { t } = useI18n();
  /** Returns display label (e.g. "ALT + H") for a given action, or "" if unset. */
  const hk = (id: ShortcutActionId): string =>
    getShortcutDisplayLabel(shortcutConfig.shortcuts[id] ?? [], '');

  const openAreaSelect = React.useCallback(() => {
    if (!activeStageAllowsAreaTools) return;
    setSegmentEditTool('select');
    setManualImageTool('none');
    setManualToolsConfigOpen(true);
  }, [activeStageAllowsAreaTools, setSegmentEditTool, setManualImageTool, setManualToolsConfigOpen]);

  const selectSegmentBrush = React.useCallback(() => {
    if (!activeStageAllowsSegmentTools) return;
    setManualImageTool('none');
    setSegmentEditTool('brush');
    setManualToolsConfigOpen(true);
  }, [activeStageAllowsSegmentTools, setManualImageTool, setSegmentEditTool, setManualToolsConfigOpen]);

  const selectSegmentEraser = React.useCallback(() => {
    if (!activeStageAllowsSegmentTools) return;
    setManualImageTool('none');
    setSegmentEditTool('eraser');
    setManualToolsConfigOpen(true);
  }, [activeStageAllowsSegmentTools, setManualImageTool, setSegmentEditTool, setManualToolsConfigOpen]);

  const pickPaintTool = React.useCallback(() => toggleManualImageTool('paint'), [toggleManualImageTool]);
  const pickPaintEraserTool = React.useCallback(() => toggleManualImageTool('paint_eraser'), [toggleManualImageTool]);
  const pickWandTool = React.useCallback(() => toggleManualImageTool('magic_wand'), [toggleManualImageTool]);
  const pickHealingTool = React.useCallback(() => toggleManualImageTool('healing_brush'), [toggleManualImageTool]);

  const clearActivePaint = React.useCallback(() => {
    if (!activeId) return;
    if (mode === 'cleaner') {
      clearCleanerManualPaintForImage(activeId);
      return;
    }
    clearAioManualPaintForImage(activeId);
  }, [mode, activeId, clearCleanerManualPaintForImage, clearAioManualPaintForImage]);

  const resetActiveEdits = React.useCallback(() => {
    if (!activeId) return;
    if (mode === 'cleaner') {
      resetCleanerManualImageEditsForImage(activeId);
      return;
    }
    resetAioManualImageEditsForImage(activeId);
  }, [mode, activeId, resetCleanerManualImageEditsForImage, resetAioManualImageEditsForImage]);

  return (
    <>
      {/* ═══ Tool Config Flyout ═══ */}
      {manualToolsConfigVisible && (
        <aside
          className="koma-tool-config custom-scrollbar"
          style={{ right: manualDockRightOffset + 62 }}
          aria-label={t('dashboard.dock.config.ariaLabel')}
        >
          <div className="koma-tool-config__head">
            <div className="koma-tool-config__title">
              <span className="koma-tool-config__title-icon" aria-hidden="true">
                <Wrench size={11} />
              </span>
              {manualToolsConfigTitle}
            </div>
            <button
              type="button"
              className="koma-tool-config__close"
              onClick={() => setManualToolsConfigOpen(false)}
              title={t('dashboard.dock.config.closeTitle')}
              aria-label={t('dashboard.dock.config.closeAriaLabel')}
            >
              <X size={13} />
            </button>
          </div>

          <div className="koma-tool-config__body">
            {/* ── Area Selection Config ──────────────────────── */}
            {areaSelectionToolHasConfig && (
              <div className="koma-tool-config__section">
                <span className="koma-tool-config__section-title">
                  <ScanText size={10} /> {t('dashboard.dock.areaSelection.sectionTitle')}
                </span>

                <div className="koma-field">
                  <label className="koma-field__label">
                    {t('dashboard.dock.areaSelection.shapeLabel')}
                  </label>
                  <select
                    value={areaSelectionCreateMode}
                    onChange={(e) =>
                      setAreaSelectionCreateMode(
                        e.target.value as AreaSelectionCreateMode,
                      )
                    }
                    className="koma-select"
                    aria-label={t('dashboard.dock.areaSelection.shapeLabel')}
                  >
                    <option value="auto">{t('dashboard.dock.areaSelection.optionAuto')}</option>
                    <option value="square">{t('dashboard.dock.areaSelection.optionSquare')}</option>
                    <option value="rounded">{t('dashboard.dock.areaSelection.optionRounded')}</option>
                  </select>
                </div>

                <p className="koma-tool-config__hint">
                  {areaSelectionCreateMode === 'auto'
                    ? t('dashboard.dock.areaSelection.hintAuto').replace('{kind}', resolvedAioAreaSelectionShapeKind)
                    : t('dashboard.dock.areaSelection.hintFixed').replace('{mode}', areaSelectionCreateMode)}
                </p>

                <div className="koma-tool-config__btn-grid">
                  <button
                    type="button"
                    className="koma-btn koma-btn--ghost"
                    disabled={!activeSelectedRegion}
                    onClick={duplicateSelectedTypographerRegion}
                  >
                    {t('dashboard.dock.areaSelection.btnDuplicate')}
                  </button>
                  <button
                    type="button"
                    className="koma-btn koma-btn--ghost"
                    disabled={!activeSelectedRegion}
                    onClick={applyAutoDetectedShapeToActiveRegion}
                  >
                    {t('dashboard.dock.areaSelection.btnToAuto')}
                  </button>
                  <button
                    type="button"
                    className="koma-btn koma-btn--ghost"
                    disabled={!activeSelectedRegion}
                    onClick={() => convertActiveTypographerShape('square')}
                  >
                    {t('dashboard.dock.areaSelection.btnToSquare')}
                  </button>
                  <button
                    type="button"
                    className="koma-btn koma-btn--ghost"
                    disabled={!activeSelectedRegion}
                    onClick={() => convertActiveTypographerShape('rounded')}
                  >
                    {t('dashboard.dock.areaSelection.btnToRounded')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Segment Brush/Eraser Config ────────────────── */}
            {activeStageAllowsSegmentTools &&
              (segmentEditTool === 'brush' || segmentEditTool === 'eraser') && (
                <div className="koma-tool-config__section">
                  <span className="koma-tool-config__section-title">
                    {segmentEditTool === 'brush' ? (
                      <>
                        <Paintbrush size={10} /> {t('dashboard.dock.segment.brushTitle')}
                      </>
                    ) : (
                      <>
                        <Eraser size={10} /> {t('dashboard.dock.segment.eraserTitle')}
                      </>
                    )}
                  </span>
                  <KlSlider
                    label={t('dashboard.dock.segment.sizeLabel')}
                    value={segmentBrushSize}
                    min={6}
                    max={120}
                    step={1}
                    onChange={setSegmentBrushSize}
                    resetVal={28}
                  />
                  <p className="koma-tool-config__hint">
                    {t('dashboard.dock.segment.hint')}
                  </p>
                </div>
              )}

            {/* ── Manual Image Tool Config ───────────────────── */}
            {activeStageAllowsManualImageTools &&
              (manualImageTool === 'paint' ||
                manualImageTool === 'paint_eraser' ||
                manualImageTool === 'healing_brush') && (
                <div className="koma-tool-config__section">
                  <span className="koma-tool-config__section-title">
                    {manualImageTool === 'paint' && (
                      <>
                        <Paintbrush size={10} /> {t('dashboard.dock.imageTool.paintTitle')}
                      </>
                    )}
                    {manualImageTool === 'paint_eraser' && (
                      <>
                        <Eraser size={10} /> {t('dashboard.dock.imageTool.eraserTitle')}
                      </>
                    )}
                    {manualImageTool === 'healing_brush' && (
                      <>
                        <Sparkles size={10} /> {t('dashboard.dock.imageTool.healingTitle')}
                      </>
                    )}
                  </span>

                  <KlSlider
                    label={t('dashboard.dock.imageTool.sizeLabel')}
                    value={manualImageBrushSize}
                    min={4}
                    max={160}
                    step={1}
                    onChange={setManualImageBrushSize}
                    resetVal={26}
                  />
                  <KlSlider
                    label={t('dashboard.dock.imageTool.opacityLabel')}
                    value={manualImageBrushOpacity}
                    min={0.05}
                    max={1}
                    step={0.01}
                    onChange={setManualImageBrushOpacity}
                    resetVal={1}
                  />
                  <KlSlider
                    label={t('dashboard.dock.imageTool.blurLabel')}
                    value={manualImageBrushBlur}
                    min={0}
                    max={24}
                    step={0.5}
                    onChange={setManualImageBrushBlur}
                    resetVal={0}
                  />

                  {manualImageTool === 'paint' && (
                    <div className="koma-field">
                      <label className="koma-field__label">{t('dashboard.dock.imageTool.colorLabel')}</label>
                      <input
                        type="color"
                        value={manualImagePaintColor}
                        onChange={(e) =>
                          setManualImagePaintColor(e.target.value)
                        }
                        className="koma-tool-config__color"
                        aria-label={t('dashboard.dock.imageTool.colorAriaLabel')}
                      />
                    </div>
                  )}
                </div>
              )}

            {/* ── Magic Wand Config ──────────────────────────── */}
            {activeStageAllowsManualImageTools &&
              manualImageTool === 'magic_wand' && (
                <div className="koma-tool-config__section">
                  <span className="koma-tool-config__section-title">
                    <Wand2 size={10} /> {t('dashboard.dock.magicWand.title')}
                  </span>

                  <KlSlider
                    label={t('dashboard.dock.magicWand.toleranceLabel')}
                    value={manualImageWandTolerance}
                    min={0}
                    max={160}
                    step={1}
                    onChange={setManualImageWandTolerance}
                    resetVal={34}
                  />

                  <div className="koma-tool-config__action-row">
                    <button
                      type="button"
                      className="koma-btn koma-btn--primary"
                      disabled={
                        !activeHasManualWandSelection ||
                        activeManualHealingBusy ||
                        !activeId
                      }
                      onClick={() => {
                        void applyHealingFromActiveWandSelection();
                      }}
                      title={t('dashboard.dock.magicWand.healingBtnTitle')}
                    >
                      {activeManualHealingBusy ? t('dashboard.dock.magicWand.healingBtnBusy') : t('dashboard.dock.magicWand.healingBtn')}
                    </button>
                    <button
                      type="button"
                      className="koma-btn koma-btn--ghost"
                      disabled={!activeHasManualWandSelection || !activeId}
                      onClick={() => {
                        if (!activeId) return;
                        clearManualWandSelection(activeId);
                      }}
                    >
                      {t('dashboard.dock.magicWand.clearBtn')}
                    </button>
                  </div>
                </div>
              )}

            {/* ── Healing Model Info ─────────────────────────── */}
            {activeStageAllowsManualImageTools &&
              (manualImageTool === 'magic_wand' ||
                manualImageTool === 'healing_brush') && (
                <p className="koma-tool-config__hint">
                  {t('dashboard.dock.imageTool.modelHint')}<strong>{aioStageSelection.cleanImage}</strong>
                </p>
              )}
          </div>
        </aside>
      )}

      {/* ═══ Tool Palette Bar ═══ */}
      <TooltipProvider delayDuration={1000} skipDelayDuration={120}>
        <div
          className="koma-tool-palette"
          data-tour="dashboard-manual-dock"
          style={{ right: manualDockRightOffset }}
          role="toolbar"
          aria-label={t('dashboard.dock.palette.ariaLabel')}
        >
          {/* Config Toggle */}
          <div className="koma-tool-palette__group">
            <DockTooltipButton
              className={cn(
                'koma-tool-palette__btn',
                manualToolsConfigVisible && 'koma-tool-palette__btn--active',
              )}
              ariaLabel={
                manualToolsConfigVisible ? t('dashboard.dock.config.closeLabel') : t('dashboard.dock.config.openLabel')
              }
              title={manualToolsConfigVisible ? t('dashboard.dock.config.closeLabel') : t('dashboard.dock.config.openLabel')}
              description={t('dashboard.dock.config.description')}
              badge={t('dashboard.dock.config.badge')}
              previewKind="config"
              disabled={!activeDockToolHasConfig}
              disabledReason={t('dashboard.dock.config.disabledReason')}
              hotkey={hk('toolConfigToggle')}
              onClick={toggleManualToolsConfig}
              icon={PanelLeftOpen}
              iconSize={15}
            />
          </div>

          {/* ── Region Tools ────────────────────────────── */}
          {isAioManualMode && (
            <>
              <div className="koma-tool-palette__divider" aria-hidden="true">
                <span className="koma-tool-palette__divider-label">{t('dashboard.dock.divider.reg')}</span>
              </div>

              <div className="koma-tool-palette__group">
                <DockTooltipButton
                  className={cn(
                    'koma-tool-palette__btn',
                    areaSelectionToolActive &&
                    activeStageAllowsAreaTools &&
                    'koma-tool-palette__btn--active',
                  )}
                  ariaLabel={t('dashboard.dock.areaSelect.ariaLabel')}
                  title={t('dashboard.dock.areaSelect.title')}
                  description={t('dashboard.dock.areaSelect.description')}
                  badge={t('dashboard.dock.areaSelect.badge')}
                  previewKind="area-select"
                  disabled={!activeStageAllowsAreaTools}
                  disabledReason={t('dashboard.dock.areaSelect.disabledReason')}
                  hotkey={hk('toolAreaSelect')}
                  onClick={openAreaSelect}
                  icon={ScanText}
                />

                <DockTooltipButton
                  className="koma-tool-palette__btn koma-tool-palette__btn--danger"
                  ariaLabel={t('dashboard.dock.clearPage.ariaLabel')}
                  title={t('dashboard.dock.clearPage.title')}
                  description={t('dashboard.dock.clearPage.description')}
                  badge={t('dashboard.dock.clearPage.badge')}
                  previewKind="clear-page"
                  disabled={
                    !activeStageAllowsAreaTools || activeDockRegionsCount === 0
                  }
                  disabledReason={t('dashboard.dock.clearPage.disabledReason')}
                  hotkey={hk('toolClearRegions')}
                  onClick={clearAioRegionsForActiveImage}
                  icon={Trash2}
                />
              </div>
            </>
          )}

          {/* ── Segment Tools ───────────────────────────── */}
          <div className="koma-tool-palette__divider" aria-hidden="true">
            <span className="koma-tool-palette__divider-label">{t('dashboard.dock.divider.seg')}</span>
          </div>

          <div className="koma-tool-palette__group">
            <DockTooltipButton
              className={cn(
                'koma-tool-palette__btn',
                segmentEditTool === 'brush' &&
                activeStageAllowsSegmentTools &&
                'koma-tool-palette__btn--active',
              )}
              ariaLabel={t('dashboard.dock.segBrush.ariaLabel')}
              title={t('dashboard.dock.segBrush.title')}
              description={t('dashboard.dock.segBrush.description')}
              badge={t('dashboard.dock.segBrush.badge')}
              previewKind="segment-brush"
              disabled={!activeStageAllowsSegmentTools}
              disabledReason={t('dashboard.dock.segBrush.disabledReason')}
              hotkey={hk('toolSegmentBrush')}
              onClick={selectSegmentBrush}
              icon={Paintbrush}
            />

            <DockTooltipButton
              className={cn(
                'koma-tool-palette__btn',
                segmentEditTool === 'eraser' &&
                activeStageAllowsSegmentTools &&
                'koma-tool-palette__btn--active',
              )}
              ariaLabel={t('dashboard.dock.segEraser.ariaLabel')}
              title={t('dashboard.dock.segEraser.title')}
              description={t('dashboard.dock.segEraser.description')}
              badge={t('dashboard.dock.segEraser.badge')}
              previewKind="segment-eraser"
              disabled={!activeStageAllowsSegmentTools}
              disabledReason={t('dashboard.dock.segEraser.disabledReason')}
              hotkey={hk('toolSegmentEraser')}
              onClick={selectSegmentEraser}
              icon={Eraser}
            />
          </div>

          {/* ── Image Tools ─────────────────────────────── */}
          <div className="koma-tool-palette__divider" aria-hidden="true">
            <span className="koma-tool-palette__divider-label">{t('dashboard.dock.divider.img')}</span>
          </div>

          <div className="koma-tool-palette__group">
            <DockTooltipButton
              className={cn(
                'koma-tool-palette__btn',
                manualImageTool === 'paint' &&
                activeStageAllowsManualImageTools &&
                'koma-tool-palette__btn--active',
              )}
              ariaLabel={t('dashboard.dock.paint.ariaLabel')}
              title={t('dashboard.dock.paint.title')}
              description={t('dashboard.dock.paint.description')}
              badge={t('dashboard.dock.paint.badge')}
              previewKind="paint"
              disabled={!activeStageAllowsManualImageTools}
              disabledReason={t('dashboard.dock.paint.disabledReason')}
              hotkey={hk('toolPaint')}
              onClick={pickPaintTool}
              icon={Paintbrush}
            />

            <DockTooltipButton
              className={cn(
                'koma-tool-palette__btn',
                manualImageTool === 'paint_eraser' &&
                activeStageAllowsManualImageTools &&
                'koma-tool-palette__btn--active',
              )}
              ariaLabel={t('dashboard.dock.paintEraser.ariaLabel')}
              title={t('dashboard.dock.paintEraser.title')}
              description={t('dashboard.dock.paintEraser.description')}
              badge={t('dashboard.dock.paintEraser.badge')}
              previewKind="paint-eraser"
              disabled={!activeStageAllowsManualImageTools}
              disabledReason={t('dashboard.dock.paintEraser.disabledReason')}
              hotkey={hk('toolPaintEraser')}
              onClick={pickPaintEraserTool}
              icon={Eraser}
            />

            <DockTooltipButton
              className={cn(
                'koma-tool-palette__btn',
                manualImageTool === 'magic_wand' &&
                activeStageAllowsManualImageTools &&
                'koma-tool-palette__btn--active',
              )}
              ariaLabel={t('dashboard.dock.wand.ariaLabel')}
              title={t('dashboard.dock.wand.title')}
              description={t('dashboard.dock.wand.description')}
              badge={t('dashboard.dock.wand.badge')}
              previewKind="magic-wand"
              disabled={!activeStageAllowsManualImageTools}
              disabledReason={t('dashboard.dock.wand.disabledReason')}
              hotkey={hk('toolMagicWand')}
              onClick={pickWandTool}
              icon={Wand2}
            />

            <DockTooltipButton
              className={cn(
                'koma-tool-palette__btn',
                manualImageTool === 'healing_brush' &&
                activeStageAllowsManualImageTools &&
                'koma-tool-palette__btn--active',
              )}
              ariaLabel={t('dashboard.dock.healing.ariaLabel')}
              title={t('dashboard.dock.healing.title')}
              description={t('dashboard.dock.healing.description')}
              badge={t('dashboard.dock.healing.badge')}
              previewKind="healing"
              disabled={!activeStageAllowsManualImageTools}
              disabledReason={t('dashboard.dock.healing.disabledReason')}
              hotkey={hk('toolHealingBrush')}
              onClick={pickHealingTool}
              icon={Sparkles}
            />
          </div>

          {/* ── Destructive Actions ─────────────────────── */}
          <span className="koma-tool-palette__sep" aria-hidden="true" />

          <div className="koma-tool-palette__group">
            <DockTooltipButton
              className="koma-tool-palette__btn koma-tool-palette__btn--danger"
              ariaLabel={t('dashboard.dock.clearPaint.ariaLabel')}
              title={t('dashboard.dock.clearPaint.title')}
              description={t('dashboard.dock.clearPaint.description')}
              badge={t('dashboard.dock.clearPaint.badge')}
              previewKind="clear-paint"
              disabled={
                !activeStageAllowsManualImageTools ||
                !activeId ||
                !activeHasManualPaintLayer
              }
              disabledReason={t('dashboard.dock.clearPaint.disabledReason')}
              hotkey={hk('toolClearPaint')}
              onClick={clearActivePaint}
              icon={Trash2}
            />

            <DockTooltipButton
              className="koma-tool-palette__btn koma-tool-palette__btn--danger"
              ariaLabel={t('dashboard.dock.resetEdits.ariaLabel')}
              title={t('dashboard.dock.resetEdits.title')}
              description={t('dashboard.dock.resetEdits.description')}
              badge={t('dashboard.dock.resetEdits.badge')}
              previewKind="reset-edits"
              disabled={
                !activeStageAllowsManualImageTools ||
                !activeId ||
                !activeHasManualEdits
              }
              disabledReason={t('dashboard.dock.resetEdits.disabledReason')}
              hotkey={hk('toolResetEdits')}
              onClick={resetActiveEdits}
              icon={RefreshCcw}
            />
          </div>
        </div>
      </TooltipProvider>
    </>
  );
};
