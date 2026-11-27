import { useState, type ReactNode } from 'react';
import { Bandage, BoxSelect, Columns2, Download, PencilLine, Sparkles, Type } from 'lucide-react';

import {
  DockToolAnimatedPreview,
  type DockToolPreviewKind,
} from '../../../features/dashboard/components/DockToolAnimatedPreview';
import { useI18n } from '../../../i18n';
import { OnbBadge, OnbSection, cx } from '../onboardingPrimitives';
import { OnbTabs, tabPanelProps } from '../onboardingChoiceControls';
import { useOnbSkin } from '../onboardingSkin';

type ToolsTabId = 'healing' | 'text' | 'selection';

interface ToolCardSpec {
  readonly kind: DockToolPreviewKind;
  readonly key: string;
}

const HEALING_TOOLS: readonly ToolCardSpec[] = [
  { kind: 'healing', key: 'healing' },
  { kind: 'magic-wand', key: 'magicWand' },
  { kind: 'segment-brush', key: 'segmentBrush' },
  { kind: 'segment-eraser', key: 'segmentEraser' },
  { kind: 'paint', key: 'paint' },
  { kind: 'paint-eraser', key: 'paintEraser' },
  { kind: 'clear-paint', key: 'clearPaint' },
  { kind: 'reset-edits', key: 'resetEdits' },
];

const SELECTION_TOOLS: readonly ToolCardSpec[] = [
  { kind: 'area-select', key: 'areaSelect' },
  { kind: 'config', key: 'config' },
  { kind: 'clear-page', key: 'clearPage' },
];

const TEXT_TOOLS = [
  { Icon: PencilLine, key: 'inline' },
  { Icon: Type, key: 'typo' },
  { Icon: Columns2, key: 'compare' },
  { Icon: Download, key: 'export' },
] as const;

const HEALING_FLOW_KEYS = [
  'onboarding.tools.healingFlow.step1',
  'onboarding.tools.healingFlow.step2',
  'onboarding.tools.healingFlow.step3',
  'onboarding.tools.healingFlow.step4',
] as const;

const TABS_ID = 'koma-onb-tools';
const toolTitle = (key: string): string => `onboarding.tools.card.${key}Title`;
const toolDesc = (key: string): string => `onboarding.tools.card.${key}Desc`;

function ToolPicker({
  tools,
  featured,
  onFeature,
  children,
}: {
  tools: readonly ToolCardSpec[];
  featured: DockToolPreviewKind;
  onFeature: (kind: DockToolPreviewKind) => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const variant = skin.noir ? 'noir' : 'classic';
  const current = tools.find((tool) => tool.kind === featured) ?? tools[0];
  if (!current) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className={cx('koma-onb-spotlight grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]', skin.item, skin.itemOn)}>
        <div className="overflow-hidden">
          <DockToolAnimatedPreview kind={current.kind} variant={variant} size="card" label={t(toolTitle(current.key))} />
        </div>
        <div className="flex min-w-0 flex-col gap-2" aria-live="polite">
          <strong className={skin.itemTitle}>{t(toolTitle(current.key))}</strong>
          <p className={skin.body}>{t(toolDesc(current.key))}</p>
          {children}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tools.map((tool) => {
          const on = tool.kind === featured;
          return (
            <button
              key={tool.kind}
              type="button"
              aria-pressed={on}
              onClick={() => onFeature(tool.kind)}
              className={cx('flex flex-col gap-2 text-left', skin.item, skin.press, on ? skin.itemOn : skin.itemOff)}
            >
              <DockToolAnimatedPreview kind={tool.kind} variant={variant} size="card" playMode="hover" label={t(toolTitle(tool.key))} />
              <span className={cx('block', skin.itemTitle)}>{t(toolTitle(tool.key))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OnboardingToolsHealingStep() {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const [tab, setTab] = useState<ToolsTabId>('healing');
  const [healing, setHealing] = useState<DockToolPreviewKind>('healing');
  const [selection, setSelection] = useState<DockToolPreviewKind>('area-select');

  return (
    <OnbSection
      icon={<Sparkles size={14} />}
      title={t('onboarding.tools.healingFlow.title')}
      desc={t('onboarding.tools.intro')}
      actions={<OnbBadge tone="accent">{t('onboarding.tools.healingFlow.badge')}</OnbBadge>}
    >
      <OnbTabs
        idBase={TABS_ID}
        label={t('onboarding.tools.tabsAria')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'healing', label: t('onboarding.tools.tab.healing'), icon: <Bandage size={12} aria-hidden="true" /> },
          { value: 'text', label: t('onboarding.tools.tab.text'), icon: <Type size={12} aria-hidden="true" /> },
          { value: 'selection', label: t('onboarding.tools.tab.selection'), icon: <BoxSelect size={12} aria-hidden="true" /> },
        ]}
      />

      <div {...tabPanelProps(TABS_ID, tab)} className="mt-3 outline-none">
        {tab === 'healing' ? (
          <ToolPicker tools={HEALING_TOOLS} featured={healing} onFeature={setHealing}>
            <ol className="mt-1 flex flex-col gap-1.5">
              {HEALING_FLOW_KEYS.map((key, i) => (
                <li key={key} className={cx('flex items-start gap-2', skin.muted)}>
                  <span aria-hidden="true" className={skin.badge('neutral')}>{i + 1}</span>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ol>
          </ToolPicker>
        ) : null}

        {tab === 'text' ? (
          <div className="flex flex-col gap-3">
            <p className={skin.body}>{t('onboarding.tools.text.leadBody')}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {TEXT_TOOLS.map(({ Icon, key }) => (
                <li key={key} className={cx('flex items-start gap-3', skin.item, skin.itemOff)}>
                  <span aria-hidden="true" className={skin.sectionIcon}><Icon size={14} /></span>
                  <span className="min-w-0">
                    <strong className={cx('block', skin.itemTitle)}>{t(`onboarding.tools.text.${key}Title`)}</strong>
                    <span className={cx('mt-1 block', skin.muted)}>{t(`onboarding.tools.text.${key}Desc`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === 'selection' ? (
          <ToolPicker tools={SELECTION_TOOLS} featured={selection} onFeature={setSelection} />
        ) : null}
      </div>
    </OnbSection>
  );
}
