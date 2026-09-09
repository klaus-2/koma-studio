import { Bookmark, ChevronRight, Type } from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { TypographyStyleFolder, TypographyStylePreset } from '../../../typography/types';
import { cn } from '../../../utils/dashboard.utils';

interface RenderTextPreviewPresetSubmenuProps {
  contextSubmenu: 'presets' | null;
  presetSearch: string;
  presetFolderFilter: string | null;
  availableTypographyPresets: TypographyStylePreset[];
  availableTypographyFolders: TypographyStyleFolder[];
  filteredTypographyPresets: TypographyStylePreset[];
  groupedTypographyPresets: Array<[string | null, TypographyStylePreset[]]>;
  typographyFolderNameById: Map<string, string>;
  editable: boolean;
  canApplyPreset: boolean;
  onContextSubmenuChange: (next: 'presets' | null) => void;
  onPresetSearchChange: (next: string) => void;
  onPresetFolderFilterChange: (next: string | null) => void;
  onApplyPresetById: (presetId: string) => void;
}

const RenderTextPreviewPresetSubmenu = ({
  contextSubmenu,
  presetSearch,
  presetFolderFilter,
  availableTypographyPresets,
  availableTypographyFolders,
  filteredTypographyPresets,
  groupedTypographyPresets,
  typographyFolderNameById,
  editable,
  canApplyPreset,
  onContextSubmenuChange,
  onPresetSearchChange,
  onPresetFolderFilterChange,
  onApplyPresetById,
}: RenderTextPreviewPresetSubmenuProps) => {
  const { t } = useI18n();
  const tLoose = t as (
    key: string,
    vars?: Record<string, string | number | null | undefined>,
  ) => string;

  if (!availableTypographyPresets.length) return null;

  return (
    <div
      className="koma-ctx__submenu-host"
      onMouseEnter={() => onContextSubmenuChange('presets')}
    >
      <button
        type="button"
        className={cn(
          'koma-ctx__item',
          contextSubmenu === 'presets' && 'koma-ctx__item--active',
        )}
        role="menuitem"
        disabled={!editable || !canApplyPreset}
        title={
          editable
            ? t('renderPreview.applyTypographyPreset')
            : t('renderPreview.manualModeRequired')
        }
        onFocus={() => onContextSubmenuChange('presets')}
        aria-haspopup="menu"
        aria-expanded={contextSubmenu === 'presets'}
      >
        <span className="koma-ctx__item-icon" aria-hidden="true">
          <Bookmark size={11} />
        </span>
        <span className="koma-ctx__item-label">{t('renderPreview.preset')}</span>
        <ChevronRight size={12} className="koma-ctx__item-chevron" />
      </button>

      {contextSubmenu === 'presets' && (
        <div
          className="koma-ctx__submenu koma-ctx__submenu--presets"
          onMouseLeave={() => onContextSubmenuChange(null)}
          role="menu"
          aria-label={t('renderPreview.typographyPresets')}
        >
          <div className="koma-ctx__submenu-title">
            {t('renderPreview.applyPreset')}
          </div>
          <div className="koma-ctx__submenu-search">
            <input
              type="text"
              className="koma-ctx__submenu-search-input"
              placeholder={tLoose('renderPreview.searchPresets')}
              value={presetSearch}
              onChange={(event) => onPresetSearchChange(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              autoFocus
            />
          </div>
          {availableTypographyFolders.length > 0 && (
            <div className="koma-ctx__submenu-filters">
              <button
                type="button"
                className={cn(
                  'koma-ctx__filter-chip',
                  presetFolderFilter === null &&
                    'koma-ctx__filter-chip--active',
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onPresetFolderFilterChange(null);
                }}
              >
                {tLoose('renderPreview.allFolders')}
              </button>
              {availableTypographyFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={cn(
                    'koma-ctx__filter-chip',
                    presetFolderFilter === folder.id &&
                      'koma-ctx__filter-chip--active',
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPresetFolderFilterChange(folder.id);
                  }}
                >
                  {folder.name}
                </button>
              ))}
              <button
                type="button"
                className={cn(
                  'koma-ctx__filter-chip',
                  presetFolderFilter === '__none' &&
                    'koma-ctx__filter-chip--active',
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onPresetFolderFilterChange('__none');
                }}
              >
                {tLoose('renderPreview.noFolder')}
              </button>
            </div>
          )}
          <div className="koma-ctx__submenu-list">
            {filteredTypographyPresets.length === 0 && (
              <p className="koma-ctx__submenu-empty">
                {tLoose('renderPreview.noPresetsFound')}
              </p>
            )}
            {groupedTypographyPresets.map(([folderId, presets]) => {
              const folderName =
                folderId === null ? null : typographyFolderNameById.get(folderId) ?? null;
              return (
                <div key={folderId ?? '__none'}>
                  {folderName && (
                    <div className="koma-ctx__submenu-group-label">
                      {folderName}
                    </div>
                  )}
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="koma-ctx__item"
                      role="menuitem"
                      onClick={() => onApplyPresetById(preset.id)}
                    >
                      <span className="koma-ctx__item-icon" aria-hidden="true">
                        <Type size={10} />
                      </span>
                      <span className="koma-ctx__item-label">{preset.name}</span>
                      {preset.description && (
                        <span className="koma-ctx__item-meta">
                          {preset.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RenderTextPreviewPresetSubmenu;
