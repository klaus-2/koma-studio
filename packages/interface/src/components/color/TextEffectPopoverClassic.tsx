import { memo } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@koma/ui/components/popover";
import type { NativeTextEffectPreset, NativeTextEffectPresetId } from "../../typography/textEffects";
import { useI18n } from "../../i18n";
import { TextEffectPreviewThumb } from "./TextEffectPreviewThumb";
import { TEXT_EFFECT_CATEGORY_TABS, useTextEffectPicker } from "./useTextEffectPicker";

interface TextEffectPopoverProps {
  value: NativeTextEffectPresetId;
  presets: NativeTextEffectPreset[];
  onChange: (value: NativeTextEffectPresetId) => void;
  intensity: number;
  onIntensityChange: (value: number) => void;
}

export const TextEffectPopoverClassic = memo(function TextEffectPopover({
  value,
  presets,
  onChange,
  intensity,
  onIntensityChange,
}: TextEffectPopoverProps) {
  const { t } = useI18n();
  const {
    open,
    query,
    setQuery,
    category,
    setCategory,
    nonePreset,
    activePreset,
    effectPresets,
    gridRef,
    handleOpenChange,
    handleSelectPreset,
    handleClearEffect,
    handlePreviewEnter,
    handlePreviewLeave,
    handleGridKeyDown,
  } = useTextEffectPicker({
    value,
    presets,
    translate: t,
    onChange,
  });

  const hasActiveEffect = Boolean(activePreset && activePreset.id !== "none");

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="koma-color-popover__trigger"
          aria-label={t("dashboard.typography.effect.aria")}
          title={t("dashboard.typography.effect.title")}
          data-testid="text-effect-trigger"
        >
          <span
            className={`koma-color-popover__preview koma-color-popover__preview--fx ${hasActiveEffect ? "koma-effect-picker__triggerThumb" : ""}`}
          >
            {hasActiveEffect && activePreset ? (
              <TextEffectPreviewThumb
                presetId={activePreset.id}
                fallbackText="FX"
                width={36}
                height={24}
                intensity={intensity}
              />
            ) : (
              "FX"
            )}
          </span>
          <span className="koma-color-popover__meta">
            <span className="koma-color-popover__label">
              {t("dashboard.typography.effect.label")}
            </span>
            <span className="koma-color-popover__value">
              {activePreset ? t(activePreset.label) : t("dashboard.typography.effect.none")}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="koma-color-popover__content koma-effect-popover__content" side="top">
        <div className="koma-color-popover__panel">
          <div className="koma-color-popover__panelHead">
            <div className="koma-effect-picker__headRow">
              <div>
                <div className="koma-color-popover__panelTitle">
                  {t("dashboard.typography.effect.panelTitle")}
                </div>
                <div className="koma-color-popover__panelHint">
                  {t("dashboard.typography.effect.panelHint")}
                </div>
              </div>
              {hasActiveEffect && (
                <button
                  type="button"
                  className="koma-effect-picker__clearBtn"
                  onClick={handleClearEffect}
                  data-testid="text-effect-clear"
                >
                  {t("dashboard.typography.effect.clear")}
                </button>
              )}
            </div>
          </div>

          <div className="koma-effect-picker__searchWrap">
            <input
              type="text"
              className="koma-effect-picker__search"
              placeholder={t("dashboard.typography.effect.searchPlaceholder")}
              aria-label={t("dashboard.typography.effect.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="koma-effect-picker__tabs" role="tablist" aria-label={t("dashboard.typography.effect.panelTitle")}>
            {TEXT_EFFECT_CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={category === tab.id}
                className={`koma-effect-picker__tab ${category === tab.id ? "koma-effect-picker__tab--active" : ""}`}
                onClick={() => setCategory(tab.id)}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {activePreset?.supportsIntensity && activePreset.id !== "none" && (
            <div className="koma-effect-picker__intensity">
              <div className="koma-effect-picker__intensityHead">
                <span>{t("dashboard.typography.effect.intensity")}</span>
                <button
                  type="button"
                  className="koma-effect-picker__intensityReset"
                  title={t("dashboard.typography.effect.resetIntensity")}
                  onDoubleClick={() => onIntensityChange(1)}
                >
                  {intensity.toFixed(2)}x
                </button>
              </div>
              <input
                type="range"
                aria-label={t("dashboard.typography.effect.intensity")}
                min={0}
                max={2}
                step={0.05}
                value={intensity}
                onChange={(event) => onIntensityChange(Number(event.target.value))}
              />
            </div>
          )}

          {nonePreset && (
            <button
              type="button"
              data-effect-id="none"
              className={`koma-effect-picker__noneCard ${value === "none" ? "koma-effect-picker__item--active" : ""}`}
              onClick={() => handleSelectPreset("none", true)}
              onMouseEnter={() => handlePreviewEnter("none")}
              onMouseLeave={handlePreviewLeave}
              onFocus={() => handlePreviewEnter("none")}
              onBlur={handlePreviewLeave}
            >
              <span className="koma-effect-picker__noneBadge">Aa</span>
              <span className="koma-effect-picker__noneMeta">
                <span className="koma-effect-picker__title">{t(nonePreset.label)}</span>
                <span className="koma-effect-picker__desc">
                  {t("dashboard.typography.effect.restoreOriginal")}
                </span>
              </span>
            </button>
          )}

          <div
            ref={gridRef}
            className="koma-effect-picker__grid"
            role="listbox"
            aria-label={t("dashboard.typography.effect.panelTitle")}
            onKeyDown={handleGridKeyDown}
          >
            {effectPresets.map((preset) => {
              const selected = preset.id === value;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-effect-id={preset.id}
                  title={t(preset.description)}
                  className={`koma-effect-picker__card ${selected ? "koma-effect-picker__item--active" : ""}`}
                  onClick={() => handleSelectPreset(preset.id, false)}
                  onDoubleClick={() => handleSelectPreset(preset.id, true)}
                  onMouseEnter={() => handlePreviewEnter(preset.id)}
                  onMouseLeave={handlePreviewLeave}
                  onFocus={() => handlePreviewEnter(preset.id)}
                  onBlur={handlePreviewLeave}
                >
                  <span className="koma-effect-picker__stage">
                    <TextEffectPreviewThumb
                      presetId={preset.id}
                      fallbackText={preset.sampleText}
                      width={148}
                      height={46}
                      intensity={selected ? intensity : 1}
                    />
                  </span>
                  <span className="koma-effect-picker__cardMeta">
                    <span className="koma-effect-picker__title">{t(preset.label)}</span>
                    <span className="koma-effect-picker__desc">{t(preset.description)}</span>
                  </span>
                </button>
              );
            })}
            {effectPresets.length === 0 && (
              <div className="koma-effect-picker__empty">
                {t("dashboard.typography.effect.noResults")}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
