import type { JSX } from "react";
import { BookOpen, Check, ChevronDown, Copy, FolderPlus, Pencil, Plus, Star, Trash2, X } from "lucide-react";

import { FillStylePopover } from "../../components/color/FillStylePopover";
import { HexColorPopover } from "../../components/color/HexColorPopover";
import { FontFamilySelect } from "../../components/fonts/FontFamilySelect";
import type { useI18n } from "../../i18n";
import { RENDER_MODE_PRESET_OPTIONS } from "./settings.constants";
import type { TypographyPresetFormData } from "./settings.types";
import type { RenderTextStyle } from "../../utils/renderText";
import { buildFillPickerValue, listTextFillSwatches, parseFillPickerValue, type TextFillSwatchStateV1 } from "../../utils/textFillPicker";
import type { TypographyPresetStateV1, TypographyShapeKind, TypographyStyleFolder, TypographyStylePreset } from "../../typography/types";

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

export const renderSettingsTypographerTab = ({
  t,
  textFill,
  typography,
}: SettingsTypographerTabArgs): JSX.Element => {
  const {
    typographyPresetState,
    typographyPresetForm,
    setTypographyPresetForm,
    typographyPresetFeedback,
    typographyPresetError,
    typographyNewFolderName,
    setTypographyNewFolderName,
    typographyNewFolderParentId,
    setTypographyNewFolderParentId,
    collapsedFolderIds,
    folderRenameId,
    setFolderRenameId,
    folderRenameName,
    setFolderRenameName,
    typographyPresetFontOptions,
    typographyPresetsByFolder,
    openCreateTypographyPresetForm,
    openEditTypographyPresetForm,
    handleTypographyPresetFieldChange,
    handleTypographyPresetStyleChange,
    handleSaveTypographyPreset,
    handleCreateTypographyFolder,
    handleDeleteTypographyFolder,
    handleStartFolderRename,
    handleCommitFolderRename,
    handleToggleFolderCollapse,
    handleDuplicateTypographyPreset,
    handleDeleteTypographyPreset,
    handleBindTypographyPreset,
    handleSetDefaultTypographyPreset,
  } = typography;
  const textFillSwatchList = listTextFillSwatches(textFill.textFillSwatches);

  return (
    <div className="koma-presets-panel" key="typographer">

  {/* ═══ Typographer Library ═══ */}
  <section className="koma-preset-sec">
    <div className="koma-preset-sec__head">
      <span className="koma-preset-sec__icon" aria-hidden="true"><BookOpen size={14} /></span>
      <h3 className="koma-preset-sec__title">{t("settings.typographerLibrary.title")}</h3>
      <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" onClick={openCreateTypographyPresetForm}>
        <Plus size={11} /> {t("dashboard.aio.presets.new")}
      </button>
    </div>
    <p className="koma-preset-sec__desc">
      {t("settings.typographerLibrary.description")}
    </p>

    {typographyPresetFeedback && <div className="koma-preset-alert koma-preset-alert--success" role="status"><span>{typographyPresetFeedback}</span></div>}
    {typographyPresetError && <div className="koma-preset-alert koma-preset-alert--warn" role="alert"><span>{typographyPresetError}</span></div>}

    {/* Folder + Default preset */}
    <div className="koma-preset-form">
      <div className="koma-folder-create-row">
        <input
          type="text"
          className="koma-pf__input"
          placeholder={t("settings.typographerLibrary.newFolder")}
          value={typographyNewFolderName}
          onChange={(e) => setTypographyNewFolderName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreateTypographyFolder(); }}
        />
        {typographyPresetState.folders.length > 0 && (
          <select
            className="koma-pf__select koma-folder-parent-select"
            value={typographyNewFolderParentId ?? ""}
            onChange={(e) => setTypographyNewFolderParentId(e.target.value || null)}
            title={t("settings.typographerLibrary.parentFolder")}
          >
            <option value="">{t("settings.typographerLibrary.noParent")}</option>
            {typographyPresetState.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={handleCreateTypographyFolder}>
          <FolderPlus size={11} /> {t("dashboard.aio.presets.create")}
        </button>
      </div>
      <div className="koma-pf">
        <label className="koma-pf__label">{t("settings.typographerLibrary.defaultPreset")}</label>
        <select className="koma-pf__select" value={typographyPresetState.defaultPresetId ?? ""} onChange={(e) => handleSetDefaultTypographyPreset(e.target.value || null)}>
          <option value="">{t("settings.typographerLibrary.none")}</option>
          {typographyPresetState.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </div>

    {/* Typography Preset Form */}
    {typographyPresetForm && (
      <div className="koma-preset-form">
        <h4 className="koma-preset-form__title">{typographyPresetForm.presetId ? t("settings.typographerLibrary.edit") : t("settings.typographerLibrary.new")} {t("settings.typographerLibrary.presetTypographer")}</h4>
        <div className="koma-preset-form__grid">
          <div className="koma-pf">
            <label className="koma-pf__label">{t("dashboard.aio.customAi.name")}</label>
            <input type="text" className="koma-pf__input" value={typographyPresetForm.name} onChange={(e) => handleTypographyPresetFieldChange("name", e.target.value)} />
          </div>
          <div className="koma-pf">
            <label className="koma-pf__label">{t("settings.typographerLibrary.folder")}</label>
            <select className="koma-pf__select" value={typographyPresetForm.folderId ?? ""} onChange={(e) => handleTypographyPresetFieldChange("folderId", e.target.value || null)}>
              <option value="">{t("settings.typographerLibrary.withoutFolder")}</option>
              {typographyPresetState.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
        <div className="koma-pf">
          <label className="koma-pf__label koma-pf__label--opt">{t("dashboard.aio.presets.description")}</label>
          <input type="text" className="koma-pf__input" value={typographyPresetForm.description} onChange={(e) => handleTypographyPresetFieldChange("description", e.target.value)} placeholder={t("settings.typographerLibrary.descriptionPlaceholder")} />
        </div>
        <div className="koma-preset-form__grid">
          <div className="koma-pf">
            <label className="koma-pf__label">{t("renderPreview.shape")}</label>
            <select className="koma-pf__select" value={typographyPresetForm.defaultShapeKind} onChange={(e) => handleTypographyPresetFieldChange("defaultShapeKind", e.target.value as TypographyShapeKind)}>
              <option value="rounded">{t("renderPreview.elliptic")}</option>
              <option value="square">{t("renderPreview.rectangular")}</option>
            </select>
          </div>
          <div className="koma-pf">
            <label className="koma-pf__label">{t("settings.typographerLibrary.padding")}</label>
            <input type="number" min={0} className="koma-pf__input" value={typographyPresetForm.padding} onChange={(e) => handleTypographyPresetFieldChange("padding", Math.max(0, Number(e.target.value) || 0))} />
          </div>
        </div>

        <div className="koma-style-row">
          <FontFamilySelect
            className="koma-pf__select"
            value={typographyPresetForm.style.fontFamily}
            onChange={(family) => handleTypographyPresetStyleChange("fontFamily", family)}
            families={typographyPresetFontOptions}
            ariaLabel={t("renderPreview.textFont")}
          />
          <div className="koma-style-row__group" role="group" aria-label={t("renderPreview.typographyStyle")}>
            <button type="button" className={`koma-style-row__btn${typographyPresetForm.style.bold ? " koma-style-row__btn--active" : ""}`} onClick={() => handleTypographyPresetStyleChange("bold", !typographyPresetForm.style.bold)} aria-label={t("renderPreview.bold")}>{t("settings.typography.iconBold")}</button>
            <button type="button" className={`koma-style-row__btn${typographyPresetForm.style.italic ? " koma-style-row__btn--active" : ""}`} onClick={() => handleTypographyPresetStyleChange("italic", !typographyPresetForm.style.italic)} aria-label={t("renderPreview.italic")}>{t("settings.typography.iconItalic")}</button>
            <button type="button" className={`koma-style-row__btn${typographyPresetForm.style.uppercase ? " koma-style-row__btn--active" : ""}`} onClick={() => handleTypographyPresetStyleChange("uppercase", !typographyPresetForm.style.uppercase)} aria-label={t("renderPreview.uppercase")}>{t("settings.typography.iconUppercase")}</button>
          </div>
        </div>

        <div className="koma-fine-grid">
          <div className="koma-fine-field">
            <span className="koma-fine-field__label">{t("renderPreview.fontSize")}</span>
            <div className="koma-fine-field__control">
              <input type="range" className="koma-fine-field__range" min={6} max={160} step={1} value={typographyPresetForm.style.fontSize} onChange={(e) => handleTypographyPresetStyleChange("fontSize", Math.max(6, Number(e.target.value)))} />
              <span className="koma-fine-field__value">{Math.round(typographyPresetForm.style.fontSize)}px</span>
            </div>
          </div>
          <div className="koma-fine-field">
            <span className="koma-fine-field__label">{t("settings.typographerLibrary.lineSpacing")}</span>
            <div className="koma-fine-field__control">
              <input type="range" className="koma-fine-field__range" min={0.65} max={2.2} step={0.05} value={typographyPresetForm.style.lineSpacing} onChange={(e) => handleTypographyPresetStyleChange("lineSpacing", Number(e.target.value))} />
              <span className="koma-fine-field__value">{typographyPresetForm.style.lineSpacing.toFixed(2)}</span>
            </div>
          </div>
          <div className="koma-fine-field">
            <span className="koma-fine-field__label">{t("settings.modePresets.outlineWidth")}</span>
            <div className="koma-fine-field__control">
              <input type="range" className="koma-fine-field__range" min={0} max={10} step={0.25} value={typographyPresetForm.style.outlineWidth} onChange={(e) => handleTypographyPresetStyleChange("outlineWidth", Number(e.target.value))} />
              <span className="koma-fine-field__value">{typographyPresetForm.style.outlineWidth.toFixed(1)}</span>
            </div>
          </div>
          <div className="koma-fine-field">
            <div className="koma-color-row">
              <FillStylePopover label={t("renderPreview.fill")} value={buildFillPickerValue(typographyPresetForm.style)} swatches={textFillSwatchList} onChange={(v) => { const f = parseFillPickerValue(v, typographyPresetForm.style.color); handleTypographyPresetStyleChange("color", f.color); handleTypographyPresetStyleChange("fillCssValue", f.fillCssValue); handleTypographyPresetStyleChange("gradientEnabled", f.gradientEnabled); handleTypographyPresetStyleChange("gradientStartColor", f.gradientStartColor); handleTypographyPresetStyleChange("gradientEndColor", f.gradientEndColor); handleTypographyPresetStyleChange("gradientAngle", f.gradientAngle); handleTypographyPresetStyleChange("detectGradient", false); }} />
              <HexColorPopover label={t("renderPreview.outline")} value={typographyPresetForm.style.outlineColor} onChange={(v) => handleTypographyPresetStyleChange("outlineColor", v)} />
            </div>
          </div>
        </div>

        <div className="koma-preset-form__actions">
          <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={() => setTypographyPresetForm(null)}>{t("dashboard.aio.presets.cancel")}</button>
          <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" onClick={handleSaveTypographyPreset}>
            {typographyPresetForm.presetId ? t("dashboard.aio.presets.update") : t("dashboard.aio.presets.create")}
          </button>
        </div>
      </div>
    )}

    {/* Typography preset list by folder */}
    <div className="koma-preset-groups">
      {[...typographyPresetState.folders.map((f) => ({ id: f.id as string | null, name: f.name, isReal: true })), { id: null as string | null, name: t('settings.typographerLibrary.noFolder'), isReal: false }].map((folder) => {
        const presets = typographyPresetsByFolder.get(folder.id) ?? [];
        if (!presets.length && !folder.isReal) return null;
        const isCollapsed = folder.id !== null && collapsedFolderIds.has(folder.id);
        const folderObj = folder.id ? typographyPresetState.folders.find((f) => f.id === folder.id) : null;
        const parentName = folderObj?.parentId
          ? typographyPresetState.folders.find((f) => f.id === folderObj.parentId)?.name
          : null;
        return (
          <div key={folder.id ?? "__none"} className={`koma-preset-lang-group${isCollapsed ? " koma-preset-lang-group--collapsed" : ""}`}>
            <div className="koma-preset-lang-group__head">
              {folder.id !== null && (
                <button
                  type="button"
                  className="koma-preset-lang-group__collapse-btn"
                  onClick={() => handleToggleFolderCollapse(folder.id!)}
                  aria-label={isCollapsed ? t("common.expand") : t("common.collapse")}
                >
                  <ChevronDown size={12} className={`koma-collapse-icon${isCollapsed ? " koma-collapse-icon--rotated" : ""}`} />
                </button>
              )}
              <div className="koma-preset-lang-group__info">
                {folderRenameId === folder.id ? (
                  <div className="koma-folder-rename-row">
                    <input
                      type="text"
                      className="koma-pf__input koma-pf__input--sm"
                      value={folderRenameName}
                      autoFocus
                      onChange={(e) => setFolderRenameName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCommitFolderRename(folder.id!);
                        if (e.key === "Escape") { setFolderRenameId(null); setFolderRenameName(""); }
                      }}
                    />
                    <button type="button" className="koma-btn koma-btn--primary koma-btn--xs" onClick={() => handleCommitFolderRename(folder.id!)}><Check size={10} /></button>
                    <button type="button" className="koma-btn koma-btn--ghost koma-btn--xs" onClick={() => { setFolderRenameId(null); setFolderRenameName(""); }}><X size={10} /></button>
                  </div>
                ) : (
                  <>
                    <p className="koma-preset-lang-group__title">
                      {folder.name}
                      {parentName && <span className="koma-folder-parent-badge">{parentName}</span>}
                    </p>
                    <p className="koma-preset-lang-group__meta">
                      {presets.length === 1
                        ? t("settings.typographerLibrary.presetsCount_one", { count: presets.length })
                        : t("settings.typographerLibrary.presetsCount_other", { count: presets.length })}
                    </p>
                  </>
                )}
              </div>
              {folder.id !== null && folderRenameId !== folder.id && folderObj && (
                <div className="koma-preset-lang-group__folder-actions">
                  <button type="button" className="koma-preset-card__icon-btn" onClick={() => handleStartFolderRename(folderObj)} aria-label={t("common.edit")}><Pencil size={10} /></button>
                  <button type="button" className="koma-preset-card__icon-btn koma-preset-card__icon-btn--danger" onClick={() => handleDeleteTypographyFolder(folderObj)} aria-label={t("common.delete")}><Trash2 size={10} /></button>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <div className="koma-preset-list">
                {presets.length === 0 && (
                  <p className="koma-preset-empty">{t("settings.typographerLibrary.emptyFolder")}</p>
                )}
                {presets.map((preset) => {
                  const isDefault = typographyPresetState.defaultPresetId === preset.id;
                  return (
                    <div key={preset.id} className={`koma-preset-card${isDefault ? " koma-preset-card--active" : ""}`}>
                      <div className="koma-preset-card__accent" />
                      <div className="koma-preset-card__body">
                        <div className="koma-preset-card__top">
                          <span className="koma-preset-card__name">{preset.name}</span>
                          {isDefault && <span className="koma-preset-chip koma-preset-chip--purple">{t("settings.typography.default")}</span>}
                        </div>
                        <div className="koma-preset-card__meta">
                          <span className="koma-preset-chip koma-preset-chip--neutral">{preset.defaultShapeKind}</span>
                          <span className="koma-preset-card__desc">{preset.description || `${preset.style.fontFamily} · ${Math.round(preset.style.fontSize)}px`}</span>
                        </div>
                      </div>
                      <div className="koma-preset-card__actions">
                        <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={() => handleSetDefaultTypographyPreset(preset.id)}>
                          <Star size={10} /> {t("settings.typography.default")}
                        </button>
                        <div className="koma-preset-card__icon-actions">
                          <button type="button" className="koma-preset-card__icon-btn" onClick={() => openEditTypographyPresetForm(preset)} aria-label={t("common.edit")}><Pencil size={10} /></button>
                          <button type="button" className="koma-preset-card__icon-btn" onClick={() => handleDuplicateTypographyPreset(preset)} aria-label={t("common.duplicate")}><Copy size={10} /></button>
                          <button type="button" className="koma-preset-card__icon-btn koma-preset-card__icon-btn--danger" onClick={() => handleDeleteTypographyPreset(preset)} aria-label={t("common.delete")}><Trash2 size={10} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Mode Bindings */}
    <div className="koma-preset-form" style={{ marginTop: 8 }}>
      <h4 className="koma-preset-form__title">{t("settings.typography.bindingsTitle")}</h4>
      <div className="koma-bindings-grid">
        {RENDER_MODE_PRESET_OPTIONS.map(([mKey, label]) => (
          <div key={`bind-${mKey}`} className="koma-binding-cell">
            <span className="koma-binding-cell__label">{label}</span>
            <select className="koma-pf__select" value={typographyPresetState.modeBindings[mKey] ?? ""} onChange={(e) => handleBindTypographyPreset(mKey, e.target.value || null)}>
              <option value="">{t("settings.typography.useDefault")}</option>
              {typographyPresetState.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  </section>
    </div>
  );
};

export default renderSettingsTypographerTab;
