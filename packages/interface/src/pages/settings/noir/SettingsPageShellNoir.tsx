import type { JSX } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ArrowLeft } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';

const EASE_NOIR = [0.22, 1, 0.36, 1] as const;

import type { AuthUser } from '../../../contexts/AuthContext';
import type { useI18n } from '../../../i18n';
import type { UseUpdaterApi } from '../../../hooks/useUpdater';
import { SettingsTabIcon as TabIcon } from '../SettingsTabIcon';
import { TABS } from '../settings.constants';
import type { SettingsTab } from '../settings.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

interface SettingsPageShellNoirProps {
  onBackDashboard: () => void;
  user: AuthUser | null;
  t: TranslationFn;
  updater: UseUpdaterApi;
  activeTab: SettingsTab;
  setActiveTab: Dispatch<SetStateAction<SettingsTab>>;
  tabContent: Record<SettingsTab, () => JSX.Element>;
}

export const SettingsPageShellNoir = ({
  onBackDashboard,
  user,
  t,
  updater,
  activeTab,
  setActiveTab,
  tabContent,
}: SettingsPageShellNoirProps): JSX.Element => {
  const initials = (user?.name?.trim() || t('settings.profile.defaultUser')).charAt(0).toUpperCase();
  const tabLabels: Record<SettingsTab, string> = {
    general: t('settings.tabs.general'),
    presets: t('settings.tabs.presets'),
    integrations: t('settings.tabs.integrations'),
    app: t('settings.tabs.app'),
  };
  const tabMeta: Record<SettingsTab, { index: string; jp: string }> = {
    general: { index: '01', jp: 'アカウント' },
    presets: { index: '02', jp: 'プリセット' },
    integrations: { index: '03', jp: '連携' },
    app: { index: '04', jp: 'アプリ' },
  };

  return (
    <div className="halftone relative min-h-screen bg-ink text-paper font-display">
      <span aria-hidden className="pointer-events-none fixed left-4 top-4 h-5 w-5 border-l border-t border-paper/15" />
      <span aria-hidden className="pointer-events-none fixed right-4 top-4 h-5 w-5 border-r border-t border-paper/15" />
      <span aria-hidden className="pointer-events-none fixed bottom-4 left-4 h-5 w-5 border-b border-l border-paper/15" />
      <span aria-hidden className="pointer-events-none fixed bottom-4 right-4 h-5 w-5 border-b border-r border-paper/15" />
      <span aria-hidden className="v-text pointer-events-none fixed right-6 top-1/2 hidden -translate-y-1/2 select-none font-display text-3xl font-black tracking-[0.3em] text-paper/[0.04] lg:block">
        コマ・スタジオ設定
      </span>
      <span aria-hidden className="fixed left-0 top-0 z-30 h-[3px] w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <m.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_NOIR }}
          className="mb-8 flex items-center justify-between"
        >
          <button type="button" onClick={onBackDashboard}
            className="panel-cut-sm hard-hover inline-flex items-center gap-2 border border-paper/20 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson">
            <ArrowLeft size={12} /> {t('settings.backToDashboard')}
          </button>
          <span className="kicker hidden sm:block">// CONTROL ROOM · 設定</span>
        </m.div>

        <m.header
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE_NOIR, delay: 0.05 }}
          className="glass panel-cut relative mb-8 overflow-hidden border border-paper/8 p-6 sm:p-8"
        >
          <span aria-hidden className="text-outline pointer-events-none absolute -bottom-4 right-4 select-none font-display text-7xl font-black leading-none sm:text-8xl">
            SETTINGS
          </span>
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-crimson" />

          <div className="relative flex flex-wrap items-center gap-5">
            <m.div
              aria-hidden
              initial={{ rotate: -12, scale: 0.7, opacity: 0 }}
              animate={{ rotate: -3, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.2 }}
              className="panel-cut-sm flex h-16 w-16 items-center justify-center border-2 border-crimson bg-crimson/10 font-display text-xl font-black text-crimson"
            >
              {initials}
            </m.div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-2xl font-black uppercase tracking-tight text-paper sm:text-3xl">
                {user?.name?.trim() || t('settings.profile.defaultUser')}
              </h1>
              <p className="truncate font-mono text-[11px] text-paper/45">{user?.email || '—'}</p>
            </div>

            {updater.currentVersion ? (
              <span className="stamp !text-[11px]">v{updater.currentVersion}</span>
            ) : null}
          </div>

          {updater.currentVersion ? (
            <div className="relative mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-paper/8 pt-4 font-mono text-[11px]">
              <span className="inline-flex items-baseline gap-2">
                <strong className="text-sm font-bold text-paper">v{updater.currentVersion}</strong>
                <span className="uppercase tracking-[0.16em] text-paper/35">{t('settings.stats.version')}</span>
              </span>
            </div>
          ) : null}
        </m.header>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav role="tablist" aria-label={t('settings.tabs.ariaLabel')}
            className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const meta = tabMeta[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative shrink-0 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson ${active ? 'text-paper' : 'text-paper/40 hover:text-paper/80'
                    }`}
                >
                  {active && (
                    <m.span
                      layoutId="koma-stg-tab-ink"
                      aria-hidden
                      className="panel-cut-sm absolute inset-0 border border-crimson/50 bg-crimson/10"
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3 px-3.5 py-3">
                    <span className={`font-display text-lg font-black leading-none ${active ? 'text-crimson' : 'text-paper/20 group-hover:text-paper/40'
                      }`}>
                      {meta.index}
                    </span>
                    <span className="flex flex-col">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                        <TabIcon id={tab.icon} />
                        {tabLabels[tab.id]}
                      </span>
                      <span aria-hidden className={`font-mono text-[8px] tracking-[0.3em] ${active ? 'text-crimson/60' : 'text-paper/20'
                        }`}>
                        {meta.jp}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}

            <span aria-hidden className="mt-4 hidden h-px w-full bg-gradient-to-r from-crimson/30 to-transparent lg:block" />
            <span aria-hidden className="hidden px-3.5 pt-2 font-mono text-[8px] uppercase tracking-[0.3em] text-paper/20 lg:block">
              KOMA © SCANLATION WORKFLOW
            </span>
          </nav>

          <div role="tabpanel" className="min-w-0">
            <AnimatePresence mode="wait">
              <m.div
                key={activeTab}
                initial={{ opacity: 0, x: 24, clipPath: 'inset(0 0 0 12%)' }}
                animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0 0 0%)' }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.35, ease: EASE_NOIR }}
              >
                {tabContent[activeTab]()}
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
