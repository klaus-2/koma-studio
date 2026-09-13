import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Palette,
  Pencil,
  X,
  Check,
  Bold,
  Italic,
  Type,
} from 'lucide-react';

import type {
  TypographyStylePreset,
  TypographyStyleFolder,
  TypographyShapeKind,
} from '../../typography/types';
import type { RenderTextStyle } from '../../typography/renderStyle';
import './TypographerPresetBrowser.css';

interface TypographerPresetBrowserProps {
  presets: TypographyStylePreset[];
  folders: TypographyStyleFolder[];
  selectedPresetId: string | null;
  availableFonts: string[];
  onSelectPreset: (presetId: string | null) => void;
  onApplyToSelection: () => void;
  onApplyToImage: () => void;
  onUpdatePreset?: (presetId: string, patch: Partial<TypographyStylePreset>) => void;
  hasActiveRegion: boolean;
  regionsCount: number;
}

interface FolderNode {
  folder: TypographyStyleFolder;
  children: FolderNode[];
  presets: TypographyStylePreset[];
}

function buildFolderTree(
  folders: TypographyStyleFolder[],
  presets: TypographyStylePreset[],
): { roots: FolderNode[]; rootPresets: TypographyStylePreset[] } {
  const folderMap = new Map<string, FolderNode>();
  for (const folder of folders) {
    folderMap.set(folder.id, { folder, children: [], presets: [] });
  }
  const roots: FolderNode[] = [];
  for (const node of folderMap.values()) {
    if (node.folder.parentId && folderMap.has(node.folder.parentId)) {
      folderMap.get(node.folder.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  roots.sort((a, b) => a.folder.order - b.folder.order || a.folder.name.localeCompare(b.folder.name));
  for (const node of folderMap.values()) {
    node.children.sort((a, b) => a.folder.order - b.folder.order || a.folder.name.localeCompare(b.folder.name));
  }
  const rootPresets: TypographyStylePreset[] = [];
  for (const preset of presets) {
    if (preset.folderId && folderMap.has(preset.folderId)) {
      folderMap.get(preset.folderId)!.presets.push(preset);
    } else {
      rootPresets.push(preset);
    }
  }
  return { roots, rootPresets };
}

function countPresetsInNode(node: FolderNode): number {
  let count = node.presets.length;
  for (const child of node.children) count += countPresetsInNode(child);
  return count;
}

export const TypographerPresetBrowser = ({
  presets,
  folders,
  selectedPresetId,
  availableFonts,
  onSelectPreset,
  onApplyToSelection,
  onApplyToImage,
  onUpdatePreset,
  hasActiveRegion,
  regionsCount,
}: TypographerPresetBrowserProps) => {
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const popoutRef = useRef<HTMLDivElement | null>(null);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const filteredPresets = useMemo(() => {
    let list = presets;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (folderFilter !== null) {
      if (folderFilter === '__none__') {
        list = list.filter((p) => !p.folderId);
      } else {
        const descendants = new Set<string>([folderFilter]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const f of folders) {
            if (f.parentId && descendants.has(f.parentId) && !descendants.has(f.id)) {
              descendants.add(f.id);
              changed = true;
            }
          }
        }
        list = list.filter((p) => p.folderId && descendants.has(p.folderId));
      }
    }
    return list;
  }, [presets, search, folderFilter, folders]);

  const { roots, rootPresets } = useMemo(
    () => buildFolderTree(folders, filteredPresets),
    [folders, filteredPresets],
  );

  const isSearching = search.trim().length > 0 || folderFilter !== null;

  useEffect(() => {
    if (!editingPresetId) return;
    const handler = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        setEditingPresetId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingPresetId]);

  const editingPreset = editingPresetId
    ? presets.find((p) => p.id === editingPresetId) ?? null
    : null;

  const renderPresetItem = (preset: TypographyStylePreset) => {
    const isSelected = preset.id === selectedPresetId;
    const fillColor = preset.style.color || '#ffffff';
    return (
      <div
        key={preset.id}
        className={`koma-preset-item${isSelected ? ' koma-preset-item--active' : ''}`}
        onClick={() => onSelectPreset(isSelected ? null : preset.id)}
      >
        <span
          className="koma-preset-item__swatch"
          style={{ background: fillColor }}
        />
        <span className="koma-preset-item__name" title={preset.name}>
          {preset.name}
        </span>
        <span className="koma-preset-item__meta">
          {preset.style.fontFamily?.split(',')[0]?.trim() || 'Default'}{' '}
          {preset.style.fontSize}px
        </span>
        {onUpdatePreset && (
          <button
            type="button"
            className="koma-preset-item__edit"
            onClick={(e) => {
              e.stopPropagation();
              setEditingPresetId(preset.id === editingPresetId ? null : preset.id);
            }}
            title="Quick edit"
          >
            <Pencil size={10} />
          </button>
        )}
      </div>
    );
  };

  const renderFolderNode = (node: FolderNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.folder.id);
    const presetCount = countPresetsInNode(node);
    if (presetCount === 0 && isSearching) return null;
    return (
      <div key={node.folder.id} className="koma-preset-folder" style={{ paddingLeft: depth > 0 ? 8 : 0 }}>
        <button
          type="button"
          className="koma-preset-folder__header"
          onClick={() => toggleFolder(node.folder.id)}
        >
          {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {isExpanded ? <FolderOpen size={11} /> : <Folder size={11} />}
          <span className="koma-preset-folder__name">{node.folder.name}</span>
          <span className="koma-preset-folder__count">{presetCount}</span>
        </button>
        {isExpanded && (
          <div className="koma-preset-folder__content">
            {node.presets.map(renderPresetItem)}
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="koma-preset-browser">
      {/* Search */}
      <div className="koma-preset-browser__search">
        <Search size={11} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search presets..."
          className="koma-preset-browser__search-input"
        />
        {search && (
          <button
            type="button"
            className="koma-preset-browser__search-clear"
            onClick={() => setSearch('')}
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Folder filter chips */}
      {folders.length > 0 && (
        <div className="koma-preset-browser__filters">
          <button
            type="button"
            className={`koma-preset-chip${folderFilter === null ? ' koma-preset-chip--active' : ''}`}
            onClick={() => setFolderFilter(null)}
          >
            All
          </button>
          {/* ponytail: kept separate for clarity — idiomatic JSX filter/map; one pass would need an IIFE */}
          {folders
            .filter((f) => !f.parentId)
            .map((f) => (
              <button
                key={f.id}
                type="button"
                className={`koma-preset-chip${folderFilter === f.id ? ' koma-preset-chip--active' : ''}`}
                onClick={() => setFolderFilter(folderFilter === f.id ? null : f.id)}
              >
                {f.name}
              </button>
            ))}
          <button
            type="button"
            className={`koma-preset-chip${folderFilter === '__none__' ? ' koma-preset-chip--active' : ''}`}
            onClick={() => setFolderFilter(folderFilter === '__none__' ? null : '__none__')}
          >
            Uncategorized
          </button>
        </div>
      )}

      {/* Preset tree */}
      <div className="koma-preset-browser__list">
        {isSearching ? (
          filteredPresets.length === 0 ? (
            <div className="koma-preset-browser__empty">No presets found</div>
          ) : (
            filteredPresets.map(renderPresetItem)
          )
        ) : (
          <>
            {roots.map((node) => renderFolderNode(node))}
            {rootPresets.length > 0 && (
              <>
                {roots.length > 0 && rootPresets.length > 0 && (
                  <div className="koma-preset-browser__divider" />
                )}
                {rootPresets.map(renderPresetItem)}
              </>
            )}
            {filteredPresets.length === 0 && (
              <div className="koma-preset-browser__empty">
                <Palette size={16} />
                <span>No presets yet</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Apply buttons */}
      <div className="koma-preset-browser__actions">
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={onApplyToSelection}
          disabled={!hasActiveRegion || !selectedPresetId}
        >
          Apply to Selection
        </button>
        <button
          type="button"
          className="koma-btn koma-btn--ghost"
          onClick={onApplyToImage}
          disabled={regionsCount === 0 || !selectedPresetId}
        >
          Apply to Image
        </button>
      </div>

      {/* Quick edit popout */}
      {editingPreset && onUpdatePreset && (
        <PresetQuickEdit
          ref={popoutRef}
          preset={editingPreset}
          availableFonts={availableFonts}
          onUpdate={(patch) => {
            onUpdatePreset(editingPreset.id, patch);
          }}
          onClose={() => setEditingPresetId(null)}
        />
      )}
    </div>
  );
};

/* ─── Quick Edit Popout ──────────────────────────────── */

import React from 'react';

interface PresetQuickEditProps {
  preset: TypographyStylePreset;
  availableFonts: string[];
  onUpdate: (patch: Partial<TypographyStylePreset>) => void;
  onClose: () => void;
}

const PresetQuickEdit = React.forwardRef<HTMLDivElement, PresetQuickEditProps>(
  ({ preset, availableFonts, onUpdate, onClose }, ref) => {
    const [name, setName] = useState(preset.name);
    const [fontFamily, setFontFamily] = useState(preset.style.fontFamily || '');
    const [fontSize, setFontSize] = useState(preset.style.fontSize || 24);
    const [bold, setBold] = useState(preset.style.bold || false);
    const [italic, setItalic] = useState(preset.style.italic || false);
    const [fillColor, setFillColor] = useState(preset.style.color || '#ffffff');
    const [outlineColor, setOutlineColor] = useState(preset.style.outlineColor || '#000000');
    const [outlineWidth, setOutlineWidth] = useState(preset.style.outlineWidth || 0);
    const [lineSpacing, setLineSpacing] = useState(preset.style.lineSpacing || 1.2);
    const [padding, setPadding] = useState(preset.padding || 10);
    const [shapeKind, setShapeKind] = useState<TypographyShapeKind>(preset.defaultShapeKind);

    const handleSave = useCallback(() => {
      const stylePatch: Partial<RenderTextStyle> = {
        fontFamily,
        fontSize,
        bold,
        italic,
        color: fillColor,
        outlineColor,
        outlineWidth,
        lineSpacing,
      };
      onUpdate({
        name: name.trim() || preset.name,
        style: { ...preset.style, ...stylePatch } as RenderTextStyle,
        padding,
        defaultShapeKind: shapeKind,
      });
      onClose();
    }, [
      bold,
      fillColor,
      fontFamily,
      fontSize,
      italic,
      lineSpacing,
      name,
      onClose,
      onUpdate,
      outlineColor,
      outlineWidth,
      padding,
      preset.name,
      preset.style,
      shapeKind,
    ]);

    return (
      <div ref={ref} className="koma-preset-quickedit">
        <div className="koma-preset-quickedit__header">
          <Type size={12} />
          <span>Quick Edit</span>
          <button type="button" className="koma-preset-quickedit__close" onClick={onClose}>
            <X size={12} />
          </button>
        </div>

        <div className="koma-preset-quickedit__body">
          {/* Name */}
          <label className="koma-preset-quickedit__field">
            <span>Name</span>
            <input
              type="text"
              className="koma-input koma-input--sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {/* Font */}
          <label className="koma-preset-quickedit__field">
            <span>Font</span>
            <select
              className="koma-select koma-select--sm"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
            >
              <option value="">Default</option>
              {availableFonts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          {/* Size + Style toggles */}
          <div className="koma-preset-quickedit__row">
            <label className="koma-preset-quickedit__field koma-preset-quickedit__field--half">
              <span>Size</span>
              <input
                type="number"
                className="koma-input koma-input--sm"
                value={fontSize}
                min={6}
                max={200}
                onChange={(e) => setFontSize(Number(e.target.value) || 24)}
              />
            </label>
            <div className="koma-preset-quickedit__toggles">
              <button
                type="button"
                className={`koma-preset-quickedit__toggle${bold ? ' koma-preset-quickedit__toggle--on' : ''}`}
                onClick={() => setBold(!bold)}
                title="Bold"
              >
                <Bold size={12} />
              </button>
              <button
                type="button"
                className={`koma-preset-quickedit__toggle${italic ? ' koma-preset-quickedit__toggle--on' : ''}`}
                onClick={() => setItalic(!italic)}
                title="Italic"
              >
                <Italic size={12} />
              </button>
            </div>
          </div>

          {/* Colors */}
          <div className="koma-preset-quickedit__row">
            <label className="koma-preset-quickedit__field koma-preset-quickedit__field--half">
              <span>Fill</span>
              <div className="koma-preset-quickedit__color-wrap">
                <input
                  type="color"
                  className="koma-preset-quickedit__color"
                  value={fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                />
                <span className="koma-preset-quickedit__color-label">{fillColor}</span>
              </div>
            </label>
            <label className="koma-preset-quickedit__field koma-preset-quickedit__field--half">
              <span>Outline</span>
              <div className="koma-preset-quickedit__color-wrap">
                <input
                  type="color"
                  className="koma-preset-quickedit__color"
                  value={outlineColor}
                  onChange={(e) => setOutlineColor(e.target.value)}
                />
                <span className="koma-preset-quickedit__color-label">{outlineColor}</span>
              </div>
            </label>
          </div>

          {/* Outline width + Line spacing */}
          <div className="koma-preset-quickedit__row">
            <label className="koma-preset-quickedit__field koma-preset-quickedit__field--half">
              <span>Outline W.</span>
              <input
                type="number"
                className="koma-input koma-input--sm"
                value={outlineWidth}
                min={0}
                max={20}
                step={0.5}
                onChange={(e) => setOutlineWidth(Number(e.target.value) || 0)}
              />
            </label>
            <label className="koma-preset-quickedit__field koma-preset-quickedit__field--half">
              <span>Line Sp.</span>
              <input
                type="number"
                className="koma-input koma-input--sm"
                value={lineSpacing}
                min={0.5}
                max={3}
                step={0.05}
                onChange={(e) => setLineSpacing(Number(e.target.value) || 1.2)}
              />
            </label>
          </div>

          {/* Padding + Shape */}
          <div className="koma-preset-quickedit__row">
            <label className="koma-preset-quickedit__field koma-preset-quickedit__field--half">
              <span>Padding</span>
              <input
                type="number"
                className="koma-input koma-input--sm"
                value={padding}
                min={0}
                max={100}
                onChange={(e) => setPadding(Number(e.target.value) || 0)}
              />
            </label>
            <label className="koma-preset-quickedit__field koma-preset-quickedit__field--half">
              <span>Shape</span>
              <select
                className="koma-select koma-select--sm"
                value={shapeKind}
                onChange={(e) => setShapeKind(e.target.value as TypographyShapeKind)}
              >
                <option value="square">Rectangular</option>
                <option value="rounded">Elliptic</option>
              </select>
            </label>
          </div>
        </div>

        <div className="koma-preset-quickedit__footer">
          <button
            type="button"
            className="koma-btn koma-btn--ghost koma-btn--sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--primary koma-btn--sm"
            onClick={handleSave}
          >
            <Check size={10} /> Save
          </button>
        </div>
      </div>
    );
  },
);
