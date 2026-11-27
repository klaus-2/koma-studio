import { useState } from 'react';
import {
  Bandage,
  BoxSelect,
  Columns2,
  Download,
  PencilLine,
  Sparkles,
  Type,
} from 'lucide-react';

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
  readonly kind: DockToolPreviewKind;
  readonly titleKey: string;
  readonly descKey: string;
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

const HEALING_FLOW_KEYS = [
  'onboarding.tools.healingFlow.step1',
  'onboarding.tools.healingFlow.step2',
  'onboarding.tools.healingFlow.step3',
  'onboarding.tools.healingFlow.step4',
] as const;

export function OnboardingToolsHealingStep() {
  const { t } = useI18n();
  const isNoir = useIsNoirFamily();
  const variant = isNoir ? 'noir' : 'classic';
  const [activeTab, setActiveTab] = useState<ToolsTabId>('healing');
  const [featuredHealingKind, setFeaturedHealingKind] = useState<DockToolPreviewKind>('healing');
  const [featuredSelectionKind, setFeaturedSelectionKind] = useState<DockToolPreviewKind>('area-select');

  const featuredHealing =
    HEALING_TOOLS.find((item) => item.kind === featuredHealingKind) ?? HEALING_TOOLS[0];
  const featuredSelection =
    SELECTION_TOOLS.find((item) => item.kind === featuredSelectionKind) ?? SELECTION_TOOLS[0];

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
          <Bandage size={13} aria-hidden="true" />
          <span>{t('onboarding.tools.tab.healing')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'text'}
          onClick={() => setActiveTab('text')}
          className={`koma-onb-stageTab ${activeTab === 'text' ? 'koma-onb-stageTab--active' : ''}`}
        >
          <Type size={13} aria-hidden="true" />
          <span>{t('onboarding.tools.tab.text')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'selection'}
          onClick={() => setActiveTab('selection')}
          className={`koma-onb-stageTab ${activeTab === 'selection' ? 'koma-onb-stageTab--active' : ''}`}
        >
          <BoxSelect size={13} aria-hidden="true" />
          <span>{t('onboarding.tools.tab.selection')}</span>
        </button>
      </div>

      {activeTab === 'healing' && (
        <div className="koma-onb-stepStack" role="tabpanel">

          {featuredHealing && (
            <OnboardingSectionCard tone="accent" className="koma-onb-spotlightCard">
              <div className="koma-onb-spotlight">
                <div className="koma-onb-spotlight__media">
                  <DockToolAnimatedPreview
                    kind={featuredHealing.kind}
                    variant={variant}
                    size="card"
                    label={t(featuredHealing.titleKey)}
                  />
                </div>
                <div className="koma-onb-spotlight__copy">
                  <div className="koma-onb-cardHead">
                    <Sparkles size={14} aria-hidden="true" />
                    <h4 className="koma-onb-cardTitle">{t('onboarding.tools.healingFlow.title')}</h4>
                    <OnboardingBadge tone="accent">
                      {t('onboarding.tools.healingFlow.badge')}
                    </OnboardingBadge>
                  </div>
                  <div className="koma-onb-spotlight__activeTool">
                    <strong>{t(featuredHealing.titleKey)}</strong>
                    <p className="koma-onb-muted">{t(featuredHealing.descKey)}</p>
                  </div>
                  <ol className="koma-onb-recipeList">
                    {HEALING_FLOW_KEYS.map((key, idx) => (
                      <li key={key} className="koma-onb-recipeItem">
                        <span className="koma-onb-recipeItem__num">{idx + 1}</span>
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </OnboardingSectionCard>
          )}

          <div className="koma-onb-toolGrid">
            {HEALING_TOOLS.map((tool) => {
              const active = tool.kind === featuredHealingKind;
              return (
                <button
                  key={tool.kind}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFeaturedHealingKind(tool.kind)}
                  className={`koma-onb-toolBtn koma-onb-card koma-onb-toolCard ${
                    active ? 'koma-onb-card--active koma-onb-card--accent' : ''
                  }`}
                >
                  <DockToolAnimatedPreview
                    kind={tool.kind}
                    variant={variant}
                    size="card"
                    playMode="hover"
                    label={t(tool.titleKey)}
                  />
                  <div className="koma-onb-toolCard__copy">
                    <strong className="koma-onb-toolCard__title">{t(tool.titleKey)}</strong>
                    <p className="koma-onb-muted">{t(tool.descKey)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="koma-onb-stepStack" role="tabpanel">
          <OnboardingSectionCard tone="info">
            <div className="koma-onb-cardHead">
              <span className="koma-onb-iconTile" aria-hidden="true">
                <Type size={14} />
              </span>
              <h4 className="koma-onb-cardTitle">{t('onboarding.tools.text.leadTitle')}</h4>
            </div>
            <p className="koma-onb-body koma-onb-mtXs">{t('onboarding.tools.text.leadBody')}</p>
          </OnboardingSectionCard>

          <div className="koma-onb-grid2">
            {(
              [
                { Icon: PencilLine, titleKey: 'onboarding.tools.text.inlineTitle', descKey: 'onboarding.tools.text.inlineDesc' },
                { Icon: Type, titleKey: 'onboarding.tools.text.typoTitle', descKey: 'onboarding.tools.text.typoDesc' },
                { Icon: Columns2, titleKey: 'onboarding.tools.text.compareTitle', descKey: 'onboarding.tools.text.compareDesc' },
                { Icon: Download, titleKey: 'onboarding.tools.text.exportTitle', descKey: 'onboarding.tools.text.exportDesc' },
              ] as const
            ).map(({ Icon, titleKey, descKey }) => (
              <OnboardingSectionCard key={titleKey}>
                <div className="koma-onb-cardHead">
                  <span className="koma-onb-iconTile" aria-hidden="true">
                    <Icon size={14} />
                  </span>
                  <strong className="koma-onb-cardTitle">{t(titleKey)}</strong>
                </div>
                <p className="koma-onb-body koma-onb-mtXs">{t(descKey)}</p>
              </OnboardingSectionCard>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'selection' && (
        <div className="koma-onb-stepStack" role="tabpanel">
          {featuredSelection && (
            <OnboardingSectionCard tone="info" className="koma-onb-spotlightCard">
              <div className="koma-onb-spotlight">
                <div className="koma-onb-spotlight__media">
                  <DockToolAnimatedPreview
                    kind={featuredSelection.kind}
                    variant={variant}
                    size="card"
                    label={t(featuredSelection.titleKey)}
                  />
                </div>
                <div className="koma-onb-spotlight__copy">
                  <strong className="koma-onb-detailTitle">{t(featuredSelection.titleKey)}</strong>
                  <p className="koma-onb-body koma-onb-mtXs">{t(featuredSelection.descKey)}</p>
                </div>
              </div>
            </OnboardingSectionCard>
          )}

          <div className="koma-onb-grid3">
            {SELECTION_TOOLS.map((tool) => {
              const active = tool.kind === featuredSelectionKind;
              return (
                <button
                  key={tool.kind}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFeaturedSelectionKind(tool.kind)}
                  className={`koma-onb-toolBtn koma-onb-card koma-onb-toolCard ${
                    active ? 'koma-onb-card--active koma-onb-card--info' : ''
                  }`}
                >
                  <DockToolAnimatedPreview
                    kind={tool.kind}
                    variant={variant}
                    size="card"
                    playMode="hover"
                    label={t(tool.titleKey)}
                  />
                  <div className="koma-onb-toolCard__copy">
                    <strong className="koma-onb-toolCard__title">{t(tool.titleKey)}</strong>
                    <p className="koma-onb-muted">{t(tool.descKey)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
