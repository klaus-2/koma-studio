import type { JSX } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { AuthUser } from '../../contexts/AuthContext';
import type { useI18n } from '../../i18n';
import type { UseUpdaterApi } from '../../hooks/useUpdater';
import { SettingsTabIcon as TabIcon } from './SettingsTabIcon';
import { TABS } from './settings.constants';
import type { SettingsTab } from './settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

interface SettingsPageShellClassicProps {
  onBackDashboard: () => void;
  initials: string;
  user: AuthUser | null;
  t: TranslationFn;
  updater: UseUpdaterApi;
  activeTab: SettingsTab;
  setActiveTab: Dispatch<SetStateAction<SettingsTab>>;
  tabContent: Record<SettingsTab, () => JSX.Element>;
}

export const SettingsPageShellClassic = ({
  onBackDashboard,
  initials,
  user,
  t,
  updater,
  activeTab,
  setActiveTab,
  tabContent,
}: SettingsPageShellClassicProps): JSX.Element => (
    <div className="koma-stg">
      {/* ── Background layers ── */}
      <div className="koma-stg__bg" aria-hidden="true" />
      <div className="koma-stg__halftone" aria-hidden="true" />
      <div className="auth-orb auth-orb--purple koma-stg__orb-1" aria-hidden="true" />
      <div className="auth-orb auth-orb--cyan koma-stg__orb-2" aria-hidden="true" />

      <div className="koma-stg__scroll">
        <div className="koma-stg__container">
          {/* ── Back button ── */}
          <button type="button" onClick={onBackDashboard} className="koma-back-btn">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            {t("settings.backToDashboard")}
          </button>

          {/* ── Profile header card ── */}
          <div className="koma-stg-header">
            <div className="koma-stg-header__row">
              <div className="koma-stg-avatar" aria-hidden="true">
                <span>{initials}</span>
              </div>
              <div className="koma-stg-header__info">
                <h1 className="koma-stg-header__name">{user?.name?.trim() || t('settings.profile.defaultUser')}</h1>
                <p className="koma-stg-header__email">{user?.email || "—"}</p>
              </div>
            </div>

            {updater.currentVersion ? (
              <div className="koma-stg-stats">
                <div className="koma-stg-stat">
                  <span className="koma-stg-stat__value">v{updater.currentVersion}</span>
                  <span className="koma-stg-stat__label">{t("settings.stats.version")}</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* ── Tab navigation ── */}
          <div className="koma-stg-tabs" role="tablist" aria-label={t("settings.tabs.ariaLabel")}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`koma-stg-tab ${activeTab === tab.id ? "koma-stg-tab--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <TabIcon id={tab.icon} />
                <span className="koma-stg-tab__label">
                  {tab.id === "general"
                    ? t("settings.tabs.general")
                    : tab.id === "presets"
                      ? t("settings.tabs.presets")
                      : tab.id === "integrations"
                        ? t("settings.tabs.integrations")
                        : t("settings.tabs.app")}
                </span>
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="koma-stg-body" role="tabpanel">
            {tabContent[activeTab]()}
          </div>
        </div>
      </div>
    </div>
  );
