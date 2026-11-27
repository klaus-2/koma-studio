import { useId, useState } from 'react';
import { Activity, Bookmark, Cpu, ExternalLink, Plug, Settings, SlidersHorizontal, Type } from 'lucide-react';

import { useCustomCursor } from '../../../hooks/useCustomCursor';
import { useToolTips } from '../../../hooks/useToolTips';
import { useI18n } from '../../../i18n';
import type { SettingsTab } from '../../../pages/settings/settings.types';
import {
  loadWorkspaceAutosaveSettings,
  saveWorkspaceAutosaveSettings,
  type WorkspaceAutosaveSettings,
} from '../../../utils/workspaceAutosaveSettings';
import { OnbBadge, OnbField, OnbSection, OnbToggleRow, cx } from '../onboardingPrimitives';
import { useOnbSkin } from '../onboardingSkin';

export interface OnboardingSettingsStepProps {
  onOpenSettingsTab: (tab: SettingsTab) => void;
}

const SETTINGS_TABS: readonly { id: SettingsTab; Icon: typeof Settings; key: string }[] = [
  { id: 'general', Icon: Settings, key: 'general' },
  { id: 'presets', Icon: Bookmark, key: 'presets' },
  { id: 'typographer', Icon: Type, key: 'typographer' },
  { id: 'integrations', Icon: Plug, key: 'integrations' },
  { id: 'runtime', Icon: Cpu, key: 'runtime' },
  { id: 'performance', Icon: Activity, key: 'performance' },
];

export function OnboardingSettingsStep({ onOpenSettingsTab }: OnboardingSettingsStepProps) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const intervalId = useId();
  const intervalHintId = useId();
  const { enabled: toolTips, setEnabled: setToolTips } = useToolTips();
  const { enabled: cursor, setEnabled: setCursor } = useCustomCursor();
  const [autosave, setAutosave] = useState<WorkspaceAutosaveSettings>(() => loadWorkspaceAutosaveSettings());
  const [intervalDraft, setIntervalDraft] = useState(() => String(autosave.intervalSeconds));

  const persist = (next: WorkspaceAutosaveSettings): void => {
    const saved = saveWorkspaceAutosaveSettings(next);
    setAutosave(saved);
    setIntervalDraft(String(saved.intervalSeconds));
  };

  const commitInterval = (): void => {
    const parsed = Number(intervalDraft);
    if (!Number.isFinite(parsed) || intervalDraft.trim() === '') {
      setIntervalDraft(String(autosave.intervalSeconds));
      return;
    }
    persist({ ...autosave, intervalSeconds: parsed });
  };

  return (
    <div className="flex flex-col gap-4">
      <OnbSection
        icon={<SlidersHorizontal size={14} />}
        title={t('onboarding.settings.quickPrefsTitle')}
        desc={t('onboarding.settings.quickPrefsDesc')}
        actions={<OnbBadge tone="success">{t('onboarding.settings.liveSyncBadge')}</OnbBadge>}
      >
        <div className="flex flex-col gap-2">
          <OnbToggleRow
            title={t('settings.tooltips.enableTitle')}
            desc={t('settings.tooltips.enableDesc')}
            checked={toolTips}
            onChange={setToolTips}
          />
          <OnbToggleRow
            title={t('settings.customCursor.enableTitle')}
            desc={t('settings.customCursor.enableDesc')}
            checked={cursor}
            onChange={setCursor}
          />
          <OnbToggleRow
            title={t('onboarding.settings.autosaveTitle')}
            desc={t('onboarding.settings.autosaveDesc', { seconds: autosave.intervalSeconds })}
            checked={autosave.enabled}
            onChange={(enabled) => persist({ ...autosave, enabled })}
          />
          {autosave.enabled ? (
            <div className="sm:max-w-xs">
              <OnbField label={t('onboarding.settings.autosaveIntervalLabel')} htmlFor={intervalId}>
                <input
                  id={intervalId}
                  type="number"
                  inputMode="numeric"
                  min={15}
                  max={3600}
                  step={15}
                  value={intervalDraft}
                  aria-describedby={intervalHintId}
                  onChange={(e) => setIntervalDraft(e.target.value)}
                  onBlur={commitInterval}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitInterval();
                  }}
                  className={skin.input}
                />
              </OnbField>
              <p id={intervalHintId} className={cx('mt-1', skin.hint)}>
                {t('onboarding.settings.autosaveIntervalHint')}
              </p>
            </div>
          ) : null}
        </div>
      </OnbSection>

      <OnbSection title={t('onboarding.settings.tabsTitle')} desc={t('onboarding.settings.tabsDesc')}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SETTINGS_TABS.map(({ id, Icon, key }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onOpenSettingsTab(id)}
                className={cx('group flex h-full w-full items-start gap-3', skin.item, skin.press, skin.itemOff)}
              >
                <span aria-hidden="true" className={skin.sectionIcon}><Icon size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block', skin.itemTitle)}>{t(`onboarding.settings.tabs.${key}Title`)}</span>
                  <span className={cx('mt-1 block', skin.muted)}>{t(`onboarding.settings.tabs.${key}Desc`)}</span>
                </span>
                <span className={cx('inline-flex shrink-0 items-center gap-1', skin.label)}>
                  {t('onboarding.settings.openTabButton')}
                  <ExternalLink size={11} aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </OnbSection>
    </div>
  );
}
