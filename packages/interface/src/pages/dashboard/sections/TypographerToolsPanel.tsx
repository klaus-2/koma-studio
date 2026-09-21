import { useEffect, useMemo } from 'react';

import TypesetterToolsPanel from '../../../components/dashboard/TypesetterToolsPanel';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useTypographerStore } from '../stores/typographer-store';
import type { useAioRegionEditing } from '../hooks/region-editor';
import type { useTypographerControls } from '../hooks/typographer';
import { resolveTypographyPresetForMode } from '../../../typography/presets';
import { resolveRenderTextMode } from '../../../utils/renderModes';
import { EMPTY_SELECTED_REGION_IDS } from '../../../utils/dashboardRenderUtils';

type AioRegionEditingApi = ReturnType<typeof useAioRegionEditing>;
type TypographerControlsApi = ReturnType<typeof useTypographerControls>;

interface TypographerToolsPanelProps {
  /* ── Render font catalog (not yet migrated) ── */
  availableRenderFonts: string[];

  /* ── Typographer controls hook (not yet migrated) ── */
  handleTypographerPresetChange: TypographerControlsApi['handleTypographerPresetChange'];
  refineActiveTypographerShape: TypographerControlsApi['refineActiveTypographerShape'];
  handleTypographerSaveSnapshot: TypographerControlsApi['handleTypographerSaveSnapshot'];
  handleTypographerRestoreSnapshot: TypographerControlsApi['handleTypographerRestoreSnapshot'];
  handleTypographerDraftChange: TypographerControlsApi['handleTypographerDraftChange'];
  handleTypographerBuildQueue: TypographerControlsApi['handleTypographerBuildQueue'];
  handleTypographerClearQueue: TypographerControlsApi['handleTypographerClearQueue'];
  applySelectedTypographerQueueItem: TypographerControlsApi['applySelectedTypographerQueueItem'];
  applyNextTypographerQueueItem: TypographerControlsApi['applyNextTypographerQueueItem'];
  handleTypographerToggleMultiBubble: TypographerControlsApi['handleTypographerToggleMultiBubble'];
  handleTypographerImportQueueText: TypographerControlsApi['handleTypographerImportQueueText'];

  /* ── Region editor hook (not yet migrated) ── */
  convertActiveTypographerShape: AioRegionEditingApi['convertActiveTypographerShape'];
  duplicateSelectedTypographerRegion: AioRegionEditingApi['duplicateSelectedTypographerRegion'];
  removeSelectedAioRegion: AioRegionEditingApi['removeSelectedAioRegion'];
  applyActiveTypographyPresetToSelection: AioRegionEditingApi['applyActiveTypographyPresetToSelection'];
  applyActiveTypographyPresetToImage: AioRegionEditingApi['applyActiveTypographyPresetToImage'];
  handleUpdateTypographyPreset: AioRegionEditingApi['handleUpdateTypographyPreset'];
}

/**
 * Typesetter tools panel view (the `{mode === 'typesetter'}` block).
 * Reads the typographer store slots + the shared catalogs and derives the
 * same memos the page computes (sources cannot diverge — same stores).
 * The session/preset/multi-selection slices are auto-subscribed here
 * instead of flowing from the page.
 */
