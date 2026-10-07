'use client';

import {
  AlertTriangle, ArrowLeft, Gavel, Megaphone, Plus, ShieldAlert, Users,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { FeedTab } from '../ScanlationFeed.types';
import { Stamp } from '../../../components/noir-panels/NoirPrimitives';
import { feedBtn } from './ScanlationFeedPrimitives';

type Props = {
  tab: FeedTab;
  canModerate: boolean;
  heroTitle: string;
  composerTypeLabel: string;
  feedback: string | null;
  error: string | null;
  onBackDashboard: () => void;
  onTabChange: (tab: FeedTab) => void;
  onOpenComposer: () => void;
};

const TAB_META: Record<FeedTab, { icon: typeof Users; jp: string }> = {
  recruitment: { icon: Users, jp: '募集' },
  showcase: { icon: Megaphone, jp: '発表' },
  moderation: { icon: Gavel, jp: '検閲' },
};

export default function ScanlationFeedHeaderToolbar({
  tab, canModerate, heroTitle, composerTypeLabel,
  feedback, error, onBackDashboard, onTabChange, onOpenComposer,
}: Props) {
  const { t } = useI18n();

  const tabs: FeedTab[] = canModerate
    ? ['recruitment', 'showcase', 'moderation']
    : ['recruitment', 'showcase'];

  const tabLabel = (key: FeedTab) =>
    key === 'recruitment' ? t('feed.tab.recruitment')
      : key === 'showcase' ? t('feed.tab.showcase')
        : t('feed.tab.moderation');

  return (
    <>
      {/* ── Hero ── */}
      <header className="glass panel-cut relative overflow-hidden p-6">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-9 right-4 select-none font-display text-[120px] font-black leading-none"
        >
          掲示板
        </span>
        <div className="halftone-red pointer-events-none absolute inset-y-0 right-0 w-48 opacity-40" aria-hidden />

        <div className="relative">
          <button type="button" className="btn-ghost mb-4" onClick={onBackDashboard}>
            <ArrowLeft size={11} /> {t('feed.hero.back')}
          </button>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Stamp tone="crimson" blink>
                {t('dashboard.topbar.scanlationFeed')}
              </Stamp>
              <h1 className="mt-3 font-display text-3xl font-black uppercase leading-none tracking-tight text-paper">
                {heroTitle}
              </h1>
              <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-paper/50">
                {t('feed.hero.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <nav role="tablist" aria-label={t('feed.tabsAria')} className="flex flex-wrap gap-2">
          {tabs.map((key) => {
            const active = tab === key;
            const { icon: Icon, jp } = TAB_META[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(key)}
                className={`panel-cut-sm flex items-center gap-2 px-4 py-2 transition-all duration-150 ${active
                    ? 'bg-crimson text-ink -translate-x-0.5 -translate-y-0.5 drop-shadow-[4px_4px_0_#ffc857]'
                    : 'border border-paper/15 text-paper/55 hover:border-paper/40 hover:text-paper'
                  }`}
              >
                <Icon size={13} strokeWidth={2.5} />
                <span className="font-display text-[11px] font-extrabold uppercase tracking-wider">
                  {tabLabel(key)}
                </span>
                <span aria-hidden className={`font-accent text-[12px] italic ${active ? 'opacity-70' : 'opacity-40'}`}>
                  {jp}
                </span>
              </button>
            );
          })}
        </nav>
        {tab !== 'moderation' && (
          <button type="button" className={`${feedBtn.primary} ml-auto`} onClick={onOpenComposer}>
            <Plus size={14} />
            {t('feed.actions.createPost', { type: composerTypeLabel.toLowerCase() })}
          </button>
        )}
      </div>

      {/* ── Alerts ── */}
      <div className="flex flex-col gap-2">
        <div
          role="alert"
          className="panel-cut-sm flex items-start gap-2.5 border-l-[3px] border-l-gold bg-gold/8 px-3.5 py-2.5 text-[11px] leading-relaxed text-paper/70"
        >
          <ShieldAlert size={14} className="mt-0.5 flex-none text-gold" aria-hidden />
          <span>{t('feed.alert.safety')}</span>
        </div>
        {canModerate && (
          <div
            role="note"
            className="panel-cut-sm flex items-start gap-2.5 border-l-[3px] border-l-azure bg-azure/8 px-3.5 py-2.5 text-[11px] leading-relaxed text-paper/70"
          >
            <AlertTriangle size={14} className="mt-0.5 flex-none text-azure" aria-hidden />
            <span>{t('feed.alert.banPolicy')}</span>
          </div>
        )}
      </div>

      {/* ── Toasts ── */}
      {feedback && (
        <div
          role="status"
          className="panel-cut-sm border-l-[3px] border-l-mint bg-mint/8 px-3.5 py-2.5 text-[11.5px] text-mint"
        >
          ✓ {feedback}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="panel-cut-sm border-l-[3px] border-l-crimson bg-crimson/8 px-3.5 py-2.5 text-[11.5px] text-crimson"
        >
          {error}
        </div>
      )}
    </>
  );
}
