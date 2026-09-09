import {
  Circle,
  ClipboardCopy,
  Languages,
  Pencil,
  Square,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type {
  TypographyShapeKind,
  TypographyStyleFolder,
  TypographyStylePreset,
} from '../../../typography/types';
import RenderTextPreviewPresetSubmenu from './RenderTextPreviewPresetSubmenu';

export interface RenderTextPreviewContextMenuState {
  regionId: string;
  x: number;
  y: number;
}

interface RenderTextPreviewContextMenuProps {
  contextMenu: RenderTextPreviewContextMenuState | null;
  targetRegion: AioTextRegion | null;
  editable: boolean;
  contextSubmenu: 'presets' | null;
  presetSearch: string;
  presetFolderFilter: string | null;
  availableTypographyPresets: TypographyStylePreset[];
  availableTypographyFolders: TypographyStyleFolder[];
  filteredTypographyPresets: TypographyStylePreset[];
  groupedTypographyPresets: Array<[string | null, TypographyStylePreset[]]>;
  typographyFolderNameById: Map<string, string>;
  canApplyPreset: boolean;
  canConvertShape: boolean;
  onContextSubmenuChange: (next: 'presets' | null) => void;
  onPresetSearchChange: (next: string) => void;
  onPresetFolderFilterChange: (next: string | null) => void;
  onCopyRecognized: () => void;
  onCopyTranslated: () => void;
  onEditRendered: () => void;
  onApplyPresetById: (presetId: string) => void;
  onConvertShape: (kind: 'auto' | TypographyShapeKind) => void;
  onRemoveRegion: () => void;
}

const RenderTextPreviewContextMenu = ({
  contextMenu,
  targetRegion,
  editable,
  contextSubmenu,
  presetSearch,
  presetFolderFilter,
  availableTypographyPresets,
  availableTypographyFolders,
  filteredTypographyPresets,
  groupedTypographyPresets,
  typographyFolderNameById,
  canApplyPreset,
  canConvertShape,
  onContextSubmenuChange,
  onPresetSearchChange,
  onPresetFolderFilterChange,
  onCopyRecognized,
  onCopyTranslated,
  onEditRendered,
  onApplyPresetById,
  onConvertShape,
  onRemoveRegion,
}: RenderTextPreviewContextMenuProps) => {
  const { t } = useI18n();
  const tLoose = t as (
    key: string,
    vars?: Record<string, string | number | null | undefined>,
  ) => string;

  if (!contextMenu || !targetRegion) return null;

  const hasOcr = (targetRegion.recognizedText ?? '').trim().length > 0;
  const hasTl = (targetRegion.translatedText ?? '').trim().length > 0;

  return (
    <div
      className="koma-ctx"
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
      aria-label={t('dashboard.renderText.regionActions.aria')}
    >
      <span className="koma-ctx__label">{tLoose('renderPreview.textLabel')}</span>

      <button
        type="button"
        className="koma-ctx__item"
        role="menuitem"
        onClick={onCopyRecognized}
        disabled={!hasOcr}
      >
        <span className="koma-ctx__item-icon" aria-hidden="true">
          <ClipboardCopy size={11} />
        </span>
        <span className="koma-ctx__item-label">
          {t('renderPreview.context.copyRecognized')}
        </span>
      </button>

      <button
        type="button"
        className="koma-ctx__item"
        role="menuitem"
        onClick={onCopyTranslated}
        disabled={!hasTl}
      >
        <span className="koma-ctx__item-icon" aria-hidden="true">
          <Languages size={11} />
        </span>
        <span className="koma-ctx__item-label">
          {t('renderPreview.context.copyTranslated')}
        </span>
      </button>

      <button
        type="button"
        className="koma-ctx__item"
        role="menuitem"
        onClick={onEditRendered}
        disabled={!editable}
        title={
          editable
            ? t('renderPreview.context.editRenderedHint')
            : t('renderPreview.context.manualModeHint')
        }
      >
        <span className="koma-ctx__item-icon" aria-hidden="true">
          <Pencil size={11} />
        </span>
        <span className="koma-ctx__item-label">
          {t('renderPreview.context.editRendered')}
        </span>
      </button>

      <div className="koma-ctx__sep" aria-hidden="true" />

      <span className="koma-ctx__label">{t('renderPreview.shape')}</span>

      <button
        type="button"
        className="koma-ctx__item"
        role="menuitem"
        onClick={() => onConvertShape('square')}
        disabled={!editable || !canConvertShape}
        title={
          editable
            ? t('renderPreview.convertRectangular')
            : t('renderPreview.manualModeRequired')
        }
      >
        <span className="koma-ctx__item-icon" aria-hidden="true">
          <Square size={11} />
        </span>
        <span className="koma-ctx__item-label">
          {t('renderPreview.rectangular')}
        </span>
      </button>

      <button
        type="button"
        className="koma-ctx__item"
        role="menuitem"
        onClick={() => onConvertShape('rounded')}
        disabled={!editable || !canConvertShape}
        title={
          editable
            ? t('renderPreview.convertElliptic')
            : t('renderPreview.manualModeRequired')
        }
      >
        <span className="koma-ctx__item-icon" aria-hidden="true">
          <Circle size={11} />
        </span>
        <span className="koma-ctx__item-label">
          {t('renderPreview.elliptic')}
        </span>
      </button>

      <div className="koma-ctx__sep" aria-hidden="true" />

      <RenderTextPreviewPresetSubmenu
        contextSubmenu={contextSubmenu}
        presetSearch={presetSearch}
        presetFolderFilter={presetFolderFilter}
        availableTypographyPresets={availableTypographyPresets}
        availableTypographyFolders={availableTypographyFolders}
        filteredTypographyPresets={filteredTypographyPresets}
        groupedTypographyPresets={groupedTypographyPresets}
        typographyFolderNameById={typographyFolderNameById}
        editable={editable}
        canApplyPreset={canApplyPreset}
        onContextSubmenuChange={onContextSubmenuChange}
        onPresetSearchChange={onPresetSearchChange}
        onPresetFolderFilterChange={onPresetFolderFilterChange}
        onApplyPresetById={onApplyPresetById}
      />

      <div className="koma-ctx__sep" aria-hidden="true" />

      <button
        type="button"
        className="koma-ctx__item koma-ctx__item--danger"
        role="menuitem"
        onClick={onRemoveRegion}
        disabled={!editable}
        title={
          editable
            ? t('renderPreview.removeRegion')
            : t('renderPreview.manualModeRequired')
        }
      >
        <span className="koma-ctx__item-icon" aria-hidden="true">
          <Trash2 size={11} />
        </span>
        <span className="koma-ctx__item-label">
          {t('renderPreview.removeRegion')}
        </span>
      </button>
    </div>
  );
};

export default RenderTextPreviewContextMenu;
