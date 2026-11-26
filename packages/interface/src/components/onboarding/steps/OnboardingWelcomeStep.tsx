import { Globe2, Layers, Monitor, Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { useThemeStore, type KomaTheme } from '@koma/ui/stores/theme-store';
import { THEME_FAMILIES } from '@koma/ui/themes/registry';
import { UI_SCALE_OPTIONS, useUiScaleStore } from '@koma/ui/stores/ui-scale-store';

import { useI18n } from '../../../i18n';
import type { AppLocale } from '../../../i18n/config';
import {
  OnboardingBadge,
  OnboardingSectionCard,
  OnboardingToggleRow,
} from '../onboardingPrimitives';

export function OnboardingWelcomeStep() {
  const { locale, localeLabels, setLocale, supportedLocales, t } = useI18n();
  const currentTheme = useThemeStore((s) => s.theme);
  const setCurrentTheme = useThemeStore((s) => s.setTheme);
  const currentFamily = useThemeStore((s) => s.family);
  const setCurrentFamily = useThemeStore((s) => s.setFamily);
  const uiScale = useUiScaleStore((s) => s.uiScale);
  const setUiScale = useUiScaleStore((s) => s.setUiScale);
  const compactDensity = useUiScaleStore((s) => s.compactDensity);
  const setCompactDensity = useUiScaleStore((s) => s.setCompactDensity);

  return (
    <div className="koma-onb-stepStack">
      <OnboardingSectionCard tone="accent">
        <div className="koma-onb-hero">
          <div className="koma-onb-hero__copy">
            <div className="koma-onb-eyebrowRow">
              <OnboardingBadge tone="accent">
                <Sparkles size={11} />
                {t('onboarding.welcome.badge')}
              </OnboardingBadge>
            </div>
            <h3 className="koma-onb-heading">{t('onboarding.welcome.heroTitle')}</h3>
            <p className="koma-onb-lead">{t('onboarding.welcome.heroBody')}</p>
          </div>
          <div className="koma-onb-flowStrip" aria-label={t('onboarding.welcome.pipelineAria')}>
            {(
              [
                'aio.stage.detectText',
                'aio.stage.recognizeText',
                'aio.stage.getTranslations',
                'aio.stage.segmentText',
                'aio.stage.cleanImage',
                'aio.stage.render',
              ] as const
            ).map((stageKey) => (
              <span key={stageKey} className="koma-onb-flowChip">
                {t(stageKey)}
              </span>
            ))}
          </div>
        </div>
      </OnboardingSectionCard>

      <div className="koma-onb-grid2">
        <OnboardingSectionCard>
          <div className="koma-onb-cardHead">
            <Globe2 size={15} />
            <label htmlFor="koma-onb-locale-select" className="koma-onb-cardTitle">
              {t('onboarding.welcome.languageTitle')}
            </label>
          </div>
          <p className="koma-onb-muted">{t('onboarding.welcome.languageDesc')}</p>
          <select
            id="koma-onb-locale-select"
            className="koma-onb-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as AppLocale)}
          >
            {supportedLocales.map((loc) => (
              <option key={loc} value={loc}>
                {localeLabels[loc]}
              </option>
            ))}
          </select>
        </OnboardingSectionCard>

        <OnboardingSectionCard>
          <div className="koma-onb-cardHead">
            <Layers size={15} />
            <span className="koma-onb-cardTitle">{t('onboarding.welcome.scaleTitle')}</span>
          </div>
          <p className="koma-onb-muted">{t('onboarding.welcome.scaleDesc')}</p>
          <div className="koma-onb-pillRow" role="group" aria-label={t('onboarding.welcome.scaleTitle')}>
            {UI_SCALE_OPTIONS.map((scale) => {
              const active = uiScale === scale;
              return (
                <button
                  key={scale}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setUiScale(scale)}
                  className={`koma-onb-pillBtn ${active ? 'koma-onb-pillBtn--active' : ''}`}
                >
                  {Math.round(scale * 100)}%
                </button>
              );
            })}
          </div>
          <div className="koma-onb-mtSm">
            <OnboardingToggleRow
              title={t('settings.uiScale.compactTitle')}
              description={t('settings.uiScale.compactDesc')}
              checked={compactDensity}
              onChange={setCompactDensity}
            />
          </div>
        </OnboardingSectionCard>
      </div>

      <div className="koma-onb-grid2">
        <OnboardingSectionCard>
          <div className="koma-onb-cardHead">
            <Palette size={15} />
            <span className="koma-onb-cardTitle">{t('onboarding.welcome.familyTitle')}</span>
          </div>
          <p className="koma-onb-muted">{t('onboarding.welcome.familyDesc')}</p>
          <div className="koma-onb-choiceGrid">
            {THEME_FAMILIES.map((family) => {
              const active = currentFamily === family.id;
              return (
                <button
                  key={family.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCurrentFamily(family.id)}
                  className={`koma-onb-choiceCard ${active ? 'koma-onb-choiceCard--active' : ''}`}
                >
                  <span className="koma-onb-choiceGlyph" aria-hidden="true">
                    {family.glyph}
                  </span>
                  <span className="koma-onb-choiceCopy">
                    <span className="koma-onb-choiceName">{t(family.nameKey)}</span>
                    <span className="koma-onb-choiceDesc">{t(family.descKey)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </OnboardingSectionCard>

        <OnboardingSectionCard>
          <div className="koma-onb-cardHead">
            <Monitor size={15} />
            <span className="koma-onb-cardTitle">{t('onboarding.welcome.themeTitle')}</span>
          </div>
          <p className="koma-onb-muted">{t('onboarding.welcome.themeDesc')}</p>
          <div className="koma-onb-choiceGrid">
            {(
              [
                {
                  id: 'dark' as KomaTheme,
                  Icon: Moon,
                  nameKey: 'settings.theme.dark',
                  descKey: 'settings.theme.darkDesc',
                },
                {
                  id: 'light' as KomaTheme,
                  Icon: Sun,
                  nameKey: 'settings.theme.light',
                  descKey: 'settings.theme.lightDesc',
                },
              ] as const
            ).map((opt) => {
              const active = currentTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCurrentTheme(opt.id)}
                  className={`koma-onb-choiceCard ${active ? 'koma-onb-choiceCard--active' : ''}`}
                >
                  <span className="koma-onb-choiceIcon" aria-hidden="true">
                    <opt.Icon size={16} />
                  </span>
                  <span className="koma-onb-choiceCopy">
                    <span className="koma-onb-choiceName">{t(opt.nameKey)}</span>
                    <span className="koma-onb-choiceDesc">{t(opt.descKey)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </OnboardingSectionCard>
      </div>
    </div>
  );
}
