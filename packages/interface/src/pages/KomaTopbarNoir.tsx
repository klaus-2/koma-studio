import { memo, useCallback, useEffect, useMemo, useRef, useState, forwardRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Layers,
  Zap,
  ZoomOut,
  ZoomIn,
  LayoutGrid,
  Keyboard,
  Undo2,
  Redo2,
  Eraser,
  Type,
  Languages,
  Maximize2,
  Scissors,
  Stamp,
  Wand2,
  BookOpen,
  FolderOpen,
  Image as ImageIcon,

  Wrench,
  Sparkles,
} from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@koma/ui/components/tooltip";
import { useI18n } from '../i18n';
import { UNDER_DEVELOPMENT_TOOLTIP_KEY } from '../constants/dashboard.constants';
import KomaMobileDrawerNoir from './koma-topbar/noir/KomaMobileDrawerNoir';
import KomaNavGroupDropdownNoir from './koma-topbar/noir/KomaNavGroupDropdownNoir';
import KomaTopbarDownloadMenuNoir from './koma-topbar/noir/KomaTopbarDownloadMenuNoir';
import KomaTopbarUserMenuNoir from './koma-topbar/noir/KomaTopbarUserMenuNoir';
import {
  cn,
  isModeUnderDevelopment,
  NavGroup,
  type DownloadBundleFormat,
  type DropdownId,
  type PsdCompression,
  type ToolMode,
  type ViewMode,
} from './koma-topbar/KomaTopbar.shared';

interface KomaTopbarProps {
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  forcedDropdown?: DropdownId;
  translatorWorkspaceMode?: 'text' | 'visual' | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  batchThreads: number;
  onBatchThreadsChange: (threads: number) => void;
  batchThreadsEnabled: boolean;
  onBatchThreadsToggle: (enabled: boolean) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  processing: boolean;
  activeId: string | null;
  onRotateImage: (id: string) => void;
  canUndoWorkspace: boolean;
  canRedoWorkspace: boolean;
  onUndoWorkspace: () => void;
  onRedoWorkspace: () => void;
  onExportWorkspace: () => void;
  onImportWorkspace: () => void;
  onCloseWorkspace: () => void;
  hasDownloadActions: boolean;
  hasDownloads: boolean;
  activeDownloadScope: string | null;
  outFormat: string;
  onOutFormatChange: (v: string) => void;
  outQuality: number;
  onOutQualityChange: (v: number) => void;
  downloadBundleFormat: DownloadBundleFormat;
  onDownloadBundleFormatChange: (v: DownloadBundleFormat) => void;
  canExportAioMetadata: boolean;
  downloadIncludeRawText: boolean;
  onDownloadIncludeRawTextChange: (v: boolean) => void;
  downloadIncludeTranslatedText: boolean;
  onDownloadIncludeTranslatedTextChange: (v: boolean) => void;
  downloadIncludeInpaintedImage: boolean;
  onDownloadIncludeInpaintedImageChange: (v: boolean) => void;
  hasInpaintedOutputs: boolean;
  onDownload: (scope: string | null) => void;
  canExportPsd: boolean;
  downloadPsdLoading: boolean;
  downloadPsdCompression: PsdCompression;
  onDownloadPsdCompressionChange: (v: PsdCompression) => void;
  downloadPsdDpi: number;
  onDownloadPsdDpiChange: (v: number) => void;
  downloadPsdIncludeOcrOverlay: boolean;
  onDownloadPsdIncludeOcrOverlayChange: (v: boolean) => void;
  downloadPsdIncludeIndividualCrops: boolean;
  onDownloadPsdIncludeIndividualCropsChange: (v: boolean) => void;
  downloadPsdIncludeRawTextLayer: boolean;
  onDownloadPsdIncludeRawTextLayerChange: (v: boolean) => void;
  downloadPsdIncludeTranslatedTextLayer: boolean;
  onDownloadPsdIncludeTranslatedTextLayerChange: (v: boolean) => void;
  downloadPsdUsePhotoshopTextLayers: boolean;
  onDownloadPsdUsePhotoshopTextLayersChange: (v: boolean) => void;
  downloadPsdIncludeMetadataJson: boolean;
  onDownloadPsdIncludeMetadataJsonChange: (v: boolean) => void;
  hasAioRenderRegionsForPsd: boolean;
  onDownloadPsd: () => void;
  toolsPanelVisible: boolean;
  onToolsPanelToggle: () => void;
  isCompactViewport?: boolean;
  toolsRevealButtonRef?: (node: HTMLButtonElement | null) => void;
  onOpenShortcuts: () => void;
  shortcutModalOpen?: boolean;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  sidebarRevealButtonRef?: (node: HTMLButtonElement | null) => void;
  userDisplayName: string;
  userDisplayEmail: string;
  onOpenSettings?: () => void;
  onOpenModelRankings?: () => void;
  onOpenScanlationFeed?: () => void;
  onReplayTour?: () => void;
  onLogout: () => void;
  onStatusMessage?: (msg: string) => void;
}

