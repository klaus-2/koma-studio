import type { LucideIcon } from 'lucide-react';
import {
  Bookmark,
  ChevronRight,
  Circle,
  ClipboardCopy,
  Languages,
  Pencil,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../../i18n';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type {
  TypographyShapeKind,
  TypographyStyleFolder,
  TypographyStylePreset,
} from '../../../typography/types';
import { cn } from '../../../utils/dashboard.utils';
import type { RenderTextPreviewContextMenuState } from '../render-text-preview/RenderTextPreviewContextMenu';

interface RenderTextPreviewContextMenuNoirProps {
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

function CtxItem({ icon: Icon, label, onClick, disabled, danger, title }: {
  icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; title?: string;
}) {
  return (
    <button
      type="button" role="menuitem" onClick={disabled ? undefined : onClick} disabled={disabled} title={title}
      className={cn(
        'panel-cut-sm relative flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors',
        disabled ? 'cursor-not-allowed opacity-30'
          : danger ? 'text-crimson hover:bg-crimson hover:text-ink'
            : 'text-paper hover:bg-crimson hover:text-ink',
      )}
    >
      <Icon size={11} className="shrink-0" />
      <span className="flex-1 font-mono text-[11px]">{label}</span>
    </button>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: (e: React.MouseEvent) => void; label: string }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        'panel-cut-sm px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors',
        active ? 'bg-crimson text-ink' : 'bg-ink-3 text-paper-dim hover:text-paper',
      )}
    >
      {label}
    </button>
  );
}

