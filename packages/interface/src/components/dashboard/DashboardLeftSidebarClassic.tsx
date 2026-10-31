import React from 'react';
import {
  Upload,
  Layers,
  Image as ImageIcon,
  Trash2,
  RotateCw,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  ListChecks,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  RefreshCcw,
} from 'lucide-react';

import { useI18n, type TranslateFn } from '../../i18n';
import VersionBadge from '../VersionBadge';
import SidebarChapterHeader from './SidebarChapterHeader';
import SidebarChapterSelectionBar from './SidebarChapterSelectionBar';
import { cn } from '../../utils/dashboard.utils';
import type { SidebarChapterSelection } from '../../pages/dashboard/hooks/use-sidebar-chapter-selection';
import {
  DIRECT_IMAGES_CHAPTER_ID,
  groupImagesIntoAioChapters,
} from '../../pages/dashboard/lib/aio-chapters';
import { useExportStore } from '../../pages/dashboard/stores/export-store';
import { useRegionEditorStore } from '../../pages/dashboard/stores/region-editor-store';
import { useCleanerStore } from '../../pages/dashboard/stores/cleaner-store';
import { useTranslatorStore } from '../../pages/dashboard/stores/translator-store';
import type {
  DashboardProcessingStatsSummary,
  LoadedImage,
} from '../../types/dashboard.types';

export interface AioImageHistoryMeta {
  key: string | null;
  label: string | null;
  index: number;
  canRewind: boolean;
  canForward: boolean;
}

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
    <li
      onClick={() =>
        selectionMode ? onToggleSelection(img.id) : setActiveId(img.id)
      }
      className={cn(
        'koma-fileitem',
        isActive && 'koma-fileitem--active',
        selectionMode && isSelected && 'ring-1 ring-inset ring-[var(--auth-purple)]',
      )}
    >
      {selectionMode && (
        <span
          aria-hidden="true"
          className={cn(
            'grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border',
            isSelected
              ? 'border-transparent bg-[var(--auth-purple)] text-white'
              : 'border-current opacity-40',
          )}
        >
          {isSelected && <Check size={11} />}
        </span>
      )}
      <div className="koma-fileitem__thumb">
        <img src={img.thumbnailUrl ?? img.url} alt="thumb" loading="lazy" decoding="async" style={{ contain: "content" }} />
      </div>
      <div className="koma-fileitem__info">
        <p className="koma-fileitem__name" title={img.file.name}>
          {img.file.name}
        </p>
        <p className="koma-fileitem__dims">
          {rotated.width}x{rotated.height}
        </p>
      </div>
      <div
        className={cn(
          'koma-fileitem__actions',
          selectionMode && 'hidden',
        )}
      >
        {isAioMode && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                rewindAioPipelineForImage(img.id);
              }}
              className="koma-iconbtn koma-iconbtn--xs"
              title={t('dashboard.sidebar.rewindImage')}
              disabled={processing || !canRewind}
            >
              <SkipBack size={12} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                forwardAioPipelineForImage(img.id);
              }}
              className="koma-iconbtn koma-iconbtn--xs"
              title={t('dashboard.sidebar.forwardImage')}
              disabled={processing || !canForward}
            >
              <SkipForward size={12} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            rotateImage(img.id);
          }}
          className="koma-iconbtn koma-iconbtn--xs"
          title={t('dashboard.sidebar.rotate90')}
          disabled={processing}
        >
          <RotateCw size={13} />
        </button>
        <div className="koma-fileitem__reorder">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              moveImage(idx, 'up');
            }}
            disabled={idx === 0}
            className="koma-iconbtn koma-iconbtn--xs"
            title={t('dashboard.sidebar.moveUp')}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              moveImage(idx, 'down');
            }}
            disabled={idx === count - 1}
            className="koma-iconbtn koma-iconbtn--xs"
            title={t('dashboard.sidebar.moveDown')}
          >
            <ArrowDown size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeImage(img.id);
          }}
          className="koma-iconbtn koma-iconbtn--xs koma-iconbtn--danger"
          title={t('dashboard.sidebar.remove')}
        >
          <X size={14} />
        </button>
      </div>
    </li>
  );
});