export default function TypographerToolsPanel({
  availableRenderFonts,
  handleTypographerPresetChange,
  refineActiveTypographerShape,
  convertActiveTypographerShape,
  duplicateSelectedTypographerRegion,
  removeSelectedAioRegion,
  applyActiveTypographyPresetToSelection,
  applyActiveTypographyPresetToImage,
  handleTypographerSaveSnapshot,
  handleTypographerRestoreSnapshot,
  handleTypographerDraftChange,
  handleTypographerBuildQueue,
  handleTypographerClearQueue,
  applySelectedTypographerQueueItem,
  applyNextTypographerQueueItem,
  handleTypographerToggleMultiBubble,
  handleTypographerImportQueueText,
  handleUpdateTypographyPreset,
}: TypographerToolsPanelProps) {
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const typographyPresetState = useRegionEditorStore(
    (s) => s.typographyPresetState,
  );
  const typographerSelectionTool = useTypographerStore(
    (s) => s.typographerSelectionTool,
  );
  const setTypographerSelectionTool = useTypographerStore(
    (s) => s.setTypographerSelectionTool,
  );
  const typographerQueueSelectedId = useTypographerStore(
    (s) => s.typographerQueueSelectedId,
  );
  const setTypographerQueueSelectedId = useTypographerStore(
    (s) => s.setTypographerQueueSelectedId,
  );
  const typographerSnapshotName = useTypographerStore(
    (s) => s.typographerSnapshotName,
  );
  const setTypographerSnapshotName = useTypographerStore(
    (s) => s.setTypographerSnapshotName,
  );
  const typographerSelectedSnapshotId = useTypographerStore(
    (s) => s.typographerSelectedSnapshotId,
  );
  const setTypographerSelectedSnapshotId = useTypographerStore(
    (s) => s.setTypographerSelectedSnapshotId,
  );
  const setTypographerMultiSelectedByImage = useTypographerStore(
    (s) => s.setTypographerMultiSelectedByImage,
  );

  // Same derivations the page computes (duplicate expression, single source
  // stores — consolidation candidate in T12).
  const activeImage = useMemo(
    () =>
      images.find((img) => img.id === activeId) ??
      images[0] ??
      null,
    [images, activeId],
  );
  const resolvedActiveId = activeImage?.id ?? null;

  const activeTypographerSession = useTypographerStore((s) =>
    resolvedActiveId
      ? (s.typographerSessionsByImage[resolvedActiveId] ?? null)
      : null,
  );
  const activeTypographerMultiSelectedIds = useTypographerStore((s) =>
    resolvedActiveId
      ? (s.typographerMultiSelectedByImage[resolvedActiveId] ?? EMPTY_SELECTED_REGION_IDS)
      : EMPTY_SELECTED_REGION_IDS,
  );
  const activeImageDetectionsEntry = useRegionEditorStore((s) =>
    resolvedActiveId
      ? (s.aioDetectionsByImage[resolvedActiveId] ?? null)
      : null,
  );
  const activeImageDetections = useMemo(
    () => activeImageDetectionsEntry ?? [],
    [activeImageDetectionsEntry],
  );
  const activeSelectedRegionId = useRegionEditorStore((s) =>
    resolvedActiveId
      ? (s.aioSelectedRegionByImage[resolvedActiveId] ?? null)
      : null,
  );
  const activeSelectedRegion = useMemo(
    () =>
      activeImageDetections.find(
        (region) => region.id === activeSelectedRegionId,
      ) ?? null,
    [activeImageDetections, activeSelectedRegionId],
  );
  const activeSelectedResolvedRenderMode = useMemo(
    () =>
      resolveRenderTextMode({
        renderMode: activeSelectedRegion?.renderMode ?? 'auto',
        detectedRenderMode: activeSelectedRegion?.detectedRenderMode ?? 'text_bubble',
      }),
    [activeSelectedRegion?.detectedRenderMode, activeSelectedRegion?.renderMode],
  );
  const activeTypographerPreset = useMemo(() => {
    const sessionPreset = activeTypographerSession?.activePresetId
      ? (typographyPresetState.presets.find(
        (preset) => preset.id === activeTypographerSession.activePresetId,
      ) ?? null)
      : null;
    if (sessionPreset) return sessionPreset;
    return resolveTypographyPresetForMode(
      activeSelectedResolvedRenderMode,
      typographyPresetState,
    );
  }, [
    activeSelectedResolvedRenderMode,
    activeTypographerSession?.activePresetId,
    typographyPresetState,
  ]);
  const handleTypographerMultiSelectReorder = useMemo(
    () => (nextOrder: string[]) => {
      if (!resolvedActiveId) return;
      setTypographerMultiSelectedByImage((prev) => ({
        ...prev,
        [resolvedActiveId]: nextOrder,
      }));
    },
    [resolvedActiveId, setTypographerMultiSelectedByImage],
  );

  useEffect(() => {
    if (!resolvedActiveId || !activeTypographerSession) return;
    if (activeTypographerSession.activePresetId) return;
    if (!activeTypographerPreset?.id) return;
    useTypographerStore
      .getState()
      .setTypographerSessionsByImage((prev) => {
        const current = prev[resolvedActiveId];
        if (!current || current.activePresetId) return prev;
        return {
          ...prev,
          [resolvedActiveId]: {
            ...current,
            activePresetId: activeTypographerPreset.id,
            updatedAt: Date.now(),
          },
        };
      });
  }, [
    activeTypographerPreset?.id,
    activeTypographerSession,
    resolvedActiveId,
  ]);
  useEffect(() => {
    if (!activeTypographerSession) {
      setTypographerQueueSelectedId(null);
      setTypographerSelectedSnapshotId(null);
      return;
    }
    if (
      !typographerQueueSelectedId ||
      !activeTypographerSession.queue.some(
        (item) => item.id === typographerQueueSelectedId,
      )
    ) {
      setTypographerQueueSelectedId(
        activeTypographerSession.queue[0]?.id ?? null,
      );
    }
    if (
      !typographerSelectedSnapshotId ||
      !activeTypographerSession.snapshots.some(
        (item) => item.id === typographerSelectedSnapshotId,
      )
    ) {
      setTypographerSelectedSnapshotId(
        activeTypographerSession.snapshots[0]?.id ?? null,
      );
    }
  }, [
    activeTypographerSession,
    setTypographerQueueSelectedId,
    setTypographerSelectedSnapshotId,
    typographerQueueSelectedId,
    typographerSelectedSnapshotId,
  ]);
  const typographyPresetList = useMemo(
    () =>
      [...typographyPresetState.presets].sort((left, right) =>
        left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [typographyPresetState.presets],
  );
  const typographyFolderList = useMemo(
    () => [...typographyPresetState.folders].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'pt-BR')),
    [typographyPresetState.folders],
  );

  return (
    <TypesetterToolsPanel
      activeImageName={activeImage?.file.name ?? images[0]?.file.name ?? null}
      activeRegion={activeSelectedRegion}
      regionsCount={activeImageDetections.length}
      session={activeTypographerSession}
      queueSelectedId={typographerQueueSelectedId}
      availablePresets={typographyPresetList}
      selectedPresetId={
        activeTypographerSession?.activePresetId ??
        activeTypographerPreset?.id ??
        null
      }
      selectedTool={typographerSelectionTool}
      snapshotName={typographerSnapshotName}
      selectedSnapshotId={typographerSelectedSnapshotId}
      onSelectedToolChange={setTypographerSelectionTool}
      onPresetChange={handleTypographerPresetChange}
      onRefineShape={() => void refineActiveTypographerShape()}
      onConvertShape={convertActiveTypographerShape}
      onDuplicateRegion={duplicateSelectedTypographerRegion}
      onDeleteRegion={removeSelectedAioRegion}
      onApplyPresetToSelection={applyActiveTypographyPresetToSelection}
      onApplyPresetToImage={applyActiveTypographyPresetToImage}
      onSnapshotNameChange={setTypographerSnapshotName}
      onSaveSnapshot={handleTypographerSaveSnapshot}
      onSelectSnapshot={setTypographerSelectedSnapshotId}
      onRestoreSnapshot={handleTypographerRestoreSnapshot}
      onDraftTextChange={handleTypographerDraftChange}
      onBuildQueue={handleTypographerBuildQueue}
      onClearQueue={handleTypographerClearQueue}
      onApplySelectedQueueItem={applySelectedTypographerQueueItem}
      onApplyNextQueueItem={applyNextTypographerQueueItem}
      onSelectQueueItem={setTypographerQueueSelectedId}
      onToggleMultiBubble={handleTypographerToggleMultiBubble}
      onImportQueueText={handleTypographerImportQueueText}
      multiBubbleRegions={activeTypographerMultiSelectedIds.map(
        (id, i) => {
          const region = activeImageDetections.find((r) => r.id === id);
          const text = (region?.renderText ?? '').trim();
          return {
            id,
            label: text.length > 0 ? text.slice(0, 28) : `Bubble ${i + 1}`,
          };
        },
      )}
      onReorderMultiBubbleRegions={handleTypographerMultiSelectReorder}
      availableFolders={typographyFolderList}
      availableFonts={availableRenderFonts}
      onUpdatePreset={handleUpdateTypographyPreset}
    />
  );
}
