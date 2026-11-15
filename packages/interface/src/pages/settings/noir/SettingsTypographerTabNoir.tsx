import { m } from "framer-motion";
import {
  BookOpen, Check, ChevronDown, Copy, FolderPlus, Pencil, Plus, Star, Trash2, X,
} from "lucide-react";
import { FillStylePopover } from "../../../components/color/FillStylePopover";
import { HexColorPopover } from "../../../components/color/HexColorPopover";
import { FontFamilySelect } from "../../../components/fonts/FontFamilySelect";
import type React from "react";
import type { useI18n } from "../../../i18n";
import { RENDER_MODE_PRESET_OPTIONS } from "../settings.constants";
import type { TypographyPresetFormData } from "../settings.types";
import type { RenderTextStyle } from "../../../utils/renderText";
import {
  buildFillPickerValue, listTextFillSwatches,
  parseFillPickerValue, type TextFillSwatchStateV1,
} from "../../../utils/textFillPicker";
import type {
  TypographyPresetStateV1, TypographyShapeKind, TypographyStyleFolder, TypographyStylePreset,
} from "../../../typography/types";
import {
  Sec, Field, Alert, RangeField, EASE,
  inputCls, selectCls, btnPrimary, btnGhost, iconBtn, iconBtnDanger, chip,
} from "./primitives";
import { cn } from "../../../lib/utils";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface SettingsTypographerTabArgs {
  t: TranslationFn;
  textFill: {
    textFillFeedback: string | null;
    textFillError: string | null;
    textFillDraftValue: string;
    setTextFillDraftValue: (value: string) => void;
    setTextFillError: (value: string | null) => void;
    setTextFillFeedback: (value: string | null) => void;
    textFillSwatches: TextFillSwatchStateV1;
    handleAddTextFillSwatch: () => void;
    handleRemoveTextFillSwatch: (value: string) => void;
    handleResetTextFillSwatches: () => void;
  };
  typography: {
    typographyPresetState: TypographyPresetStateV1;
    typographyPresetForm: TypographyPresetFormData | null;
    setTypographyPresetForm: (value: TypographyPresetFormData | null | ((prev: TypographyPresetFormData | null) => TypographyPresetFormData | null)) => void;
    typographyPresetFeedback: string | null;
    typographyPresetError: string | null;
    typographyNewFolderName: string;
    setTypographyNewFolderName: (value: string) => void;
    typographyNewFolderParentId: string | null;
    setTypographyNewFolderParentId: (value: string | null) => void;
    collapsedFolderIds: Set<string>;
    folderRenameId: string | null;
    setFolderRenameId: (value: string | null) => void;
    folderRenameName: string;
    setFolderRenameName: (value: string) => void;
    typographyPresetFontOptions: string[];
    typographyPresetsByFolder: Map<string | null, TypographyStylePreset[]>;
    openCreateTypographyPresetForm: () => void;
    openEditTypographyPresetForm: (preset: TypographyStylePreset) => void;
    handleTypographyPresetFieldChange: <K extends keyof TypographyPresetFormData>(key: K, value: TypographyPresetFormData[K]) => void;
    handleTypographyPresetStyleChange: <K extends keyof RenderTextStyle>(key: K, value: RenderTextStyle[K]) => void;
    handleSaveTypographyPreset: () => void;
    handleCreateTypographyFolder: () => void;
    handleDeleteTypographyFolder: (folder: TypographyStyleFolder) => void;
    handleStartFolderRename: (folder: TypographyStyleFolder) => void;
    handleCommitFolderRename: (folderId: string) => void;
    handleToggleFolderCollapse: (folderId: string) => void;
    handleDuplicateTypographyPreset: (preset: TypographyStylePreset) => void;
    handleDeleteTypographyPreset: (preset: TypographyStylePreset) => void;
    handleBindTypographyPreset: (modeKey: string, presetId: string | null) => void;
    handleSetDefaultTypographyPreset: (presetId: string | null) => void;
  };
}