export default function DashboardLeftSidebarClassic({
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
  const statsItems = [processingStats.daily, processingStats.weekly, processingStats.monthly];
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
    const imageHistoryMeta = getAioImageSnapshotMeta(img.id);

    return (
      <SidebarImageItem
        key={img.id}
        img={img}
        idx={imageIndexById.get(img.id) ?? 0}
        count={images.length}
        isActive={activeId === img.id}
        canRewind={imageHistoryMeta.canRewind}
        canForward={imageHistoryMeta.canForward}
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

  const formatResetCountdown = (resetInMs: number): string => {
    const totalMinutes = Math.max(0, Math.ceil(resetInMs / 60_000));
    if (totalMinutes <= 0) {
      return t('dashboard.sidebar.stats.resetNow');
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) {
      return t('dashboard.sidebar.stats.resetInHoursMinutes', { hours, minutes });
    }
    if (hours > 0) {
      return t('dashboard.sidebar.stats.resetInHours', { hours });
    }
    return t('dashboard.sidebar.stats.resetInMinutes', { minutes: totalMinutes });
  };

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'koma-dash__sidebar',
        mobileSidebarOpen && 'koma-dash__sidebar--open',
        !isCompactViewport && desktopSidebarCollapsed && 'koma-dash__sidebar--collapsed',
      )}
      data-tour="dashboard-sidebar"
      aria-hidden={!isCompactViewport && desktopSidebarCollapsed}
      style={!isCompactViewport && !desktopSidebarCollapsed ? { width: leftSidebarWidth } : undefined}
    >
      <div className="koma-sidebar__top">
        <div className="koma-brand">
          <div className="koma-brand__icon"><Layers size={18} /></div>
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
          {!isCompactViewport && (
            <button
              type="button"
              ref={desktopSidebarToggleRef as React.LegacyRef<HTMLButtonElement>}
              className="koma-iconbtn koma-iconbtn--xs koma-desktop-sidebar-toggle"
              onClick={() => toggleDesktopSidebar(true)}
              title={t('dashboard.sidebar.hide')}
              aria-label={t('dashboard.sidebar.hide')}
            >
              <PanelLeftOpen size={16} className="koma-iconbtn__flip-x" />
            </button>
          )}
        </div>

        <div className="koma-usage-card">
          <div className="koma-usage-card__row">
            <span className="koma-usage-card__label">
              {t('dashboard.sidebar.stats.title')}
            </span>
            <span className="koma-usage-card__value">{t('dashboard.sidebar.stats.badge')}</span>
          </div>
          <div className="koma-usage-card__statsGrid">
            {statsItems.map((item) => (
              <div key={item.key} className="koma-usage-card__statTile">
                <div className="koma-usage-card__statLabel">{t(`dashboard.sidebar.stats.${item.key}`)}</div>
                <div className="koma-usage-card__statValue">{item.count}</div>
                <div className="koma-usage-card__statHint">{formatResetCountdown(item.resetInMs)}</div>
              </div>
            ))}
          </div>
          <div className="koma-usage-card__foot">
            {t('dashboard.sidebar.stats.foot')}
          </div>
        </div>
      </div>

      {!isCompactViewport && !desktopSidebarCollapsed && (
        <button
          type="button"
          className="koma-sidebar-resize-handle koma-sidebar-resize-handle--right"
          onMouseDown={(event) => {
            event.preventDefault();
            startSidebarResize('left', event.clientX);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            resetLeftSidebarWidth();
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              resizeLeftSidebarBy(sidebarResizeStep);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              resizeLeftSidebarBy(-sidebarResizeStep);
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              resetLeftSidebarWidth();
            }
          }}
          aria-label={t('dashboard.sidebar.resizeAria')}
          title={t('dashboard.sidebar.resizeTitle')}
        >
          <span
            className="koma-sidebar-resize-handle__inner"
            aria-hidden="true"
          >
            <ChevronLeft size={11} />
            <ChevronRight size={11} />
          </span>
        </button>
      )}

      <div className="koma-files">
        <div className="koma-files__header">
          <span>{t('dashboard.sidebar.files', { count: images.length })}</span>
          {images.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  'koma-iconbtn koma-iconbtn--xs',
                  chapterSelection.active && 'text-[var(--auth-purple)]',
                )}
                title={t('dashboard.sidebar.selection.toggle')}
                aria-label={t('dashboard.sidebar.selection.toggle')}
                aria-pressed={chapterSelection.active}
                disabled={chapterSelection.disabled}
                onClick={chapterSelection.toggleMode}
              >
                <ListChecks size={13} />
              </button>
              <button
                type="button"
                className="koma-iconbtn koma-iconbtn--danger koma-iconbtn--xs"
                title={t('dashboard.sidebar.clearAll')}
                onClick={() => {
                  const { downloadItems, setDownloadItems } =
                    useExportStore.getState();
                  images.forEach((img) => { URL.revokeObjectURL(img.url); if (img.thumbnailUrl?.startsWith("blob:")) URL.revokeObjectURL(img.thumbnailUrl); });
                  downloadItems.forEach((item) =>
                    URL.revokeObjectURL(item.previewUrl),
                  );
                  setImages([]);
                  setActiveId(null);
                  setDownloadItems([]);
                  useRegionEditorStore.getState().clearAioRegionMaps();
                  useCleanerStore.getState().clearCleanerPerImageMaps();
                  useTranslatorStore.getState().clearTranslatorPerImageMaps();
                  invalidateAioPipelineHistory();
                  setStatusMessage(t('dashboard.sidebar.cleared'));
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {chapterSelection.active && (
          <SidebarChapterSelectionBar selection={chapterSelection} noir={false} />
        )}

        <div className="koma-files__list custom-scrollbar">
          {images.length === 0 ? (
            <div className="koma-files__empty">
              <ImageIcon size={20} />
              <span>{t('dashboard.sidebar.empty')}</span>
            </div>
          ) : (
            <ul className="koma-filelist">
              {hasChapters
                ? chapterGroups.map((group) => (
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
                          noir={false}
                        />
                      </li>
                      {group.images.map(renderImageItem)}
                    </React.Fragment>
                  ))
                : images.map(renderImageItem)}
            </ul>
          )}
        </div>

        <div
          {...getRootProps()}
          aria-busy={isExtractingUploads}
          data-tour="dashboard-dropzone"
          className={cn(
            'koma-dropzone',
            isDragActive && 'koma-dropzone--active',
            isExtractingUploads && 'koma-dropzone--loading',
          )}
        >
          <input {...getInputProps()} />
          <Upload size={18} />
          <div className="koma-dropzone__text" aria-live="polite">
            <p>
              {isExtractingUploads
                ? t('dashboard.sidebar.extracting')
                : isDragActive
                  ? t('dashboard.sidebar.dropHere')
                  : t('dashboard.sidebar.clickOrDrag')}
            </p>
            {isExtractingUploads ? (
              <span className="koma-dropzone__loading">
                <RefreshCcw size={11} className="koma-spin" />
                {t('dashboard.sidebar.processingArchive')}
              </span>
            ) : (
              <span>{t('dashboard.sidebar.supportedFormats')}</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
