import React, { useMemo } from 'react';

import DashboardLeftSidebar, {
  type AioImageHistoryMeta,
} from '../../../components/dashboard/DashboardLeftSidebar';
import { SIDEBAR_RESIZE_STEP } from '../../../constants/dashboard.constants';
import { getRotatedDims } from '../../../utils/dashboard.utils';
import type {
  DashboardProcessingStatsSummary,
} from '../../../types/dashboard.types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';

interface ImageCollectionSidebarProps {
  /* ── Shell layout (not yet migrated) ── */
  mobileSidebarOpen: boolean;
  isCompactViewport: boolean;
  desktopSidebarCollapsed: boolean;
  leftSidebarWidth: number;
  desktopSidebarToggleRef: React.RefObject<HTMLButtonElement | null>;
  toggleDesktopSidebar: (animate: boolean) => void;
  startSidebarResize: (side: 'left' | 'right', clientX: number) => void;
  resetLeftSidebarWidth: () => void;
  resizeLeftSidebarBy: (delta: number) => void;

  /* ── Processing stats (not yet migrated) ── */
  processingStats: DashboardProcessingStatsSummary;

  /* ── Uploads hook (dropzone bindings) ── */
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;

  /* ── Cross-domain region/state setters (not yet migrated) ── */
  invalidateAioPipelineHistory: () => void;

  /* ── AIO pipeline (not yet migrated) ── */
  getAioImageSnapshotMeta: (imageId: string) => AioImageHistoryMeta;
  rewindAioPipelineForImage: (imageId: string) => void;
  forwardAioPipelineForImage: (imageId: string) => void;

  /* ── Composite removal (revokes URLs + prunes cross-domain maps) ── */
  removeImage: (imageId: string) => void;
}

export default function ImageCollectionSidebar({
  mobileSidebarOpen,
  isCompactViewport,
  desktopSidebarCollapsed,
  leftSidebarWidth,
  desktopSidebarToggleRef,
  toggleDesktopSidebar,
  startSidebarResize,
  resetLeftSidebarWidth,
  resizeLeftSidebarBy,
  processingStats,
  getRootProps,
  getInputProps,
  isDragActive,
  invalidateAioPipelineHistory,
  getAioImageSnapshotMeta,
  rewindAioPipelineForImage,
  forwardAioPipelineForImage,
  removeImage,
}: ImageCollectionSidebarProps) {
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const isExtractingUploads = useImageCollectionStore(
    (s) => s.isExtractingUploads,
  );
  const setImages = useImageCollectionStore((s) => s.setImages);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const moveImage = useImageCollectionStore((s) => s.moveImage);
  const rotateImage = useImageCollectionStore((s) => s.rotateImage);
  const mode = useUiShellStore((s) => s.mode);
  const processing = useUiShellStore((s) => s.processing);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  // Same derivation as the page-level `activeImage` memo: the active selection
  // falls back to the first loaded image.
  const resolvedActiveId = useMemo(
    () =>
      (images.find((img) => img.id === activeId) ?? images[0] ?? null)?.id ??
      null,
    [activeId, images],
  );

  return (
    <DashboardLeftSidebar
      mobileSidebarOpen={mobileSidebarOpen}
      isCompactViewport={isCompactViewport}
      desktopSidebarCollapsed={desktopSidebarCollapsed}
      leftSidebarWidth={leftSidebarWidth}
      desktopSidebarToggleRef={desktopSidebarToggleRef}
      processingStats={processingStats}
      images={images}
      activeId={resolvedActiveId}
      mode={mode}
      processing={processing}
      isExtractingUploads={isExtractingUploads}
      getRootProps={getRootProps}
      getInputProps={getInputProps}
      isDragActive={isDragActive}
      setImages={setImages}
      setActiveId={setActiveId}
      invalidateAioPipelineHistory={invalidateAioPipelineHistory}
      setStatusMessage={setStatusMessage}
      toggleDesktopSidebar={toggleDesktopSidebar}
      startSidebarResize={startSidebarResize}
      resetLeftSidebarWidth={resetLeftSidebarWidth}
      resizeLeftSidebarBy={resizeLeftSidebarBy}
      sidebarResizeStep={SIDEBAR_RESIZE_STEP}
      getRotatedDims={getRotatedDims}
      getAioImageSnapshotMeta={getAioImageSnapshotMeta}
      rewindAioPipelineForImage={rewindAioPipelineForImage}
      forwardAioPipelineForImage={forwardAioPipelineForImage}
      rotateImage={rotateImage}
      moveImage={moveImage}
      removeImage={removeImage}
    />
  );
}
