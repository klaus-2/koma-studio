'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@koma/ui/components/popover';
import type { NativeTextEffectPreset, NativeTextEffectPresetId } from '../../../typography/textEffects';
import { useI18n } from '../../../i18n';
import { PopoverChip, PopoverPanel } from '../noir-popover';
import { TextEffectPreviewThumb } from '../TextEffectPreviewThumb';
import { TEXT_EFFECT_CATEGORY_TABS, useTextEffectPicker } from '../useTextEffectPicker';

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

  const hasActiveEffect = Boolean(activePreset && activePreset.id !== 'none');

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <PopoverChip
          label={t('dashboard.typography.effect.label')}
          value={activePreset ? t(activePreset.label) : t('dashboard.typography.effect.none')}
          previewText="FX"
          previewStyle={hasActiveEffect ? { backgroundColor: '#faf9f6' } : undefined}
          previewSlot={
            hasActiveEffect && activePreset ? (
              <TextEffectPreviewThumb
                presetId={activePreset.id}
                fallbackText="FX"
                width={26}
                height={26}
                intensity={intensity}
              />
            ) : undefined
          }
          aria-label={t('dashboard.typography.effect.aria')}
          title={t('dashboard.typography.effect.title')}
          data-testid="text-effect-trigger"
        />
      </PopoverTrigger>
      <PopoverContent className="w-[368px] max-w-[calc(100vw-24px)]" side="top">
        <PopoverPanel
          title={t('dashboard.typography.effect.panelTitle')}
          hint={t('dashboard.typography.effect.panelHint')}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="noir-input flex-1"
              placeholder={t('dashboard.typography.effect.searchPlaceholder')}
              aria-label={t('dashboard.typography.effect.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {hasActiveEffect && (
              <button
                type="button"
                onClick={handleClearEffect}
                data-testid="text-effect-clear"
                className="panel-cut-sm shrink-0 border border-crimson/40 bg-crimson/15 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-crimson/30"
              >
                {t('dashboard.typography.effect.clear')}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1" role="tablist" aria-label={t('dashboard.typography.effect.panelTitle')}>
            {TEXT_EFFECT_CATEGORY_TABS.map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(tab.id)}
                  className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${
                    active
                      ? 'border-crimson bg-crimson/20 text-paper'
                      : 'border-paper/15 bg-ink/50 text-paper/60 hover:border-paper/30 hover:text-paper'
                  }`}
                >
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>

          {activePreset?.supportsIntensity && activePreset.id !== 'none' && (
            <div className="flex flex-col gap-1.5 border border-paper/10 bg-ink/50 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/70">
                  {t('dashboard.typography.effect.intensity')}
                </span>
                <button
                  type="button"
                  title={t('dashboard.typography.effect.resetIntensity')}
                  onDoubleClick={() => onIntensityChange(1)}
                  className="font-mono text-[10px] font-bold text-gold"
                >
                  {intensity.toFixed(2)}x
                </button>
              </div>
              <input
                type="range"
                aria-label={t('dashboard.typography.effect.intensity')}
                className="noir-slider"
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
              className={`flex items-center gap-2.5 border px-2.5 py-2 text-left transition-colors ${
                value === 'none'
                  ? 'border-crimson bg-crimson/15'
                  : 'border-paper/12 bg-ink/50 hover:border-paper/25 hover:bg-paper/5'
              }`}
              onClick={() => handleSelectPreset('none', true)}
              onMouseEnter={() => handlePreviewEnter('none')}
              onMouseLeave={handlePreviewLeave}
              onFocus={() => handlePreviewEnter('none')}
              onBlur={handlePreviewLeave}
            >
              <span className="grid h-7 w-10 shrink-0 place-items-center border border-paper/15 bg-[#faf9f6] font-display text-[11px] font-black text-[#1f2430]">
                Aa
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[11px] font-bold text-paper">
                  {t(nonePreset.label)}
                </span>
                <span className="block truncate text-[9px] text-paper/50">
                  {t('dashboard.typography.effect.restoreOriginal')}
                </span>
              </span>
            </button>
          )}

          <div
            ref={gridRef}
            className="noir-scroll grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5"
            role="listbox"
            aria-label={t('dashboard.typography.effect.panelTitle')}
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
                  className={`flex flex-col overflow-hidden border text-left transition-colors ${
                    selected
                      ? 'border-crimson bg-crimson/15'
                      : 'border-paper/12 bg-ink/60 hover:border-paper/30'
                  }`}
                  onClick={() => handleSelectPreset(preset.id, false)}
                  onDoubleClick={() => handleSelectPreset(preset.id, true)}
                  onMouseEnter={() => handlePreviewEnter(preset.id)}
                  onMouseLeave={handlePreviewLeave}
                  onFocus={() => handlePreviewEnter(preset.id)}
                  onBlur={handlePreviewLeave}
                >
                  <span className="flex h-[46px] w-full shrink-0 items-center justify-center overflow-hidden bg-[#faf9f6] px-1">
                    <TextEffectPreviewThumb
                      presetId={preset.id}
                      fallbackText={preset.sampleText}
                      width={148}
                      height={44}
                      intensity={selected ? intensity : 1}
                    />
                  </span>
                  <span className="flex flex-col gap-0.5 px-2 py-1.5">
                    <span className="truncate font-display text-[10px] font-bold text-paper">
                      {t(preset.label)}
                    </span>
                    <span className="truncate text-[9px] text-paper/45">
                      {t(preset.description)}
                    </span>
                  </span>
                </button>
              );
            })}
            {effectPresets.length === 0 && (
              <div className="col-span-2 px-2 py-3 text-center font-mono text-[10px] text-paper/40">
                {t('dashboard.typography.effect.noResults')}
              </div>
            )}
          </div>
        </PopoverPanel>
      </PopoverContent>
    </Popover>
  );
};
