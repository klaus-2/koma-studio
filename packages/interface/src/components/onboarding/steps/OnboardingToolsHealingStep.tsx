import { useState } from 'react';
import { Bandage, BoxSelect, Sparkles, Type } from 'lucide-react';

import {
  DockToolAnimatedPreview,
  type DockToolPreviewKind,
} from '../../../features/dashboard/components/DockToolAnimatedPreview';
import { useI18n } from '../../../i18n';
import {
  OnboardingBadge,
  OnboardingSectionCard,
  useIsNoirFamily,
} from '../onboardingPrimitives';

type ToolsTabId = 'healing' | 'text' | 'selection';

interface ToolCardSpec {
  kind: DockToolPreviewKind;
  titleKey: string;
  descKey: string;
}

const HEALING_TOOLS: readonly ToolCardSpec[] = [
  { kind: 'healing', titleKey: 'onboarding.tools.card.healingTitle', descKey: 'onboarding.tools.card.healingDesc' },
  { kind: 'magic-wand', titleKey: 'onboarding.tools.card.magicWandTitle', descKey: 'onboarding.tools.card.magicWandDesc' },
  { kind: 'segment-brush', titleKey: 'onboarding.tools.card.segmentBrushTitle', descKey: 'onboarding.tools.card.segmentBrushDesc' },
  { kind: 'segment-eraser', titleKey: 'onboarding.tools.card.segmentEraserTitle', descKey: 'onboarding.tools.card.segmentEraserDesc' },
  { kind: 'paint', titleKey: 'onboarding.tools.card.paintTitle', descKey: 'onboarding.tools.card.paintDesc' },
  { kind: 'paint-eraser', titleKey: 'onboarding.tools.card.paintEraserTitle', descKey: 'onboarding.tools.card.paintEraserDesc' },
  { kind: 'clear-paint', titleKey: 'onboarding.tools.card.clearPaintTitle', descKey: 'onboarding.tools.card.clearPaintDesc' },
  { kind: 'reset-edits', titleKey: 'onboarding.tools.card.resetEditsTitle', descKey: 'onboarding.tools.card.resetEditsDesc' },
];

const SELECTION_TOOLS: readonly ToolCardSpec[] = [
  { kind: 'area-select', titleKey: 'onboarding.tools.card.areaSelectTitle', descKey: 'onboarding.tools.card.areaSelectDesc' },
  { kind: 'config', titleKey: 'onboarding.tools.card.configTitle', descKey: 'onboarding.tools.card.configDesc' },
  { kind: 'clear-page', titleKey: 'onboarding.tools.card.clearPageTitle', descKey: 'onboarding.tools.card.clearPageDesc' },
];

export function OnboardingToolsHealingStep() {
  const { t } = useI18n();
  const isNoir = useIsNoirFamily();
  const variant = isNoir ? 'noir' : 'classic';
  const [activeTab, setActiveTab] = useState<ToolsTabId>('healing');

  return (
    <div className="koma-onb-stepStack">
      <div className="koma-onb-stageTabs" role="tablist" aria-label={t('onboarding.tools.tabsAria')}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'healing'}
          onClick={() => setActiveTab('healing')}
          className={`koma-onb-stageTab ${activeTab === 'healing' ? 'koma-onb-stageTab--active' : ''}`}
        >
          <Bandage size={13} />
          <span>{t('onboarding.tools.tab.healing')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'text'}
          onClick={() => setActiveTab('text')}
          className={`koma-onb-stageTab ${activeTab === 'text' ? 'koma-onb-stageTab--active' : ''}`}
        >
          <Type size={13} />
          <span>{t('onboarding.tools.tab.text')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'selection'}
          onClick={() => setActiveTab('selection')}
          className={`koma-onb-stageTab ${activeTab === 'selection' ? 'koma-onb-stageTab--active' : ''}`}
        >
          <BoxSelect size={13} />
          <span>{t('onboarding.tools.tab.selection')}</span>
        </button>
      </div>

      {activeTab === 'healing' && (
        <div className="koma-onb-stepStack" role="tabpanel">
          <OnboardingSectionCard tone="accent">
            <div className="koma-onb-cardHead">
              <Sparkles size={15} />
              <h4 className="koma-onb-cardTitle">{t('onboarding.tools.healingFlow.title')}</h4>
              <OnboardingBadge tone="accent">{t('onboarding.tools.healingFlow.badge')}</OnboardingBadge>
            </div>
            <ol className="koma-onb-orderedSteps">
              <li>{t('onboarding.tools.healingFlow.step1')}</li>
              <li>{t('onboarding.tools.healingFlow.step2')}</li>
              <li>{t('onboarding.tools.healingFlow.step3')}</li>
              <li>{t('onboarding.tools.healingFlow.step4')}</li>
            </ol>
          </OnboardingSectionCard>

          <div className="koma-onb-toolGrid">
            {HEALING_TOOLS.map((tool) => (
              <OnboardingSectionCard key={tool.kind} className="koma-onb-toolCard">
                <DockToolAnimatedPreview
                  kind={tool.kind}
                  variant={variant}
                  size="card"
                  label={t(tool.titleKey)}
                />
                <div className="koma-onb-toolCard__copy">
                  <strong className="koma-onb-toolCard__title">{t(tool.titleKey)}</strong>
                  <p className="koma-onb-muted">{t(tool.descKey)}</p>
                </div>
              </OnboardingSectionCard>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="koma-onb-stepStack" role="tabpanel">
          <OnboardingSectionCard tone="info">
            <h4 className="koma-onb-cardTitle">{t('onboarding.tools.text.leadTitle')}</h4>
            <p className="koma-onb-body">{t('onboarding.tools.text.leadBody')}</p>
          </OnboardingSectionCard>

          <div className="koma-onb-grid2">
            <OnboardingSectionCard>
              <strong className="koma-onb-cardTitle">{t('onboarding.tools.text.inlineTitle')}</strong>
              <p className="koma-onb-body">{t('onboarding.tools.text.inlineDesc')}</p>
            </OnboardingSectionCard>
            <OnboardingSectionCard>
              <strong className="koma-onb-cardTitle">{t('onboarding.tools.text.typoTitle')}</strong>
              <p className="koma-onb-body">{t('onboarding.tools.text.typoDesc')}</p>
            </OnboardingSectionCard>
            <OnboardingSectionCard>
              <strong className="koma-onb-cardTitle">{t('onboarding.tools.text.compareTitle')}</strong>
              <p className="koma-onb-body">{t('onboarding.tools.text.compareDesc')}</p>
            </OnboardingSectionCard>
            <OnboardingSectionCard>
              <strong className="koma-onb-cardTitle">{t('onboarding.tools.text.exportTitle')}</strong>
              <p className="koma-onb-body">{t('onboarding.tools.text.exportDesc')}</p>
            </OnboardingSectionCard>
          </div>
        </div>
      )}

      {activeTab === 'selection' && (
        <div className="koma-onb-stepStack" role="tabpanel">
          <div className="koma-onb-toolGrid">
            {SELECTION_TOOLS.map((tool) => (
              <OnboardingSectionCard key={tool.kind} className="koma-onb-toolCard">
                <DockToolAnimatedPreview
                  kind={tool.kind}
                  variant={variant}
                  size="card"
                  label={t(tool.titleKey)}
                />
                <div className="koma-onb-toolCard__copy">
                  <strong className="koma-onb-toolCard__title">{t(tool.titleKey)}</strong>
                  <p className="koma-onb-muted">{t(tool.descKey)}</p>
                </div>
              </OnboardingSectionCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
