import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Upload, Image as ImageIcon, Trash2, RotateCw, ArrowUp, ArrowDown,
  X, Check, ListChecks, PanelLeftOpen, ChevronLeft, ChevronRight, SkipBack, SkipForward, RefreshCcw,
} from 'lucide-react';

import { useI18n, type TranslateFn } from '../../../i18n';
import VersionBadge from '../../VersionBadge';
import SidebarChapterHeader from '../SidebarChapterHeader';
import SidebarChapterSelectionBar from '../SidebarChapterSelectionBar';
import { KomaMascotBadgeNoir } from './KomaMascotBadgeNoir';
import { cn } from '../../../utils/dashboard.utils';
import type { SidebarChapterSelection } from '../../../pages/dashboard/hooks/use-sidebar-chapter-selection';
import {
  DIRECT_IMAGES_CHAPTER_ID,
  groupImagesIntoAioChapters,
} from '../../../pages/dashboard/lib/aio-chapters';
import { useExportStore } from '../../../pages/dashboard/stores/export-store';
import { useRegionEditorStore } from '../../../pages/dashboard/stores/region-editor-store';
import { useCleanerStore } from '../../../pages/dashboard/stores/cleaner-store';
import { useTranslatorStore } from '../../../pages/dashboard/stores/translator-store';
import type {
  DashboardProcessingStatsSummary,
  LoadedImage,
} from '../../../types/dashboard.types';
import type { AioImageHistoryMeta } from '../DashboardLeftSidebarClassic';

interface DashboardLeftSidebarProps {
  mobileSidebarOpen: boolean;
  isCompactViewport: boolean;
  desktopSidebarCollapsed: boolean;
  leftSidebarWidth: number;
  desktopSidebarToggleRef: React.RefObject<HTMLButtonElement | null>;
  sidebarRef?: React.RefObject<HTMLElement | null>;
  processingStats: DashboardProcessingStatsSummary;
  images: LoadedImage[];
  activeId: string | null;
  mode: string;
  processing: boolean;
  isExtractingUploads: boolean;
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
  setImages: (images: LoadedImage[]) => void;
  setActiveId: (id: string | null) => void;
  invalidateAioPipelineHistory: () => void;
  setStatusMessage: (value: string) => void;
  toggleDesktopSidebar: (animate: boolean) => void;
  startSidebarResize: (side: 'left' | 'right', clientX: number) => void;
  resetLeftSidebarWidth: () => void;
  resizeLeftSidebarBy: (delta: number) => void;
  sidebarResizeStep: number;
  getRotatedDims: (image: LoadedImage) => { width: number; height: number };
  getAioImageSnapshotMeta: (imageId: string) => AioImageHistoryMeta;
  rewindAioPipelineForImage: (imageId: string) => void;
  forwardAioPipelineForImage: (imageId: string) => void;
  rotateImage: (imageId: string) => void;
  moveImage: (index: number, direction: 'up' | 'down') => void;
  removeImage: (imageId: string) => void;
  chapterSelection: SidebarChapterSelection;
}

interface SidebarImageItemProps {
  img: LoadedImage;
  idx: number;
  count: number;
  isActive: boolean;
  canRewind: boolean;
  canForward: boolean;
  processing: boolean;
  isAioMode: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (imageId: string) => void;
  getRotatedDims: (image: LoadedImage) => { width: number; height: number };
  setActiveId: (id: string | null) => void;
  rotateImage: (imageId: string) => void;
  moveImage: (index: number, direction: 'up' | 'down') => void;
  removeImage: (imageId: string) => void;
  rewindAioPipelineForImage: (imageId: string) => void;
  forwardAioPipelineForImage: (imageId: string) => void;
  t: TranslateFn;
}

