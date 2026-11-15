import type { JSX } from "react";
import { AlertTriangle, CheckCircle2, Info, Layout, Palette, Pencil, Plus, RotateCcw, Sliders, Trash2 } from "lucide-react";

import { FillStylePopover } from "../../components/color/FillStylePopover";
import { HexColorPopover } from "../../components/color/HexColorPopover";
import { FontFamilySelect } from "../../components/fonts/FontFamilySelect";
import type { useI18n } from "../../i18n";
import { AIO_STAGE_KEYS, AIO_STAGE_LABELS, RENDER_MODE_PRESET_OPTIONS, normalizeLanguageCode } from "./settings.constants";
import type {
  PresetFormData,
  RenderModePresetFormData,
} from "./settings.types";
import type { AioLanguageOption, AioStageOptionMap } from "../../models/aioStageCatalog";
import type { AioLanguageModelPreset } from "../../types/aioModelPresets";
import type { RenderModePresetMode, RenderModeStylePreset } from "../../utils/renderModePresets";
import { buildRenderModeColorPickerValue, listTextFillSwatches, parseFillPickerValue, type TextFillSwatchStateV1 } from "../../utils/textFillPicker";

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
}

export const renderSettingsPresetsTab = ({
  t,
  aio,
  textFill,
  renderMode,
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
  // One list per render: three inline listTextFillSwatches calls allocate
  // three arrays and churn FillStylePopover props.
  const textFillSwatchList = listTextFillSwatches(textFillSwatches);
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
              {presetLanguageOptions.map((o) => <option key={o.value} value={normalizeLanguageCode(o.value)}>{t(o.label)}</option>)}
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
          swatches={textFillSwatchList}
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
            <div key={`s-${item}`} className="koma-swatch-item">
              <button type="button" className="koma-swatch-select" onClick={() => setTextFillDraftValue(item)} title={item} aria-label={t("settings.pickerPalette.selectColor", { color: item })}>
                <span className="koma-swatch-preview" style={{ background: item }} />
                <span className="koma-swatch-value">{item}</span>
              </button>
              <button type="button" className="koma-swatch-remove" onClick={() => handleRemoveTextFillSwatch(item)} aria-label={t("settings.pickerPalette.removeColor", { color: item })}>×</button>
            </div>
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
            <div key={`g-${item}`} className="koma-swatch-item">
              <button type="button" className="koma-swatch-select" onClick={() => setTextFillDraftValue(item)} title={item} aria-label={t("settings.pickerPalette.selectColor", { color: item })}>
                <span className="koma-swatch-preview" style={{ background: item }} />
                <span className="koma-swatch-value">{item}</span>
              </button>
              <button type="button" className="koma-swatch-remove" onClick={() => handleRemoveTextFillSwatch(item)} aria-label={t("settings.pickerPalette.removeColor", { color: item })}>×</button>
            </div>
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
        <FontFamilySelect
          className="koma-pf__select"
          value={renderModePresetForm.style.fontFamily}
          onChange={(family) => handleRenderModePresetFieldChange("fontFamily", family)}
          families={renderModePresetFontOptions}
          ariaLabel={t("renderPreview.textFont")}
        />
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
            <FillStylePopover label={t("settings.modePresets.textColor")} value={buildRenderModeColorPickerValue(renderModePresetForm.style)} allowGradient={false} swatches={textFillSwatchList} onChange={(v) => { const f = parseFillPickerValue(v, renderModePresetForm.style.color); handleRenderModePresetFieldChange("color", f.color); }} />
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
    </div>
  );
};

export default renderSettingsPresetsTab;
