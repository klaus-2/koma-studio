import type { useSpecialModeStageProps } from '../../hooks/utility-workspaces';
import type { useImageCollectionStore } from '../../stores/image-collection-store';
import type { useUiShellStore } from '../../stores/ui-shell-store';
import type {
  useAioRegionSnapshotSync,
  useAioRegionEditing,
} from '../../hooks/region-editor';
import type {
  useCleanerRegionEditing,
  useCleanerManualEdits,
  useCleanerWandHealing,
} from '../../hooks/cleaner';
import type { useAioManualEdits, useAioWandHealing } from '../../hooks/manual-tools';
import type {
  useTranslatorRegionEditing,
  useTranslatorTextActions,
  useTranslatorImports,
} from '../../hooks/translator';
import type {
  useTypographerWorkspace,
  useTypographerControls,
} from '../../hooks/typographer';
import type { useDashboardImageCollection } from '../../hooks/image-collection';
import type { useRenderFontCatalog } from '../../../../hooks/useRenderFontCatalog';
import type { useDashboardDownloadActions } from '../../hooks/export-download';
import type {
  AioPipelineSnapshotKey,
  DownloadItem,
} from '../../../../types/dashboard.types';

type SpecialModeStageProps = ReturnType<typeof useSpecialModeStageProps>['specialModeStageProps'];

/* Store/hook-backed prop types (same fields the page reads today). */
type ImageCollectionState = ReturnType<typeof useImageCollectionStore.getState>;
type UiShellState = ReturnType<typeof useUiShellStore.getState>;
type AioSnapshotSyncApi = ReturnType<typeof useAioRegionSnapshotSync>;
type AioRegionEditingApi = ReturnType<typeof useAioRegionEditing>;
type TypographerControlsApi = ReturnType<typeof useTypographerControls>;
type CleanerRegionEditingApi = ReturnType<typeof useCleanerRegionEditing>;
type TranslatorRegionEditingApi = ReturnType<typeof useTranslatorRegionEditing>;
type CleanerManualEditsApi = ReturnType<typeof useCleanerManualEdits>;
type AioManualEditsApi = ReturnType<typeof useAioManualEdits>;
type CleanerWandHealingApi = ReturnType<typeof useCleanerWandHealing>;
type AioWandHealingApi = ReturnType<typeof useAioWandHealing>;
type TypographerWorkspaceApi = ReturnType<typeof useTypographerWorkspace>;
type ImageCollectionApi = ReturnType<typeof useDashboardImageCollection>;
type RenderFontCatalogApi = ReturnType<typeof useRenderFontCatalog>;
type TranslatorTextActionsApi = ReturnType<typeof useTranslatorTextActions>;
type TranslatorImportsApi = ReturnType<typeof useTranslatorImports>;
type DownloadActionsApi = ReturnType<typeof useDashboardDownloadActions>;

/**
 * Stage-item render helpers that feed `React.memo(..., areEqual)` previews
 * (RenderTextPreview / TextDetectionPreview). Callback identity is
 * load-bearing: every dep arrives as a same-name prop so the original
 * `useCallback` dep values (and their re-creation cadence) are preserved.
 */
export interface DashboardStageSectionProps {
  /* ── Store-backed values (forwarded by DashboardMainLayout selectors) ── */
  images: ImageCollectionState['images'];
  setActiveId: ImageCollectionState['setActiveId'];
  mode: UiShellState['mode'];
  subMode: UiShellState['subMode'];
  viewMode: UiShellState['viewMode'];
  inlineEditorShortcutRequestKey: UiShellState['inlineEditorShortcutRequestKey'];

  /* ── Region editing / manual tools callbacks ── */
  selectAioRegionForImage: AioSnapshotSyncApi['selectAioRegionForImage'];
  updateAioRegionsForImage: AioSnapshotSyncApi['updateAioRegionsForImage'];
  selectCleanerRegionForImage: CleanerRegionEditingApi['selectCleanerRegionForImage'];
  updateCleanerRegionsForImage: CleanerRegionEditingApi['updateCleanerRegionsForImage'];
  selectTranslatorRegionForImage: TranslatorRegionEditingApi['selectTranslatorRegionForImage'];
  updateTranslatorRegionsForImage: TranslatorRegionEditingApi['updateTranslatorRegionsForImage'];
  getAioManualImageEditState: AioManualEditsApi['getAioManualImageEditState'];
  patchAioManualImageEditState: AioManualEditsApi['patchAioManualImageEditState'];
  getCleanerManualImageEditState: CleanerManualEditsApi['getCleanerManualImageEditState'];
  patchCleanerManualImageEditState: CleanerManualEditsApi['patchCleanerManualImageEditState'];
  runAioMagicWandForImage: AioWandHealingApi['runAioMagicWandForImage'];
  applyAioHealingMaskForImage: AioWandHealingApi['applyAioHealingMaskForImage'];
  runCleanerMagicWandForImage: CleanerWandHealingApi['runCleanerMagicWandForImage'];
  applyCleanerHealingMaskForImage: CleanerWandHealingApi['applyCleanerHealingMaskForImage'];
  refineActiveTypographerShape: TypographerControlsApi['refineActiveTypographerShape'];

  /* ── AIO pipeline history ── */
  rewindAioPipelineForImage: (imageId: string) => void;
  forwardAioPipelineForImage: (imageId: string) => void;
  getAioImageSnapshotMeta: (
    imageId: string,
  ) => {
    index: number;
    canRewind: boolean;
    canForward: boolean;
    label: string | null;
    key: AioPipelineSnapshotKey | null;
  };
  getAioFallbackStageKey: () => AioPipelineSnapshotKey;
  getAioDownloadItemForImage: (imageId: string) => DownloadItem | null;

  /* ── Region-editor / typographer derived values ── */
  resolvedActiveId: string | null;
  applyAutoDetectedShapeToActiveRegion: AioRegionEditingApi['applyAutoDetectedShapeToActiveRegion'];
  applyAutoDetectedShapeToRegionById: AioRegionEditingApi['applyAutoDetectedShapeToRegionById'];
  applyTypographyPresetToRegionById: AioRegionEditingApi['applyTypographyPresetToRegionById'];
  convertRegionShapeById: AioRegionEditingApi['convertRegionShapeById'];
  translationNotesEnabled: boolean;

  /* ── Shell / fonts ── */
  isCompactViewport: boolean;
  renderFontRefreshToken: RenderFontCatalogApi['renderFontRefreshToken'];
  availableRenderFonts: RenderFontCatalogApi['availableRenderFonts'];
  handleStageWheelZoom: (event: WheelEvent) => void;

  /* ── Stage branch consumers ── */
  specialModeStageProps: SpecialModeStageProps;
  onOpenSettings: (() => void) | undefined;
  translatorTextImportRef: React.RefObject<HTMLInputElement | null>;
  runTranslatorText: TranslatorTextActionsApi;
  handleDownload: DownloadActionsApi['handleDownload'];
  handleTranslatorTextImport: TranslatorImportsApi['handleTranslatorTextImport'];
  getPreviewSrc: ImageCollectionApi['getPreviewSrc'];
  typographerWorkspace: TypographerWorkspaceApi;
}
