import { useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@koma/ui/components/popover";
import type { NativeTextEffectPreset, NativeTextEffectPresetId } from "../../typography/textEffects";
import { useI18n } from "../../i18n";

interface TextEffectPopoverProps {
  value: NativeTextEffectPresetId;
  presets: NativeTextEffectPreset[];
  onChange: (value: NativeTextEffectPresetId) => void;
  intensity: number;
  onIntensityChange: (value: number) => void;
}

export const TextEffectPopover = ({
  value,
  presets,
  onChange,
  intensity,
  onIntensityChange,
}: TextEffectPopoverProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activePreset = presets.find((preset) => preset.id === value) ?? presets[0];
  const activePresetClass = activePreset ? `koma-effect-picker__sample--${activePreset.id}` : "";
  const filteredPresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return presets;
    return presets.filter((preset) => (
      t(preset.label as any).toLowerCase().includes(normalizedQuery)
      || t(preset.description as any).toLowerCase().includes(normalizedQuery)
    ));
  }, [presets, query, t]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="koma-color-popover__trigger"
          aria-label={t('dashboard.typography.effect.aria')}
          title={t('dashboard.typography.effect.title')}
        >
          <span className="koma-color-popover__preview koma-color-popover__preview--fx">
            FX
          </span>
          <span className="koma-color-popover__meta">
            <span className="koma-color-popover__label">{t('dashboard.typography.effect.label')}</span>
            <span className={`koma-color-popover__value koma-effect-picker__sample ${activePresetClass}`}>
              {activePreset ? t(activePreset.label as any) : t('dashboard.typography.effect.none')}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="koma-color-popover__content" side="top">
        <div className="koma-color-popover__panel">
          <div className="koma-color-popover__panelHead">
            <div className="koma-color-popover__panelTitle">{t('dashboard.typography.effect.panelTitle')}</div>
            <div className="koma-color-popover__panelHint">{t('dashboard.typography.effect.panelHint')}</div>
          </div>
          <div className="koma-effect-picker__searchWrap">
            <input
              type="text"
              className="koma-effect-picker__search"
              placeholder={t('dashboard.typography.effect.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {activePreset?.supportsIntensity && activePreset.id !== "none" && (
            <div className="koma-effect-picker__intensity">
              <div className="koma-effect-picker__intensityHead">
                <span>{t('dashboard.typography.effect.intensity')}</span>
                <strong>{intensity.toFixed(2)}x</strong>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={intensity}
                onChange={(event) => onIntensityChange(Number(event.target.value))}
              />
            </div>
          )}
          <div className="koma-effect-picker__list">
            {filteredPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`koma-effect-picker__item ${preset.id === value ? "koma-effect-picker__item--active" : ""}`}
                onClick={() => {
                  onChange(preset.id);
                  setOpen(false);
                }}
              >
                <span className={`koma-effect-picker__title koma-effect-picker__sample koma-effect-picker__sample--${preset.id}`}>
                  {t(preset.label as any)}
                </span>
                <span className="koma-effect-picker__desc">{t(preset.description as any)}</span>
              </button>
            ))}
            {filteredPresets.length === 0 && (
              <div className="koma-effect-picker__empty">{t('dashboard.typography.effect.noResults')}</div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
