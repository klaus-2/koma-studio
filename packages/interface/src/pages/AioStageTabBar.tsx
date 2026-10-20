import { memo } from 'react';
import { cn } from '../lib/utils';
import { useI18n } from '../i18n';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { AioStageTabBarNoir } from './aio-noir/AioStageTabBarNoir';
import type { StageTabDef, StageTabKey } from './AioStageTabBar.types';

export type { StageTabDef, StageTabKey } from './AioStageTabBar.types';

interface AioStageTabBarProps {
  tabs: StageTabDef[];
  activeTab: StageTabKey;
  enabledSteps: Record<string, boolean>;
  onSelect: (tab: StageTabKey) => void;
}

const AioStageTabBarClassic = ({
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

export const AioStageTabBar = memo(function AioStageTabBar(props: AioStageTabBarProps) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <AioStageTabBarNoir {...props} /> : <AioStageTabBarClassic {...props} />;
});