const SidebarImageItem = React.memo(function SidebarImageItem({
  img,
  idx,
  count,
  isActive,
  canRewind,
  canForward,
  processing,
  isAioMode,
  selectionMode,
  isSelected,
  onToggleSelection,
  getRotatedDims,
  setActiveId,
  rotateImage,
  moveImage,
  removeImage,
  rewindAioPipelineForImage,
  forwardAioPipelineForImage,
  t,
}: SidebarImageItemProps) {
  const rotated = getRotatedDims(img);
  return (
    <m.li
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      onClick={() =>
        selectionMode ? onToggleSelection(img.id) : setActiveId(img.id)
      }
      className={cn(
        'panel-cut-sm group flex cursor-pointer items-center gap-2 p-1.5 transition-all',
        isActive
          ? 'bg-crimson/15 shadow-hard-crimson ring-1 ring-crimson/40'
          : 'bg-ink-3/60 hover:-translate-x-0.5 hover:bg-ink-3 hover:shadow-hard-paper',
        selectionMode && isSelected && 'bg-crimson/10 ring-1 ring-crimson/70',
      )}
    >
      {selectionMode && (
        <span
          aria-hidden="true"
          className={cn(
            'panel-cut-sm grid h-4 w-4 shrink-0 place-items-center border',
            isSelected
              ? 'border-crimson bg-crimson text-ink'
              : 'border-paper/25 bg-ink',
          )}
        >
          {isSelected && <Check size={11} />}
        </span>
      )}
      <div className="panel-cut-sm relative h-11 w-11 shrink-0 overflow-hidden bg-ink">
        <img src={img.thumbnailUrl ?? img.url} alt="thumb" loading="lazy" decoding="async" style={{ contain: 'content' }} className="h-full w-full object-cover" />
        {isActive && <span className="absolute left-1 top-1 h-1.5 w-1.5 bg-crimson blink-noir" aria-hidden="true" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-mono text-[11px] font-medium text-paper" title={img.file.name}>{img.file.name}</p>
        <p className="font-mono text-[9px] text-paper-dim">{rotated.width}×{rotated.height}</p>
      </div>
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100',
          selectionMode && 'hidden',
        )}
      >
        {isAioMode && (
          <>
            <MiniBtn title={t('dashboard.sidebar.rewindImage')} disabled={processing || !canRewind} onClick={(e) => { e.stopPropagation(); rewindAioPipelineForImage(img.id); }}>
              <SkipBack size={11} />
            </MiniBtn>
            <MiniBtn title={t('dashboard.sidebar.forwardImage')} disabled={processing || !canForward} onClick={(e) => { e.stopPropagation(); forwardAioPipelineForImage(img.id); }}>
              <SkipForward size={11} />
            </MiniBtn>
          </>
        )}
        <MiniBtn title={t('dashboard.sidebar.rotate90')} disabled={processing} onClick={(e) => { e.stopPropagation(); rotateImage(img.id); }}>
          <RotateCw size={12} />
        </MiniBtn>
        <div className="flex flex-col">
          <MiniBtn title={t('dashboard.sidebar.moveUp')} disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveImage(idx, 'up'); }}>
            <ArrowUp size={10} />
          </MiniBtn>
          <MiniBtn title={t('dashboard.sidebar.moveDown')} disabled={idx === count - 1} onClick={(e) => { e.stopPropagation(); moveImage(idx, 'down'); }}>
            <ArrowDown size={10} />
          </MiniBtn>
        </div>
        <MiniBtn danger title={t('dashboard.sidebar.remove')} onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}>
          <X size={12} />
        </MiniBtn>
      </div>
    </m.li>
  );
});

