import {
  ArrowRight,
  Globe2,
  Layers,
  Monitor,
  Moon,
  Palette,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useThemeStore, type KomaTheme } from '@koma/ui/stores/theme-store';
import { THEME_FAMILIES } from '@koma/ui/themes/registry';
import { UI_SCALE_OPTIONS, useUiScaleStore } from '@koma/ui/stores/ui-scale-store';

import { useI18n } from '../../../i18n';
import type { AppLocale } from '../../../i18n/config';
import {
  OnboardingBadge,
  OnboardingSectionCard,
  OnboardingSelect,
  OnboardingToggleRow,
} from '../onboardingPrimitives';

const PIPELINE_KEYS = [
  'aio.stage.detectText',
  'aio.stage.recognizeText',
  'aio.stage.getTranslations',
  'aio.stage.segmentText',
  'aio.stage.cleanImage',
  'aio.stage.render',
] as const;

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

  const localeOptions = supportedLocales.map((loc) => ({
    value: loc,
    label: localeLabels[loc],
  }));

  return (
    <div className="koma-onb-stepStack">

      <OnboardingSectionCard tone="accent" className="koma-onb-heroCard">
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
            {PIPELINE_KEYS.map((stageKey, idx) => (
              <span key={stageKey} className="koma-onb-flowItem">
                <span className="koma-onb-flowChip">
                  <span className="koma-onb-flowChip__idx">{idx + 1}</span>
                  <span>{t(stageKey)}</span>
                </span>
                {idx < PIPELINE_KEYS.length - 1 && (
                  <ArrowRight size={11} className="koma-onb-flowArrow" aria-hidden="true" />
                )}
              </span>
            ))}
          </div>
        </div>
      </OnboardingSectionCard>

      <div className="koma-onb-grid2">
        <OnboardingSectionCard>
          <div className="koma-onb-cardHead">
            <span className="koma-onb-iconTile" aria-hidden="true">
              <Palette size={14} />
            </span>
            <div>
              <span className="koma-onb-cardTitle">{t('onboarding.welcome.familyTitle')}</span>
              <p className="koma-onb-muted">{t('onboarding.welcome.familyDesc')}</p>
            </div>
          </div>

          <div className="koma-onb-choiceGrid">
            {THEME_FAMILIES.map((family) => {
              const active = currentFamily === family.id;
              return (
                <button
                  key={family.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCurrentFamily(family.id)}
                  className={`koma-onb-themeCard ${active ? 'koma-onb-themeCard--active' : ''}`}
                >

                  <span
                    className={`koma-onb-skinSwatch koma-onb-skinSwatch--${family.id}`}
                    aria-hidden="true"
                  >
                    <span className="koma-onb-skinSwatch__bar" />
                    <span className="koma-onb-skinSwatch__glyph">{family.glyph}</span>
                    <span className="koma-onb-skinSwatch__dots">
                      <i />
                      <i />
                      <i />
                    </span>
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
            <span className="koma-onb-iconTile" aria-hidden="true">
              <Monitor size={14} />
            </span>
            <div>
              <span className="koma-onb-cardTitle">{t('onboarding.welcome.themeTitle')}</span>
              <p className="koma-onb-muted">{t('onboarding.welcome.themeDesc')}</p>
            </div>
          </div>

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
                  className={`koma-onb-themeCard ${active ? 'koma-onb-themeCard--active' : ''}`}
                >
                  <span
                    className={`koma-onb-modeSwatch koma-onb-modeSwatch--${opt.id}`}
                    aria-hidden="true"
                  >
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

      <div className="koma-onb-grid2">
        <OnboardingSectionCard>
          <div className="koma-onb-cardHead">
            <span className="koma-onb-iconTile" aria-hidden="true">
              <Globe2 size={14} />
            </span>
            <div>
              <label htmlFor="koma-onb-locale-select" className="koma-onb-cardTitle">
                {t('onboarding.welcome.languageTitle')}
              </label>
              <p className="koma-onb-muted">{t('onboarding.welcome.languageDesc')}</p>
            </div>
          </div>
          <div className="koma-onb-mtSm">
            <OnboardingSelect
              id="koma-onb-locale-select"
              value={locale}
              options={localeOptions}
              onChange={(val) => setLocale(val as AppLocale)}
            />
          </div>
        </OnboardingSectionCard>

        <OnboardingSectionCard>
          <div className="koma-onb-cardHead">
            <span className="koma-onb-iconTile" aria-hidden="true">
              <Layers size={14} />
            </span>
            <div>
              <span className="koma-onb-cardTitle">{t('onboarding.welcome.scaleTitle')}</span>
              <p className="koma-onb-muted">{t('onboarding.welcome.scaleDesc')}</p>
            </div>
          </div>
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
          <div className="koma-onb-mtSm koma-onb-dividerTop">
            <OnboardingToggleRow
              title={t('settings.uiScale.compactTitle')}
              description={t('settings.uiScale.compactDesc')}
              checked={compactDensity}
              onChange={setCompactDensity}
            />
          </div>
        </OnboardingSectionCard>
      </div>
    </div>
  );
}
