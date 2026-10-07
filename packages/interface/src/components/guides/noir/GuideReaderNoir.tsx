import { useCallback, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';

import { GUIDE_CATEGORIES, GUIDES } from '../../../data/guides-data';
import type { GuideCategoryId, GuideStep } from '../../../data/guides-types';
import { useInfoNavStore } from '../../../stores/info-nav-store';
import { useI18n } from '../../../i18n';
const EASE = [0.22, 1, 0.36, 1] as const;
import { DifficultyStamp, NoirBreadcrumb, TimeBadge } from './noir-guides';
import GuideStepRendererNoir from './GuideStepRendererNoir';

interface Props {
  categoryId: GuideCategoryId;
  entryId: string;
}

export default function GuideReader({ categoryId, entryId }: Props) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const navigateGuidesHome = useInfoNavStore((s) => s.navigateGuidesHome);
  const navigateToGuideCategory = useInfoNavStore((s) => s.navigateToGuideCategory);
  const navigateToGuideEntry = useInfoNavStore((s) => s.navigateToGuideEntry);
  const activeStep = useInfoNavStore((s) => s.guidesActiveStep);
  const setActiveStep = useInfoNavStore((s) => s.setGuidesActiveStep);
  const bookmarks = useInfoNavStore((s) => s.bookmarks);
  const toggleBookmark = useInfoNavStore((s) => s.toggleBookmark);
  const markGuideRead = useInfoNavStore((s) => s.markGuideRead);
  const recentlyViewed = useInfoNavStore((s) => s.recentGuides);

  const category = GUIDE_CATEGORIES.find((c) => c.id === categoryId);
  const guide = GUIDES.find((g) => g.id === entryId);

  /* Flatten steps across sections */
  const allSteps = useMemo<Array<GuideStep & { sectionTitle: string }>>(() => {
    if (!guide) return [];
    return guide.sections.flatMap((section) =>
      section.steps.map((step) => ({ ...step, sectionTitle: section.title })),
    );
  }, [guide]);

  const sectionBreaks = useMemo(() => {
    const breaks: Record<number, string> = {};
    if (!guide) return breaks;
    let idx = 0;
    for (const section of guide.sections) {
      if (section.steps.length > 0) breaks[idx] = section.title;
      idx += section.steps.length;
    }
    return breaks;
  }, [guide]);

  const totalSteps = allSteps.length;
  const currentStep = allSteps[activeStep];
  const progressPercent = totalSteps > 0 ? ((activeStep + 1) / totalSteps) * 100 : 0;
  const isBookmarked = bookmarks.includes(entryId);
  const isLastStep = activeStep >= totalSteps - 1;

  const goToStep = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < totalSteps) setActiveStep(idx);
    },
    [setActiveStep, totalSteps],
  );

  const recentGuides = useMemo(
    () =>
      recentlyViewed
        .filter((id) => id !== entryId)
        .slice(0, 3)
        .map((id) => GUIDES.find((g) => g.id === id))
        .filter(Boolean),
    [recentlyViewed, entryId],
  );

  const handleComplete = useCallback(() => {
    markGuideRead(entryId);
    navigateToGuideCategory(categoryId);
  }, [markGuideRead, entryId, navigateToGuideCategory, categoryId]);

  /* ── Not found ── */
  if (!category || !guide || !currentStep) {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" className="btn-ghost self-start" onClick={navigateGuidesHome}>
          <ArrowLeft size={11} /> {t('guides.reader.backToGuides')}
        </button>
        <div className="flex flex-col items-center gap-3 border border-dashed border-paper/15 py-16 text-paper/35">
          <FileText size={28} strokeWidth={1.2} />
          <p className="font-display text-[13px] font-bold uppercase tracking-wide">
            {t('guides.reader.notFound')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Progress bar risograph ── */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('guides.reader.progressAria')}
        className="flex items-center gap-3"
      >
        <div className="panel-cut-sm h-2.5 flex-1 border border-paper/15 bg-ink p-px">
          <div
            className="noir-progress-fill h-full transition-[width] duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="flex-none font-mono text-[10px] text-paper/50">
          <span className="text-crimson">{activeStep + 1}</span> / {totalSteps}
        </span>
      </div>

      {/* ── 3-column layout ── */}
      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_190px]">
        {/* ═══ SIDEBAR — steps timeline ═══ */}
        <aside
          role="navigation"
          aria-label={t('guides.reader.stepsAria')}
          className="glass panel-cut lg:sticky lg:top-4 flex max-h-[80vh] flex-col p-4"
        >
          <button
            type="button"
            onClick={() => navigateToGuideCategory(categoryId)}
            className="mb-3 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-paper/45 transition-colors hover:text-crimson"
          >
            <ArrowLeft size={11} /> {category.label}
          </button>

          <h2 className="mb-4 border-b border-paper/10 pb-3 font-display text-[13px] font-black uppercase leading-snug tracking-tight text-paper">
            {guide.title}
          </h2>

          <ul className="noir-timeline noir-scroll flex-1 space-y-0.5 overflow-y-auto pr-1">
            {allSteps.map((step, idx) => {
              const isCompleted = idx < activeStep;
              const isActive = idx === activeStep;
              const sectionLabel = sectionBreaks[idx];

              return (
                <li key={step.id}>
                  {sectionLabel && guide.sections.length > 1 && (
                    <div className="mb-1 mt-3 pl-8 font-mono text-[8.5px] uppercase tracking-[0.25em] text-paper/30 first:mt-0">
                      {sectionLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => goToStep(idx)}
                    className={`relative flex w-full items-center gap-2.5 py-1.5 pl-0 pr-2 text-left transition-colors ${isActive ? 'text-paper' : isCompleted ? 'text-paper/50' : 'text-paper/40 hover:text-paper/70'
                      }`}
                  >
                    <span
                      aria-hidden
                      className={`relative z-10 grid h-[22px] w-[22px] flex-none place-items-center border font-mono text-[9px] transition-all ${isActive
                          ? 'border-crimson bg-crimson font-bold text-ink drop-shadow-[2px_2px_0_#ffc857]'
                          : isCompleted
                            ? 'border-mint/50 bg-mint/12 text-mint'
                            : 'border-paper/20 bg-ink text-paper/40'
                        }`}
                      style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
                    >
                      {isCompleted ? <Check size={11} strokeWidth={3} /> : idx + 1}
                    </span>
                    <span
                      className={`truncate text-[11px] ${isActive ? 'font-bold' : ''}`}
                    >
                      {step.title || t('guides.reader.stepLabel', { index: idx + 1 })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Recent */}
          {recentGuides.length > 0 && (
            <div className="mt-4 border-t border-paper/10 pt-3">
              <p className="mb-2 font-mono text-[8.5px] uppercase tracking-[0.25em] text-paper/30">
                {t('guides.reader.recent')}
              </p>
              {recentGuides.map(
                (rg) =>
                  rg && (
                    <button
                      key={rg.id}
                      type="button"
                      onClick={() => navigateToGuideEntry(rg.category, rg.id)}
                      className="flex w-full items-center gap-2 truncate py-1 text-left text-[10.5px] text-paper/45 transition-colors hover:text-crimson"
                    >
                      <FileText size={10} className="flex-none" aria-hidden />
                      <span className="truncate">{rg.title}</span>
                    </button>
                  ),
              )}
            </div>
          )}
        </aside>

        {/* ═══ CONTENT ═══ */}
        <main className="glass panel-cut relative min-w-0 p-5 sm:p-7">
          <span
            aria-hidden
            className="text-outline pointer-events-none absolute right-4 top-3 select-none font-display text-6xl font-black leading-none"
          >
            {String(activeStep + 1).padStart(2, '0')}
          </span>

          {/* Breadcrumb + bookmark */}
          <NoirBreadcrumb
            items={[
              { label: t('guides.reader.guides'), onClick: navigateGuidesHome },
              { label: category.label, onClick: () => navigateToGuideCategory(categoryId) },
              { label: guide.title },
            ]}
            right={
              <button
                type="button"
                onClick={() => toggleBookmark(entryId)}
                aria-label={
                  isBookmarked ? t('guides.reader.removeBookmark') : t('guides.reader.saveBookmark')
                }
                aria-pressed={isBookmarked}
                className={`panel-cut-sm grid h-7 w-7 place-items-center border transition-all duration-150 ${isBookmarked
                    ? 'border-gold bg-gold/12 text-gold'
                    : 'border-paper/15 text-paper/40 hover:border-gold/50 hover:text-gold'
                  }`}
              >
                {isBookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
              </button>
            }
          />

          {/* Meta */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DifficultyStamp
              level={guide.difficulty}
              label={t(`guides.common.${guide.difficulty}`)}
            />
            <TimeBadge>{guide.estimatedTime}</TimeBadge>
          </div>

          {/* Step content (animated swap) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.32, ease: EASE }}
              className="mt-5"
            >
              {currentStep.title && (
                <h2 className="mb-4 font-display text-xl font-black uppercase tracking-tight text-paper">
                  <span aria-hidden className="mr-2 text-crimson">
                    ¶
                  </span>
                  {currentStep.title}
                </h2>
              )}
              <GuideStepRendererNoir step={currentStep} />
            </motion.div>
          </AnimatePresence>

          {/* Step navigation */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-paper/10 pt-5">
            <button
              type="button"
              className="btn-ghost"
              disabled={activeStep <= 0}
              onClick={() => goToStep(activeStep - 1)}
            >
              <ChevronLeft size={13} /> {t('guides.reader.previous')}
            </button>

            {isLastStep ? (
              <button type="button" className="btn-primary" onClick={handleComplete}>
                <Check size={13} /> {t('guides.reader.completeGuide')}
                <span
                  aria-hidden
                  className="font-accent text-[14px] normal-case italic tracking-normal opacity-70"
                >
                  完了
                </span>
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => goToStep(activeStep + 1)}>
                {t('guides.reader.next')} <ChevronRight size={13} />
              </button>
            )}
          </div>
        </main>

        {/* ═══ TOC (xl only) ═══ */}
        <aside
          role="navigation"
          aria-label={t('guides.detail.tocAria')}
          className="sticky top-4 hidden xl:block"
        >
          <p className="mb-3 flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.25em] text-paper/35">
            {t('guides.detail.inThisGuide')}
            <span aria-hidden className="h-px flex-1 bg-paper/10" />
          </p>
          <div className="noir-scroll max-h-[62vh] space-y-0.5 overflow-y-auto">
            {allSteps.map((step, i) => {
              const active = i === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(i)}
                  className={`flex w-full items-center gap-2 border-l-2 py-1 pl-3 text-left text-[10.5px] transition-all ${active
                      ? 'border-l-crimson font-bold text-paper'
                      : i < activeStep
                        ? 'border-l-mint/40 text-paper/40 hover:text-paper/70'
                        : 'border-l-paper/10 text-paper/40 hover:border-l-paper/30 hover:text-paper/70'
                    }`}
                >
                  <span className="truncate">
                    {step.title ?? t('guides.detail.stepLabel', { index: i + 1 })}
                  </span>
                </button>
              );
            })}
          </div>

          <span
            aria-hidden
            className="v-text mt-6 block select-none font-display text-2xl font-black tracking-[0.3em] text-paper/[0.06]"
          >
            読ミ物
          </span>
        </aside>
      </div>
    </div>
  );
}
