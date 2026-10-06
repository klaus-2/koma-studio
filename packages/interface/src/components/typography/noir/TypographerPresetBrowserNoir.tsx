import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, ChevronRight, FolderOpen, Folder,
  Palette, Pencil, X, Check, Bold, Italic, Type,
} from "lucide-react";
import type {
  TypographyStylePreset, TypographyStyleFolder, TypographyShapeKind,
} from "../../../typography/types";
import type { RenderTextStyle } from "../../../typography/renderStyle";
import { btnGhost, btnPrimary, inputCls, selectCls } from "../../../pages/settings/noir/primitives";
import { EASE } from "../../system/v2/kit";

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

/* ── Tree helpers — V1 intactos ── */
function buildFolderTree(folders: TypographyStyleFolder[], presets: TypographyStylePreset[]) {
  const folderMap = new Map<string, FolderNode>();
  for (const folder of folders) folderMap.set(folder.id, { folder, children: [], presets: [] });
  const roots: FolderNode[] = [];
  for (const node of folderMap.values()) {
    if (node.folder.parentId && folderMap.has(node.folder.parentId)) {
      folderMap.get(node.folder.parentId)!.children.push(node);
    } else roots.push(node);
  }
  roots.sort((a, b) => a.folder.order - b.folder.order || a.folder.name.localeCompare(b.folder.name));
  for (const node of folderMap.values()) {
    node.children.sort((a, b) => a.folder.order - b.folder.order || a.folder.name.localeCompare(b.folder.name));
  }
  const rootPresets: TypographyStylePreset[] = [];
  for (const preset of presets) {
    if (preset.folderId && folderMap.has(preset.folderId)) folderMap.get(preset.folderId)!.presets.push(preset);
    else rootPresets.push(preset);
  }
  return { roots, rootPresets };
}
function countPresetsInNode(node: FolderNode): number {
  let count = node.presets.length;
  for (const child of node.children) count += countPresetsInNode(child);
  return count;
}

