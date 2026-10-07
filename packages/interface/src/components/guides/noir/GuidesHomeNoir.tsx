import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Bookmark, ChevronRight, Play, Search } from 'lucide-react';

import { GUIDE_CATEGORIES, GUIDES } from '../../../data/guides-data';
import { useInfoNavStore } from '../../../stores/info-nav-store';
import { useI18n } from '../../../i18n';

import { DifficultyStamp, GuideRow, resolveTone, TimeBadge, TONE_CLASSES } from './noir-guides';
import GuideSearchNoir from './GuideSearchNoir';

const EASE = [0.22, 1, 0.36, 1] as const;
const useNoirMotion = () => ({
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } },
  item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } },
  initial: 'hidden' as const,
  animate: 'show' as const,
});

export default function GuidesHome() {
  const { t } = useI18n();
  const m = useNoirMotion();
  const navigateToGuideCategory = useInfoNavStore((s) => s.navigateToGuideCategory);
  const navigateToGuideEntry = useInfoNavStore((s) => s.navigateToGuideEntry);
  const stepProgress = useInfoNavStore((s) => s.stepProgress);
  const readGuides = useInfoNavStore((s) => s.readGuides);
  const bookmarks = useInfoNavStore((s) => s.bookmarks);
  const [searchOpen, setSearchOpen] = useState(false);

  /* Ctrl+K */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const inProgressGuide = useMemo(() => {
    for (const [guideId, step] of Object.entries(stepProgress)) {
      if (!readGuides[guideId] && step > 0) {
        const guide = GUIDES.find((g) => g.id === guideId);
        if (guide) {
          const totalSteps = guide.sections.reduce((acc, s) => acc + s.steps.length, 0);
          return { guide, step, totalSteps };
        }
      }
    }
    return null;
  }, [stepProgress, readGuides]);

  const bookmarkedGuides = useMemo(
    () => GUIDES.filter((g) => bookmarks.includes(g.id)),
    [bookmarks],
  );

  const handleContinue = useCallback(() => {
    if (inProgressGuide) {
      navigateToGuideEntry(inProgressGuide.guide.category, inProgressGuide.guide.id);
    }
  }, [inProgressGuide, navigateToGuideEntry]);

  const continuePct = inProgressGuide
    ? ((inProgressGuide.step + 1) / inProgressGuide.totalSteps) * 100
    : 0;

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
          指南
        </span>
        <div className="halftone-red pointer-events-none absolute inset-y-0 right-0 w-48 opacity-40" aria-hidden />

        <div className="relative max-w-xl">
          <p className="kicker mb-2 flex items-center gap-2">
            <BookOpen size={11} aria-hidden />
            {'// '}
            {t('guides.home.title')}
          </p>
          <h1 className="font-display text-3xl font-black uppercase leading-none tracking-tight text-paper">
            Field{' '}
            <em className="font-accent font-normal normal-case italic text-crimson">Manual</em>
          </h1>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-paper/50">
            {t('guides.home.description')}
          </p>

          {/* Search trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t('guides.home.searchAria')}
            className="panel-cut-sm mt-5 flex w-full max-w-md items-center gap-3 border border-paper/15 bg-ink/70 px-4 py-3 text-left transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-crimson/50 hover:drop-shadow-[4px_4px_0_rgba(255,200,87,0.55)]"
          >
            <Search size={14} className="flex-none text-crimson" aria-hidden />
            <span className="flex-1 font-mono text-[11px] text-paper/40">
              {t('guides.home.searchPlaceholder')}
            </span>
            <kbd className="noir-kbd" aria-hidden>
              {t('guides.home.searchShortcut')}
            </kbd>
          </button>
        </div>
      </motion.header>

      {/* ── Continue reading ── */}
      {inProgressGuide && (
        <motion.div variants={m.item}>
          <div
            role="button"
            tabIndex={0}
            onClick={handleContinue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleContinue();
            }}
            className="panel-cut group relative cursor-pointer overflow-hidden border border-crimson/35 bg-crimson/6 p-5 transition-all duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:drop-shadow-[6px_6px_0_rgba(255,200,87,0.7)]"
          >
            <div className="halftone-red pointer-events-none absolute inset-0 opacity-30" aria-hidden />
            <div className="relative flex flex-wrap items-center gap-5">
              <div className="min-w-0 flex-1">
                <p className="kicker mb-1.5">{t('guides.home.continueReading')}</p>
                <h3 className="truncate font-display text-lg font-black uppercase tracking-tight text-paper">
                  {inProgressGuide.guide.title}
                </h3>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/45">
                  {t('guides.home.stepProgress', {
                    current: inProgressGuide.step + 1,
                    total: inProgressGuide.totalSteps,
                    time: inProgressGuide.guide.estimatedTime,
                  })}
                </p>
                <div className="panel-cut-sm mt-3 h-2 w-full max-w-xs border border-paper/15 bg-ink p-px">
                  <div
                    className="noir-progress-fill h-full transition-[width] duration-500"
                    style={{ width: `${continuePct}%` }}
                  />
                </div>
              </div>
              <span className="btn-primary flex-none">
                <Play size={12} /> {t('guides.home.continueCta')}
                <span aria-hidden className="font-accent text-[14px] normal-case italic tracking-normal opacity-70">
                  続き
                </span>
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Categories ── */}
      <motion.div variants={m.item} className="flex items-center gap-3">
        <span className="kicker">{'// '}{t('guides.home.categories')}</span>
        <span aria-hidden className="h-px flex-1 bg-paper/10" />
        <span aria-hidden className="font-mono text-[9px] tracking-[0.3em] text-paper/25">
          カテゴリー
        </span>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {GUIDE_CATEGORIES.map((cat, idx) => {
          const tone = resolveTone(cat.accentColor);
          const tc = TONE_CLASSES[tone];
          const guidesInCat = GUIDES.filter((g) => g.category === cat.id);
          const completedCount = guidesInCat.filter((g) => readGuides[g.id]).length;
          const countLabel = `${guidesInCat.length} ${t('guides.home.guidesCountLabel', {
            suffix: guidesInCat.length !== 1 ? t('guides.home.guidesPluralSuffix') : '',
          })}${completedCount > 0
            ? ` · ${completedCount} ${t('guides.home.completedCountLabel', {
              suffix: completedCount !== 1 ? t('guides.home.guidesPluralSuffix') : '',
            })}`
            : ''
            }`;
          const CatIcon = cat.icon;

          return (
            <motion.div
              key={cat.id}
              variants={m.item}
              role="button"
              tabIndex={0}
              onClick={() => navigateToGuideCategory(cat.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigateToGuideCategory(cat.id);
                }
              }}
              className={`glass panel-cut group relative cursor-pointer p-5 transition-all duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:${tc.shadow}`}
            >
              <span
                aria-hidden
                className="text-outline pointer-events-none absolute right-3 top-2 select-none font-display text-4xl font-black"
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span
                className={`panel-cut-sm grid h-10 w-10 place-items-center border ${tc.border} ${tc.bg} ${tc.text}`}
              >
                <CatIcon size={17} />
              </span>
              <h3 className="mt-3.5 font-display text-[15px] font-black uppercase tracking-tight text-paper">
                {cat.label}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-paper/45">
                {cat.description}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-paper/10 pt-3">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper/40">
                  {countLabel}
                </span>
                <ChevronRight
                  size={14}
                  aria-hidden
                  className={`transition-transform duration-150 group-hover:translate-x-1 ${tc.text}`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Bookmarks ── */}
      {bookmarkedGuides.length > 0 && (
        <>
          <motion.div variants={m.item} className="mt-2 flex items-center gap-3">
            <span className="kicker flex items-center gap-1.5">
              <Bookmark size={11} aria-hidden />
              {'// '}
              {t('guides.home.saved', { count: bookmarkedGuides.length })}
            </span>
            <span aria-hidden className="h-px flex-1 bg-paper/10" />
          </motion.div>

          <div className="flex flex-col gap-2.5">
            {bookmarkedGuides.map((guide) => (
              <motion.div key={guide.id} variants={m.item}>
                <GuideRow
                  icon={guide.icon}
                  tone={resolveTone(guide.accentColor)}
                  title={guide.title}
                  subtitle={guide.subtitle}
                  meta={
                    <>
                      <DifficultyStamp
                        level={guide.difficulty}
                        label={t(`guides.common.${guide.difficulty}`)}
                      />
                      <TimeBadge>{guide.estimatedTime}</TimeBadge>
                    </>
                  }
                  onSelect={() => navigateToGuideEntry(guide.category, guide.id)}
                />
              </motion.div>
            ))}
          </div>
        </>
      )}

      {searchOpen && <GuideSearchNoir onClose={() => setSearchOpen(false)} />}
    </motion.div>
  );
}
