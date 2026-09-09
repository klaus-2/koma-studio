import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Layers,
  Zap,
  Eraser,
  Type,
  Languages,
  FileImage,
  ShieldCheck,
  Maximize2,
  Scissors,
  Stamp,
  Wand2,
  BookOpen,
  FolderOpen,
  Image as ImageIcon,
  ZoomOut,
  ZoomIn,
  RotateCw,
  LayoutGrid,
  Keyboard,
  Wrench,
  Sparkles,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@koma/ui/components/tooltip";
import { useI18n } from '../i18n';
import VersionBadge from '../components/VersionBadge';
import { UNDER_DEVELOPMENT_TOOLTIP_KEY } from '../constants/dashboard.constants';
import './KomaTopbar.css';
import KomaMobileDrawer from './koma-topbar/KomaMobileDrawer';
import KomaNavGroupDropdown from './koma-topbar/KomaNavGroupDropdown';
import KomaTopbarDownloadMenu from './koma-topbar/KomaTopbarDownloadMenu';
import KomaTopbarUserMenu from './koma-topbar/KomaTopbarUserMenu';
import {
  cn,
  isModeUnderDevelopment,
  type DownloadBundleFormat,
  type DropdownId,
  type NavGroup,
  type NavItem,
  type PsdCompression,
  type ToolMode,
  type ViewMode,
} from './koma-topbar/KomaTopbar.shared';

type TranslateFn = ReturnType<typeof useI18n>['t'];

