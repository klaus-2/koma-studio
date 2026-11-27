import { useId } from 'react';
import { Globe2, Layers, Monitor, Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { useThemeStore, type KomaTheme } from '@koma/ui/stores/theme-store';
import { THEME_FAMILIES } from '@koma/ui/themes/registry';
import { UI_SCALE_OPTIONS, useUiScaleStore } from '@koma/ui/stores/ui-scale-store';

import { useI18n } from '../../../i18n';
import type { AppLocale } from '../../../i18n/config';
import {
  OnbField,
  OnbNotice,
  OnbSection,
  OnbSelect,
  OnbToggleRow,
  cx,
  type OnbOption,
} from '../onboardingPrimitives';
import { OnbChoiceGroup, OnbSegmented } from '../onboardingChoiceControls';
import { useOnbSkin } from '../onboardingSkin';

const NOIR_SWATCH: Record<string, string> = {
  noir: 'bg-gradient-to-br from-ink via-ink to-crimson/70 text-paper',
  classic: 'bg-gradient-to-br from-ink via-ink to-[#a855f7]/70 text-paper',
};

export function OnboardingWelcomeStep() {
  const { locale, localeLabels, setLocale, supportedLocales, t } = useI18n();
  const skin = useOnbSkin();
  const familyTitleId = useId();
  const modeLabelId = useId();
  const scaleLabelId = useId();

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const family = useThemeStore((s) => s.family);
  const setFamily = useThemeStore((s) => s.setFamily);
  const uiScale = useUiScaleStore((s) => s.uiScale);
  const setUiScale = useUiScaleStore((s) => s.setUiScale);
  const compactDensity = useUiScaleStore((s) => s.compactDensity);
  const setCompactDensity = useUiScaleStore((s) => s.setCompactDensity);

  const familyOptions = THEME_FAMILIES.map((entry) => ({
    value: entry.id,
    title: t(entry.nameKey),
    desc: t(entry.descKey),
    media: (
      <span
        aria-hidden="true"
        className={
          skin.noir
            ? cx(
                'panel-cut-sm grid h-10 w-12 shrink-0 place-items-center border border-paper/15 font-display text-xs font-black',
                NOIR_SWATCH[entry.id],
              )
            : `koma-stg-theme__preview koma-stg-theme__preview--${entry.id}`
        }
      >
        {entry.glyph}
      </span>
    ),
  }));

  const modeOptions: readonly OnbOption<KomaTheme>[] = [
    { value: 'dark', label: t('settings.theme.dark'), icon: <Moon size={13} aria-hidden="true" /> },
    { value: 'light', label: t('settings.theme.light'), icon: <Sun size={13} aria-hidden="true" /> },
  ];

  const scaleOptions = UI_SCALE_OPTIONS.map((scale) => ({
    value: scale,
    label: `${Math.round(scale * 100)}%`,
  }));

  const localeOptions = supportedLocales.map((entry) => ({
    value: entry,
    label: localeLabels[entry],
  }));

  return (
    <div className="flex flex-col gap-4">
      <OnbNotice tone="info">
        <Sparkles size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <strong className="block">{t('onboarding.welcome.heroTitle')}</strong>
          {t('onboarding.welcome.liveHint')}
        </span>
      </OnbNotice>

      <OnbSection
        icon={<Palette size={14} />}
        title={t('onboarding.welcome.familyTitle')}
        desc={t('onboarding.welcome.familyDesc')}
        titleId={familyTitleId}
      >
        <OnbChoiceGroup
          labelledBy={familyTitleId}
          value={family}
          options={familyOptions}
          onChange={setFamily}
        />
      </OnbSection>

      <div className="grid gap-4 md:grid-cols-2">
        <OnbSection
          icon={<Monitor size={14} />}
          title={t('onboarding.welcome.themeTitle')}
          desc={t('onboarding.welcome.themeDesc')}
        >
          <OnbField label={t('onboarding.welcome.themeTitle')} labelId={modeLabelId}>
            <OnbSegmented labelledBy={modeLabelId} value={theme} options={modeOptions} onChange={setTheme} />
          </OnbField>
        </OnbSection>

        <OnbSection
          icon={<Globe2 size={14} />}
          title={t('onboarding.welcome.languageTitle')}
          desc={t('onboarding.welcome.languageDesc')}
        >
          <OnbField label={t('onboarding.welcome.languageTitle')} htmlFor="koma-onb-locale-select">
            <OnbSelect
              id="koma-onb-locale-select"
              value={locale}
              options={localeOptions}
              onChange={(value) => setLocale(value as AppLocale)}
            />
          </OnbField>
        </OnbSection>
      </div>

      <OnbSection
        icon={<Layers size={14} />}
        title={t('onboarding.welcome.scaleTitle')}
        desc={t('onboarding.welcome.scaleDesc')}
      >
        <div className="flex flex-col gap-3">
          <OnbField label={t('onboarding.welcome.scaleTitle')} labelId={scaleLabelId}>
            <OnbSegmented labelledBy={scaleLabelId} value={uiScale} options={scaleOptions} onChange={setUiScale} />
          </OnbField>
          <OnbToggleRow
            title={t('settings.uiScale.compactTitle')}
            desc={t('settings.uiScale.compactDesc')}
            checked={compactDensity}
            onChange={setCompactDensity}
          />
        </div>
      </OnbSection>
    </div>
  );
}
