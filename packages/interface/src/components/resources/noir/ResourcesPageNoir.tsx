import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Search, Type, Users, Volume2, Wrench, X } from 'lucide-react';
import { useI18n } from '../../../i18n';

import {
  COMMUNITIES_DATA,
  EXTERNAL_TOOLS_DATA,
  FONTS_DATA,
  GLOSSARY_DATA,
  SFX_DATA,
} from '../../../data/resources-data';
import type { ResourceTab } from '../../../data/guides-types';
import { useInfoNavStore } from '../../../stores/info-nav-store';

import CommunitiesSectionNoir from './CommunitiesSectionNoir';
import FontsSectionNoir from './FontsSectionNoir';
import GlossarySectionNoir from './GlossarySectionNoir';
import SfxSectionNoir from './SfxSectionNoir';
import ToolsSectionNoir from './ToolsSectionNoir';

interface TabDef {
  id: ResourceTab;
  label: string;
  jp: string;
  icon: typeof Type;
  count: number;
}


const EASE = [0.22, 1, 0.36, 1] as const;
const useNoirMotion = () => ({
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } },
  item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } },
  initial: 'hidden' as const,
  animate: 'show' as const,
});

export default function ResourcesPage() {
  const { t } = useI18n();
  const m = useNoirMotion();
  const reduce = useReducedMotion();
  const rawTab = useInfoNavStore((s) => s.resourcesCategory);
  const setTab = useInfoNavStore((s) => s.navigateToResourceCategory);
  const activeTab = rawTab ?? 'fonts';

  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const TABS: TabDef[] = [
    { id: 'fonts', label: t('resources.page.tab.fonts'), jp: '書体', icon: Type, count: FONTS_DATA.length },
    { id: 'sfx-library', label: t('resources.page.tab.sfx'), jp: '擬音', icon: Volume2, count: SFX_DATA.length },
    { id: 'glossary', label: t('resources.page.tab.glossary'), jp: '用語', icon: BookOpen, count: GLOSSARY_DATA.length },
    { id: 'communities', label: t('resources.page.tab.communities'), jp: '仲間', icon: Users, count: COMMUNITIES_DATA.length },
    { id: 'tools-external', label: t('resources.page.tab.tools'), jp: '道具', icon: Wrench, count: EXTERNAL_TOOLS_DATA.length },
  ];

  const activeDef = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  /* Ctrl+F → focus search */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleTabClick = useCallback((id: ResourceTab) => setTab(id), [setTab]);

  const clearSearch = useCallback(() => {
    setSearch('');
    searchRef.current?.focus();
  }, []);

  return (
    <motion.div
      variants={m.container}
      initial={m.initial}
      animate={m.animate}
      className="flex flex-col gap-5"
    >
      {/* ── Hero ── */}
      <motion.header variants={m.item} className="glass panel-cut relative overflow-hidden p-6">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-9 right-4 select-none font-display text-[130px] font-black leading-none"
        >
          資料
        </span>
        <div className="halftone-red pointer-events-none absolute inset-y-0 right-0 w-48 opacity-40" aria-hidden />

        <div className="relative max-w-xl">
          <p className="kicker mb-2">{'// '}{t('resources.page.title.main')}</p>
          <h1 className="font-display text-3xl font-black uppercase leading-none tracking-tight text-paper">
            {t('resources.page.title.main')}{' '}
            <em className="font-accent font-normal normal-case italic text-crimson">
              {t('resources.page.title.accent')}
            </em>
          </h1>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-paper/50">
            {t('resources.page.subtitle')}
          </p>

          {/* Search */}
          <div className="relative mt-5 max-w-md">
            <Search
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-crimson"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('resources.page.searchPlaceholder')}
              aria-label={t('resources.page.searchAria')}
              className="noir-input !py-3 !pl-10 !pr-20"
            />
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {search.length > 0 ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label={t('resources.page.clearSearch')}
                  className="noir-icon-btn"
                >
                  <X size={12} />
                </button>
              ) : (
                <>
                  <kbd className="noir-kbd" aria-hidden>{t('resources.page.shortcutCtrl')}</kbd>
                  <kbd className="noir-kbd" aria-hidden>{t('resources.page.shortcutFind')}</kbd>
                </>
              )}
            </span>
          </div>
        </div>
      </motion.header>

      {/* ── Tabs (hanko index) ── */}
      <motion.div
        variants={m.item}
        role="tablist"
        aria-label={t('resources.page.tabsAria')}
        className="flex flex-wrap gap-2"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleTabClick(tab.id)}
              className={`panel-cut-sm flex items-center gap-2 px-3.5 py-2 transition-all duration-150 ${active
                  ? 'bg-crimson text-ink -translate-x-0.5 -translate-y-0.5 drop-shadow-[4px_4px_0_#ffc857]'
                  : 'border border-paper/15 text-paper/55 hover:border-paper/40 hover:text-paper'
                }`}
            >
              <Icon size={13} strokeWidth={2.5} />
              <span className="font-display text-[11px] font-extrabold uppercase tracking-wider">
                {tab.label}
              </span>
              <span
                aria-hidden
                className={`font-accent text-[12px] italic ${active ? 'opacity-70' : 'opacity-40'}`}
              >
                {tab.jp}
              </span>
              <span
                className={`font-mono text-[9px] ${active ? 'text-ink/70' : 'text-crimson'}`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* ── Active section (animated swap) ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          role="tabpanel"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="glass panel-cut relative p-5"
        >
          <span
            aria-hidden
            className="text-outline pointer-events-none absolute right-4 top-3 select-none font-display text-6xl font-black leading-none"
          >
            {activeDef?.jp}
          </span>

          {activeTab === 'fonts' && <FontsSectionNoir search={search} />}
          {activeTab === 'sfx-library' && <SfxSectionNoir search={search} />}
          {activeTab === 'glossary' && <GlossarySectionNoir search={search} />}
          {activeTab === 'communities' && <CommunitiesSectionNoir search={search} />}
          {activeTab === 'tools-external' && <ToolsSectionNoir search={search} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
