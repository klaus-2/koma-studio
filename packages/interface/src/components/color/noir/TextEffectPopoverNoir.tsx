'use client';

import { useMemo, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@koma/ui/components/popover';
import type { NativeTextEffectPreset, NativeTextEffectPresetId } from '../../../typography/textEffects';
import { useI18n } from '../../../i18n';
import { PopoverChip, PopoverPanel } from '../noir-popover';

interface TextEffectPopoverProps {
  value: NativeTextEffectPresetId;
  presets: NativeTextEffectPreset[];
  onChange: (value: NativeTextEffectPresetId) => void;
  intensity: number;
  onIntensityChange: (value: number) => void;
}

export const TextEffectPopoverNoir = ({
  value,
  presets,
  onChange,
  intensity,
  onIntensityChange,
}: TextEffectPopoverProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const activePreset = presets.find((preset) => preset.id === value) ?? presets[0];
  const activePresetClass = activePreset ? `koma-effect-picker__sample--${activePreset.id}` : '';
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
        <PopoverChip
          label={t('dashboard.typography.effect.label')}
          value={activePreset ? t(activePreset.label as any) : t('dashboard.typography.effect.none')}
          previewText="FX"
          aria-label={t('dashboard.typography.effect.aria')}
          title={t('dashboard.typography.effect.title')}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[320px]" side="top">
        <PopoverPanel
          title={t('dashboard.typography.effect.panelTitle')}
          hint={t('dashboard.typography.effect.panelHint')}
        >
          <input
            type="text"
            className="noir-input"
            placeholder={t('dashboard.typography.effect.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {activePreset?.supportsIntensity && activePreset.id !== 'none' && (
            <div className="flex flex-col gap-1.5 border border-paper/10 bg-ink/50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/70">
                  {t('dashboard.typography.effect.intensity')}
                </span>
                <strong className="font-mono text-[10px] text-gold">{intensity.toFixed(2)}x</strong>
              </div>
              <input
                type="range"
                className="noir-slider"
                min={0}
                max={2}
                step={0.05}
                value={intensity}
                onChange={(event) => onIntensityChange(Number(event.target.value))}
              />
            </div>
          )}
          <div className="noir-scroll flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {filteredPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`flex flex-col gap-0.5 border-l-2 px-2.5 py-2 text-left transition-colors ${preset.id === value
                    ? 'border-l-crimson bg-crimson/10'
                    : 'border-l-transparent hover:bg-paper/5'
                  }`}
                onClick={() => {
                  onChange(preset.id);
                  setOpen(false);
                }}
              >
                <span className={`font-display text-[11px] font-bold text-paper ${activePresetClass}`}>
                  {t(preset.label as any)}
                </span>
                <span className="truncate text-[9px] text-paper/40">{t(preset.description as any)}</span>
              </button>
            ))}
            {filteredPresets.length === 0 && (
              <div className="px-1 py-2 font-mono text-[10px] text-paper/40">
                {t('dashboard.typography.effect.noResults')}
              </div>
            )}
          </div>
        </PopoverPanel>
      </PopoverContent>
    </Popover>
  );
};