type TranslateFn = ReturnType<typeof useI18n>['t'];

const createNavGroups = (t: TranslateFn): NavGroup[] => [
  {
    id: 'main',
    label: t('dashboard.nav.group.main'),
    groupIcon: Layers,
    items: [
      {
        mode: 'aio',
        icon: Zap,
        label: t('dashboard.nav.short.aio'),
        subtitle: t('dashboard.nav.subtitle.aio'),
        tooltip: t('dashboard.nav.tooltip.aio'),
        hasSubMode: true,
      },
    ],
  },
  {
    id: 'production',
    label: t('dashboard.nav.group.production'),
    groupIcon: Wrench,
    items: [
      {
        mode: 'cleaner',
        icon: Eraser,
        label: t('dashboard.nav.short.cleaner'),
        subtitle: t('dashboard.nav.subtitle.cleaner'),
        tooltip:
          t('dashboard.nav.tooltip.cleaner'),
      },
      {
        mode: 'typesetter',
        icon: Type,
        label: t('dashboard.mode.typesetter'),
        subtitle: t('dashboard.nav.subtitle.typesetter'),
        tooltip: t('dashboard.nav.tooltip.typesetter'),
        hasSubMode: true,
      },
      {
        mode: 'translator',
        icon: Languages,
        label: t('dashboard.mode.translator'),
        subtitle: t('dashboard.nav.subtitle.translator'),
        tooltip: t('dashboard.nav.tooltip.translator'),
      },
      // {
      //   mode: 'raw',
      //   icon: FileImage,
      //   label: t('dashboard.mode.raw'),
      //   subtitle: t('dashboard.nav.subtitle.raw'),
      //   tooltip: t('dashboard.nav.tooltip.raw'),
      // },
      // {
      //   mode: 'proofreader',
      //   icon: ShieldCheck,
      //   label: t('dashboard.mode.proofreader'),
      //   subtitle: t('dashboard.nav.subtitle.proofreader'),
      //   tooltip: t('dashboard.nav.tooltip.proofreader'),
      //   hasSubMode: true,
      // },
    ],
  },
  {
    id: 'utils',
    label: t('dashboard.nav.group.utils'),
    groupIcon: Wand2,
    items: [
      {
        mode: 'stitch',
        icon: Maximize2,
        label: t('dashboard.mode.stitch'),
        subtitle: t('dashboard.nav.subtitle.stitch'),
        tooltip: t('dashboard.nav.tooltip.stitch'),
      },
      {
        mode: 'split',
        icon: Scissors,
        label: t('dashboard.mode.split'),
        subtitle: t('dashboard.nav.subtitle.split'),
        tooltip: t('dashboard.nav.tooltip.split'),
      },
      {
        mode: 'watermark',
        icon: Stamp,
        label: t('dashboard.mode.watermark'),
        subtitle: t('dashboard.nav.subtitle.watermark'),
        tooltip: t('dashboard.nav.tooltip.watermark'),
      },
      {
        mode: 'enhance',
        icon: Wand2,
        label: t('dashboard.nav.short.enhance'),
        subtitle: t('dashboard.nav.subtitle.enhance'),
        tooltip: t('dashboard.nav.tooltip.enhance'),
      },
      {
        mode: 'optimizer',
        icon: Sparkles,
        label: t('dashboard.mode.optimizer'),
        subtitle: t('dashboard.nav.subtitle.optimizer'),
        tooltip: t('dashboard.nav.tooltip.optimizer'),
      },
      {
        mode: 'blogger',
        icon: LayoutGrid,
        label: t('dashboard.mode.blogger'),
        subtitle: t('dashboard.nav.subtitle.blogger'),
        tooltip: t('dashboard.nav.tooltip.blogger'),
      },
      {
        mode: 'imgur',
        icon: ImageIcon,
        label: t('dashboard.mode.imgur'),
        subtitle: t('dashboard.nav.subtitle.imgur'),
        tooltip: t('dashboard.nav.tooltip.imgur'),
      },
    ],
  },
  {
    id: 'info',
    label: t('dashboard.nav.group.info'),
    groupIcon: BookOpen,
    items: [
      {
        mode: 'guides',
        icon: BookOpen,
        label: t('dashboard.mode.guides'),
        subtitle: t('dashboard.nav.subtitle.guides'),
        tooltip: t('dashboard.nav.tooltip.guides'),
      },
      {
        mode: 'resources',
        icon: FolderOpen,
        label: t('dashboard.mode.resources'),
        subtitle: t('dashboard.nav.subtitle.resources'),
        tooltip: t('dashboard.nav.tooltip.resources'),
      },
    ],
  },
];

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.1;

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

