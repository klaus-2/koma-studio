import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useI18n } from '../../../../i18n';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@koma/ui/components/tooltip';
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
import KlSlider from '../../../../components/dashboard/KlSlider';
import type {
  AioTextRegion,
  AreaSelectionCreateMode,
  SegmentEditTool,
  ManualImageEditTool,
  ToolMode,
} from '../../../../types/dashboard.types';
import type { AioStageSelection } from '@/types/aioModelPresets';
import type { KeyboardShortcutConfigV2, ShortcutActionId } from '../../../../shortcuts/keyboardShortcuts';
import { getShortcutDisplayLabel } from '../../../../shortcuts/keyboardShortcuts';

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
  | 'config' | 'area-select' | 'clear-page' | 'segment-brush' | 'segment-eraser'
  | 'paint' | 'paint-eraser' | 'magic-wand' | 'healing' | 'clear-paint' | 'reset-edits';

const renderDockTooltipPreview = (kind: DockTooltipPreviewKind): React.ReactNode => {
  const base = 'relative h-16 w-full overflow-hidden bg-ink panel-cut-sm';
  switch (kind) {
    case 'config':
      return (
        <div className={cn(base, 'halftone')}>
          <span className="absolute inset-x-3 top-3 h-2 bg-crimson/60" />
          <span className="absolute left-3 top-7 h-1.5 w-1.5 bg-gold" />
          <span className="absolute left-6 top-7 h-1.5 w-1.5 bg-azure" />
          <span className="absolute left-9 top-7 h-1.5 w-1.5 bg-mint" />
          <span className="absolute inset-x-3 bottom-3 h-2 bg-paper/20" />
        </div>
      );
    case 'area-select':
      return (
        <div className={cn(base, 'halftone-red')}>
          <motion.span className="absolute left-1/2 top-1/2 h-8 w-12 -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-azure"
            animate={{ scale: [0.85, 1, 0.85] }} transition={{ duration: 2, repeat: Infinity }} />
          <span className="absolute right-3 bottom-3 h-2 w-2 border-r-2 border-b-2 border-crimson" />
        </div>
      );
    case 'clear-page':
      return (
        <div className={base}>
          <span className="absolute left-4 top-4 h-6 w-8 border-2 border-paper/30" />
          <span className="absolute right-4 bottom-4 h-5 w-7 border-2 border-paper/30" />
          <motion.span className="absolute inset-y-0 left-0 w-1/2 bg-crimson/40"
            animate={{ x: ['0%', '200%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      );
    case 'segment-brush':
      return (
        <div className={cn(base, 'halftone')}>
          <span className="absolute inset-2 bg-azure/10" />
          <motion.span className="absolute left-3 top-1/2 h-2 w-4/5 origin-left -translate-y-1/2 rounded-full bg-azure"
            animate={{ scaleX: [0, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
        </div>
      );
    case 'segment-eraser':
      return (
        <div className={base}>
          <span className="absolute inset-2 bg-azure/25" />
          <motion.span className="absolute top-1/2 h-3 w-3 -translate-y-1/2 bg-ink"
            animate={{ left: ['10%', '80%'] }} transition={{ duration: 1.6, repeat: Infinity }} />
        </div>
      );
    case 'paint':
      return (
        <div className={cn(base, 'halftone')}>
          <motion.span className="absolute left-3 top-1/2 h-2.5 w-5/6 origin-left -translate-y-1/2 bg-crimson"
            animate={{ scaleX: [0, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
        </div>
      );
    case 'paint-eraser':
      return (
        <div className={base}>
          <span className="absolute inset-2 bg-crimson/25" />
          <motion.span className="absolute top-1/2 h-3 w-4 -translate-y-1/2 bg-ink"
            animate={{ left: ['5%', '80%'] }} transition={{ duration: 1.6, repeat: Infinity }} />
        </div>
      );
    case 'magic-wand':
      return (
        <div className={cn(base, 'halftone-red')}>
          <motion.span className="absolute left-1/2 top-1/2 h-7 w-9 -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-gold"
            animate={{ rotate: [0, 3, -3, 0] }} transition={{ duration: 2, repeat: Infinity }} />
          <motion.span className="absolute left-4 top-4 text-gold" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <Sparkles size={10} />
          </motion.span>
        </div>
      );
    case 'healing':
      return (
        <div className={base}>
          <span className="absolute left-1/2 top-3 h-10 w-0.5 -translate-x-1/2 bg-crimson/50" />
          <motion.span className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-mint"
            animate={{ top: ['12%', '78%'], opacity: [1, 0.3] }} transition={{ duration: 1.6, repeat: Infinity }} />
        </div>
      );
    case 'clear-paint':
      return (
        <div className={base}>
          <span className="absolute inset-2 bg-crimson/40" />
          <motion.span className="absolute inset-y-0 left-0 w-1/3 bg-ink"
            animate={{ x: ['0%', '300%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      );
    case 'reset-edits':
      return (
        <div className={cn(base, 'grid place-items-center')}>
          <motion.span className="text-crimson" animate={{ rotate: -360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
            <RefreshCcw size={22} />
          </motion.span>
        </div>
      );
  }
};

interface DockTooltipButtonProps {
  active?: boolean;
  danger?: boolean;
  ariaLabel: string;
  title: string;
  description: string;
  badge: string;
  previewKind: DockTooltipPreviewKind;
  disabled?: boolean;
  disabledReason?: string;
  hotkey?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

const DockTooltipButton: React.FC<DockTooltipButtonProps> = ({
  active, danger, ariaLabel, title, description, badge, previewKind,
  disabled = false, disabledReason, hotkey, onClick, children,
}) => {
  const { t } = useI18n();
  const footerText = disabled && disabledReason ? disabledReason : t('dashboard.dock.tooltip.hoverHint');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative inline-flex">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-pressed={active}
            className={cn(
              'panel-cut-sm group relative grid h-9 w-9 place-items-center transition-all duration-200',
              active
                ? danger
                  ? 'bg-crimson text-ink shadow-hard-paper'
                  : 'bg-crimson text-ink shadow-hard-gold'
                : danger
                  ? 'bg-ink-3/70 text-crimson hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson hover:text-ink hover:shadow-hard-gold'
                  : 'bg-ink-3/70 text-paper-dim hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-ink-3 hover:text-paper hover:shadow-hard-crimson',
              disabled && 'cursor-not-allowed opacity-25 hover:translate-x-0 hover:translate-y-0 hover:bg-ink-3/70 hover:text-paper-dim hover:shadow-none',
            )}
          >
            {active && !disabled && (
              <span className="absolute -left-1 top-1/2 h-4 w-1 -translate-y-1/2 bg-crimson blink-noir" aria-hidden="true" />
            )}
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" align="center" sideOffset={18} className="glass panel-cut border-crimson/30 w-64 p-0 shadow-hard-crimson">
        <div className="p-2">
          {renderDockTooltipPreview(previewKind)}
        </div>
        <div className="relative px-3 pb-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <strong className="font-display text-sm font-black uppercase tracking-tight text-paper">{title}</strong>
            <span className="panel-cut-sm shrink-0 border border-crimson/40 bg-crimson/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-crimson">{badge}</span>
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-paper-dim">{description}</p>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-paper/10 pt-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-paper-dim">{footerText}</span>
            {hotkey && !disabled && (
              <kbd className="panel-cut-sm border border-paper/20 bg-ink px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-gold">{hotkey}</kbd>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const DockDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="relative my-1 flex w-full items-center justify-center" aria-hidden="true">
    <span className="h-px w-4 bg-crimson/25" />
    <span className="mx-1 font-mono text-[7px] font-bold uppercase tracking-[0.2em] text-paper-dim">{label}</span>
    <span className="h-px w-4 bg-crimson/25" />
  </div>
);

export const DashboardManualDockNoir: React.FC<DashboardManualDockProps> = (props) => {
  const {
    manualDockRightOffset, manualToolsConfigVisible, manualToolsConfigTitle,
    setManualToolsConfigOpen, areaSelectionToolHasConfig, areaSelectionCreateMode,
    setAreaSelectionCreateMode, resolvedAioAreaSelectionShapeKind, activeSelectedRegion,
    duplicateSelectedTypographerRegion, applyAutoDetectedShapeToActiveRegion,
    convertActiveTypographerShape, activeStageAllowsSegmentTools, segmentEditTool,
    segmentBrushSize, setSegmentBrushSize, activeStageAllowsManualImageTools,
    manualImageTool, manualImageBrushSize, setManualImageBrushSize, manualImageBrushOpacity,
    setManualImageBrushOpacity, manualImageBrushBlur, setManualImageBrushBlur,
    manualImagePaintColor, setManualImagePaintColor, manualImageWandTolerance,
    setManualImageWandTolerance, activeHasManualWandSelection, activeManualHealingBusy,
    applyHealingFromActiveWandSelection, activeId, clearManualWandSelection, aioStageSelection,
    toggleManualToolsConfig, activeDockToolHasConfig, isAioManualMode, areaSelectionToolActive,
    activeStageAllowsAreaTools, setSegmentEditTool, setManualImageTool, clearAioRegionsForActiveImage,
    activeDockRegionsCount, toggleManualImageTool, mode, clearCleanerManualPaintForImage,
    clearAioManualPaintForImage, resetCleanerManualImageEditsForImage, resetAioManualImageEditsForImage,
    activeHasManualPaintLayer, activeHasManualEdits, shortcutConfig,
  } = props;

  const { t } = useI18n();
  const hk = (id: ShortcutActionId): string =>
    getShortcutDisplayLabel(shortcutConfig.shortcuts[id] ?? [], '');

  return (
    <>
      {/* ═══ Tool Config Flyout ═══ */}
      <AnimatePresence>
        {manualToolsConfigVisible && (
          <motion.aside
            initial={{ opacity: 0, x: 16, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass panel-cut custom-scrollbar fixed top-20 z-40 max-h-[70vh] w-64 overflow-y-auto border-crimson/30 shadow-hard-crimson"
            style={{ right: manualDockRightOffset + 62 }}
            aria-label={t('dashboard.dock.config.ariaLabel')}
          >
            <div className="halftone-red pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />

            {/* Head */}
            <div className="relative flex items-center gap-2 border-b-2 border-crimson/25 p-3">
              <span className="panel-cut-sm grid h-6 w-6 place-items-center bg-crimson text-ink" aria-hidden="true">
                <Wrench size={12} />
              </span>
              <span className="flex-1 truncate font-display text-xs font-black uppercase tracking-tight text-paper">{manualToolsConfigTitle}</span>
              <button
                type="button"
                onClick={() => setManualToolsConfigOpen(false)}
                title={t('dashboard.dock.config.closeTitle')}
                aria-label={t('dashboard.dock.config.closeAriaLabel')}
                className="panel-cut-sm grid h-6 w-6 place-items-center bg-ink-3 text-paper-dim transition-colors hover:bg-crimson hover:text-ink"
              >
                <X size={13} />
              </button>
            </div>

            <div className="relative flex flex-col gap-4 p-3">
              {/* ── Area Selection Config ── */}
              {areaSelectionToolHasConfig && (
                <ConfigSection icon={ScanText} title={t('dashboard.dock.areaSelection.sectionTitle')}>
                  <Field label={t('dashboard.dock.areaSelection.shapeLabel')}>
                    <NoirSelect
                      value={areaSelectionCreateMode}
                      onChange={(v) => setAreaSelectionCreateMode(v as AreaSelectionCreateMode)}
                      aria-label={t('dashboard.dock.areaSelection.shapeLabel')}
                    >
                      <option value="auto">{t('dashboard.dock.areaSelection.optionAuto')}</option>
                      <option value="square">{t('dashboard.dock.areaSelection.optionSquare')}</option>
                      <option value="rounded">{t('dashboard.dock.areaSelection.optionRounded')}</option>
                    </NoirSelect>
                  </Field>
                  <Hint>
                    {areaSelectionCreateMode === 'auto'
                      ? t('dashboard.dock.areaSelection.hintAuto').replace('{kind}', resolvedAioAreaSelectionShapeKind)
                      : t('dashboard.dock.areaSelection.hintFixed').replace('{mode}', areaSelectionCreateMode)}
                  </Hint>
                  <div className="grid grid-cols-2 gap-1.5">
                    <GhostBtn disabled={!activeSelectedRegion} onClick={duplicateSelectedTypographerRegion}>{t('dashboard.dock.areaSelection.btnDuplicate')}</GhostBtn>
                    <GhostBtn disabled={!activeSelectedRegion} onClick={applyAutoDetectedShapeToActiveRegion}>{t('dashboard.dock.areaSelection.btnToAuto')}</GhostBtn>
                    <GhostBtn disabled={!activeSelectedRegion} onClick={() => convertActiveTypographerShape('square')}>{t('dashboard.dock.areaSelection.btnToSquare')}</GhostBtn>
                    <GhostBtn disabled={!activeSelectedRegion} onClick={() => convertActiveTypographerShape('rounded')}>{t('dashboard.dock.areaSelection.btnToRounded')}</GhostBtn>
                  </div>
                </ConfigSection>
              )}

              {/* ── Segment Brush/Eraser Config ── */}
              {activeStageAllowsSegmentTools && (segmentEditTool === 'brush' || segmentEditTool === 'eraser') && (
                <ConfigSection
                  icon={segmentEditTool === 'brush' ? Paintbrush : Eraser}
                  title={segmentEditTool === 'brush' ? t('dashboard.dock.segment.brushTitle') : t('dashboard.dock.segment.eraserTitle')}
                >
                  <KlSlider label={t('dashboard.dock.segment.sizeLabel')} value={segmentBrushSize} min={6} max={120} step={1} onChange={setSegmentBrushSize} resetVal={28} />
                  <Hint>{t('dashboard.dock.segment.hint')}</Hint>
                </ConfigSection>
              )}

              {/* ── Manual Image Tool Config ── */}
              {activeStageAllowsManualImageTools && (manualImageTool === 'paint' || manualImageTool === 'paint_eraser' || manualImageTool === 'healing_brush') && (
                <ConfigSection
                  icon={manualImageTool === 'paint' ? Paintbrush : manualImageTool === 'paint_eraser' ? Eraser : Sparkles}
                  title={manualImageTool === 'paint' ? t('dashboard.dock.imageTool.paintTitle') : manualImageTool === 'paint_eraser' ? t('dashboard.dock.imageTool.eraserTitle') : t('dashboard.dock.imageTool.healingTitle')}
                >
                  <KlSlider label={t('dashboard.dock.imageTool.sizeLabel')} value={manualImageBrushSize} min={4} max={160} step={1} onChange={setManualImageBrushSize} resetVal={26} />
                  <KlSlider label={t('dashboard.dock.imageTool.opacityLabel')} value={manualImageBrushOpacity} min={0.05} max={1} step={0.01} onChange={setManualImageBrushOpacity} resetVal={1} />
                  <KlSlider label={t('dashboard.dock.imageTool.blurLabel')} value={manualImageBrushBlur} min={0} max={24} step={0.5} onChange={setManualImageBrushBlur} resetVal={0} />
                  {manualImageTool === 'paint' && (
                    <Field label={t('dashboard.dock.imageTool.colorLabel')}>
                      <div className="panel-cut-sm relative h-8 overflow-hidden border border-paper/15">
                        <input
                          type="color" value={manualImagePaintColor}
                          onChange={(e) => setManualImagePaintColor(e.target.value)}
                          className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0"
                          aria-label={t('dashboard.dock.imageTool.colorAriaLabel')}
                        />
                      </div>
                    </Field>
                  )}
                </ConfigSection>
              )}

              {/* ── Magic Wand Config ── */}
              {activeStageAllowsManualImageTools && manualImageTool === 'magic_wand' && (
                <ConfigSection icon={Wand2} title={t('dashboard.dock.magicWand.title')}>
                  <KlSlider label={t('dashboard.dock.magicWand.toleranceLabel')} value={manualImageWandTolerance} min={0} max={160} step={1} onChange={setManualImageWandTolerance} resetVal={34} />
                  <div className="flex flex-col gap-1.5">
                    <PrimaryBtn
                      disabled={!activeHasManualWandSelection || activeManualHealingBusy || !activeId}
                      onClick={() => { void applyHealingFromActiveWandSelection(); }}
                      title={t('dashboard.dock.magicWand.healingBtnTitle')}
                      busy={activeManualHealingBusy}
                    >
                      {activeManualHealingBusy ? t('dashboard.dock.magicWand.healingBtnBusy') : t('dashboard.dock.magicWand.healingBtn')}
                    </PrimaryBtn>
                    <GhostBtn disabled={!activeHasManualWandSelection || !activeId} onClick={() => { if (activeId) clearManualWandSelection(activeId); }}>
                      {t('dashboard.dock.magicWand.clearBtn')}
                    </GhostBtn>
                  </div>
                </ConfigSection>
              )}

              {/* ── Healing Model Info ── */}
              {activeStageAllowsManualImageTools && (manualImageTool === 'magic_wand' || manualImageTool === 'healing_brush') && (
                <div className="panel-cut-sm border border-azure/30 bg-azure/8 p-2">
                  <p className="font-mono text-[9px] leading-relaxed text-paper-dim">
                    {t('dashboard.dock.imageTool.modelHint')}
                    <strong className="text-azure">{aioStageSelection.cleanImage}</strong>
                  </p>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ═══ Tool Palette Bar ═══ */}
      <TooltipProvider delayDuration={1000} skipDelayDuration={120}>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="glass panel-cut fixed top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 border-crimson/30 p-1.5 shadow-hard-crimson"
          data-tour="dashboard-manual-dock"
          style={{ right: manualDockRightOffset }}
          role="toolbar"
          aria-label={t('dashboard.dock.palette.ariaLabel')}
        >
          <div className="halftone-red pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
          {/* vertical katakana decoration */}
          <span className="v-text pointer-events-none absolute -left-5 top-1/2 -translate-y-1/2 font-display text-2xl font-black text-outline opacity-30" aria-hidden="true">道具</span>

          {/* Config Toggle */}
          <div className="relative flex flex-col gap-1">
            <DockTooltipButton
              active={manualToolsConfigVisible}
              ariaLabel={manualToolsConfigVisible ? t('dashboard.dock.config.closeLabel') : t('dashboard.dock.config.openLabel')}
              title={manualToolsConfigVisible ? t('dashboard.dock.config.closeLabel') : t('dashboard.dock.config.openLabel')}
              description={t('dashboard.dock.config.description')}
              badge={t('dashboard.dock.config.badge')}
              previewKind="config"
              disabled={!activeDockToolHasConfig}
              disabledReason={t('dashboard.dock.config.disabledReason')}
              hotkey={hk('toolConfigToggle')}
              onClick={toggleManualToolsConfig}
            >
              <PanelLeftOpen size={15} />
            </DockTooltipButton>
          </div>

          {/* ── Region Tools ── */}
          {isAioManualMode && (
            <>
              <DockDivider label={t('dashboard.dock.divider.reg')} />
              <div className="relative flex flex-col gap-1">
                <DockTooltipButton
                  active={areaSelectionToolActive && activeStageAllowsAreaTools}
                  ariaLabel={t('dashboard.dock.areaSelect.ariaLabel')}
                  title={t('dashboard.dock.areaSelect.title')}
                  description={t('dashboard.dock.areaSelect.description')}
                  badge={t('dashboard.dock.areaSelect.badge')}
                  previewKind="area-select"
                  disabled={!activeStageAllowsAreaTools}
                  disabledReason={t('dashboard.dock.areaSelect.disabledReason')}
                  hotkey={hk('toolAreaSelect')}
                  onClick={() => {
                    if (!activeStageAllowsAreaTools) return;
                    setSegmentEditTool('select');
                    setManualImageTool('none');
                    setManualToolsConfigOpen(true);
                  }}
                >
                  <ScanText size={14} />
                </DockTooltipButton>

                <DockTooltipButton
                  danger
                  ariaLabel={t('dashboard.dock.clearPage.ariaLabel')}
                  title={t('dashboard.dock.clearPage.title')}
                  description={t('dashboard.dock.clearPage.description')}
                  badge={t('dashboard.dock.clearPage.badge')}
                  previewKind="clear-page"
                  disabled={!activeStageAllowsAreaTools || activeDockRegionsCount === 0}
                  disabledReason={t('dashboard.dock.clearPage.disabledReason')}
                  hotkey={hk('toolClearRegions')}
                  onClick={clearAioRegionsForActiveImage}
                >
                  <Trash2 size={14} />
                </DockTooltipButton>
              </div>
            </>
          )}

          {/* ── Segment Tools ── */}
          <DockDivider label={t('dashboard.dock.divider.seg')} />
          <div className="relative flex flex-col gap-1">
            <DockTooltipButton
              active={segmentEditTool === 'brush' && activeStageAllowsSegmentTools}
              ariaLabel={t('dashboard.dock.segBrush.ariaLabel')} title={t('dashboard.dock.segBrush.title')}
              description={t('dashboard.dock.segBrush.description')} badge={t('dashboard.dock.segBrush.badge')}
              previewKind="segment-brush" disabled={!activeStageAllowsSegmentTools}
              disabledReason={t('dashboard.dock.segBrush.disabledReason')} hotkey={hk('toolSegmentBrush')}
              onClick={() => {
                if (!activeStageAllowsSegmentTools) return;
                setManualImageTool('none'); setSegmentEditTool('brush'); setManualToolsConfigOpen(true);
              }}
            >
              <Paintbrush size={14} />
            </DockTooltipButton>

            <DockTooltipButton
              active={segmentEditTool === 'eraser' && activeStageAllowsSegmentTools}
              ariaLabel={t('dashboard.dock.segEraser.ariaLabel')} title={t('dashboard.dock.segEraser.title')}
              description={t('dashboard.dock.segEraser.description')} badge={t('dashboard.dock.segEraser.badge')}
              previewKind="segment-eraser" disabled={!activeStageAllowsSegmentTools}
              disabledReason={t('dashboard.dock.segEraser.disabledReason')} hotkey={hk('toolSegmentEraser')}
              onClick={() => {
                if (!activeStageAllowsSegmentTools) return;
                setManualImageTool('none'); setSegmentEditTool('eraser'); setManualToolsConfigOpen(true);
              }}
            >
              <Eraser size={14} />
            </DockTooltipButton>
          </div>

          {/* ── Image Tools ── */}
          <DockDivider label={t('dashboard.dock.divider.img')} />
          <div className="relative flex flex-col gap-1">
            <DockTooltipButton
              active={manualImageTool === 'paint' && activeStageAllowsManualImageTools}
              ariaLabel={t('dashboard.dock.paint.ariaLabel')} title={t('dashboard.dock.paint.title')}
              description={t('dashboard.dock.paint.description')} badge={t('dashboard.dock.paint.badge')}
              previewKind="paint" disabled={!activeStageAllowsManualImageTools}
              disabledReason={t('dashboard.dock.paint.disabledReason')} hotkey={hk('toolPaint')}
              onClick={() => toggleManualImageTool('paint')}
            >
              <Paintbrush size={14} />
            </DockTooltipButton>

            <DockTooltipButton
              active={manualImageTool === 'paint_eraser' && activeStageAllowsManualImageTools}
              ariaLabel={t('dashboard.dock.paintEraser.ariaLabel')} title={t('dashboard.dock.paintEraser.title')}
              description={t('dashboard.dock.paintEraser.description')} badge={t('dashboard.dock.paintEraser.badge')}
              previewKind="paint-eraser" disabled={!activeStageAllowsManualImageTools}
              disabledReason={t('dashboard.dock.paintEraser.disabledReason')} hotkey={hk('toolPaintEraser')}
              onClick={() => toggleManualImageTool('paint_eraser')}
            >
              <Eraser size={14} />
            </DockTooltipButton>

            <DockTooltipButton
              active={manualImageTool === 'magic_wand' && activeStageAllowsManualImageTools}
              ariaLabel={t('dashboard.dock.wand.ariaLabel')} title={t('dashboard.dock.wand.title')}
              description={t('dashboard.dock.wand.description')} badge={t('dashboard.dock.wand.badge')}
              previewKind="magic-wand" disabled={!activeStageAllowsManualImageTools}
              disabledReason={t('dashboard.dock.wand.disabledReason')} hotkey={hk('toolMagicWand')}
              onClick={() => toggleManualImageTool('magic_wand')}
            >
              <Wand2 size={14} />
            </DockTooltipButton>

            <DockTooltipButton
              active={manualImageTool === 'healing_brush' && activeStageAllowsManualImageTools}
              ariaLabel={t('dashboard.dock.healing.ariaLabel')} title={t('dashboard.dock.healing.title')}
              description={t('dashboard.dock.healing.description')} badge={t('dashboard.dock.healing.badge')}
              previewKind="healing" disabled={!activeStageAllowsManualImageTools}
              disabledReason={t('dashboard.dock.healing.disabledReason')} hotkey={hk('toolHealingBrush')}
              onClick={() => toggleManualImageTool('healing_brush')}
            >
              <Sparkles size={14} />
            </DockTooltipButton>
          </div>

          {/* ── Destructive Actions ── */}
          <span className="my-1 h-0.5 w-8 bg-crimson/30" aria-hidden="true" />
          <div className="relative flex flex-col gap-1">
            <DockTooltipButton
              danger
              ariaLabel={t('dashboard.dock.clearPaint.ariaLabel')} title={t('dashboard.dock.clearPaint.title')}
              description={t('dashboard.dock.clearPaint.description')} badge={t('dashboard.dock.clearPaint.badge')}
              previewKind="clear-paint"
              disabled={!activeStageAllowsManualImageTools || !activeId || !activeHasManualPaintLayer}
              disabledReason={t('dashboard.dock.clearPaint.disabledReason')} hotkey={hk('toolClearPaint')}
              onClick={() => {
                if (!activeId) return;
                if (mode === 'cleaner') { clearCleanerManualPaintForImage(activeId); return; }
                clearAioManualPaintForImage(activeId);
              }}
            >
              <Trash2 size={14} />
            </DockTooltipButton>

            <DockTooltipButton
              danger
              ariaLabel={t('dashboard.dock.resetEdits.ariaLabel')} title={t('dashboard.dock.resetEdits.title')}
              description={t('dashboard.dock.resetEdits.description')} badge={t('dashboard.dock.resetEdits.badge')}
              previewKind="reset-edits"
              disabled={!activeStageAllowsManualImageTools || !activeId || !activeHasManualEdits}
              disabledReason={t('dashboard.dock.resetEdits.disabledReason')} hotkey={hk('toolResetEdits')}
              onClick={() => {
                if (!activeId) return;
                if (mode === 'cleaner') { resetCleanerManualImageEditsForImage(activeId); return; }
                resetAioManualImageEditsForImage(activeId);
              }}
            >
              <RefreshCcw size={14} />
            </DockTooltipButton>
          </div>
        </motion.div>
      </TooltipProvider>
    </>
  );
};

function ConfigSection({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ size?: number }>; title: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="kicker flex items-center gap-1.5 !text-[10px]">
        <Icon size={11} /> {title}
      </span>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-paper-dim">{label}</span>
      {children}
    </label>
  );
}

function NoirSelect({ children, value, onChange, ...rest }: {
  children: React.ReactNode; value: string; onChange: (v: string) => void; 'aria-label'?: string;
}) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)} {...rest}
      className="panel-cut-sm border border-paper/15 bg-ink-3 px-2 py-1.5 font-mono text-[11px] text-paper outline-none focus:border-crimson"
    >
      {children}
    </select>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[9px] leading-relaxed text-paper-dim">{children}</p>;
}

function GhostBtn({ children, disabled, onClick }: {
  children: React.ReactNode; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={cn(
        'panel-cut-sm border border-paper/15 bg-ink-3/60 px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-paper transition-all',
        'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-crimson hover:text-crimson hover:shadow-hard-crimson',
        disabled && 'cursor-not-allowed opacity-30 hover:translate-x-0 hover:translate-y-0 hover:border-paper/15 hover:text-paper hover:shadow-none',
      )}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({ children, disabled, onClick, title, busy }: {
  children: React.ReactNode; disabled?: boolean; onClick: () => void; title?: string; busy?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      className={cn(
        'panel-cut-sm flex items-center justify-center gap-1.5 bg-crimson px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-ink transition-all',
        'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-gold',
        disabled && 'cursor-not-allowed opacity-30 hover:translate-x-0 hover:translate-y-0 hover:shadow-none',
      )}
    >
      {busy && <RefreshCcw size={11} className="animate-spin" />}
      {children}
    </button>
  );
}