export const TypographerPresetBrowserNoir = ({
  presets, folders, selectedPresetId, availableFonts,
  onSelectPreset, onApplyToSelection, onApplyToImage, onUpdatePreset,
  hasActiveRegion, regionsCount,
}: TypographerPresetBrowserProps) => {
  const [search, setSearch] = useState("");
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
      if (folderFilter === "__none__") list = list.filter((p) => !p.folderId);
      else {
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
    () => buildFolderTree(folders, filteredPresets), [folders, filteredPresets]);
  const isSearching = search.trim().length > 0 || folderFilter !== null;

  useEffect(() => {
    if (!editingPresetId) return;
    const handler = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) setEditingPresetId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editingPresetId]);

  const editingPreset = editingPresetId ? presets.find((p) => p.id === editingPresetId) ?? null : null;

  const renderPresetItem = (preset: TypographyStylePreset) => {
    const isSelected = preset.id === selectedPresetId;
    const fillColor = preset.style.color || "#ffffff";
    return (
      <div key={preset.id}
        onClick={() => onSelectPreset(isSelected ? null : preset.id)}
        className={`panel-cut-sm group relative flex cursor-pointer items-center gap-2 border px-2 py-1.5 transition-all ${isSelected
            ? "border-crimson/50 bg-crimson/[0.06]"
            : "border-paper/8 bg-ink/50 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-paper/20 hover:[filter:drop-shadow(2px_2px_0_rgba(255,200,87,0.4))]"
          }`}>
        {isSelected && <span aria-hidden className="absolute left-0 top-0 h-full w-[2px] bg-crimson" />}
        <span aria-hidden className="h-3.5 w-3.5 shrink-0 border border-paper/20" style={{ background: fillColor }} />
        <span className="min-w-0 flex-1 truncate text-[11px] text-paper" title={preset.name}
          style={{
            fontFamily: preset.style.fontFamily || undefined,
            fontWeight: preset.style.bold ? 700 : 400,
            fontStyle: preset.style.italic ? "italic" : "normal",
          }}>
          {preset.name}
        </span>
        <span className="shrink-0 font-mono text-[8px] uppercase tracking-wider text-paper/30">
          {preset.style.fontFamily?.split(",")[0]?.trim() || "Default"} {preset.style.fontSize}px
        </span>
        {onUpdatePreset && (
          <button type="button" title="Quick edit"
            onClick={(e) => {
              e.stopPropagation();
              setEditingPresetId(preset.id === editingPresetId ? null : preset.id);
            }}
            className="shrink-0 p-1 text-paper/25 opacity-0 transition-opacity hover:text-gold group-hover:opacity-100">
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
      <div key={node.folder.id} style={{ paddingLeft: depth > 0 ? 10 : 0 }}>
        <button type="button" aria-expanded={isExpanded}
          onClick={() => toggleFolder(node.folder.id)}
          className="flex w-full items-center gap-1.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-paper/50 transition-colors hover:text-paper">
          <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15, ease: EASE }}>
            <ChevronRight size={10} />
          </motion.span>
          {isExpanded ? <FolderOpen size={10} className="text-gold" /> : <Folder size={10} />}
          <span className="min-w-0 flex-1 truncate text-left">{node.folder.name}</span>
          <span className="border border-paper/15 px-1 text-[8px] text-paper/35">{presetCount}</span>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}
              className="space-y-1 overflow-hidden border-l border-paper/8 pl-2">
              {node.presets.map(renderPresetItem)}
              {node.children.map((child) => renderFolderNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="relative space-y-2.5">
      {/* Search */}
      <div className="panel-cut-sm flex items-center gap-2 border border-paper/12 bg-ink px-2.5 py-1.5 focus-within:border-crimson/50">
        <Search size={11} className="shrink-0 text-paper/30" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search presets..."
          className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-paper placeholder:text-paper/25 focus:outline-none" />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            className="shrink-0 text-paper/30 hover:text-crimson">
            <X size={10} />
          </button>
        )}
      </div>

      {/* Folder filter chips */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setFolderFilter(null)}
            className={`panel-cut-sm border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] transition-colors ${folderFilter === null ? "border-crimson bg-crimson text-ink" : "border-paper/15 text-paper/40 hover:text-paper"
              }`}>All</button>
          {folders.filter((f) => !f.parentId).map((f) => (
            <button key={f.id} type="button"
              onClick={() => setFolderFilter(folderFilter === f.id ? null : f.id)}
              className={`panel-cut-sm border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] transition-colors ${folderFilter === f.id ? "border-crimson bg-crimson text-ink" : "border-paper/15 text-paper/40 hover:text-paper"
                }`}>{f.name}</button>
          ))}
          <button type="button"
            onClick={() => setFolderFilter(folderFilter === "__none__" ? null : "__none__")}
            className={`panel-cut-sm border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] transition-colors ${folderFilter === "__none__" ? "border-crimson bg-crimson text-ink" : "border-paper/15 text-paper/40 hover:text-paper"
              }`}>Uncategorized</button>
        </div>
      )}

      {/* Tree */}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {isSearching ? (
          filteredPresets.length === 0 ? (
            <p className="py-4 text-center font-mono text-[9px] uppercase tracking-wider text-paper/30">No presets found</p>
          ) : filteredPresets.map(renderPresetItem)
        ) : (
          <>
            {roots.map((node) => renderFolderNode(node))}
            {rootPresets.length > 0 && (
              <>
                {roots.length > 0 && <div aria-hidden className="my-1.5 h-px bg-gradient-to-r from-paper/10 to-transparent" />}
                {rootPresets.map(renderPresetItem)}
              </>
            )}
            {filteredPresets.length === 0 && (
              <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                <Palette size={16} className="text-paper/15" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-paper/30">No presets yet</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Apply */}
      <div className="grid grid-cols-2 gap-1.5 border-t border-paper/8 pt-2.5">
        <button type="button" className={btnGhost} onClick={onApplyToSelection}
          disabled={!hasActiveRegion || !selectedPresetId}>
          Apply to Selection
        </button>
        <button type="button" className={btnGhost} onClick={onApplyToImage}
          disabled={regionsCount === 0 || !selectedPresetId}>
          Apply to Image
        </button>
      </div>

      {/* Quick edit popout */}
      <AnimatePresence>
        {editingPreset && onUpdatePreset && (
          <PresetQuickEdit ref={popoutRef} preset={editingPreset}
            availableFonts={availableFonts}
            onUpdate={(patch) => onUpdatePreset(editingPreset.id, patch)}
            onClose={() => setEditingPresetId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

interface PresetQuickEditProps {
  preset: TypographyStylePreset;
  availableFonts: string[];
  onUpdate: (patch: Partial<TypographyStylePreset>) => void;
  onClose: () => void;
}

const PresetQuickEdit = React.forwardRef<HTMLDivElement, PresetQuickEditProps>(
  ({ preset, availableFonts, onUpdate, onClose }, ref) => {
    /* Estado local — V1 intacto */
    const [name, setName] = useState(preset.name);
    const [fontFamily, setFontFamily] = useState(preset.style.fontFamily || "");
    const [fontSize, setFontSize] = useState(preset.style.fontSize || 24);
    const [bold, setBold] = useState(preset.style.bold || false);
    const [italic, setItalic] = useState(preset.style.italic || false);
    const [fillColor, setFillColor] = useState(preset.style.color || "#ffffff");
    const [outlineColor, setOutlineColor] = useState(preset.style.outlineColor || "#000000");
    const [outlineWidth, setOutlineWidth] = useState(preset.style.outlineWidth || 0);
    const [lineSpacing, setLineSpacing] = useState(preset.style.lineSpacing || 1.2);
    const [padding, setPadding] = useState(preset.padding || 10);
    const [shapeKind, setShapeKind] = useState<TypographyShapeKind>(preset.defaultShapeKind);

    const handleSave = useCallback(() => {
      const stylePatch: Partial<RenderTextStyle> = {
        fontFamily, fontSize, bold, italic,
        color: fillColor, outlineColor, outlineWidth, lineSpacing,
      };
      onUpdate({
        name: name.trim() || preset.name,
        style: { ...preset.style, ...stylePatch } as RenderTextStyle,
        padding, defaultShapeKind: shapeKind,
      });
      onClose();
    }, [bold, fillColor, fontFamily, fontSize, italic, lineSpacing, name,
      onClose, onUpdate, outlineColor, outlineWidth, padding,
      preset.name, preset.style, shapeKind]);

    const fld = "flex flex-col gap-1";
    const lbl = "font-mono text-[8px] uppercase tracking-[0.2em] text-paper/40";

    return (
      <motion.div ref={ref}
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="glass panel-cut-sm absolute right-0 top-0 z-30 w-72 border border-crimson/25 p-3.5">
        <span aria-hidden className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-crimson to-transparent" />

        <div className="mb-3 flex items-center gap-2">
          <Type size={11} className="text-crimson" />
          <span className="kicker !text-[9px]">// QUICK EDIT</span>
          <button type="button" onClick={onClose}
            className="ml-auto p-0.5 text-paper/35 hover:text-crimson">
            <X size={11} />
          </button>
        </div>

        <div className="space-y-2.5">
          <label className={fld}>
            <span className={lbl}>Name</span>
            <input type="text" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className={fld}>
            <span className={lbl}>Font</span>
            <select className={selectCls} value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
              <option value="">Default</option>
              {availableFonts.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <label className={`${fld} flex-1`}>
              <span className={lbl}>Size</span>
              <input type="number" className={inputCls} value={fontSize} min={6} max={200}
                onChange={(e) => setFontSize(Number(e.target.value) || 24)} />
            </label>
            <div className="flex gap-0.5">
              <button type="button" title="Bold" aria-pressed={bold} onClick={() => setBold(!bold)}
                className={`panel-cut-sm flex h-8 w-8 items-center justify-center border transition-colors ${bold ? "border-crimson bg-crimson text-ink" : "border-paper/15 text-paper/40 hover:text-paper"
                  }`}><Bold size={12} /></button>
              <button type="button" title="Italic" aria-pressed={italic} onClick={() => setItalic(!italic)}
                className={`panel-cut-sm flex h-8 w-8 items-center justify-center border transition-colors ${italic ? "border-crimson bg-crimson text-ink" : "border-paper/15 text-paper/40 hover:text-paper"
                  }`}><Italic size={12} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([["Fill", fillColor, setFillColor], ["Outline", outlineColor, setOutlineColor]] as const).map(
              ([label, value, setter]) => (
                <label key={label} className={fld}>
                  <span className={lbl}>{label}</span>
                  <span className="panel-cut-sm flex items-center gap-1.5 border border-paper/12 bg-ink px-1.5 py-1">
                    <input type="color" value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
                    <span className="font-mono text-[9px] text-paper/60">{value}</span>
                  </span>
                </label>
              ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className={fld}>
              <span className={lbl}>Outline W.</span>
              <input type="number" className={inputCls} value={outlineWidth} min={0} max={20} step={0.5}
                onChange={(e) => setOutlineWidth(Number(e.target.value) || 0)} />
            </label>
            <label className={fld}>
              <span className={lbl}>Line Sp.</span>
              <input type="number" className={inputCls} value={lineSpacing} min={0.5} max={3} step={0.05}
                onChange={(e) => setLineSpacing(Number(e.target.value) || 1.2)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className={fld}>
              <span className={lbl}>Padding</span>
              <input type="number" className={inputCls} value={padding} min={0} max={100}
                onChange={(e) => setPadding(Number(e.target.value) || 0)} />
            </label>
            <label className={fld}>
              <span className={lbl}>Shape</span>
              <select className={selectCls} value={shapeKind}
                onChange={(e) => setShapeKind(e.target.value as TypographyShapeKind)}>
                <option value="square">Rectangular</option>
                <option value="rounded">Elliptic</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-1.5 border-t border-paper/8 pt-3">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={handleSave}>
            <Check size={10} /> Save
          </button>
        </div>
      </motion.div>
    );
  },
);
PresetQuickEdit.displayName = "PresetQuickEdit";
