import { useState, type MouseEvent } from 'react';
import { CheckCircle2, Compass, Pencil, Play, Star } from 'lucide-react';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { THEME_FAMILIES } from '@koma/ui/themes/registry';

import { useI18n } from '../../../i18n';
import { useModelManagerLiveState } from '../../../hooks/useModelManager';
import { useAioPipelineStore } from '../../../pages/dashboard/stores/aio-pipeline-store';
import { KomaNekoActor } from '../../koma-mascot/KomaNekoActor';
import { OnbBadge, OnbCheckbox, OnbSection, cx } from '../onboardingPrimitives';
import { useOnbSkin } from '../onboardingSkin';
import { KOMA_GITHUB_REPO_URL, type OnboardingStepId } from '../onboardingSteps';

export interface OnboardingFinishStepProps {
  githubUrl?: string;
  onOpenExternalUrl: (event: MouseEvent<HTMLElement>, url: string) => void | Promise<void>;
  onFinishAndStartTour: () => void;
  onFinishOnly: () => void;
  onEditStep?: (stepId: OnboardingStepId) => void;
}

export function OnboardingFinishStep({
  githubUrl = KOMA_GITHUB_REPO_URL,
  onOpenExternalUrl,
  onFinishAndStartTour,
  onFinishOnly,
  onEditStep,
}: OnboardingFinishStepProps) {
  const { locale, localeLabels, t } = useI18n();
  const skin = useOnbSkin();
  const theme = useThemeStore((s) => s.theme);
  const family = useThemeStore((s) => s.family);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const { entries } = useModelManagerLiveState();
  const [starred, setStarred] = useState(false);
  const [startTour, setStartTour] = useState(true);

  const list = Object.values(entries);
  const installed = list.filter((e) => e.status === 'installed' || e.status === 'update_available').length;
  const active = list.filter((e) => e.status === 'downloading' || e.status === 'queued' || e.status === 'verifying').length;
  const familyEntry = THEME_FAMILIES.find((entry) => entry.id === family);
  const themeLabel = t(theme === 'light' ? 'settings.theme.light' : 'settings.theme.dark');

  const summary: readonly { label: string; value: string; step: OnboardingStepId; tone?: 'warn' }[] = [
    { label: t('onboarding.finish.labelLanguage'), value: localeLabels[locale], step: 'welcome' },
    {
      label: t('onboarding.finish.labelAppearance'),
      value: `${familyEntry ? t(familyEntry.nameKey) : family} · ${themeLabel}`,
      step: 'welcome',
    },
    { label: t('onboarding.finish.labelPair'), value: `${aioSrcLang.toUpperCase()} → ${aioTgtLang.toUpperCase()}`, step: 'install-models' },
    {
      label: t('onboarding.finish.labelModels'),
      value:
        active > 0
          ? t('onboarding.finish.modelsWithActive', { installed, active })
          : t('onboarding.finish.modelsInstalled', { installed }),
      step: 'install-models',
      tone: installed === 0 && active === 0 ? 'warn' : undefined,
    },
  ];

  const handleStar = (event: MouseEvent<HTMLAnchorElement>): void => {
    setStarred(true);
    void onOpenExternalUrl(event, githubUrl);
  };

  return (
    <div className="flex flex-col gap-4">
      <OnbSection
        icon={<CheckCircle2 size={14} />}
        title={t('onboarding.finish.summaryTitle')}
        desc={t('onboarding.finish.summaryDesc')}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div aria-hidden="true" className="mx-auto shrink-0 sm:mx-0">
            <KomaNekoActor pose="celebrate" mode="video" size={112} />
          </div>
          <dl className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            {summary.map((row) => (
              <div key={row.label} className={cx('flex items-start justify-between gap-2', skin.item, skin.itemOff)}>
                <div className="min-w-0">
                  <dt className={skin.label}>{row.label}</dt>
                  <dd className={cx('mt-1 truncate', skin.itemTitle)}>
                    {row.value}
                    {row.tone === 'warn' ? (
                      <span className="ml-2 align-middle"><OnbBadge tone="warn">{t('onboarding.finish.modelsNone')}</OnbBadge></span>
                    ) : null}
                  </dd>
                </div>
                {onEditStep ? (
                  <button
                    type="button"
                    className={skin.btnSmall}
                    aria-label={t('onboarding.finish.editAria', { item: row.label })}
                    onClick={() => onEditStep(row.step)}
                  >
                    <Pencil size={11} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
          </dl>
        </div>
      </OnbSection>

      <OnbSection
        icon={<Star size={14} />}
        title={t('onboarding.finish.github.title')}
        desc={t('onboarding.finish.github.body')}
        actions={
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleStar}
            className={skin.btnGhost}
          >
            <Star size={13} aria-hidden="true" />
            <span>{starred ? t('onboarding.finish.github.thanksButton') : t('onboarding.finish.github.ctaButton')}</span>
          </a>
        }
      />

      <OnbSection title={t('onboarding.finish.readyTitle')} desc={t('onboarding.finish.readyDesc')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-start gap-3">
            <OnbCheckbox checked={startTour} onChange={setStartTour} />
            <span className="min-w-0">
              <span className={cx('block', skin.rowTitle)}>{t('onboarding.finish.tourCheckbox')}</span>
              <span className={skin.rowDesc}>{t('onboarding.finish.tourCheckboxDesc')}</span>
            </span>
          </label>
          <button
            type="button"
            className={cx(skin.btnPrimary, 'justify-center')}
            onClick={startTour ? onFinishAndStartTour : onFinishOnly}
          >
            {startTour ? <Compass size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
            <span>{startTour ? t('onboarding.finish.startTourButton') : t('onboarding.finish.enterStudioButton')}</span>
          </button>
        </div>
      </OnbSection>
    </div>
  );
}