export default function DashboardLeftSidebarNoir({
  mobileSidebarOpen,
  isCompactViewport,
  desktopSidebarCollapsed,
  leftSidebarWidth,
  desktopSidebarToggleRef,
  sidebarRef,
  processingStats,
  images,
  activeId,
  mode,
  processing,
  isExtractingUploads,
  getRootProps,
  getInputProps,
  isDragActive,
  setImages,
  setActiveId,
  invalidateAioPipelineHistory,
  setStatusMessage,
  toggleDesktopSidebar,
  startSidebarResize,
  resetLeftSidebarWidth,
  resizeLeftSidebarBy,
  sidebarResizeStep,
  getRotatedDims,
  getAioImageSnapshotMeta,
  rewindAioPipelineForImage,
  forwardAioPipelineForImage,
  rotateImage,
  moveImage,
  removeImage,
  chapterSelection,
}: DashboardLeftSidebarProps) {
  const { t } = useI18n();
  const chapterGroups = React.useMemo(
    () => groupImagesIntoAioChapters(images),
    [images],
  );
  const hasChapters = chapterGroups.some(
    (group) => group.id !== DIRECT_IMAGES_CHAPTER_ID,
  );
  const imageIndexById = React.useMemo(
    () => new Map(images.map((image, index) => [image.id, index])),
    [images],
  );
  const renderImageItem = (img: LoadedImage) => {
    const meta = getAioImageSnapshotMeta(img.id);

    return (
      <SidebarImageItem
        key={img.id}
        img={img}
        idx={imageIndexById.get(img.id) ?? 0}
        count={images.length}
        isActive={activeId === img.id}
        canRewind={meta.canRewind}
        canForward={meta.canForward}
        processing={processing}
        isAioMode={mode === 'aio'}
        selectionMode={chapterSelection.active}
        isSelected={chapterSelection.selectedIds.has(img.id)}
        onToggleSelection={chapterSelection.toggleImage}
        getRotatedDims={getRotatedDims}
        setActiveId={setActiveId}
        rotateImage={rotateImage}
        moveImage={moveImage}
        removeImage={removeImage}
        rewindAioPipelineForImage={rewindAioPipelineForImage}
        forwardAioPipelineForImage={forwardAioPipelineForImage}
        t={t}
      />
    );
  };
  const statsItems = [processingStats.daily, processingStats.weekly, processingStats.monthly];

  const formatResetCountdown = (resetInMs: number): string => {
    const totalMinutes = Math.max(0, Math.ceil(resetInMs / 60_000));
    if (totalMinutes <= 0) return t('dashboard.sidebar.stats.resetNow');
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return t('dashboard.sidebar.stats.resetInHoursMinutes', { hours, minutes });
    if (hours > 0) return t('dashboard.sidebar.stats.resetInHours', { hours });
    return t('dashboard.sidebar.stats.resetInMinutes', { minutes: totalMinutes });
  };

  const handleClearAll = () => {
    const { downloadItems, setDownloadItems } = useExportStore.getState();
    images.forEach((img) => {
      URL.revokeObjectURL(img.url);
      if (img.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(img.thumbnailUrl);
    });
    downloadItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setImages([]);
    setActiveId(null);
    setDownloadItems([]);
    useRegionEditorStore.getState().clearAioRegionMaps();
    useCleanerStore.getState().clearCleanerPerImageMaps();
    useTranslatorStore.getState().clearTranslatorPerImageMaps();
    invalidateAioPipelineHistory();
    setStatusMessage(t('dashboard.sidebar.cleared'));
  };

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'relative flex h-full flex-col overflow-hidden border-r-2 border-crimson/25 bg-ink-2/90 backdrop-blur-xl transition-transform',
        mobileSidebarOpen && 'z-50 translate-x-0',
        isCompactViewport && !mobileSidebarOpen && '-translate-x-full',
        !isCompactViewport && desktopSidebarCollapsed && 'w-0 -translate-x-full border-0',
      )}
      data-tour="dashboard-sidebar"
      aria-hidden={!isCompactViewport && desktopSidebarCollapsed}
      style={!isCompactViewport && !desktopSidebarCollapsed ? { width: leftSidebarWidth } : undefined}
    >
      <div className="halftone pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <span className="v-text pointer-events-none absolute -right-1 bottom-32 font-display text-5xl font-black text-outline opacity-25" aria-hidden="true">ファイル</span>

      <div className="relative z-10 border-b border-paper/10 p-3">
        <div className="flex items-center gap-2.5">
          <KomaMascotBadgeNoir />
          <div className="min-w-0 flex-1 leading-none">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-display text-[14px] font-black uppercase tracking-tight text-paper">
                {t('brand.name')}
                <span className="font-serif-accent italic text-crimson"> {t('brand.studioSuffix')}</span>
              </span>
            </div>
            <VersionBadge />
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-paper-faint">
            {t('dashboard.sidebar.workspace')}
          </span>
          {!isCompactViewport && (
            <button
              type="button"
              ref={desktopSidebarToggleRef}
              className="k2-mbtn"
              onClick={() => toggleDesktopSidebar(true)}
              title={t('dashboard.sidebar.hide')}
              aria-label={t('dashboard.sidebar.hide')}
            >
              <PanelLeftOpen size={15} className="-scale-x-100" />
            </button>
          )}
        </div>

        {/* Usage card */}
        <div className="glass panel-cut mt-3 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="kicker !text-[10px]">
              {t('dashboard.sidebar.stats.title')}
            </span>
            <span className="panel-cut-sm bg-gold/15 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-gold">
              {t('dashboard.sidebar.stats.badge')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {statsItems.map((item) => (
              <div key={item.key} className="panel-cut-sm bg-ink-3/70 p-2 text-center">
                <div className="font-mono text-[8px] uppercase tracking-wider text-paper-dim">{t(`dashboard.sidebar.stats.${item.key}`)}</div>
                <div className="font-display text-lg font-black text-crimson">{item.count}</div>
                <div className="font-mono text-[7px] text-paper-dim">{formatResetCountdown(item.resetInMs)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[8px] leading-relaxed text-paper-dim">{t('dashboard.sidebar.stats.foot')}</div>
        </div>
      </div>

      {!isCompactViewport && !desktopSidebarCollapsed && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); startSidebarResize('left', e.clientX); }}
          onDoubleClick={(e) => { e.preventDefault(); resetLeftSidebarWidth(); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); resizeLeftSidebarBy(sidebarResizeStep); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); resizeLeftSidebarBy(-sidebarResizeStep); }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetLeftSidebarWidth(); }
          }}
          aria-label={t('dashboard.sidebar.resizeAria')} title={t('dashboard.sidebar.resizeTitle')}
          className="group absolute right-0 top-0 z-30 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-crimson/10"
        >
          <span className="flex flex-col text-paper-dim opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
            <ChevronLeft size={10} /><ChevronRight size={10} />
          </span>
        </button>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="kicker">// {t('dashboard.sidebar.files', { count: images.length })}</span>
          {images.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={t('dashboard.sidebar.selection.toggle')}
                aria-label={t('dashboard.sidebar.selection.toggle')}
                aria-pressed={chapterSelection.active}
                disabled={chapterSelection.disabled}
                onClick={chapterSelection.toggleMode}
                className={cn(
                  'panel-cut-sm grid h-6 w-6 place-items-center transition-all disabled:cursor-not-allowed disabled:opacity-30',
                  chapterSelection.active
                    ? 'bg-crimson text-ink'
                    : 'bg-ink-3 text-paper-dim hover:bg-ink-2 hover:text-paper',
                )}
              >
                <ListChecks size={12} />
              </button>
              <button
                type="button"
                title={t('dashboard.sidebar.clearAll')}
                onClick={handleClearAll}
                className="panel-cut-sm grid h-6 w-6 place-items-center bg-ink-3 text-crimson transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-crimson hover:text-ink hover:shadow-hard-gold"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {chapterSelection.active && (
          <SidebarChapterSelectionBar selection={chapterSelection} noir />
        )}

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {images.length === 0 ? (
            <div className="panel-cut flex h-40 flex-col items-center justify-center gap-2 border border-dashed border-paper/15 bg-ink-3/40 text-paper-dim">
              <ImageIcon size={22} className="text-crimson/60" />
              <span className="font-mono text-[11px]">{t('dashboard.sidebar.empty')}</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {hasChapters ? (
                chapterGroups.map((group) => (
                  <React.Fragment key={group.id}>
                    <li>
                      <SidebarChapterHeader
                        chapterId={
                          group.id === DIRECT_IMAGES_CHAPTER_ID
                            ? null
                            : group.id
                        }
                        label={
                          group.id === DIRECT_IMAGES_CHAPTER_ID
                            ? t('dashboard.sidebar.chapters.unassigned')
                            : group.label
                        }
                        count={group.images.length}
                        noir
                      />
                    </li>
                    {group.images.map(renderImageItem)}
                  </React.Fragment>
                ))
              ) : (
                <AnimatePresence initial={false}>
                  {images.map(renderImageItem)}
                </AnimatePresence>
              )}
            </ul>
          )}
        </div>

        <div
          {...getRootProps()}
          aria-busy={isExtractingUploads}
          data-tour="dashboard-dropzone"
          className={cn(
            'panel-cut group mt-3 flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed p-4 text-center transition-all',
            isDragActive
              ? 'border-crimson bg-crimson/10 shadow-hard-crimson'
              : 'border-paper/15 bg-ink-3/40 hover:border-crimson/50 hover:bg-ink-3/70',
            isExtractingUploads && 'animate-pulse border-azure/50',
          )}
        >
          <input {...getInputProps()} />
          <span className={cn(
            'panel-cut-sm grid h-10 w-10 place-items-center transition-colors',
            isDragActive ? 'bg-crimson text-ink' : 'bg-ink-2 text-crimson group-hover:bg-crimson group-hover:text-ink',
          )}>
            <Upload size={18} />
          </span>
          <div aria-live="polite" className="flex flex-col gap-0.5">
            <p className="font-display text-xs font-bold uppercase tracking-tight text-paper">
              {isExtractingUploads ? t('dashboard.sidebar.extracting')
                : isDragActive ? t('dashboard.sidebar.dropHere')
                  : t('dashboard.sidebar.clickOrDrag')}
            </p>
            {isExtractingUploads ? (
              <span className="flex items-center justify-center gap-1 font-mono text-[10px] text-azure">
                <RefreshCcw size={10} className="animate-spin" />
                {t('dashboard.sidebar.processingArchive')}
              </span>
            ) : (
              <span className="font-mono text-[9px] text-paper-dim">{t('dashboard.sidebar.supportedFormats')}</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function MiniBtn({ children, onClick, disabled, danger, title }: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'panel-cut-sm grid h-6 w-6 place-items-center transition-colors',
        danger ? 'text-crimson hover:bg-crimson hover:text-ink' : 'text-paper-dim hover:bg-ink-2 hover:text-paper',
        disabled && 'cursor-not-allowed opacity-25 hover:bg-transparent hover:text-paper-dim',
      )}
    >
      {children}
    </button>
  );
}