const RenderTextPreviewContextMenuNoir = ({
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
}: RenderTextPreviewContextMenuNoirProps) => {
  const { t } = useI18n();
  const tLoose = t as (
    key: string,
    vars?: Record<string, string | number | null | undefined>,
  ) => string;

  // The menu root is clipped by its panel-cut shape, so the preset submenu is
  // portaled to <body> and anchored to the row it hangs off.
  const presetRowRef = useRef<HTMLDivElement | null>(null);
  const [presetPanelPos, setPresetPanelPos] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const openPresetSubmenu = useCallback(() => {
    const rect = presetRowRef.current?.getBoundingClientRect();
    if (rect) {
      const panelWidth = 240;
      const panelHeight = 360;
      const margin = 8;
      setPresetPanelPos({
        left: Math.max(
          margin,
          Math.min(rect.right + 4, window.innerWidth - panelWidth - margin),
        ),
        top: Math.max(
          margin,
          Math.min(rect.top, window.innerHeight - panelHeight - margin),
        ),
      });
    }
    onContextSubmenuChange('presets');
  }, [onContextSubmenuChange]);

  const closePresetSubmenu = useCallback(() => {
    setPresetPanelPos(null);
    onContextSubmenuChange(null);
  }, [onContextSubmenuChange]);

  if (!contextMenu || !targetRegion) return null;

  const hasOcr = (targetRegion.recognizedText ?? '').trim().length > 0;
  const hasTl = (targetRegion.translatedText ?? '').trim().length > 0;

  return (
    <div
      className="glass panel-cut absolute z-50 w-56 border-crimson/30 p-1.5 shadow-hard-crimson"
      style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
      aria-label={t('dashboard.renderText.regionActions.aria')}
    >
      <div className="halftone-red pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
      <span className="kicker relative mb-1 block px-1.5 !text-[9px]">// {tLoose('renderPreview.textLabel')}</span>

      <CtxItem icon={ClipboardCopy} label={t('renderPreview.context.copyRecognized')} onClick={onCopyRecognized} disabled={!hasOcr} />
      <CtxItem icon={Languages} label={t('renderPreview.context.copyTranslated')} onClick={onCopyTranslated} disabled={!hasTl} />
      <CtxItem icon={Pencil} label={t('renderPreview.context.editRendered')} onClick={onEditRendered} disabled={!editable}
        title={editable ? t('renderPreview.context.editRenderedHint') : t('renderPreview.context.manualModeHint')} />

      <div className="relative my-1 border-t border-paper/10" aria-hidden="true" />
      <span className="kicker relative mb-1 block px-1.5 !text-[9px] !text-gold">// {t('renderPreview.shape')}</span>

      <CtxItem icon={Square} label={t('renderPreview.rectangular')} onClick={() => onConvertShape('square')}
        disabled={!editable || !canConvertShape} title={editable ? t('renderPreview.convertRectangular') : t('renderPreview.manualModeRequired')} />
      <CtxItem icon={Circle} label={t('renderPreview.elliptic')} onClick={() => onConvertShape('rounded')}
        disabled={!editable || !canConvertShape} title={editable ? t('renderPreview.convertElliptic') : t('renderPreview.manualModeRequired')} />

      {availableTypographyPresets.length > 0 && (
        <>
          <div className="relative my-1 border-t border-paper/10" aria-hidden="true" />
          <div className="relative" ref={presetRowRef} onMouseEnter={openPresetSubmenu}>
            <button
              type="button"
              className={cn(
                'panel-cut-sm flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors',
                contextSubmenu === 'presets' ? 'bg-crimson text-ink' : 'text-paper hover:bg-ink-3',
                (!editable || !canApplyPreset) && 'cursor-not-allowed opacity-40',
              )}
              role="menuitem" disabled={!editable || !canApplyPreset}
              title={editable ? t('renderPreview.applyTypographyPreset') : t('renderPreview.manualModeRequired')}
              onClick={openPresetSubmenu}
              onFocus={openPresetSubmenu}
              aria-haspopup="menu" aria-expanded={contextSubmenu === 'presets'}
            >
              <Bookmark size={11} className="shrink-0" />
              <span className="flex-1 font-mono text-[11px]">{t('renderPreview.preset')}</span>
              <ChevronRight size={12} />
            </button>

            {contextSubmenu === 'presets' && presetPanelPos && createPortal(
              <div
                className="glass panel-cut fixed z-[150] w-60 border-crimson/30 p-1.5 shadow-hard-crimson"
                style={{ left: presetPanelPos.left, top: presetPanelPos.top }}
                onMouseLeave={closePresetSubmenu}
                role="menu" aria-label={t('renderPreview.typographyPresets')}
              >
                <div className="kicker mb-1.5 px-1 !text-[9px]">{t('renderPreview.applyPreset')}</div>
                <input
                  type="text"
                  className="panel-cut-sm mb-1.5 w-full border border-paper/10 bg-ink-3 px-2 py-1 font-mono text-[11px] text-paper outline-none focus:border-crimson"
                  placeholder={tLoose('renderPreview.searchPresets')}
                  value={presetSearch}
                  onChange={(e) => onPresetSearchChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
                {availableTypographyFolders.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    <FilterChip active={presetFolderFilter === null} onClick={(e) => { e.stopPropagation(); onPresetFolderFilterChange(null); }} label={tLoose('renderPreview.allFolders')} />
                    {availableTypographyFolders.map((folder) => (
                      <FilterChip key={folder.id} active={presetFolderFilter === folder.id} onClick={(e) => { e.stopPropagation(); onPresetFolderFilterChange(folder.id); }} label={folder.name} />
                    ))}
                    <FilterChip active={presetFolderFilter === '__none'} onClick={(e) => { e.stopPropagation(); onPresetFolderFilterChange('__none'); }} label={tLoose('renderPreview.noFolder')} />
                  </div>
                )}
                <div className="custom-scrollbar max-h-56 overflow-y-auto">
                  {filteredTypographyPresets.length === 0 && (
                    <p className="px-2 py-3 text-center font-mono text-[10px] text-paper-dim">{tLoose('renderPreview.noPresetsFound')}</p>
                  )}
                  {filteredTypographyPresets.length > 0 && groupedTypographyPresets.map(([folderId, presets]) => {
                    const folderName = folderId === null ? null : typographyFolderNameById.get(folderId) ?? null;
                    return (
                      <div key={folderId ?? '__none'}>
                        {folderName && <div className="px-1.5 pt-1.5 pb-0.5 font-mono text-[8px] uppercase tracking-widest text-gold">{folderName}</div>}
                        {presets.map((preset) => (
                          <button
                            key={preset.id} type="button" role="menuitem"
                            className="panel-cut-sm flex w-full items-center gap-2 px-2 py-1.5 text-left text-paper transition-colors hover:bg-crimson hover:text-ink"
                            onClick={() => onApplyPresetById(preset.id)}
                          >
                            <Type size={10} className="shrink-0" />
                            <span className="flex-1 truncate font-mono text-[11px]">{preset.name}</span>
                            {preset.description && <span className="truncate font-mono text-[8px] text-paper-dim">{preset.description}</span>}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>,
              document.body,
            )}
          </div>
        </>
      )}

      <div className="relative my-1 border-t border-paper/10" aria-hidden="true" />
      <CtxItem icon={Trash2} label={t('renderPreview.removeRegion')} onClick={onRemoveRegion} disabled={!editable} danger
        title={editable ? t('renderPreview.removeRegion') : t('renderPreview.manualModeRequired')} />
    </div>
  );
};

export default RenderTextPreviewContextMenuNoir;
