import { useState } from 'react';
import {
  Bot,
  Eraser,
  Languages,
  Maximize2,
  ScanText,
  Sliders,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import { OnboardingBadge, OnboardingSectionCard } from '../onboardingPrimitives';

type StageGuideTabId =
  | 'detectText'
  | 'recognizeText'
  | 'getTranslations'
  | 'segmentText'
  | 'cleanImage'
  | 'render';

export function OnboardingAioStagesStep() {
  const { t } = useI18n();
  const [activeStage, setActiveStage] = useState<StageGuideTabId>('cleanImage');

  const stageTabs: readonly {
    id: StageGuideTabId;
    labelKey: string;
    Icon: typeof ScanText;
  }[] = [
    { id: 'detectText', labelKey: 'aio.stage.detectText', Icon: ScanText },
    { id: 'recognizeText', labelKey: 'aio.stage.recognizeText', Icon: Type },
    { id: 'getTranslations', labelKey: 'aio.stage.getTranslations', Icon: Languages },
    { id: 'segmentText', labelKey: 'aio.stage.segmentText', Icon: Wand2 },
    { id: 'cleanImage', labelKey: 'aio.stage.cleanImage', Icon: Eraser },
    { id: 'render', labelKey: 'aio.stage.render', Icon: Sparkles },
  ];

  return (
    <div className="koma-onb-stepStack">
      <div className="koma-onb-grid2">
        <OnboardingSectionCard tone="accent">
          <div className="koma-onb-cardHead">
            <Bot size={15} />
            <h3 className="koma-onb-cardTitle">{t('onboarding.aio.modeAuto.title')}</h3>
            <OnboardingBadge tone="accent">{t('onboarding.aio.modeAuto.badge')}</OnboardingBadge>
          </div>
          <p className="koma-onb-body">{t('onboarding.aio.modeAuto.body')}</p>
        </OnboardingSectionCard>

        <OnboardingSectionCard tone="info">
          <div className="koma-onb-cardHead">
            <Sliders size={15} />
            <h3 className="koma-onb-cardTitle">{t('onboarding.aio.modeManual.title')}</h3>
            <OnboardingBadge tone="info">{t('onboarding.aio.modeManual.badge')}</OnboardingBadge>
          </div>
          <p className="koma-onb-body">{t('onboarding.aio.modeManual.body')}</p>
        </OnboardingSectionCard>
      </div>

      <OnboardingSectionCard>
        <div
          className="koma-onb-stageTabs"
          role="tablist"
          aria-label={t('onboarding.aio.stageTabsAria')}
        >
          {stageTabs.map(({ id, labelKey, Icon }) => {
            const active = activeStage === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveStage(id)}
                className={`koma-onb-stageTab ${active ? 'koma-onb-stageTab--active' : ''}`}
              >
                <Icon size={13} />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>

        <div className="koma-onb-stageDetail" role="tabpanel">
          {activeStage === 'detectText' && (
            <div className="koma-onb-detailStack">
              <h4 className="koma-onb-detailTitle">{t('onboarding.aio.detect.title')}</h4>
              <p className="koma-onb-body">{t('onboarding.aio.detect.body')}</p>
              <div className="koma-onb-paramGrid">
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.detect.paramModelTitle')}</strong>
                  <p>{t('onboarding.aio.detect.paramModelDesc')}</p>
                </div>
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.detect.paramTipTitle')}</strong>
                  <p>{t('onboarding.aio.detect.paramTipDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeStage === 'recognizeText' && (
            <div className="koma-onb-detailStack">
              <h4 className="koma-onb-detailTitle">{t('onboarding.aio.ocr.title')}</h4>
              <p className="koma-onb-body">{t('onboarding.aio.ocr.body')}</p>
              <div className="koma-onb-paramGrid">
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.ocr.paramEngineTitle')}</strong>
                  <p>{t('onboarding.aio.ocr.paramEngineDesc')}</p>
                </div>
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.ocr.paramEditTitle')}</strong>
                  <p>{t('onboarding.aio.ocr.paramEditDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeStage === 'getTranslations' && (
            <div className="koma-onb-detailStack">
              <h4 className="koma-onb-detailTitle">{t('onboarding.aio.translate.title')}</h4>
              <p className="koma-onb-body">{t('onboarding.aio.translate.body')}</p>
              <div className="koma-onb-paramGrid">
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.translate.paramGlossaryTitle')}</strong>
                  <p>{t('onboarding.aio.translate.paramGlossaryDesc')}</p>
                </div>
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.translate.paramPresetsTitle')}</strong>
                  <p>{t('onboarding.aio.translate.paramPresetsDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeStage === 'segmentText' && (
            <div className="koma-onb-detailStack">
              <h4 className="koma-onb-detailTitle">{t('onboarding.aio.segment.title')}</h4>
              <p className="koma-onb-body">{t('onboarding.aio.segment.body')}</p>
              <div className="koma-onb-paramGrid">
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.segment.paramMaskTitle')}</strong>
                  <p>{t('onboarding.aio.segment.paramMaskDesc')}</p>
                </div>
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.segment.paramRefineTitle')}</strong>
                  <p>{t('onboarding.aio.segment.paramRefineDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeStage === 'cleanImage' && (
            <div className="koma-onb-detailStack">
              <div className="koma-onb-cardHead">
                <Maximize2 size={15} />
                <h4 className="koma-onb-detailTitle">{t('onboarding.aio.clean.title')}</h4>
                <OnboardingBadge tone="warn">{t('onboarding.aio.clean.hdBadge')}</OnboardingBadge>
              </div>
              <p className="koma-onb-body">{t('onboarding.aio.clean.body')}</p>

              <div className="koma-onb-grid3">
                <div className="koma-onb-paramCard">
                  <div className="koma-onb-cardHead">
                    <strong>{t('onboarding.aio.clean.hdOriginalTitle')}</strong>
                  </div>
                  <p>{t('onboarding.aio.clean.hdOriginalDesc')}</p>
                </div>
                <div className="koma-onb-paramCard">
                  <div className="koma-onb-cardHead">
                    <strong>{t('onboarding.aio.clean.hdResizeTitle')}</strong>
                  </div>
                  <p>{t('onboarding.aio.clean.hdResizeDesc')}</p>
                </div>
                <div className="koma-onb-paramCard koma-onb-paramCard--highlight">
                  <div className="koma-onb-cardHead">
                    <strong>{t('onboarding.aio.clean.hdCropTitle')}</strong>
                    <OnboardingBadge tone="success">{t('onboarding.aio.clean.recommendedTag')}</OnboardingBadge>
                  </div>
                  <p>{t('onboarding.aio.clean.hdCropDesc')}</p>
                </div>
              </div>

              <div className="koma-onb-paramGrid">
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.clean.dilationTitle')}</strong>
                  <p>{t('onboarding.aio.clean.dilationDesc')}</p>
                </div>
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.clean.aiCleanTitle')}</strong>
                  <p>{t('onboarding.aio.clean.aiCleanDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {activeStage === 'render' && (
            <div className="koma-onb-detailStack">
              <h4 className="koma-onb-detailTitle">{t('onboarding.aio.render.title')}</h4>
              <p className="koma-onb-body">{t('onboarding.aio.render.body')}</p>
              <div className="koma-onb-paramGrid">
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.render.paramModesTitle')}</strong>
                  <p>{t('onboarding.aio.render.paramModesDesc')}</p>
                </div>
                <div className="koma-onb-paramCard">
                  <strong>{t('onboarding.aio.render.paramShortcutsTitle')}</strong>
                  <p>{t('onboarding.aio.render.paramShortcutsDesc')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </OnboardingSectionCard>
    </div>
  );
}
