import { useState } from 'react';
import {
  Activity,
  Bookmark,
  Cpu,
  ExternalLink,
  Plug,
  Settings,
  Type,
} from 'lucide-react';

import { useCustomCursor } from '../../../hooks/useCustomCursor';
import { useToolTips } from '../../../hooks/useToolTips';
import { useI18n } from '../../../i18n';
import type { SettingsTab } from '../../../pages/settings/settings.types';
import {
  loadWorkspaceAutosaveSettings,
  saveWorkspaceAutosaveSettings,
  type WorkspaceAutosaveSettings,
} from '../../../utils/workspaceAutosaveSettings';
import {
  OnboardingBadge,
  OnboardingSectionCard,
  OnboardingToggleRow,
} from '../onboardingPrimitives';

export interface OnboardingSettingsStepProps {
  onOpenSettingsTab: (tab: SettingsTab) => void;
}

export function OnboardingSettingsStep({
  onOpenSettingsTab,
}: OnboardingSettingsStepProps) {
  const { t } = useI18n();
  const { enabled: toolTipsEnabled, setEnabled: setToolTipsEnabled } = useToolTips();
  const { enabled: customCursorEnabled, setEnabled: setCustomCursorEnabled } =
    useCustomCursor();
  const [autosave, setAutosave] = useState<WorkspaceAutosaveSettings>(() =>
    loadWorkspaceAutosaveSettings(),
  );

  const handleAutosaveToggle = (enabled: boolean): void => {
    const saved = saveWorkspaceAutosaveSettings({
      ...autosave,
      enabled,
    });
    setAutosave(saved);
  };

  const tabs: readonly {
    id: SettingsTab;
    Icon: typeof Settings;
    titleKey: string;
    descKey: string;
  }[] = [
    {
      id: 'general',
      Icon: Settings,
      titleKey: 'onboarding.settings.tabs.generalTitle',
      descKey: 'onboarding.settings.tabs.generalDesc',
    },
    {
      id: 'presets',
      Icon: Bookmark,
      titleKey: 'onboarding.settings.tabs.presetsTitle',
      descKey: 'onboarding.settings.tabs.presetsDesc',
    },
    {
      id: 'typographer',
      Icon: Type,
      titleKey: 'onboarding.settings.tabs.typographerTitle',
      descKey: 'onboarding.settings.tabs.typographerDesc',
    },
    {
      id: 'integrations',
      Icon: Plug,
      titleKey: 'onboarding.settings.tabs.integrationsTitle',
      descKey: 'onboarding.settings.tabs.integrationsDesc',
    },
    {
      id: 'runtime',
      Icon: Cpu,
      titleKey: 'onboarding.settings.tabs.runtimeTitle',
      descKey: 'onboarding.settings.tabs.runtimeDesc',
    },
    {
      id: 'performance',
      Icon: Activity,
      titleKey: 'onboarding.settings.tabs.performanceTitle',
      descKey: 'onboarding.settings.tabs.performanceDesc',
    },
  ];

  return (
    <div className="koma-onb-stepStack">
      <OnboardingSectionCard tone="accent">
        <div className="koma-onb-cardHead">
          <span className="koma-onb-iconTile" aria-hidden="true">
            <Settings size={14} />
          </span>
          <h3 className="koma-onb-cardTitle">{t('onboarding.settings.quickPrefsTitle')}</h3>
          <OnboardingBadge tone="info">{t('onboarding.settings.liveSyncBadge')}</OnboardingBadge>
        </div>
        <div className="koma-onb-toggleStack">
          <OnboardingToggleRow
            title={t('settings.tooltips.enableTitle')}
            description={t('settings.tooltips.enableDesc')}
            checked={toolTipsEnabled}
            onChange={setToolTipsEnabled}
          />
          <OnboardingToggleRow
            title={t('settings.customCursor.enableTitle')}
            description={t('settings.customCursor.enableDesc')}
            checked={customCursorEnabled}
            onChange={setCustomCursorEnabled}
          />
          <OnboardingToggleRow
            title={t('onboarding.settings.autosaveTitle')}
            description={t('onboarding.settings.autosaveDesc', {
              seconds: autosave.intervalSeconds,
            })}
            checked={autosave.enabled}
            onChange={handleAutosaveToggle}
          />
        </div>
      </OnboardingSectionCard>

      <div className="koma-onb-grid2">
        {tabs.map(({ id, Icon, titleKey, descKey }) => (
          <OnboardingSectionCard key={id}>
            <div className="koma-onb-settingsTabCard">
              <div className="koma-onb-settingsTabCard__copy">
                <div className="koma-onb-cardHead">
                  <span className="koma-onb-iconTile" aria-hidden="true">
                    <Icon size={14} />
                  </span>
                  <h4 className="koma-onb-cardTitle">{t(titleKey)}</h4>
                </div>
                <p className="koma-onb-muted">{t(descKey)}</p>
              </div>
              <button
                type="button"
                className="koma-onb-btn koma-onb-btn--ghost koma-onb-btn--sm"
                onClick={() => onOpenSettingsTab(id)}
              >
                <span>{t('onboarding.settings.openTabButton')}</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </OnboardingSectionCard>
        ))}
      </div>
    </div>
  );
}