const MAX_BATCH_THREADS = 32;

function clampBatchThreads(v: number) {
  return clamp(Math.round(v), 1, MAX_BATCH_THREADS);
}

const KomaTopbarNoir = memo(function KomaTopbarNoir(props: KomaTopbarProps) {
  const {
    mode,
    onModeChange,
    forcedDropdown = null,
    translatorWorkspaceMode = null,
    zoom,
    onZoomChange,
    batchThreads,
    onBatchThreadsChange,
    batchThreadsEnabled,
    onBatchThreadsToggle,
    viewMode,
    onViewModeChange,
    processing,
    canUndoWorkspace,
    canRedoWorkspace,
    onUndoWorkspace,
    onRedoWorkspace,
    onExportWorkspace,
    onImportWorkspace,
    onCloseWorkspace,
    hasDownloadActions,
    hasDownloads,
    activeDownloadScope,
    outFormat,
    onOutFormatChange,
    outQuality,
    onOutQualityChange,
    downloadBundleFormat,
    onDownloadBundleFormatChange,
    canExportAioMetadata,
    downloadIncludeRawText,
    onDownloadIncludeRawTextChange,
    downloadIncludeTranslatedText,
    onDownloadIncludeTranslatedTextChange,
    downloadIncludeInpaintedImage,
    onDownloadIncludeInpaintedImageChange,
    hasInpaintedOutputs,
    onDownload,
    canExportPsd,
    downloadPsdLoading,
    downloadPsdCompression,
    onDownloadPsdCompressionChange,
    downloadPsdDpi,
    onDownloadPsdDpiChange,
    downloadPsdIncludeOcrOverlay,
    onDownloadPsdIncludeOcrOverlayChange,
    downloadPsdIncludeIndividualCrops,
    onDownloadPsdIncludeIndividualCropsChange,
    downloadPsdIncludeRawTextLayer,
    onDownloadPsdIncludeRawTextLayerChange,
    downloadPsdIncludeTranslatedTextLayer,
    onDownloadPsdIncludeTranslatedTextLayerChange,
    downloadPsdUsePhotoshopTextLayers,
    onDownloadPsdUsePhotoshopTextLayersChange,
    downloadPsdIncludeMetadataJson,
    onDownloadPsdIncludeMetadataJsonChange,
    hasAioRenderRegionsForPsd,
    onDownloadPsd,
    toolsPanelVisible,
    onToolsPanelToggle,
    isCompactViewport = false,
    toolsRevealButtonRef,
    onOpenShortcuts,
    shortcutModalOpen = false,
    sidebarCollapsed = false,
    onSidebarToggle,
    sidebarRevealButtonRef,
    userDisplayName,
    userDisplayEmail,
    onOpenSettings,
    onOpenModelRankings,
    onOpenScanlationFeed,
    onReplayTour,
    onLogout,
    onStatusMessage,
  } = props;
  const { t } = useI18n();
  const underDevelopmentTooltip = t(UNDER_DEVELOPMENT_TOOLTIP_KEY);
  const navGroups = useMemo(() => createNavGroups(t), [t]);
  const allNavItems = useMemo(() => navGroups.flatMap((group) => group.items), [navGroups]);
  const primaryItems = useMemo(
    () => [...(navGroups[0]?.items ?? []), ...(navGroups[1]?.items ?? [])],
    [navGroups],
  );
  const utilsGroup = navGroups[2];
  const infoGroup = navGroups[3];

  // ── State ──
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownId>(null);

  // ── Refs ──
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const utilsDropdownRef = useRef<HTMLDivElement>(null);
  const infoDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useMemo(
    () => ({
      download: downloadDropdownRef,
      user: userDropdownRef,
      utils: utilsDropdownRef,
      info: infoDropdownRef,
    }),
    [downloadDropdownRef, userDropdownRef, utilsDropdownRef, infoDropdownRef],
  );

  // ── Derived ──
  const currentNavItem = useMemo(
    () => allNavItems.find((i) => i.mode === mode),
    [allNavItems, mode],
  );
  const activeUtilsItem = useMemo(
    () => utilsGroup?.items.find((i) => i.mode === mode),
    [mode, utilsGroup],
  );
  const activeInfoItem = useMemo(
    () => infoGroup?.items.find((i) => i.mode === mode),
    [infoGroup, mode],
  );
  const cleanerMode = mode === 'cleaner';
  const translatorTextMode =
    mode === 'translator' && translatorWorkspaceMode === 'text';
  const translatorVisualMode =
    mode === 'translator' && translatorWorkspaceMode === 'visual';
  const effectiveDropdown = forcedDropdown ?? activeDropdown;

  // ── Handlers ──
  const toggleDropdown = useCallback(
    (id: DropdownId) => {
      if (forcedDropdown !== null) {
        return;
      }
      setMobileNavOpen(false);
      setActiveDropdown((prev) => (prev === id ? null : id));
    },
    [forcedDropdown],
  );

  const handleModeChange = useCallback(
    (m: ToolMode) => {
      if (isModeUnderDevelopment(m)) {
        onStatusMessage?.(
          `${allNavItems.find((item) => item.mode === m)?.label ?? t('dashboard.topbar.thisTab')}: ${underDevelopmentTooltip}`,
        );
        return;
      }
      onModeChange(m);
      setActiveDropdown(null);
      setMobileNavOpen(false);
    },
    [allNavItems, onModeChange, onStatusMessage, t, underDevelopmentTooltip],
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!activeDropdown || forcedDropdown !== null) return;
    const handler = (e: MouseEvent) => {
      const ref = dropdownRefs[activeDropdown as keyof typeof dropdownRefs];
      if (ref?.current && !ref.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeDropdown, dropdownRefs, forcedDropdown]);

  // Close mobile nav on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)');
    const handler = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Lock body scroll when mobile nav open
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  return (
    <TooltipProvider delayDuration={200}>
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-40 flex h-14 items-center gap-3 border-b-2 border-crimson/30 bg-ink-2/80 px-3 backdrop-blur-xl"
      >
        {/* halftone strip decoration */}
        <div className="halftone-red pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
        {/* crimson tape accent */}
        <span className="pointer-events-none absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" aria-hidden="true" />

        {/* ═══ NAVIGATION ═══ */}
        {!isCompactViewport ? (
          <nav className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5" role="tablist" aria-label={t('dashboard.topbar.tools')}>
            <div className="flex items-center gap-1">
              {primaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = mode === item.mode;
                const isDisabled = isModeUnderDevelopment(item.mode);
                return (
                  <Tooltip key={item.mode}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-disabled={isDisabled}
                        data-mode={item.mode}
                        data-tour={item.mode === 'aio' ? 'topbar-main-aio' : undefined}
                        onClick={() => handleModeChange(item.mode)}
                        className={cn(
                          'panel-cut-sm group relative flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all duration-200',
                          isActive
                            ? 'bg-crimson text-ink shadow-hard-paper'
                            : 'bg-ink-3/60 text-paper-dim hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-ink-3 hover:text-paper hover:shadow-hard-crimson',
                          isDisabled && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        {isActive && <span className="h-1.5 w-1.5 bg-ink blink-noir" aria-hidden="true" />}
                        <Icon size={13} aria-hidden="true" />
                        <span className="hidden lg:inline">{item.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="glass panel-cut-sm border-crimson/30">
                      <strong className="font-display uppercase text-crimson">{item.label}</strong>
                      <span className="block text-paper-dim">{isDisabled ? underDevelopmentTooltip : item.tooltip}</span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            <span className="mx-1 h-6 w-px bg-crimson/25" aria-hidden="true" />

            {utilsGroup ? (
              <KomaNavGroupDropdownNoir
                id="utils"
                group={utilsGroup}
                activeItem={activeUtilsItem}
                mode={mode}
                isOpen={effectiveDropdown === 'utils'}
                dropdownRef={dropdownRefs.utils}
                underDevelopmentTooltip={underDevelopmentTooltip}
                onToggle={toggleDropdown}
                onModeSelect={handleModeChange}
              />
            ) : null}

            <span className="mx-1 h-6 w-px bg-crimson/25" aria-hidden="true" />

            {infoGroup ? (
              <KomaNavGroupDropdownNoir
                id="info"
                group={infoGroup}
                activeItem={activeInfoItem}
                mode={mode}
                isOpen={effectiveDropdown === 'info'}
                dropdownRef={dropdownRefs.info}
                underDevelopmentTooltip={underDevelopmentTooltip}
                onToggle={toggleDropdown}
                onModeSelect={handleModeChange}
              />
            ) : null}
          </nav>
        ) : (
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-label={t('dashboard.topbar.navigation')}
            aria-haspopup="dialog"
            aria-expanded={mobileNavOpen}
            className="panel-cut-sm relative z-10 flex items-center gap-1.5 bg-crimson px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink shadow-hard-gold"
          >
            {currentNavItem && <currentNavItem.icon size={13} />}
            <span>{currentNavItem?.label ?? mode}</span>
          </button>
        )}

        {/* ═══ RIGHT ACTION CLUSTER ═══ */}
        <div className="relative z-10 ml-auto flex flex-shrink-0 items-center gap-1.5">
          {/* Zoom */}
          <div className="panel-cut-sm flex items-center gap-0.5 bg-ink-3/70 px-1 py-0.5">
            <IconBtn label={t('dashboard.topbar.zoomOut')} onClick={() => onZoomChange(clamp(zoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}>
              <ZoomOut size={12} />
            </IconBtn>
            <span className="min-w-[38px] text-center font-mono text-[11px] font-bold text-azure">{Math.round(zoom * 100)}%</span>
            <IconBtn label={t('dashboard.topbar.zoomIn')} onClick={() => onZoomChange(clamp(zoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}>
              <ZoomIn size={12} />
            </IconBtn>
          </div>

          {/* Batch threads */}
          <div
            className={cn(
              'panel-cut-sm flex items-center gap-1 px-1 py-0.5 transition-colors',
              batchThreadsEnabled ? 'bg-mint/15' : 'bg-ink-3/70',
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => onBatchThreadsToggle(!batchThreadsEnabled)}
                  aria-label={
                    batchThreadsEnabled
                      ? t('dashboard.topbar.disableBatch')
                      : t('dashboard.topbar.enableBatch')
                  }
                  className={cn(
                    'panel-cut-sm grid h-6 w-6 place-items-center transition-all',
                    batchThreadsEnabled ? 'bg-mint text-ink' : 'text-paper-dim hover:text-paper',
                  )}
                >
                  <Zap size={11} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="glass panel-cut-sm">
                {batchThreadsEnabled
                  ? t('dashboard.topbar.batchStatus', { count: batchThreads })
                  : t('dashboard.topbar.enableBatch')}
              </TooltipContent>
            </Tooltip>
            <input
              type="number"
              min={1}
              max={MAX_BATCH_THREADS}
              value={batchThreads}
              onChange={(e) =>
                onBatchThreadsChange(clampBatchThreads(Number(e.target.value) || 1))
              }
              disabled={processing || !batchThreadsEnabled}
              aria-label={t('dashboard.topbar.threads')}
              className="w-8 bg-transparent text-center font-mono text-[11px] font-bold text-paper outline-none disabled:opacity-40"
            />
          </div>

          {/* View mode segmented */}
          <div className="panel-cut-sm flex bg-ink-3/70" role="group" aria-label={t('dashboard.topbar.viewMode')}>
            <SegBtn active={viewMode === 'paginated'} onClick={() => onViewModeChange('paginated')} label={t('dashboard.topbar.paginated')}>
              <LayoutGrid size={13} />
            </SegBtn>
            <SegBtn active={viewMode === 'long_strip'} onClick={() => onViewModeChange('long_strip')} label={t('dashboard.topbar.longStrip')}>
              <Layers size={13} />
            </SegBtn>
          </div>

          {/* Undo / Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <TopIconBtn onClick={onUndoWorkspace} disabled={!canUndoWorkspace} label={t('dashboard.topbar.undoWorkspace')}>
                <Undo2 size={13} />
              </TopIconBtn>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass panel-cut-sm">{t('dashboard.topbar.undoShortcut')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TopIconBtn onClick={onRedoWorkspace} disabled={!canRedoWorkspace} label={t('dashboard.topbar.redoWorkspace')}>
                <Redo2 size={13} />
              </TopIconBtn>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass panel-cut-sm">{t('dashboard.topbar.redoShortcut')}</TooltipContent>
          </Tooltip>

          {/* Download menu */}
          <KomaTopbarDownloadMenuNoir
            isOpen={effectiveDropdown === 'download'}
            dropdownRef={dropdownRefs.download}
            cleanerMode={cleanerMode}
            translatorTextMode={translatorTextMode}
            translatorVisualMode={translatorVisualMode}
            hasDownloadActions={hasDownloadActions}
            hasDownloads={hasDownloads}
            activeDownloadScope={activeDownloadScope}
            outFormat={outFormat}
            onOutFormatChange={onOutFormatChange}
            outQuality={outQuality}
            onOutQualityChange={onOutQualityChange}
            downloadBundleFormat={downloadBundleFormat}
            onDownloadBundleFormatChange={onDownloadBundleFormatChange}
            canExportAioMetadata={canExportAioMetadata}
            downloadIncludeRawText={downloadIncludeRawText}
            onDownloadIncludeRawTextChange={onDownloadIncludeRawTextChange}
            downloadIncludeTranslatedText={downloadIncludeTranslatedText}
            onDownloadIncludeTranslatedTextChange={onDownloadIncludeTranslatedTextChange}
            downloadIncludeInpaintedImage={downloadIncludeInpaintedImage}
            onDownloadIncludeInpaintedImageChange={onDownloadIncludeInpaintedImageChange}
            hasInpaintedOutputs={hasInpaintedOutputs}
            onDownload={onDownload}
            canExportPsd={canExportPsd}
            downloadPsdLoading={downloadPsdLoading}
            downloadPsdCompression={downloadPsdCompression}
            onDownloadPsdCompressionChange={onDownloadPsdCompressionChange}
            downloadPsdDpi={downloadPsdDpi}
            onDownloadPsdDpiChange={onDownloadPsdDpiChange}
            downloadPsdIncludeOcrOverlay={downloadPsdIncludeOcrOverlay}
            onDownloadPsdIncludeOcrOverlayChange={onDownloadPsdIncludeOcrOverlayChange}
            downloadPsdIncludeIndividualCrops={downloadPsdIncludeIndividualCrops}
            onDownloadPsdIncludeIndividualCropsChange={onDownloadPsdIncludeIndividualCropsChange}
            downloadPsdIncludeRawTextLayer={downloadPsdIncludeRawTextLayer}
            onDownloadPsdIncludeRawTextLayerChange={onDownloadPsdIncludeRawTextLayerChange}
            downloadPsdIncludeTranslatedTextLayer={downloadPsdIncludeTranslatedTextLayer}
            onDownloadPsdIncludeTranslatedTextLayerChange={onDownloadPsdIncludeTranslatedTextLayerChange}
            downloadPsdUsePhotoshopTextLayers={downloadPsdUsePhotoshopTextLayers}
            onDownloadPsdUsePhotoshopTextLayersChange={onDownloadPsdUsePhotoshopTextLayersChange}
            downloadPsdIncludeMetadataJson={downloadPsdIncludeMetadataJson}
            onDownloadPsdIncludeMetadataJsonChange={onDownloadPsdIncludeMetadataJsonChange}
            hasAioRenderRegionsForPsd={hasAioRenderRegionsForPsd}
            modeIsAio={mode === 'aio'}
            onDownloadPsd={onDownloadPsd}
            onToggle={() => toggleDropdown('download')}
          />

          {/* Shortcuts */}
          <Tooltip>
            <TooltipTrigger asChild>
              <TopIconBtn onClick={onOpenShortcuts} active={shortcutModalOpen} label={t('dashboard.topbar.shortcuts')} pressed={shortcutModalOpen}>
                <Keyboard size={13} />
              </TopIconBtn>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="glass panel-cut-sm">{t('dashboard.topbar.shortcutsHint')}</TooltipContent>
          </Tooltip>

          {/* Tools panel toggle */}
          {isCompactViewport && (
            <TopIconBtn onClick={onToolsPanelToggle} label={toolsPanelVisible ? t('dashboard.topbar.hideTools') : t('dashboard.topbar.showTools')}>
              {toolsPanelVisible ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
            </TopIconBtn>
          )}
          {!isCompactViewport && !toolsPanelVisible && (
            <TopIconBtn ref={toolsRevealButtonRef} onClick={onToolsPanelToggle} label={t('dashboard.topbar.showTools')}>
              <PanelRightOpen size={13} />
            </TopIconBtn>
          )}

          {/* Sidebar toggle (when collapsed) */}
          {sidebarCollapsed && onSidebarToggle && (
            <TopIconBtn ref={sidebarRevealButtonRef} onClick={onSidebarToggle} label={t('dashboard.topbar.showSidebar')}>
              <PanelLeftOpen size={13} />
            </TopIconBtn>
          )}

          <span className="mx-0.5 h-6 w-px bg-crimson/25" aria-hidden="true" />

          {/* User menu */}
          <KomaTopbarUserMenuNoir
            isOpen={effectiveDropdown === 'user'}
            dropdownRef={dropdownRefs.user}
            userDisplayName={userDisplayName}
            userDisplayEmail={userDisplayEmail}
            onOpenSettings={onOpenSettings}
            onOpenModelRankings={onOpenModelRankings}
            onOpenScanlationFeed={onOpenScanlationFeed}
            onReplayTour={onReplayTour}
            onToggle={() => toggleDropdown('user')}
            onClose={() => setActiveDropdown(null)}
            onExportWorkspace={onExportWorkspace}
            onImportWorkspace={onImportWorkspace}
            onCloseWorkspace={onCloseWorkspace}
            onLogout={onLogout}
          />
        </div>
      </motion.header>

      {/* ═══ Mobile Drawer ═══ */}
      <AnimatePresence>
        {mobileNavOpen && (
          <KomaMobileDrawerNoir
            open={mobileNavOpen}
            navGroups={navGroups}
            mode={mode}
            onModeChange={handleModeChange}
            userDisplayName={userDisplayName}
            userDisplayEmail={userDisplayEmail}
            onClose={() => setMobileNavOpen(false)}
          />
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
});

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="panel-cut-sm grid h-6 w-6 place-items-center text-paper-dim transition-colors hover:bg-crimson hover:text-ink"
    >
      {children}
    </button>
  );
}

function SegBtn({ children, active, onClick, label }: { children: ReactNode; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid h-8 w-9 place-items-center transition-colors',
        active ? 'bg-azure text-ink' : 'text-paper-dim hover:text-paper',
      )}
    >
      {children}
    </button>
  );
}

const TopIconBtn = forwardRef<
  HTMLButtonElement,
  {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    label: string;
    active?: boolean;
    pressed?: boolean;
  }
>(({ children, onClick, disabled, label, active, pressed }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    aria-pressed={pressed}
    className={cn(
      'panel-cut-sm grid h-8 w-8 place-items-center bg-ink-3/70 transition-all duration-200',
      active
        ? 'bg-crimson text-ink shadow-hard-paper'
        : 'text-paper-dim hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-ink-3 hover:text-paper hover:shadow-hard-crimson',
      disabled && 'cursor-not-allowed opacity-30 hover:translate-x-0 hover:translate-y-0 hover:shadow-none',
    )}
  >
    {children}
  </button>
));
TopIconBtn.displayName = 'TopIconBtn';

export default KomaTopbarNoir;
