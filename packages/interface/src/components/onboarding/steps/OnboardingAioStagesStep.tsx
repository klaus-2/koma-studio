import { useState } from 'react';
import { Bot, Eraser, Languages, ScanText, Sliders, Sparkles, Type, Wand2 } from 'lucide-react';

import { AioStageAnimatedPreview } from '../../../features/dashboard/components/AioStageAnimatedPreview';
import { useI18n } from '../../../i18n';
import { OnbBadge, OnbSection, cx } from '../onboardingPrimitives';
import { OnbTabs, tabPanelProps } from '../onboardingChoiceControls';
import { useOnbSkin } from '../onboardingSkin';

type StageId = 'detectText' | 'recognizeText' | 'getTranslations' | 'segmentText' | 'cleanImage' | 'render';

interface StageSpec {
  readonly id: StageId;
  readonly labelKey: string;
  readonly Icon: typeof ScanText;
  readonly ns: string;
  readonly params: readonly [string, string];
}

const STAGES: readonly StageSpec[] = [
  { id: 'detectText', labelKey: 'aio.stage.detectText', Icon: ScanText, ns: 'detect', params: ['paramModel', 'paramTip'] },
  { id: 'recognizeText', labelKey: 'aio.stage.recognizeText', Icon: Type, ns: 'ocr', params: ['paramEngine', 'paramEdit'] },
  { id: 'getTranslations', labelKey: 'aio.stage.getTranslations', Icon: Languages, ns: 'translate', params: ['paramGlossary', 'paramPresets'] },
  { id: 'segmentText', labelKey: 'aio.stage.segmentText', Icon: Wand2, ns: 'segment', params: ['paramMask', 'paramRefine'] },
  { id: 'cleanImage', labelKey: 'aio.stage.cleanImage', Icon: Eraser, ns: 'clean', params: ['dilation', 'aiClean'] },
  { id: 'render', labelKey: 'aio.stage.render', Icon: Sparkles, ns: 'render', params: ['paramModes', 'paramShortcuts'] },
];

const HD_OPTIONS = [
  { key: 'hdOriginal', recommended: false },
  { key: 'hdResize', recommended: false },
  { key: 'hdCrop', recommended: true },
] as const;

const TABS_ID = 'koma-onb-aio-stages';

export function OnboardingAioStagesStep() {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const [active, setActive] = useState<StageId>('cleanImage');
  const stage = STAGES.find((entry) => entry.id === active) ?? STAGES[0];
  const index = STAGES.findIndex((entry) => entry.id === active);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <OnbSection
          icon={<Bot size={14} />}
          title={t('onboarding.aio.modeAuto.title')}
          desc={t('onboarding.aio.modeAuto.body')}
          actions={<OnbBadge tone="accent">{t('onboarding.aio.modeAuto.badge')}</OnbBadge>}
        />
        <OnbSection
          icon={<Sliders size={14} />}
          title={t('onboarding.aio.modeManual.title')}
          desc={t('onboarding.aio.modeManual.body')}
          actions={<OnbBadge tone="info">{t('onboarding.aio.modeManual.badge')}</OnbBadge>}
        />
      </div>

      <OnbSection title={t('onboarding.aio.pipelineTitle')} desc={t('onboarding.aio.pipelineDesc')}>
        <OnbTabs
          idBase={TABS_ID}
          label={t('onboarding.aio.stageTabsAria')}
          value={active}
          onChange={setActive}
          tabs={STAGES.map((entry, i) => ({
            value: entry.id,
            label: `${i + 1}. ${t(entry.labelKey)}`,
            icon: <entry.Icon size={12} aria-hidden="true" />,
          }))}
        />

        {stage ? (
          <div {...tabPanelProps(TABS_ID, stage.id)} className="mt-3 grid gap-4 outline-none md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className={cx('overflow-hidden', skin.item, skin.itemOff, '!p-0')}>
              <AioStageAnimatedPreview stage={stage.id} variant={skin.noir ? 'noir' : 'classic'} label={t(stage.labelKey)} />
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={skin.mono}>
                  {String(index + 1).padStart(2, '0')} / {String(STAGES.length).padStart(2, '0')}
                </span>
                <h4 className={skin.itemTitle}>{t(`onboarding.aio.${stage.ns}.title`)}</h4>
                {stage.id === 'cleanImage' ? <OnbBadge tone="warn">{t('onboarding.aio.clean.hdBadge')}</OnbBadge> : null}
              </div>
              <p className={skin.body}>{t(`onboarding.aio.${stage.ns}.body`)}</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {stage.params.map((param) => (
                  <div key={param} className={cx(skin.item, skin.itemOff)}>
                    <dt className={skin.itemTitle}>{t(`onboarding.aio.${stage.ns}.${param}Title`)}</dt>
                    <dd className={cx('mt-1', skin.muted)}>{t(`onboarding.aio.${stage.ns}.${param}Desc`)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : null}

        {active === 'cleanImage' ? (
          <div className="mt-4">
            <p className={cx('mb-2', skin.label)}>{t('onboarding.aio.clean.hdStrategyLabel')}</p>
            <ul className="grid gap-2 md:grid-cols-3">
              {HD_OPTIONS.map((opt) => (
                <li key={opt.key} className={cx(skin.item, opt.recommended ? skin.itemOn : skin.itemOff)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className={skin.itemTitle}>{t(`onboarding.aio.clean.${opt.key}Title`)}</strong>
                    {opt.recommended ? <OnbBadge tone="success">{t('onboarding.aio.clean.recommendedTag')}</OnbBadge> : null}
                  </div>
                  <p className={cx('mt-1', skin.muted)}>{t(`onboarding.aio.clean.${opt.key}Desc`)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </OnbSection>
    </div>
  );
}
