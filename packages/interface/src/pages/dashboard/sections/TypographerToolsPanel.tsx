import { useMemo } from 'react';

import TypesetterToolsPanel from '../../../components/dashboard/TypesetterToolsPanel';
import type {
  TypographySession,
  TypographyStylePreset,
} from '../../../typography/types';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useTypographerStore } from '../stores/typographer-store';
import type { useAioRegionEditing } from '../hooks/region-editor';
import type { useTypographerControls } from '../hooks/typographer';

type AioRegionEditingApi = ReturnType<typeof useAioRegionEditing>;
type TypographerControlsApi = ReturnType<typeof useTypographerControls>;

interface TypographerToolsPanelProps {
  /* ── Typographer workspace session + page memos (multi-store derived; selector candidates in T12) ── */
  activeTypographerSession: TypographySession | null;
  activeTypographerPreset: TypographyStylePreset | null;
  activeTypographerMultiSelectedIds: string[];

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

  /* ── Page callback (derives from resolvedActiveId) ── */
  handleTypographerMultiSelectReorder: (nextOrder: string[]) => void;
}

/**
 * Typesetter tools panel view (the `{mode === 'typesetter'}` block).
 * Reads the typographer store slots + the shared catalogs and derives the
 * same memos the page computes (sources cannot diverge — same stores).
 */
export default function TypographerToolsPanel({
  activeTypographerSession,
  activeTypographerPreset,
  activeTypographerMultiSelectedIds,
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
  handleTypographerMultiSelectReorder,
  handleUpdateTypographyPreset,
}: TypographerToolsPanelProps) {
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.aioSelectedRegionByImage,
  );
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
  const activeImageDetections = useMemo(
    () =>
      resolvedActiveId ? (aioDetectionsByImage[resolvedActiveId] ?? []) : [],
    [aioDetectionsByImage, resolvedActiveId],
  );
  const activeSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (aioSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [aioSelectedRegionByImage, resolvedActiveId],
  );
  const activeSelectedRegion = useMemo(
    () =>
      activeImageDetections.find(
        (region) => region.id === activeSelectedRegionId,
      ) ?? null,
    [activeImageDetections, activeSelectedRegionId],
  );
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
