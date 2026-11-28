import { useEffect, useState } from 'react';
import { Palette, RotateCcw } from 'lucide-react';

import {
  DEFAULT_NOIR_ACCENT_DARK,
  DEFAULT_NOIR_ACCENT_LIGHT,
  NOIR_ACCENT_PRESETS,
  hexToRgb,
  normalizeHexColor,
} from '@koma/ui/themes/noir-accent';
import { useThemeStore } from '@koma/ui/stores/theme-store';

import { useI18n } from '../../i18n';
import { OnbBadge, OnbSection, cx } from './onboardingPrimitives';
import { useOnbSkin } from './onboardingSkin';

export function OnboardingAccentColorSection() {
  const { t } = useI18n();
  const skin = useOnbSkin();

  const theme = useThemeStore((s) => s.theme);
  const family = useThemeStore((s) => s.family);
  const noirAccent = useThemeStore((s) => s.noirAccent);
  const setNoirAccent = useThemeStore((s) => s.setNoirAccent);
  const resetNoirAccent = useThemeStore((s) => s.resetNoirAccent);

  const defaultHex = theme === 'light' ? DEFAULT_NOIR_ACCENT_LIGHT : DEFAULT_NOIR_ACCENT_DARK;
  const activeHex = noirAccent ?? defaultHex;
  const rgb = hexToRgb(activeHex) ?? { r: 255, g: 46, b: 99 };

  const [hexDraft, setHexDraft] = useState(activeHex);

  useEffect(() => {
    setHexDraft(activeHex);
  }, [activeHex]);

  const handleHexInputChange = (value: string) => {
    setHexDraft(value);
    const normalized = normalizeHexColor(value);
    if (normalized) {
      setNoirAccent(normalized);
    }
  };

  const handleHexBlur = () => {
    const normalized = normalizeHexColor(hexDraft);
    if (normalized) {
      setNoirAccent(normalized);
      setHexDraft(normalized);
    } else {
      setHexDraft(activeHex);
    }
  };

  const isNoir = family === 'noir';

  return (
    <OnbSection
      icon={<Palette size={14} />}
      title={t('onboarding.welcome.accentTitle')}
      desc={t('onboarding.welcome.accentDesc')}
      actions={
        isNoir ? (
          <button
            type="button"
            className={skin.btnSmall}
            onClick={resetNoirAccent}
            disabled={noirAccent === null}
          >
            <RotateCcw size={11} aria-hidden="true" />
            {t('settings.theme.noirAccent.reset')}
          </button>
        ) : (
          <OnbBadge tone="neutral">{t('onboarding.welcome.accentNoirOnlyBadge')}</OnbBadge>
        )
      }
    >
      {!isNoir ? (
        <p className={skin.muted}>{t('settings.theme.noirAccent.noirOnlyHint')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={cx(
                'relative flex h-10 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden border',
                skin.noir ? 'panel-cut-sm border-paper/20 bg-ink-2' : 'rounded-lg border-paper/20 bg-ink-2',
              )}
            >
              <input
                type="color"
                aria-label={t('onboarding.welcome.accentTitle')}
                value={activeHex}
                onChange={(e) => setNoirAccent(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span aria-hidden="true" className="h-full w-full" style={{ backgroundColor: activeHex }} />
            </label>

            <input
              type="text"
              value={hexDraft}
              onChange={(e) => handleHexInputChange(e.target.value)}
              onBlur={handleHexBlur}
              spellCheck={false}
              maxLength={7}
              aria-label={t('settings.theme.noirAccent.hexLabel')}
              className={cx(skin.input, 'w-28 uppercase tracking-wider')}
            />

            <span className={skin.mono}>
              rgb({rgb.r}, {rgb.g}, {rgb.b})
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {NOIR_ACCENT_PRESETS.map((preset) => {
              const selected = normalizeHexColor(activeHex) === preset.hex;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setNoirAccent(preset.hex)}
                  aria-label={preset.id}
                  aria-pressed={selected}
                  title={`${preset.id.toUpperCase()} (${preset.hex})`}
                  className={cx(
                    'flex h-8 w-8 items-center justify-center border transition-transform hover:-translate-y-0.5',
                    skin.noir ? 'panel-cut-sm' : 'rounded-lg',
                    selected ? 'border-paper ring-1 ring-paper/60' : 'border-paper/20',
                  )}
                  style={{ backgroundColor: preset.hex }}
                >
                  {selected ? <span aria-hidden="true" className="h-2 w-2 rounded-full border border-ink bg-paper" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </OnbSection>
  );
}
