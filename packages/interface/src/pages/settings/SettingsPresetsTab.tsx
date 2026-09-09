import type { JSX } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, Check, Copy, FolderPlus, Info, Layout, Palette, Pencil, Plus, RotateCcw, Sliders, Star, Trash2, X } from "lucide-react";

import { FillStylePopover } from "../../components/color/FillStylePopover";
import { HexColorPopover } from "../../components/color/HexColorPopover";
import type { useI18n } from "../../i18n";
import { AIO_STAGE_KEYS, AIO_STAGE_LABELS, RENDER_MODE_PRESET_OPTIONS, normalizeLanguageCode } from "./settings.constants";
import type {
  PresetFormData,
  RenderModePresetFormData,
  TypographyPresetFormData,
} from "./settings.types";
import type { AioLanguageOption, AioStageOptionMap } from "../../models/aioStageCatalog";
import type { AioLanguageModelPreset } from "../../types/aioModelPresets";
import type { RenderModePresetMode, RenderModeStylePreset } from "../../utils/renderModePresets";
import type { RenderTextStyle } from "../../utils/renderText";
import { buildFillPickerValue, buildRenderModeColorPickerValue, listTextFillSwatches, parseFillPickerValue, type TextFillSwatchStateV1 } from "../../utils/textFillPicker";
import type { TypographyPresetStateV1, TypographyShapeKind, TypographyStyleFolder, TypographyStylePreset } from "../../typography/types";

type TranslationFn = ReturnType<typeof useI18n>["t"];

type PresetGroup = {
  language: string;
  label: string;
  activePresetId: string | null;
  presets: AioLanguageModelPreset[];
};

