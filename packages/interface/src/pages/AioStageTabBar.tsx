import { type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';

export type StageTabKey =
  | 'detectText'
  | 'recognizeText'
  | 'getTranslations'
  | 'segmentText'
  | 'cleanImage'
  | 'render';

export interface StageTabDef {
  key: StageTabKey;
  icon: LucideIcon;
  label: string;
  shortLabel: string;
}

interface AioStageTabBarProps {
  tabs: StageTabDef[];
  activeTab: StageTabKey;
  enabledSteps: Record<string, boolean>;
  onSelect: (tab: StageTabKey) => void;
}

export const AioStageTabBar = ({
  tabs,
  activeTab,
  enabledSteps,
  onSelect,
}: AioStageTabBarProps) => {
  const { t } = useI18n();

  return (
    <div
      className="koma-aio-stage-tabs__bar"
      role="tablist"
      aria-label={t('aio.stage.tabsBarAria')}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const isEnabled = enabledSteps[tab.key] ?? false;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            title={tab.label}
            className={cn(
              'koma-aio-stage-tab',
              isActive && 'koma-aio-stage-tab--active',
              isEnabled && 'koma-aio-stage-tab--enabled',
            )}
            onClick={() => onSelect(tab.key)}
          >
            <tab.icon size={14} />
            <span className="koma-aio-stage-tab__dot" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};