// ── Nav Config ──
const createNavGroups = (t: TranslateFn): NavGroup[] => [
  {
    id: 'main',
    label: t('dashboard.nav.group.main'),
    groupIcon: Layers,
    items: [
      {
        mode: 'organize',
        icon: Layers,
        label: t('dashboard.mode.organize'),
        subtitle: t('dashboard.nav.subtitle.organize'),
        tooltip: t('dashboard.nav.tooltip.organize'),
      },
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
      {
        mode: 'raw',
        icon: FileImage,
        label: t('dashboard.mode.raw'),
        subtitle: t('dashboard.nav.subtitle.raw'),
        tooltip: t('dashboard.nav.tooltip.raw'),
      },
      {
        mode: 'proofreader',
        icon: ShieldCheck,
        label: t('dashboard.mode.proofreader'),
        subtitle: t('dashboard.nav.subtitle.proofreader'),
        tooltip: t('dashboard.nav.tooltip.proofreader'),
        hasSubMode: true,
      },
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
const MAX_BATCH_THREADS = 16;

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}
function clampBatchThreads(v: number) {
  return clamp(Math.round(v), 1, MAX_BATCH_THREADS);
}

// ── Component Props ──
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

  // Download
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

  // PSD
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

  // Tools panel
  toolsPanelVisible: boolean;
  onToolsPanelToggle: () => void;
  isCompactViewport?: boolean;
  toolsRevealButtonRef?: (node: HTMLButtonElement | null) => void;
  onOpenShortcuts: () => void;
  shortcutModalOpen?: boolean;

  // Sidebar (mobile)
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  sidebarRevealButtonRef?: (node: HTMLButtonElement | null) => void;

  // User
  userDisplayName: string;
  userDisplayEmail: string;
  onOpenSettings?: () => void;
  onOpenModelRankings?: () => void;
  onOpenScanlationFeed?: () => void;
  onReplayTour?: () => void;
  onLogout: () => void;
  onStatusMessage?: (msg: string) => void;
}

// ═══════════════════════════════════════════
// ═══════════════════════════════════════════

export default function KomaTopbar(props: KomaTopbarProps) {
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
    activeId,
    onRotateImage,
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
  const mainGroup = navGroups[0];
  const prodGroup = navGroups[1];
  const utilsGroup = navGroups[2];
  const infoGroup = navGroups[3];
  const allNavItems = useMemo(() => navGroups.flatMap((group) => group.items), [navGroups]);

  // ── State ──
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownId>(null);

  // ── Refs ──
  const productionDropdownRef = useRef<HTMLDivElement>(null);
  const utilsDropdownRef = useRef<HTMLDivElement>(null);
  const infoDropdownRef = useRef<HTMLDivElement>(null);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useMemo(
    () => ({
      production: productionDropdownRef,
      utils: utilsDropdownRef,
      info: infoDropdownRef,
      download: downloadDropdownRef,
      user: userDropdownRef,
    }),
    [
      productionDropdownRef,
      utilsDropdownRef,
      infoDropdownRef,
      downloadDropdownRef,
      userDropdownRef,
    ],
  );

  // ── Derived ──
  const currentNavItem = useMemo(
    () => allNavItems.find((i) => i.mode === mode),
    [allNavItems, mode],
  );
  const activeProdItem = useMemo(
    () => prodGroup?.items.find((i) => i.mode === mode),
    [mode, prodGroup],
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

  useEffect(() => {
    if (!activeDropdown || forcedDropdown !== null) return;
    const handler = (e: MouseEvent) => {
      const ref = dropdownRefs[activeDropdown];
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

  // ── Render helpers ──
  const renderGroupDropdown = (
    id: 'production' | 'utils' | 'info',
    group: NavGroup,
    activeItem: NavItem | undefined,
  ) => (
    <KomaNavGroupDropdown
      id={id}
      group={group}
      activeItem={activeItem}
      mode={mode}
      isOpen={effectiveDropdown === id}
      dropdownRef={dropdownRefs[id]}
      underDevelopmentTooltip={underDevelopmentTooltip}
      onToggle={toggleDropdown}
      onModeSelect={handleModeChange}
    />
  );

  return (
    <TooltipProvider delayDuration={200}>
      <header className="koma-topbar">
        {/* ═══ Navigation ═══ */}
        <nav
          className="koma-topbar__nav"
          data-tour="topbar-main-nav"
          role="tablist"
          aria-label={t('dashboard.topbar.tools')}
        >
          {/* Sidebar dock (collapsed state) */}
          {sidebarCollapsed && onSidebarToggle && (
            <>
              <div className="koma-topbar__sidebar-dock">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      ref={sidebarRevealButtonRef}
                      className="koma-topbar__sidebar-reveal"
                      onClick={onSidebarToggle}
                  aria-label={t('dashboard.topbar.showSidebar')}
                    >
                      <PanelLeftOpen size={14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('dashboard.topbar.sidebar')}</TooltipContent>
                </Tooltip>
                <div
                  className="koma-topbar__sidebar-brand"
                  aria-label={t('dashboard.topbar.brand')}
                >
                  <div className="koma-brand__text">
                    <div className="koma-brand__title">
                      {t('brand.name')}
                      <span className="koma-brand__studio-wrap">
                        {t('brand.studioSuffix')}
                        <VersionBadge />
                      </span>
                    </div>
                    <div className="koma-brand__subtitle">{t('dashboard.sidebar.workspace')}</div>
                  </div>
                </div>
              </div>
              <span
                className="koma-topbar__nav-sep koma-topbar__nav-sep--sidebar"
                aria-hidden="true"
              />
            </>
          )}

          {/* Main tabs (Organize, AIO) */}
          <div className="koma-topbar__nav-group">
            {mainGroup?.items.map((item) => {
              const Icon = item.icon;
              const isActive = mode === item.mode;
              const isDisabled = isModeUnderDevelopment(item.mode);
              return (
                <Tooltip key={item.mode}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-tour={
                        item.mode === 'organize'
                          ? 'topbar-main-organize'
                          : item.mode === 'aio'
                            ? 'topbar-main-aio'
                            : undefined
                      }
                      role="tab"
                      aria-selected={isActive}
                      aria-disabled={isDisabled}
                      className={cn(
                        'koma-navtab',
                        isActive && 'koma-navtab--active',
                        isDisabled && 'koma-navtab--disabled',
                      )}
                      onClick={() => handleModeChange(item.mode)}
                    >
                      <Icon size={13} />
                      <span className="koma-navtab__text">{item.label}</span>
                      {item.hasSubMode && (
                        <span className="koma-navtab__sub-badge">{t('dashboard.topbar.autoManualBadge')}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="koma-tooltip--rich">
                    <strong>{item.label}</strong>
                    <span>
                      {isDisabled ? underDevelopmentTooltip : item.tooltip}
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <span className="koma-topbar__nav-sep" aria-hidden="true" />
          {prodGroup ? renderGroupDropdown('production', prodGroup, activeProdItem) : null}
          <span className="koma-topbar__nav-sep" aria-hidden="true" />
          {utilsGroup ? renderGroupDropdown('utils', utilsGroup, activeUtilsItem) : null}
          <span className="koma-topbar__nav-sep" aria-hidden="true" />
          {infoGroup ? renderGroupDropdown('info', infoGroup, activeInfoItem) : null}
        </nav>

        {/* ═══ Right Strip ═══ */}
        <div className="koma-topbar__right">
          {/* Mobile mode pill */}
          <div className="koma-topbar__mode-pill" data-tour="topbar-mode-pill">
            {currentNavItem && <currentNavItem.icon size={12} />}
            <span>{currentNavItem?.label ?? mode}</span>
          </div>

          <div className="koma-topbar__actions">
            {isCompactViewport && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn('koma-topbar__iconbtn', mobileNavOpen && 'koma-topbar__iconbtn--open')}
                    onClick={() => {
                      setActiveDropdown(null);
                      setMobileNavOpen((prev) => !prev);
                    }}
                    aria-label={t('dashboard.topbar.navigation')}
                    aria-haspopup="dialog"
                    aria-expanded={mobileNavOpen}
                  >
                    <PanelLeftOpen size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('dashboard.topbar.navigation')}</TooltipContent>
              </Tooltip>
            )}

            {/* Zoom */}
            <div className="koma-zoomctl">
              <button
                type="button"
                className="koma-zoomctl__btn"
                onClick={() =>
                  onZoomChange(clamp(zoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))
                }
                aria-label={t('dashboard.topbar.zoomOut')}
              >
                <ZoomOut size={12} />
              </button>
              <span className="koma-zoomctl__val">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="koma-zoomctl__btn"
                onClick={() =>
                  onZoomChange(clamp(zoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))
                }
                aria-label={t('dashboard.topbar.zoomIn')}
              >
                <ZoomIn size={12} />
              </button>
            </div>

            {/* Batch Threads */}
            <div
              className={cn(
                'koma-threadctl',
                batchThreadsEnabled && 'koma-threadctl--on',
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'koma-threadctl__toggle',
                      batchThreadsEnabled && 'koma-threadctl__toggle--on',
                    )}
                    onClick={() => onBatchThreadsToggle(!batchThreadsEnabled)}
                    disabled={processing}
                aria-label={
                      batchThreadsEnabled
                        ? t('dashboard.topbar.disableBatch')
                        : t('dashboard.topbar.enableBatch')
                    }
                  >
                    <Zap size={10} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
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
                  onBatchThreadsChange(
                    clampBatchThreads(Number(e.target.value) || 1),
                  )
                }
                className="koma-threadctl__input"
                aria-label={t('dashboard.topbar.threads')}
                disabled={processing || !batchThreadsEnabled}
              />
            </div>

            {/* View Mode */}
            <div
              className="koma-viewseg"
              role="group"
              aria-label={t('dashboard.topbar.viewMode')}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'koma-viewseg__btn',
                      viewMode === 'paginated' && 'koma-viewseg__btn--active',
                    )}
                    onClick={() => onViewModeChange('paginated')}
                    aria-label={t('dashboard.topbar.paginated')}
                  >
                    <LayoutGrid size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('dashboard.topbar.paginated')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'koma-viewseg__btn',
                      viewMode === 'long_strip' && 'koma-viewseg__btn--active',
                    )}
                    onClick={() => onViewModeChange('long_strip')}
                    aria-label={t('dashboard.topbar.longStrip')}
                  >
                    <Layers size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('dashboard.topbar.longStrip')}</TooltipContent>
              </Tooltip>
            </div>

            {/* Rotate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="koma-topbar__iconbtn koma-topbar__iconbtn--desktop"
                  onClick={() => activeId && onRotateImage(activeId)}
                  disabled={!activeId || processing}
                  aria-label={t('dashboard.topbar.rotate90')}
                >
                  <RotateCw size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {activeId ? t('dashboard.topbar.rotate90') : t('dashboard.topbar.selectImage')}
              </TooltipContent>
            </Tooltip>

            <KomaTopbarDownloadMenu
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
                <button
                  type="button"
                  className="koma-topbar__iconbtn"
                  onClick={onUndoWorkspace}
                  aria-label={t('dashboard.topbar.undoWorkspace')}
                  disabled={!canUndoWorkspace}
                >
                  <Undo2 size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('dashboard.topbar.undoShortcut')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="koma-topbar__iconbtn"
                  onClick={onRedoWorkspace}
                  aria-label={t('dashboard.topbar.redoWorkspace')}
                  disabled={!canRedoWorkspace}
                >
                  <Redo2 size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('dashboard.topbar.redoShortcut')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'koma-topbar__iconbtn',
                    shortcutModalOpen && 'koma-topbar__iconbtn--open',
                  )}
                  onClick={onOpenShortcuts}
                  aria-label={t('dashboard.topbar.shortcuts')}
                  aria-pressed={shortcutModalOpen}
                >
                  <Keyboard size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('dashboard.topbar.shortcutsHint')}</TooltipContent>
            </Tooltip>

            {/* Tools panel toggle (compact viewport) */}
            {isCompactViewport && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="koma-topbar__iconbtn"
                    onClick={onToolsPanelToggle}
                    aria-label={
                      toolsPanelVisible
                        ? t('dashboard.topbar.hideTools')
                        : t('dashboard.topbar.showTools')
                    }
                  >
                    {toolsPanelVisible ? (
                      <PanelRightClose size={14} />
                    ) : (
                      <PanelRightOpen size={14} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {toolsPanelVisible ? t('dashboard.topbar.hide') : t('dashboard.topbar.showTools')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <KomaTopbarUserMenu
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

          {/* Tools reveal (desktop, when hidden) */}
          {!isCompactViewport && !toolsPanelVisible && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  ref={toolsRevealButtonRef}
                  className="koma-topbar__iconbtn koma-topbar__tools-reveal"
                  onClick={onToolsPanelToggle}
                  aria-label={t('dashboard.topbar.showTools')}
                >
                  <PanelRightOpen size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('dashboard.topbar.showTools')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>

      {/* ═══ Mobile Drawer ═══ */}
      <KomaMobileDrawer
        open={mobileNavOpen}
        navGroups={navGroups}
        mode={mode}
        onModeChange={handleModeChange}
        userDisplayName={userDisplayName}
        userDisplayEmail={userDisplayEmail}
        onClose={() => setMobileNavOpen(false)}
      />
    </TooltipProvider>
  );
}