interface SettingsPresetsTabArgs {
  t: TranslationFn;
  aio: {
    openCreatePresetForm: () => void;
    presetCatalogLoading: boolean;
    presetFeedback: string | null;
    presetError: string | null;
    presetForm: PresetFormData | null;
    setPresetForm: (value: PresetFormData | null | ((prev: PresetFormData | null) => PresetFormData | null)) => void;
    presetLanguageOptions: AioLanguageOption[];
    handlePresetSourceLanguageChange: (sourceLanguage: string) => void;
    languageLabelByCode: Map<string, string>;
    closePresetForm: () => void;
    handleSavePreset: () => void;
    groupedPresets: PresetGroup[];
    handleSetActivePreset: (sourceLanguage: string, presetId: string | null) => void;
    openEditPresetForm: (preset: AioLanguageModelPreset) => void;
    handleDeletePreset: (presetId: string, presetName: string) => void;
    getSelectableStageCatalog: (sourceLanguage: string) => AioStageOptionMap;
  };
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
  renderMode: {
    renderModePresetFeedback: string | null;
    renderModePresetError: string | null;
    renderModePresetForm: RenderModePresetFormData;
    handleRenderModePresetModeChange: (mode: RenderModePresetMode) => void;
    handleRenderModePresetFieldChange: <K extends keyof RenderModeStylePreset>(key: K, value: RenderModeStylePreset[K]) => void;
    handleSaveRenderModePreset: () => void;
    handleResetAllRenderModePreset: () => void;
    handleResetRenderModePreset: () => void;
    renderModePresetFontOptions: string[];
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

export const renderSettingsPresetsTab = ({
  t,
  aio,
  textFill,
  renderMode,
  typography,
}: SettingsPresetsTabArgs): JSX.Element => {
  const {
    openCreatePresetForm,
    presetCatalogLoading,
    presetFeedback,
    presetError,
    presetForm,
    setPresetForm,
    presetLanguageOptions,
    handlePresetSourceLanguageChange,
    languageLabelByCode,
    closePresetForm,
    handleSavePreset,
    groupedPresets,
    handleSetActivePreset,
    openEditPresetForm,
    handleDeletePreset,
    getSelectableStageCatalog,
  } = aio;
  const {
    textFillFeedback,
    textFillError,
    textFillDraftValue,
    setTextFillDraftValue,
    setTextFillError,
    setTextFillFeedback,
    textFillSwatches,
    handleAddTextFillSwatch,
    handleRemoveTextFillSwatch,
    handleResetTextFillSwatches,
  } = textFill;
  const {
    renderModePresetFeedback,
    renderModePresetError,
    renderModePresetForm,
    handleRenderModePresetModeChange,
    handleRenderModePresetFieldChange,
    handleSaveRenderModePreset,
    handleResetAllRenderModePreset,
    handleResetRenderModePreset,
    renderModePresetFontOptions,
  } = renderMode;
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

  return (
    <div className="koma-presets-panel" key="presets">

  {/* ═══ AIO Presets ═══ */}
  <section className="koma-preset-sec">
    <div className="koma-preset-sec__head">
      <span className="koma-preset-sec__icon" aria-hidden="true"><Sliders size={14} /></span>
      <h3 className="koma-preset-sec__title">{t("dashboard.aio.presets.title")}</h3>
      <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" onClick={openCreatePresetForm}>
        <Plus size={11} /> {t("dashboard.aio.presets.new")}
      </button>
    </div>
    <p className="koma-preset-sec__desc">
      {t("settings.aioPresets.description")}
    </p>

    {/* Alerts */}
    {presetCatalogLoading && (
      <div className="koma-preset-alert koma-preset-alert--info" role="status">
        <Info size={12} className="koma-preset-alert__icon" />
        <span><strong>{t("settings.aioPresets.catalog")}</strong> — {t("settings.aioPresets.syncingCatalog")}</span>
      </div>
    )}
    {presetFeedback && (
      <div className="koma-preset-alert koma-preset-alert--success" role="status">
        <CheckCircle2 size={12} className="koma-preset-alert__icon" />
        <span>{presetFeedback}</span>
      </div>
    )}
    {presetError && (
      <div className="koma-preset-alert koma-preset-alert--warn" role="alert">
        <AlertTriangle size={12} className="koma-preset-alert__icon" />
        <span>{presetError}</span>
      </div>
    )}

    {/* Inline Form */}
    {presetForm && (
      <div className="koma-preset-form">
        <h4 className="koma-preset-form__title">
          {presetForm.presetId ? t("settings.aioPresets.editPreset") : t("settings.aioPresets.newPreset")}
        </h4>
        <div className="koma-preset-form__grid">
          <div className="koma-pf">
            <label className="koma-pf__label">{t("dashboard.aio.customAi.name")}</label>
            <input type="text" className="koma-pf__input" placeholder={t("settings.aioPresets.namePlaceholder")} value={presetForm.name} onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })} />
          </div>
          <div className="koma-pf">
            <label className="koma-pf__label">{t("settings.aioPresets.sourceLanguage")}</label>
            <select className="koma-pf__select" value={presetForm.sourceLanguage} onChange={(e) => handlePresetSourceLanguageChange(e.target.value)}>
              {presetLanguageOptions.map((o) => <option key={o.value} value={normalizeLanguageCode(o.value)}>{t(o.label as any)}</option>)}
            </select>
          </div>
        </div>
        <div className="koma-pf">
          <label className="koma-pf__label koma-pf__label--opt">{t("dashboard.aio.presets.description")}</label>
          <input type="text" className="koma-pf__input" placeholder={t("settings.aioPresets.shortDescription")} value={presetForm.description} onChange={(e) => setPresetForm({ ...presetForm, description: e.target.value })} />
        </div>
        <div className="koma-preset-form__stages">
          {AIO_STAGE_KEYS.map((k) => {
            const opts = getSelectableStageCatalog(presetForm.sourceLanguage)[k];
            const val = opts.some((o) => o.key === presetForm.stageModels[k]) ? presetForm.stageModels[k] : "";
            return (
              <div key={k} className="koma-pf">
                <label className="koma-pf__label">{AIO_STAGE_LABELS[k]}</label>
                <select className="koma-pf__select" value={val} disabled={!opts.length} onChange={(e) => setPresetForm({ ...presetForm, stageModels: { ...presetForm.stageModels, [k]: e.target.value } })}>
                  {!opts.length ? <option value="">{t("aio.model.noneAvailable")}</option> : val === "" ? <option value="" disabled>{t("settings.aioPresets.select")}</option> : null}
                  {opts.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
        <label className="koma-preset-check">
          <input type="checkbox" checked={presetForm.setAsActive} onChange={(e) => setPresetForm({ ...presetForm, setAsActive: e.target.checked })} />
          <span>{t("dashboard.aio.presets.setActiveFor")} {languageLabelByCode.get(presetForm.sourceLanguage) ?? presetForm.sourceLanguage.toUpperCase()}</span>
        </label>
        <div className="koma-preset-form__actions">
          <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={closePresetForm}>{t("dashboard.aio.presets.cancel")}</button>
          <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" disabled={!presetForm.name.trim()} onClick={handleSavePreset}>
            {presetForm.presetId ? t("dashboard.aio.presets.update") : t("dashboard.aio.presets.create")}
          </button>
        </div>
      </div>
    )}

    {/* List */}
    {groupedPresets.length === 0 ? (
      <div className="koma-preset-empty">
        <Sliders size={36} className="koma-preset-empty__icon" />
        <p>{t("settings.aioPresets.noneRegistered")}</p>
        <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={openCreatePresetForm}>{t("settings.aioPresets.createFirst")}</button>
      </div>
    ) : (
      <div className="koma-preset-groups">
        {groupedPresets.map((group) => (
          <div key={group.language} className="koma-preset-lang-group">
            <div className="koma-preset-lang-group__head">
              <div className="koma-preset-lang-group__info">
                <p className="koma-preset-lang-group__title">{group.label}</p>
                <p className="koma-preset-lang-group__meta">{t("settings.aioPresets.presetCount", { count: group.presets.length })}</p>
              </div>
              <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={() => handleSetActivePreset(group.language, null)} disabled={!group.activePresetId}>
                {t("settings.aioPresets.clearActive")}
              </button>
            </div>
            <div className="koma-preset-list">
              {group.presets.map((preset) => {
                const catalog = getSelectableStageCatalog(group.language);
                const isActive = group.activePresetId === preset.id;
                return (
                  <div key={preset.id} className={`koma-preset-card${isActive ? " koma-preset-card--active" : ""}`}>
                    <div className="koma-preset-card__accent" />
                    <div className="koma-preset-card__body">
                      <div className="koma-preset-card__top">
                        <span className="koma-preset-card__name">{preset.name}</span>
                        {isActive && <span className="koma-preset-chip koma-preset-chip--purple">{t("settings.aioPresets.active")}</span>}
                      </div>
                      <div className="koma-preset-card__meta">
                        <span className="koma-preset-chip koma-preset-chip--neutral">{group.label}</span>
                        {preset.description && <span className="koma-preset-card__desc">{preset.description}</span>}
                      </div>
                      <div className="koma-preset-card__stages">
                        {AIO_STAGE_KEYS.map((k) => {
                          const opt = catalog[k].find((i) => i.key === preset.stageModels[k]);
                          return (
                            <div key={`${preset.id}-${k}`} className="koma-preset-stage">
                              <span className="koma-preset-stage__label">{AIO_STAGE_LABELS[k]}</span>
                              <span className="koma-preset-stage__value">{opt?.name ?? preset.stageModels[k]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="koma-preset-card__actions">
                      <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={() => handleSetActivePreset(group.language, preset.id)} disabled={isActive}>
                        {t("settings.aioPresets.activate")}
                      </button>
                      <div className="koma-preset-card__icon-actions">
                        <button type="button" className="koma-preset-card__icon-btn" onClick={() => openEditPresetForm(preset)} aria-label={t("settings.aioPresets.editNamed", { name: preset.name })}>
                          <Pencil size={11} />
                        </button>
                        <button type="button" className="koma-preset-card__icon-btn koma-preset-card__icon-btn--danger" onClick={() => handleDeletePreset(preset.id, preset.name)} aria-label={t("settings.aioPresets.deleteNamed", { name: preset.name })}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    )}
  </section>

  {/* ═══ Text Fill Palette ═══ */}
  <section className="koma-preset-sec">
    <div className="koma-preset-sec__head">
      <span className="koma-preset-sec__icon" aria-hidden="true"><Palette size={14} /></span>
      <h3 className="koma-preset-sec__title">{t("settings.pickerPalette.title")}</h3>
    </div>
    <p className="koma-preset-sec__desc">
      {t("settings.pickerPalette.description")}
    </p>

    {textFillFeedback && <div className="koma-preset-alert koma-preset-alert--success" role="status"><span>{textFillFeedback}</span></div>}
    {textFillError && <div className="koma-preset-alert koma-preset-alert--warn" role="alert"><span>{textFillError}</span></div>}

    <div className="koma-swatch-add-row">
      <div style={{ flex: 1 }}>
        <FillStylePopover
          label={t("settings.pickerPalette.newPreset")}
          value={textFillDraftValue}
          swatches={listTextFillSwatches(textFillSwatches)}
          onChange={(v) => { setTextFillDraftValue(v); setTextFillError(null); setTextFillFeedback(null); }}
        />
      </div>
      <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" onClick={handleAddTextFillSwatch}>{t("settings.pickerPalette.add")}</button>
      <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={handleResetTextFillSwatches}><RotateCcw size={10} /> {t("settings.pickerPalette.reset")}</button>
    </div>
    <p className="koma-swatch-hint">
      {t("settings.pickerPalette.hintPrefix")} <code>#a855f7</code> {t("settings.pickerPalette.hintOr")} <code>linear-gradient(135deg, #a855f7, #06b6d4)</code>
    </p>

    <div className="koma-swatch-groups">
      {/* Solids */}
      <div className="koma-swatch-group">
        <div className="koma-swatch-group__head">
          <span className="koma-swatch-group__title">{t("settings.pickerPalette.solids")}</span>
          <span className="koma-swatch-group__count">{textFillSwatches.solid.length}</span>
        </div>
        <div className="koma-swatch-list">
          {textFillSwatches.solid.map((item) => (
            <button key={`s-${item}`} type="button" className="koma-swatch-item" onClick={() => setTextFillDraftValue(item)} title={item}>
              <span className="koma-swatch-preview" style={{ background: item }} />
              <span className="koma-swatch-value">{item}</span>
              <span className="koma-swatch-remove" onClick={(e) => { e.stopPropagation(); handleRemoveTextFillSwatch(item); }}>×</span>
            </button>
          ))}
        </div>
      </div>
      {/* Gradients */}
      <div className="koma-swatch-group">
        <div className="koma-swatch-group__head">
          <span className="koma-swatch-group__title">{t("settings.pickerPalette.gradients")}</span>
          <span className="koma-swatch-group__count">{textFillSwatches.gradient.length}</span>
        </div>
        <div className="koma-swatch-list">
          {textFillSwatches.gradient.map((item) => (
            <button key={`g-${item}`} type="button" className="koma-swatch-item" onClick={() => setTextFillDraftValue(item)} title={item}>
              <span className="koma-swatch-preview" style={{ background: item }} />
              <span className="koma-swatch-value">{item}</span>
              <span className="koma-swatch-remove" onClick={(e) => { e.stopPropagation(); handleRemoveTextFillSwatch(item); }}>×</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  </section>

  {/* ═══ Render Mode Presets ═══ */}
  <section className="koma-preset-sec">
    <div className="koma-preset-sec__head">
      <span className="koma-preset-sec__icon" aria-hidden="true"><Layout size={14} /></span>
      <h3 className="koma-preset-sec__title">{t("settings.modePresets.title")}</h3>
    </div>
    <p className="koma-preset-sec__desc">
      {t("settings.modePresets.description")}
    </p>

    {renderModePresetFeedback && <div className="koma-preset-alert koma-preset-alert--success" role="status"><CheckCircle2 size={11} className="koma-preset-alert__icon" /><span>{renderModePresetFeedback}</span></div>}
    {renderModePresetError && <div className="koma-preset-alert koma-preset-alert--warn" role="alert"><AlertTriangle size={11} className="koma-preset-alert__icon" /><span>{renderModePresetError}</span></div>}

    <div className="koma-preset-form">
      <div className="koma-pf">
        <label className="koma-pf__label">{t("settings.modePresets.targetMode")}</label>
        <select className="koma-pf__select" value={renderModePresetForm.mode} onChange={(e) => handleRenderModePresetModeChange(e.target.value as RenderModePresetMode)}>
          {RENDER_MODE_PRESET_OPTIONS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
      </div>

      {/* Style controls */}
      <div className="koma-style-row">
        <select className="koma-pf__select" value={renderModePresetForm.style.fontFamily} onChange={(e) => handleRenderModePresetFieldChange("fontFamily", e.target.value)}>
          {renderModePresetFontOptions.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="koma-style-row__group" role="group" aria-label={t("renderPreview.typographyStyle")}>
          <button type="button" className={`koma-style-row__btn${renderModePresetForm.style.bold ? " koma-style-row__btn--active" : ""}`} onClick={() => handleRenderModePresetFieldChange("bold", !renderModePresetForm.style.bold)} aria-label={t("renderPreview.bold")}>{t("settings.typography.iconBold")}</button>
          <button type="button" className={`koma-style-row__btn${renderModePresetForm.style.italic ? " koma-style-row__btn--active" : ""}`} onClick={() => handleRenderModePresetFieldChange("italic", !renderModePresetForm.style.italic)} aria-label={t("renderPreview.italic")}>{t("settings.typography.iconItalic")}</button>
          <button type="button" className={`koma-style-row__btn${renderModePresetForm.style.uppercase ? " koma-style-row__btn--active" : ""}`} onClick={() => handleRenderModePresetFieldChange("uppercase", !renderModePresetForm.style.uppercase)} aria-label={t("renderPreview.uppercase")}>{t("settings.typography.iconUppercase")}</button>
        </div>
      </div>

      <div className="koma-fine-grid">
        <div className="koma-fine-field">
          <span className="koma-fine-field__label">{t("renderPreview.fontSize")}</span>
          <div className="koma-fine-field__control">
            <input type="range" className="koma-fine-field__range" min={6} max={160} step={1} value={renderModePresetForm.style.fontSize} onChange={(e) => handleRenderModePresetFieldChange("fontSize", Math.max(6, Number(e.target.value)))} />
            <span className="koma-fine-field__value">{Math.round(renderModePresetForm.style.fontSize)}px</span>
          </div>
        </div>
        <div className="koma-fine-field">
          <span className="koma-fine-field__label">{t("settings.modePresets.outline")}</span>
          <label className="koma-fine-toggle">
            <input type="checkbox" checked={renderModePresetForm.style.outlineEnabled} onChange={(e) => handleRenderModePresetFieldChange("outlineEnabled", e.target.checked)} />
            <span>{renderModePresetForm.style.outlineEnabled ? t("renderPreview.enabled") : t("settings.modePresets.off")}</span>
          </label>
        </div>
        <div className="koma-fine-field">
          <span className="koma-fine-field__label">{t("settings.modePresets.outlineWidth")}</span>
          <div className="koma-fine-field__control">
            <input type="range" className="koma-fine-field__range" min={0} max={10} step={0.25} value={renderModePresetForm.style.outlineWidth} disabled={!renderModePresetForm.style.outlineEnabled} onChange={(e) => handleRenderModePresetFieldChange("outlineWidth", Number(e.target.value))} />
            <span className="koma-fine-field__value">{renderModePresetForm.style.outlineWidth.toFixed(1)}</span>
          </div>
        </div>
        <div className="koma-fine-field">
          <span className="koma-fine-field__label">{t("settings.modePresets.ocrGradient")}</span>
          <label className="koma-fine-toggle">
            <input type="checkbox" checked={renderModePresetForm.style.detectGradient} onChange={(e) => handleRenderModePresetFieldChange("detectGradient", e.target.checked)} />
            <span>{renderModePresetForm.style.detectGradient ? t("settings.modePresets.detect") : t("settings.modePresets.ignore")}</span>
          </label>
        </div>
        <div className="koma-fine-field koma-fine-field--full">
          <div className="koma-color-row">
            <FillStylePopover label={t("settings.modePresets.textColor")} value={buildRenderModeColorPickerValue(renderModePresetForm.style)} allowGradient={false} swatches={listTextFillSwatches(textFillSwatches)} onChange={(v) => { const f = parseFillPickerValue(v, renderModePresetForm.style.color); handleRenderModePresetFieldChange("color", f.color); }} />
            <HexColorPopover label={t("settings.modePresets.outlineColor")} value={renderModePresetForm.style.outlineColor} disabled={!renderModePresetForm.style.outlineEnabled} onChange={(v) => handleRenderModePresetFieldChange("outlineColor", v)} />
          </div>
        </div>
      </div>

      <div className="koma-preset-form__actions">
        <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={handleResetAllRenderModePreset}><RotateCcw size={10} /> {t("settings.modePresets.all")}</button>
        <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" onClick={handleResetRenderModePreset}><RotateCcw size={10} /> {t("settings.modePresets.mode")}</button>
        <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" onClick={handleSaveRenderModePreset}>{t("settings.modePresets.save")}</button>
      </div>
    </div>
  </section>

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
          <select className="koma-pf__select" value={typographyPresetForm.style.fontFamily} onChange={(e) => handleTypographyPresetStyleChange("fontFamily", e.target.value)}>
            {typographyPresetFontOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
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
              <FillStylePopover label={t("renderPreview.fill")} value={buildFillPickerValue(typographyPresetForm.style)} swatches={listTextFillSwatches(textFillSwatches)} onChange={(v) => { const f = parseFillPickerValue(v, typographyPresetForm.style.color); handleTypographyPresetStyleChange("color", f.color); handleTypographyPresetStyleChange("fillCssValue", f.fillCssValue); handleTypographyPresetStyleChange("gradientEnabled", f.gradientEnabled); handleTypographyPresetStyleChange("gradientStartColor", f.gradientStartColor); handleTypographyPresetStyleChange("gradientEndColor", f.gradientEndColor); handleTypographyPresetStyleChange("gradientAngle", f.gradientAngle); handleTypographyPresetStyleChange("detectGradient", false); }} />
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

export default renderSettingsPresetsTab;
