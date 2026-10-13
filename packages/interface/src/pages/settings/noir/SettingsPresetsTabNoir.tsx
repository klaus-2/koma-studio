import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Check, ChevronDown, Copy, FolderPlus, Layout, Palette,
  Pencil, Plus, RotateCcw, Sliders, Star, Trash2, X,
} from "lucide-react";
import { FillStylePopover } from "../../../components/color/FillStylePopover";
import { HexColorPopover } from "../../../components/color/HexColorPopover";
import { FontFamilySelect } from "../../../components/fonts/FontFamilySelect";
import type React from "react";
import type { useI18n } from "../../../i18n";
import { AIO_STAGE_KEYS, AIO_STAGE_LABELS, RENDER_MODE_PRESET_OPTIONS, normalizeLanguageCode } from "../settings.constants";
import type { PresetFormData, RenderModePresetFormData, TypographyPresetFormData } from "../settings.types";
import type { AioLanguageModelPreset } from "../../../types/aioModelPresets";
import type { AioLanguageOption, AioStageOption, AioStageOptionMap } from "../../../models/aioStageCatalog";
import type { RenderModePresetMode, RenderModeStylePreset } from "../../../utils/renderModePresets";
import type { RenderTextStyle } from "../../../utils/renderText";
import {
  buildFillPickerValue, buildRenderModeColorPickerValue, listTextFillSwatches,
  parseFillPickerValue, type TextFillSwatchStateV1,
} from "../../../utils/textFillPicker";
import type {
  TypographyPresetStateV1, TypographyShapeKind, TypographyStyleFolder, TypographyStylePreset,
} from "../../../typography/types";
import {
  Sec, Field, Alert, RangeField, InkToggle, EASE,
  inputCls, selectCls, btnPrimary, btnGhost, iconBtn, iconBtnDanger, chip,
} from "./primitives";