const StyleToggles = ({ t, bold, italic, uppercase, onToggle }: {
  t: TranslationFn; bold: boolean; italic: boolean; uppercase: boolean;
  onToggle: (k: "bold" | "italic" | "uppercase", v: boolean) => void;
}) => (
  <div role="group" aria-label={t("renderPreview.typographyStyle")}
    className="panel-cut-sm inline-flex gap-0.5 border border-paper/12 bg-ink p-1">
    {([
      ["bold", bold, t("renderPreview.bold"), t("settings.typography.iconBold"), "font-black"],
      ["italic", italic, t("renderPreview.italic"), t("settings.typography.iconItalic"), "italic"],
      ["uppercase", uppercase, t("renderPreview.uppercase"), t("settings.typography.iconUppercase"), "uppercase"],
    ] as const).map(([key, active, aria, glyph, cls]) => (
      <button key={key} type="button" aria-label={aria} aria-pressed={active}
        onClick={() => onToggle(key, !active)}
        className={`panel-cut-sm px-2.5 py-1 font-display text-[11px] transition-colors ${cls} ${active ? "bg-crimson text-ink" : "text-paper/40 hover:text-paper"
          }`}>
        {glyph}
      </button>
    ))}
  </div>
);

export const renderSettingsTypographerTabNoir = ({ t, textFill, typography }: SettingsTypographerTabArgs): React.ReactElement => {
  const tf = typography.typographyPresetForm;
  const swatchList = listTextFillSwatches(textFill.textFillSwatches);

  return (
    <div className="space-y-5" key="typographer">

      {/* ═══════════ 04 · TYPOGRAPHER LIBRARY ═══════════ */}
      <Sec icon={<BookOpen size={14} />} title={t("settings.typographerLibrary.title")}
        desc={t("settings.typographerLibrary.description")}
        actions={
          <button type="button" className={btnPrimary} onClick={typography.openCreateTypographyPresetForm}>
            <Plus size={11} /> {t("dashboard.aio.presets.new")}
          </button>
        }>
        <span aria-hidden className="v-text pointer-events-none absolute right-2 top-4 select-none font-display text-sm font-black text-paper/[0.05]">文字職人</span>

        <div className="space-y-2">
          {typography.typographyPresetFeedback && <Alert tone="success">{typography.typographyPresetFeedback}</Alert>}
          {typography.typographyPresetError && <Alert tone="error">{typography.typographyPresetError}</Alert>}
        </div>

        {/* Folder create + default preset */}
        <div className="mt-3 panel-cut-sm border border-paper/8 bg-ink/40 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("settings.typographerLibrary.newFolder")} className="min-w-[180px] flex-1">
              <input type="text" className={inputCls} value={typography.typographyNewFolderName}
                onChange={(e) => typography.setTypographyNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") typography.handleCreateTypographyFolder(); }} />
            </Field>
            {typography.typographyPresetState.folders.length > 0 && (
              <Field label={t("settings.typographerLibrary.parentFolder")} className="min-w-[150px]">
                <select className={selectCls} value={typography.typographyNewFolderParentId ?? ""}
                  onChange={(e) => typography.setTypographyNewFolderParentId(e.target.value || null)}>
                  <option value="">{t("settings.typographerLibrary.noParent")}</option>
                  {typography.typographyPresetState.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </Field>
            )}
            <button type="button" className={btnGhost} onClick={typography.handleCreateTypographyFolder}>
              <FolderPlus size={11} /> {t("dashboard.aio.presets.create")}
            </button>
          </div>
          <div className="mt-4">
            <Field label={t("settings.typographerLibrary.defaultPreset")}>
              <select className={selectCls} value={typography.typographyPresetState.defaultPresetId ?? ""}
                onChange={(e) => typography.handleSetDefaultTypographyPreset(e.target.value || null)}>
                <option value="">{t("settings.typographerLibrary.none")}</option>
                {typography.typographyPresetState.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div
          className={cn(
            'mt-3 grid transition-[grid-template-rows,opacity] duration-300',
            '[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
            tf
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0 pointer-events-none',
          )}
          aria-hidden={!tf}
        >
          <div className="min-h-0 overflow-hidden">
            {tf && (
              <div className="panel-cut-sm border border-crimson/25 bg-crimson/[0.03] p-4">
                <p className="kicker mb-3">
                  // {tf.presetId ? t("settings.typographerLibrary.edit") : t("settings.typographerLibrary.new")}{" "}
                  {t("settings.typographerLibrary.presetTypographer")}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("dashboard.aio.customAi.name")}>
                    <input type="text" className={inputCls} value={tf.name}
                      onChange={(e) => typography.handleTypographyPresetFieldChange("name", e.target.value)} />
                  </Field>
                  <Field label={t("settings.typographerLibrary.folder")}>
                    <select className={selectCls} value={tf.folderId ?? ""}
                      onChange={(e) => typography.handleTypographyPresetFieldChange("folderId", e.target.value || null)}>
                      <option value="">{t("settings.typographerLibrary.withoutFolder")}</option>
                      {typography.typographyPresetState.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label={t("dashboard.aio.presets.description")} optional>
                    <input type="text" className={inputCls} value={tf.description}
                      onChange={(e) => typography.handleTypographyPresetFieldChange("description", e.target.value)}
                      placeholder={t("settings.typographerLibrary.descriptionPlaceholder")} />
                  </Field>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label={t("renderPreview.shape")}>
                    <select className={selectCls} value={tf.defaultShapeKind}
                      onChange={(e) => typography.handleTypographyPresetFieldChange("defaultShapeKind", e.target.value as TypographyShapeKind)}>
                      <option value="rounded">{t("renderPreview.elliptic")}</option>
                      <option value="square">{t("renderPreview.rectangular")}</option>
                    </select>
                  </Field>
                  <Field label={t("settings.typographerLibrary.padding")}>
                    <input type="number" min={0} className={inputCls} value={tf.padding}
                      onChange={(e) => typography.handleTypographyPresetFieldChange("padding", Math.max(0, Number(e.target.value) || 0))} />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <FontFamilySelect
                    className={`${selectCls} flex-1 min-w-[180px]`}
                    value={tf.style.fontFamily}
                    onChange={(family) => typography.handleTypographyPresetStyleChange("fontFamily", family)}
                    families={typography.typographyPresetFontOptions}
                    ariaLabel={t("renderPreview.textFont")}
                  />
                  <StyleToggles t={t} bold={tf.style.bold} italic={tf.style.italic} uppercase={tf.style.uppercase}
                    onToggle={(k, v) => typography.handleTypographyPresetStyleChange(k, v)} />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <RangeField label={t("renderPreview.fontSize")} min={6} max={160} step={1}
                    value={tf.style.fontSize} display={`${Math.round(tf.style.fontSize)}px`}
                    onChange={(v) => typography.handleTypographyPresetStyleChange("fontSize", Math.max(6, v))} />
                  <RangeField label={t("settings.typographerLibrary.lineSpacing")} min={0.65} max={2.2} step={0.05}
                    value={tf.style.lineSpacing} display={tf.style.lineSpacing.toFixed(2)}
                    onChange={(v) => typography.handleTypographyPresetStyleChange("lineSpacing", v)} />
                  <RangeField label={t("settings.modePresets.outlineWidth")} min={0} max={10} step={0.25}
                    value={tf.style.outlineWidth} display={tf.style.outlineWidth.toFixed(1)}
                    onChange={(v) => typography.handleTypographyPresetStyleChange("outlineWidth", v)} />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <FillStylePopover label={t("renderPreview.fill")}
                    value={buildFillPickerValue(tf.style)} swatches={swatchList}
                    onChange={(v) => {
                      const f = parseFillPickerValue(v, tf.style.color);
                      typography.handleTypographyPresetStyleChange("color", f.color);
                      typography.handleTypographyPresetStyleChange("fillCssValue", f.fillCssValue);
                      typography.handleTypographyPresetStyleChange("gradientEnabled", f.gradientEnabled);
                      typography.handleTypographyPresetStyleChange("gradientStartColor", f.gradientStartColor);
                      typography.handleTypographyPresetStyleChange("gradientEndColor", f.gradientEndColor);
                      typography.handleTypographyPresetStyleChange("gradientAngle", f.gradientAngle);
                      typography.handleTypographyPresetStyleChange("detectGradient", false);
                    }} />
                  <HexColorPopover label={t("renderPreview.outline")} value={tf.style.outlineColor}
                    onChange={(v) => typography.handleTypographyPresetStyleChange("outlineColor", v)} />
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className={btnGhost} onClick={() => typography.setTypographyPresetForm(null)}>
                    {t("dashboard.aio.presets.cancel")}
                  </button>
                  <button type="button" className={btnPrimary} onClick={typography.handleSaveTypographyPreset}>
                    {tf.presetId ? t("dashboard.aio.presets.update") : t("dashboard.aio.presets.create")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {[
            ...typography.typographyPresetState.folders.map((f) => ({ id: f.id as string | null, name: f.name, isReal: true })),
            { id: null as string | null, name: t("settings.typographerLibrary.noFolder"), isReal: false },
          ].map((folder, chapterIdx) => {
            const presets = typography.typographyPresetsByFolder.get(folder.id) ?? [];
            if (!presets.length && !folder.isReal) return null;
            const isCollapsed = folder.id !== null && typography.collapsedFolderIds.has(folder.id);
            const folderObj = folder.id ? typography.typographyPresetState.folders.find((f) => f.id === folder.id) : null;
            const parentName = folderObj?.parentId
              ? typography.typographyPresetState.folders.find((f) => f.id === folderObj.parentId)?.name
              : null;

            return (
              <div key={folder.id ?? "__none"} className="panel-cut-sm border border-paper/8 bg-ink/30">
                {/* Chapter header */}
                <div className="flex items-center gap-2.5 border-b border-paper/8 px-3.5 py-2.5">
                  {folder.id !== null && (
                    <button type="button" onClick={() => typography.handleToggleFolderCollapse(folder.id!)}
                      aria-label={isCollapsed ? t("common.expand") : t("common.collapse")}
                      aria-expanded={!isCollapsed}
                      className="text-paper/40 transition-colors hover:text-paper">
                      <m.span className="block" animate={{ rotate: isCollapsed ? -90 : 0 }}
                        transition={{ duration: 0.2, ease: EASE }}>
                        <ChevronDown size={13} />
                      </m.span>
                    </button>
                  )}

                  <span aria-hidden className="text-outline select-none font-display text-xl font-black leading-none">
                    {String(chapterIdx + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    {typography.folderRenameId === folder.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="text" autoFocus className={`${inputCls} !py-1`}
                          value={typography.folderRenameName}
                          onChange={(e) => typography.setFolderRenameName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") typography.handleCommitFolderRename(folder.id!);
                            if (e.key === "Escape") { typography.setFolderRenameId(null); typography.setFolderRenameName(""); }
                          }} />
                        <button type="button" className={iconBtn} onClick={() => typography.handleCommitFolderRename(folder.id!)}>
                          <Check size={11} className="text-mint" />
                        </button>
                        <button type="button" className={iconBtn}
                          onClick={() => { typography.setFolderRenameId(null); typography.setFolderRenameName(""); }}>
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="flex items-center gap-2 font-display text-xs font-black uppercase tracking-tight text-paper">
                          {folder.name}
                          {parentName && <span className={chip("neutral")}>↳ {parentName}</span>}
                        </p>
                        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper/30">
                          {presets.length === 1
                            ? t("settings.typographerLibrary.presetsCount_one", { count: presets.length })
                            : t("settings.typographerLibrary.presetsCount_other", { count: presets.length })}
                        </p>
                      </>
                    )}
                  </div>

                  {folder.id !== null && typography.folderRenameId !== folder.id && folderObj && (
                    <div className="flex gap-1">
                      <button type="button" className={iconBtn} aria-label={t("common.edit")}
                        onClick={() => typography.handleStartFolderRename(folderObj)}>
                        <Pencil size={10} />
                      </button>
                      <button type="button" className={iconBtnDanger} aria-label={t("common.delete")}
                        onClick={() => typography.handleDeleteTypographyFolder(folderObj)}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-300',
                    '[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
                    isCollapsed
                      ? 'grid-rows-[0fr] opacity-0 pointer-events-none'
                      : 'grid-rows-[1fr] opacity-100',
                  )}
                  aria-hidden={isCollapsed}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-2 p-3">
                        {presets.length === 0 && (
                          <p className="py-4 text-center font-mono text-[10px] uppercase tracking-wider text-paper/30">
                            {t("settings.typographerLibrary.emptyFolder")}
                          </p>
                        )}
                        {presets.map((preset) => {
                          const isDefault = typography.typographyPresetState.defaultPresetId === preset.id;
                          return (
                            <div key={preset.id}
                              className={`panel-cut-sm relative flex flex-wrap items-center justify-between gap-3 border p-3 transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[filter:drop-shadow(3px_3px_0_rgba(255,200,87,0.5))] ${isDefault ? "border-gold/40 bg-gold/[0.04]" : "border-paper/10 bg-ink-2"
                                }`}>
                              {isDefault && <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-gold" />}
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 font-display text-xs font-black uppercase tracking-tight text-paper">
                                  {preset.name}
                                  {isDefault && <span className={chip("gold")}><Star size={8} fill="currentColor" /> {t("settings.typography.default")}</span>}
                                  <span className={chip("neutral")}>{preset.defaultShapeKind}</span>
                                </p>
                                <p className="mt-0.5 truncate font-mono text-[9px] text-paper/40"
                                  style={{ fontFamily: preset.style.fontFamily }}>
                                  {preset.description || `${preset.style.fontFamily} · ${Math.round(preset.style.fontSize)}px`}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button type="button" className={btnGhost}
                                  onClick={() => typography.handleSetDefaultTypographyPreset(preset.id)}>
                                  <Star size={10} /> {t("settings.typography.default")}
                                </button>
                                <button type="button" className={iconBtn} aria-label={t("common.edit")}
                                  onClick={() => typography.openEditTypographyPresetForm(preset)}>
                                  <Pencil size={10} />
                                </button>
                                <button type="button" className={iconBtn} aria-label={t("common.duplicate")}
                                  onClick={() => typography.handleDuplicateTypographyPreset(preset)}>
                                  <Copy size={10} />
                                </button>
                                <button type="button" className={iconBtnDanger} aria-label={t("common.delete")}
                                  onClick={() => typography.handleDeleteTypographyPreset(preset)}>
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
              </div>
            );
          })}
        </div>

        {/* ── Mode bindings ── */}
        <div className="mt-5 panel-cut-sm border border-azure/20 bg-azure/[0.03] p-4">
          <p className="kicker mb-3 !text-azure">// {t("settings.typography.bindingsTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RENDER_MODE_PRESET_OPTIONS.map(([mKey, label]) => (
              <Field key={`bind-${mKey}`} label={label}>
                <select className={selectCls}
                  value={typography.typographyPresetState.modeBindings[mKey] ?? ""}
                  onChange={(e) => typography.handleBindTypographyPreset(mKey, e.target.value || null)}>
                  <option value="">{t("settings.typography.useDefault")}</option>
                  {typography.typographyPresetState.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            ))}
          </div>
        </div>
      </Sec>
    </div>
  );
};

export default renderSettingsTypographerTabNoir;
