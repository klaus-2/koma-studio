import { useState, type MouseEvent } from 'react';
import { CheckCircle2, Compass, Play, Star } from 'lucide-react';
import { useThemeStore } from '@koma/ui/stores/theme-store';

import { useI18n } from '../../../i18n';
import { useModelManagerLiveState } from '../../../hooks/useModelManager';
import { useAioPipelineStore } from '../../../pages/dashboard/stores/aio-pipeline-store';
import { KomaNekoActor } from '../../koma-mascot/KomaNekoActor';
import { OnboardingBadge, OnboardingSectionCard } from '../onboardingPrimitives';
import { KOMA_GITHUB_REPO_URL } from '../onboardingSteps';

export interface OnboardingFinishStepProps {
  githubUrl?: string;
  onOpenExternalUrl: (event: MouseEvent<HTMLElement>, url: string) => void | Promise<void>;
  onFinishAndStartTour: () => void;
  onFinishOnly: () => void;
}

export function OnboardingFinishStep({
  githubUrl = KOMA_GITHUB_REPO_URL,
  onOpenExternalUrl,
  onFinishAndStartTour,
  onFinishOnly,
}: OnboardingFinishStepProps) {
  const { locale, localeLabels, t } = useI18n();
  const theme = useThemeStore((s) => s.theme);
  const family = useThemeStore((s) => s.family);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const { entries } = useModelManagerLiveState();
  const [starredClicked, setStarredClicked] = useState(false);

  const entryList = Object.values(entries);
  const installedCount = entryList.filter(
    (entry) => entry.status === 'installed' || entry.status === 'update_available',
  ).length;
  const activeCount = entryList.filter(
    (entry) =>
      entry.status === 'downloading' ||
      entry.status === 'queued' ||
      entry.status === 'verifying',
  ).length;

  const handleStarClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    setStarredClicked(true);
    void onOpenExternalUrl(event, githubUrl);
  };

  return (
    <div className="koma-onb-stepStack">

      <OnboardingSectionCard tone="success" className="koma-onb-finishHero">
        <div className="koma-onb-finishBanner">
          <div className="koma-onb-finishBanner__mascot" aria-hidden="true">
            <KomaNekoActor pose="celebrate" mode="video" size={116} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="koma-onb-cardHead">
              <CheckCircle2 size={16} aria-hidden="true" />
              <h3 className="koma-onb-cardTitle">{t('onboarding.finish.summaryTitle')}</h3>
            </div>
            <div className="koma-onb-summaryGrid">
              <div className="koma-onb-summaryItem">
                <span className="koma-onb-summaryItem__label">{t('onboarding.finish.labelLanguage')}</span>
                <strong>{localeLabels[locale]}</strong>
              </div>
              <div className="koma-onb-summaryItem">
                <span className="koma-onb-summaryItem__label">{t('onboarding.finish.labelAppearance')}</span>
                <strong className="uppercase">
                  {family} · {theme}
                </strong>
              </div>
              <div className="koma-onb-summaryItem">
                <span className="koma-onb-summaryItem__label">{t('onboarding.finish.labelPair')}</span>
                <strong className="koma-onb-mono">
                  {aioSrcLang.toUpperCase()} → {aioTgtLang.toUpperCase()}
                </strong>
              </div>
              <div className="koma-onb-summaryItem">
                <span className="koma-onb-summaryItem__label">{t('onboarding.finish.labelModels')}</span>
                <strong>
                  {activeCount > 0
                    ? t('onboarding.finish.modelsWithActive', {
                        installed: installedCount,
                        active: activeCount,
                      })
                    : t('onboarding.finish.modelsInstalled', {
                        installed: installedCount,
                      })}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </OnboardingSectionCard>

      <OnboardingSectionCard tone="accent">
        <div className="koma-onb-githubCard">
          <div className="koma-onb-githubCard__copy">
            <div className="koma-onb-cardHead">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <h4 className="koma-onb-cardTitle">{t('onboarding.finish.github.title')}</h4>
              <OnboardingBadge tone="warn">
                <Star size={11} />
                {t('onboarding.finish.github.badge')}
              </OnboardingBadge>
            </div>
            <p className="koma-onb-body koma-onb-mtXs">{t('onboarding.finish.github.body')}</p>
          </div>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleStarClick}
            className="koma-onb-btn koma-onb-btn--star"
          >
            <Star size={15} />
            <span>
              {starredClicked
                ? t('onboarding.finish.github.thanksButton')
                : t('onboarding.finish.github.ctaButton')}
            </span>
          </a>
        </div>
      </OnboardingSectionCard>

      <OnboardingSectionCard>
        <div className="koma-onb-finishActions">
          <button
            type="button"
            className="koma-onb-btn koma-onb-btn--primary koma-onb-btn--lg"
            onClick={onFinishAndStartTour}
          >
            <Compass size={15} />
            <span>{t('onboarding.finish.startTourButton')}</span>
          </button>
          <button
            type="button"
            className="koma-onb-btn koma-onb-btn--ghost koma-onb-btn--lg"
            onClick={onFinishOnly}
          >
            <Play size={15} />
            <span>{t('onboarding.finish.enterStudioButton')}</span>
          </button>
        </div>
      </OnboardingSectionCard>
    </div>
  );
}