type TranslationFn = ReturnType<typeof useI18n>["t"];
type PresetGroup = {
  language: string; label: string; activePresetId: string | null;
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

const SwatchChip = ({ value, onPick, onRemove }: {
  value: string; onPick: () => void; onRemove: () => void;
}) => (
  <span className="panel-cut-sm group inline-flex items-center gap-1.5 border border-paper/12 bg-ink/60 py-1 pl-1.5 pr-1 transition-colors hover:border-gold/50">
    <button type="button" onClick={onPick} title={value} className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-4 w-4 border border-paper/20" style={{ background: value }} />
      <span className="max-w-[110px] truncate font-mono text-[9px] text-paper/55 group-hover:text-paper">{value}</span>
    </button>
    <button type="button" onClick={onRemove} aria-label={`Remove ${value}`}
      className="px-1 font-mono text-[11px] text-paper/25 hover:text-crimson">×</button>
  </span>
);

export const renderSettingsPresetsTabNoir = ({ t, aio, textFill, renderMode, typography }: SettingsPresetsTabArgs): React.ReactElement => {
  const rf = renderMode.renderModePresetForm;
  const tf = typography.typographyPresetForm;
  const swatchList = listTextFillSwatches(textFill.textFillSwatches);

  return (
    <div className="space-y-5" key="presets">

      {/* ═══════════ 01 · AIO PIPELINE PRESETS ═══════════ */}
      <Sec icon={<Sliders size={14} />} title={t("dashboard.aio.presets.title")}
        desc={t("settings.aioPresets.description")}
        actions={
          <button type="button" className={btnPrimary} onClick={aio.openCreatePresetForm}>
            <Plus size={11} /> {t("dashboard.aio.presets.new")}
          </button>
        }>
        <span aria-hidden className="v-text pointer-events-none absolute right-2 top-4 select-none font-display text-sm font-black text-paper/[0.05]">パイプライン</span>

        <div className="space-y-2">
          {aio.presetCatalogLoading && (
            <Alert tone="info"><span className="blink">●</span> <strong>{t("settings.aioPresets.catalog")}</strong> — {t("settings.aioPresets.syncingCatalog")}</Alert>
          )}
          {aio.presetFeedback && <Alert tone="success">{aio.presetFeedback}</Alert>}
          {aio.presetError && <Alert tone="error">{aio.presetError}</Alert>}
        </div>

        {/* ── Form inline ── */}
        <AnimatePresence>
          {aio.presetForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: EASE }}
              className="mt-3 overflow-hidden">
              <div className="panel-cut-sm border border-crimson/25 bg-crimson/[0.03] p-4">
                <p className="kicker mb-3">
                  // {aio.presetForm.presetId ? t("settings.aioPresets.editPreset") : t("settings.aioPresets.newPreset")}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("dashboard.aio.customAi.name")}>
                    <input type="text" className={inputCls} placeholder={t("settings.aioPresets.namePlaceholder")}
                      value={aio.presetForm.name}
                      onChange={(e) => aio.setPresetForm({ ...aio.presetForm!, name: e.target.value })} />
                  </Field>
                  <Field label={t("settings.aioPresets.sourceLanguage")}>
                    <select className={selectCls} value={aio.presetForm.sourceLanguage}
                      onChange={(e) => aio.handlePresetSourceLanguageChange(e.target.value)}>
                      {aio.presetLanguageOptions.map((o: AioLanguageOption) => (
                        <option key={o.value} value={normalizeLanguageCode(o.value)}>{t(o.label as any)}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label={t("dashboard.aio.presets.description")} optional>
                    <input type="text" className={inputCls} placeholder={t("settings.aioPresets.shortDescription")}
                      value={aio.presetForm.description}
                      onChange={(e) => aio.setPresetForm({ ...aio.presetForm!, description: e.target.value })} />
                  </Field>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {AIO_STAGE_KEYS.map((k, i) => {
                    const opts = aio.getSelectableStageCatalog(aio.presetForm!.sourceLanguage)[k];
                    const val = opts.some((o: AioStageOption) => o.key === aio.presetForm!.stageModels[k]) ? aio.presetForm!.stageModels[k] : "";
                    return (
                      <div key={k} className="panel-cut-sm relative border border-paper/10 bg-ink/60 p-3">
                        <span aria-hidden className="text-outline pointer-events-none absolute right-2 top-1 select-none font-display text-2xl font-black">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Field label={AIO_STAGE_LABELS[k]}>
                          <select className={selectCls} value={val} disabled={!opts.length}
                            onChange={(e) => aio.setPresetForm({
                              ...aio.presetForm!,
                              stageModels: { ...aio.presetForm!.stageModels, [k]: e.target.value },
                            })}>
                            {!opts.length
                              ? <option value="">{t("aio.model.noneAvailable")}</option>
                              : val === "" ? <option value="" disabled>{t("settings.aioPresets.select")}</option> : null}
                            {opts.map((o: AioStageOption) => <option key={o.key} value={o.key}>{o.name}</option>)}
                          </select>
                        </Field>
                      </div>
                    );
                  })}
                </div>

                <label className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-paper/60">
                  <InkToggle checked={aio.presetForm.setAsActive}
                    onChange={(v) => aio.setPresetForm({ ...aio.presetForm!, setAsActive: v })} />
                  {t("dashboard.aio.presets.setActiveFor")}{" "}
                  <strong className="text-gold">
                    {aio.languageLabelByCode.get(aio.presetForm.sourceLanguage) ?? aio.presetForm.sourceLanguage.toUpperCase()}
                  </strong>
                </label>

                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className={btnGhost} onClick={aio.closePresetForm}>{t("dashboard.aio.presets.cancel")}</button>
                  <button type="button" className={btnPrimary} disabled={!aio.presetForm.name.trim()} onClick={aio.handleSavePreset}>
                    {aio.presetForm.presetId ? t("dashboard.aio.presets.update") : t("dashboard.aio.presets.create")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {aio.groupedPresets.length === 0 ? (
          <div className="mt-4 panel-cut-sm flex flex-col items-center gap-3 border border-dashed border-paper/15 p-8">
            <Sliders size={28} className="text-paper/20" />
            <p className="font-mono text-[10px] uppercase tracking-wider text-paper/35">{t("settings.aioPresets.noneRegistered")}</p>
            <button type="button" className={btnGhost} onClick={aio.openCreatePresetForm}>{t("settings.aioPresets.createFirst")}</button>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {aio.groupedPresets.map((group) => (
              <div key={group.language}>
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="stamp">{group.label}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-paper/35">
                    {t("settings.aioPresets.presetCount", { count: group.presets.length })}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-paper/15 to-transparent" />
                  <button type="button" className={btnGhost} disabled={!group.activePresetId}
                    onClick={() => aio.handleSetActivePreset(group.language, null)}>
                    {t("settings.aioPresets.clearActive")}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {group.presets.map((preset) => {
                    const catalog = aio.getSelectableStageCatalog(group.language);
                    const isActive = group.activePresetId === preset.id;
                    return (
                      <article key={preset.id}
                        className={`panel-cut-sm relative border p-4 transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[filter:drop-shadow(4px_4px_0_rgba(255,200,87,0.6))] ${isActive ? "border-crimson/50 bg-ink-3" : "border-paper/10 bg-ink-2"
                          }`}>
                        {isActive && <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-crimson" />}

                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="flex flex-wrap items-center gap-2 font-display text-sm font-black uppercase tracking-tight text-paper">
                              {preset.name}
                              {isActive && <span className={chip("crimson")}><span className="blink">●</span> {t("settings.aioPresets.active")}</span>}
                            </h4>
                            {preset.description && (
                              <p className="mt-0.5 font-mono text-[10px] text-paper/45">{preset.description}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button type="button" className={btnGhost} disabled={isActive}
                              onClick={() => aio.handleSetActivePreset(group.language, preset.id)}>
                              {t("settings.aioPresets.activate")}
                            </button>
                            <button type="button" className={iconBtn}
                              onClick={() => aio.openEditPresetForm(preset)}
                              aria-label={t("settings.aioPresets.editNamed", { name: preset.name })}>
                              <Pencil size={11} />
                            </button>
                            <button type="button" className={iconBtnDanger}
                              onClick={() => aio.handleDeletePreset(preset.id, preset.name)}
                              aria-label={t("settings.aioPresets.deleteNamed", { name: preset.name })}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Pipeline stages flow */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-paper/8 pt-3">
                          {AIO_STAGE_KEYS.map((k, i) => {
                            const opt = catalog[k].find((o: AioStageOption) => o.key === preset.stageModels[k]);
                            return (
                              <span key={`${preset.id}-${k}`} className="flex items-center gap-1">
                                <span className="panel-cut-sm border border-paper/10 bg-ink/60 px-2 py-1">
                                  <span className="block font-mono text-[7px] uppercase tracking-[0.2em] text-paper/30">{AIO_STAGE_LABELS[k]}</span>
                                  <span className="block max-w-[130px] truncate font-mono text-[10px] font-bold text-paper/80">
                                    {opt?.name ?? preset.stageModels[k]}
                                  </span>
                                </span>
                                {i < AIO_STAGE_KEYS.length - 1 && (
                                  <span aria-hidden className="font-mono text-[10px] text-crimson/60">▸</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Sec>

      {/* ═══════════ 02 · TEXT FILL PALETTE ═══════════ */}
      <Sec icon={<Palette size={14} />} title={t("settings.pickerPalette.title")}
        desc={t("settings.pickerPalette.description")}>
        <div className="space-y-2">
          {textFill.textFillFeedback && <Alert tone="success">{textFill.textFillFeedback}</Alert>}
          {textFill.textFillError && <Alert tone="warn">{textFill.textFillError}</Alert>}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <FillStylePopover
              label={t("settings.pickerPalette.newPreset")}
              value={textFill.textFillDraftValue}
              swatches={swatchList}
              onChange={(v) => {
                textFill.setTextFillDraftValue(v);
                textFill.setTextFillError(null);
                textFill.setTextFillFeedback(null);
              }} />
          </div>
          <button type="button" className={btnPrimary} onClick={textFill.handleAddTextFillSwatch}>
            <Plus size={10} /> {t("settings.pickerPalette.add")}
          </button>
          <button type="button" className={btnGhost} onClick={textFill.handleResetTextFillSwatches}>
            <RotateCcw size={10} /> {t("settings.pickerPalette.reset")}
          </button>
        </div>
        <p className="mt-2 font-mono text-[9px] text-paper/30">
          {t("settings.pickerPalette.hintPrefix")}{" "}
          <code className="text-gold">#B6E84B</code> {t("settings.pickerPalette.hintOr")}{" "}
          <code className="text-gold">linear-gradient(135deg, #B6E84B, #B6E84B)</code>
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {([
            ["solids", t("settings.pickerPalette.solids"), textFill.textFillSwatches.solid, "s"],
            ["gradients", t("settings.pickerPalette.gradients"), textFill.textFillSwatches.gradient, "g"],
          ] as const).map(([id, title, items, prefix]) => (
            <div key={id} className="panel-cut-sm border border-paper/8 bg-ink/40 p-3">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="kicker">// {title}</span>
                <span className={chip("neutral")}>{items.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <SwatchChip key={`${prefix}-${item}`} value={item}
                    onPick={() => textFill.setTextFillDraftValue(item)}
                    onRemove={() => textFill.handleRemoveTextFillSwatch(item)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══════════ 03 · RENDER MODE PRESETS ═══════════ */}
      <Sec icon={<Layout size={14} />} title={t("settings.modePresets.title")}
        desc={t("settings.modePresets.description")}>
        <div className="space-y-2">
          {renderMode.renderModePresetFeedback && <Alert tone="success">{renderMode.renderModePresetFeedback}</Alert>}
          {renderMode.renderModePresetError && <Alert tone="error">{renderMode.renderModePresetError}</Alert>}
        </div>

        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("settings.modePresets.targetMode")}>
              <select className={selectCls} value={rf.mode}
                onChange={(e) => renderMode.handleRenderModePresetModeChange(e.target.value as RenderModePresetMode)}>
                {RENDER_MODE_PRESET_OPTIONS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
              </select>
            </Field>
            <Field label={t("renderPreview.typographyStyle")}>
              <div className="flex flex-wrap items-center gap-2">
                <FontFamilySelect
                  className={`${selectCls} flex-1`}
                  value={rf.style.fontFamily}
                  onChange={(family) => renderMode.handleRenderModePresetFieldChange("fontFamily", family)}
                  families={renderMode.renderModePresetFontOptions}
                  ariaLabel={t("renderPreview.textFont")}
                />
                <StyleToggles t={t} bold={rf.style.bold} italic={rf.style.italic} uppercase={rf.style.uppercase}
                  onToggle={(k, v) => renderMode.handleRenderModePresetFieldChange(k, v)} />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <RangeField label={t("renderPreview.fontSize")} min={6} max={160} step={1}
              value={rf.style.fontSize} display={`${Math.round(rf.style.fontSize)}px`}
              onChange={(v) => renderMode.handleRenderModePresetFieldChange("fontSize", Math.max(6, v))} />
            <RangeField label={t("settings.modePresets.outlineWidth")} min={0} max={10} step={0.25}
              value={rf.style.outlineWidth} display={rf.style.outlineWidth.toFixed(1)}
              disabled={!rf.style.outlineEnabled}
              onChange={(v) => renderMode.handleRenderModePresetFieldChange("outlineWidth", v)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="panel-cut-sm flex items-center justify-between gap-3 border border-paper/10 bg-ink/50 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {t("settings.modePresets.outline")}
              <span className="flex items-center gap-2">
                <span className={rf.style.outlineEnabled ? "text-mint" : "text-paper/30"}>
                  {rf.style.outlineEnabled ? t("renderPreview.enabled") : t("settings.modePresets.off")}
                </span>
                <InkToggle checked={rf.style.outlineEnabled}
                  onChange={(v) => renderMode.handleRenderModePresetFieldChange("outlineEnabled", v)} />
              </span>
            </label>
            <label className="panel-cut-sm flex items-center justify-between gap-3 border border-paper/10 bg-ink/50 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {t("settings.modePresets.ocrGradient")}
              <span className="flex items-center gap-2">
                <span className={rf.style.detectGradient ? "text-azure" : "text-paper/30"}>
                  {rf.style.detectGradient ? t("settings.modePresets.detect") : t("settings.modePresets.ignore")}
                </span>
                <InkToggle checked={rf.style.detectGradient}
                  onChange={(v) => renderMode.handleRenderModePresetFieldChange("detectGradient", v)} />
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <FillStylePopover label={t("settings.modePresets.textColor")}
              value={buildRenderModeColorPickerValue(rf.style)} allowGradient={false}
              swatches={swatchList}
              onChange={(v) => {
                const f = parseFillPickerValue(v, rf.style.color);
                renderMode.handleRenderModePresetFieldChange("color", f.color);
              }} />
            <HexColorPopover label={t("settings.modePresets.outlineColor")}
              value={rf.style.outlineColor} disabled={!rf.style.outlineEnabled}
              onChange={(v) => renderMode.handleRenderModePresetFieldChange("outlineColor", v)} />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-paper/8 pt-4">
            <button type="button" className={btnGhost} onClick={renderMode.handleResetAllRenderModePreset}>
              <RotateCcw size={10} /> {t("settings.modePresets.all")}
            </button>
            <button type="button" className={btnGhost} onClick={renderMode.handleResetRenderModePreset}>
              <RotateCcw size={10} /> {t("settings.modePresets.mode")}
            </button>
            <button type="button" className={btnPrimary} onClick={renderMode.handleSaveRenderModePreset}>
              {t("settings.modePresets.save")}
            </button>
          </div>
        </div>
      </Sec>

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

        <AnimatePresence>
          {tf && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: EASE }}
              className="mt-3 overflow-hidden">
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
            </motion.div>
          )}
        </AnimatePresence>

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
                      <motion.span className="block" animate={{ rotate: isCollapsed ? -90 : 0 }}
                        transition={{ duration: 0.2, ease: EASE }}>
                        <ChevronDown size={13} />
                      </motion.span>
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

                {/* Chapter body */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
                      className="overflow-hidden">
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
                    </motion.div>
                  )}
                </AnimatePresence>
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

export default renderSettingsPresetsTabNoir;
