/* ============================================================
   KŌMA STUDIO — Guide Reader
   Sidebar navigation + content + progress bar + step nav
   ============================================================ */

   import {
    ArrowLeft,
    Bookmark,
    BookmarkCheck,
    Check,
    ChevronLeft,
    ChevronRight,
    FileText,
  } from 'lucide-react';
  import { useCallback, useMemo } from 'react';
  
  import { GUIDE_CATEGORIES, GUIDES } from '../../data/guides-data';
  import type { GuideCategoryId, GuideStep } from '../../data/guides-types';
  import { useInfoNavStore } from '../../stores/info-nav-store';
  import { useI18n } from '../../i18n';
  import GuideStepRenderer from './GuideStepRenderer';
  
  interface Props {
    categoryId: GuideCategoryId;
    entryId: string;
  }
  
  export default function GuideReader({ categoryId, entryId }: Props) {
    const { t } = useI18n();
    const navigateGuidesHome = useInfoNavStore((s) => s.navigateGuidesHome);
    const navigateToGuideCategory = useInfoNavStore((s) => s.navigateToGuideCategory);
    const activeStep = useInfoNavStore((s) => s.guidesActiveStep);
    const setActiveStep = useInfoNavStore((s) => s.setGuidesActiveStep);
    const bookmarks = useInfoNavStore((s) => s.bookmarks);
    const toggleBookmark = useInfoNavStore((s) => s.toggleBookmark);
    const markGuideRead = useInfoNavStore((s) => s.markGuideRead);
    const recentlyViewed = useInfoNavStore((s) => s.recentGuides);
    const navigateToGuideEntry = useInfoNavStore((s) => s.navigateToGuideEntry);
  
    const category = GUIDE_CATEGORIES.find((c) => c.id === categoryId);
    const guide = GUIDES.find((g) => g.id === entryId);
  
    // Flatten all steps across sections
    const allSteps = useMemo<Array<GuideStep & { sectionTitle: string }>>(() => {
      if (!guide) return [];
      return guide.sections.flatMap((section) =>
        section.steps.map((step) => ({ ...step, sectionTitle: section.title })),
      );
    }, [guide]);
  
    const totalSteps = allSteps.length;
    const currentStep = allSteps[activeStep];
    const progressPercent = totalSteps > 0 ? ((activeStep + 1) / totalSteps) * 100 : 0;
    const isBookmarked = bookmarks.includes(entryId);
    const isLastStep = activeStep >= totalSteps - 1;
  
    const goToStep = useCallback(
      (idx: number) => {
        if (idx >= 0 && idx < totalSteps) {
          setActiveStep(idx);
        }
      },
      [setActiveStep, totalSteps],
    );

        /* ── Recently viewed guides for sidebar ── */
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

    // Identify which section headers belong before which step indices
    const sectionBreaks = useMemo(() => {
      const breaks: Record<number, string> = {};
      if (!guide) return breaks;
      let idx = 0;
      for (const section of guide.sections) {
        if (section.steps.length > 0) {
          breaks[idx] = section.title;
        }
        idx += section.steps.length;
      }
      return breaks;
    }, [guide]);

    if (!category || !guide || !currentStep) {
      return (
        <div className="koma-gr-page koma-gr-fadein">
          <button type="button" className="koma-gr-back" onClick={navigateGuidesHome}>
            <ArrowLeft size={13} /> {t('guides.reader.backToGuides')}
          </button>
          <div className="koma-gr-empty">
            <p className="koma-gr-empty__title">{t('guides.reader.notFound')}</p>
          </div>
        </div>
      );
    }
  
    return (
      <div className="koma-gr-page" style={{ padding: 0 }}>
        {/* Progress bar */}
        <div className="koma-gr-progress" role="progressbar" aria-valuenow={progressPercent} aria-label={t('guides.reader.progressAria')}>
          <div className="koma-gr-progress__fill" style={{ width: `${progressPercent}%` }} />
          <span className="koma-gr-progress__label">
            {activeStep + 1} / {totalSteps}
          </span>
        </div>
  
        <div className="koma-gr-reader">
          {/* ── SIDEBAR ── */}
          <aside className="koma-gr-sidebar" role="navigation" aria-label={t('guides.reader.stepsAria')}>
            <button type="button" className="koma-gr-sidebar__back" onClick={() => navigateToGuideCategory(categoryId)}>
              <ArrowLeft size={13} /> {category.label}
            </button>
  
            <div className="koma-gr-sidebar__title">{guide.title}</div>
  
            <ul className="koma-gr-sidebar__steps">
              {allSteps.map((step, idx) => {
                const isCompleted = idx < activeStep;
                const isActive = idx === activeStep;
                const sectionLabel = sectionBreaks[idx];
  
                return (
                  <li key={step.id}>
                    {sectionLabel && (
                      <div className="koma-gr-sidebar__section-label">{sectionLabel}</div>
                    )}
                    <div
                      className={[
                        'koma-gr-sidebar__step',
                        isActive && 'koma-gr-sidebar__step--active',
                        isCompleted && 'koma-gr-sidebar__step--completed',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => goToStep(idx)}
                      role="button"
                      tabIndex={0}
                      aria-current={isActive ? 'step' : undefined}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') goToStep(idx);
                      }}
                    >
                      <span className="koma-gr-sidebar__step-num">
                        {isCompleted ? <Check size={12} /> : idx + 1}
                      </span>
                      <span className="koma-gr-sidebar__step-label">
                        {step.title || t('guides.reader.stepLabel', { index: idx + 1 })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Recent */}
          {recentGuides.length > 0 && (
            <div className="koma-gr-sidebar__recent">
              <p className="koma-gr-sidebar__recent-label">{t('guides.reader.recent')}</p>
              {recentGuides.map(
                (rg) =>
                  rg && (
                    <button
                      key={rg.id}
                      type="button"
                      className="koma-gr-sidebar__recent-item"
                      onClick={() => navigateToGuideEntry(rg.category, rg.id)}
                    >
                      <FileText size={11} />
                      {rg.title}
                    </button>
                  ),
              )}
            </div>
          )}
          </aside>
  
          {/* ── CONTENT ── */}
          <main className="koma-gr-content">
            {/* Breadcrumb */}
            <div className="koma-gr-breadcrumb">
              <button type="button" className="koma-gr-breadcrumb__link" onClick={navigateGuidesHome}>
                {t('guides.reader.guides')}
              </button>
              <span className="koma-gr-breadcrumb__sep">›</span>
              <button type="button" className="koma-gr-breadcrumb__link" onClick={() => navigateToGuideCategory(categoryId)}>
                {category.label}
              </button>
              <span className="koma-gr-breadcrumb__sep">›</span>
              <span className="koma-gr-breadcrumb__current">{guide.title}</span>
  
              {/* Bookmark */}
              <button
                type="button"
                onClick={() => toggleBookmark(entryId)}
                aria-label={isBookmarked ? t('guides.reader.removeBookmark') : t('guides.reader.saveBookmark')}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: isBookmarked ? 'var(--auth-purple)' : 'var(--auth-text-muted)',
                  transition: 'color .15s ease',
                  padding: 4,
                }}
              >
                {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </button>
            </div>
  
            {/* Step content */}
            <div className="koma-gr-content__inner koma-gr-fadein" key={activeStep}>
              {currentStep.title && (
                <h2 className="koma-gr-content__step-title">{currentStep.title}</h2>
              )}
  
              <GuideStepRenderer step={currentStep} />
            </div>
  
            {/* Step Navigation */}
            <div className="koma-gr-step-nav">
              <button
                type="button"
                className="koma-gr-step-nav__btn koma-gr-step-nav__btn--prev"
                disabled={activeStep <= 0}
                onClick={() => goToStep(activeStep - 1)}
              >
                <ChevronLeft size={16} /> {t('guides.reader.previous')}
              </button>
  
              {isLastStep ? (
                <button
                  type="button"
                  className="koma-gr-step-nav__btn koma-gr-step-nav__btn--next koma-gr-step-nav__btn--complete"
                  onClick={handleComplete}
                >
                  <Check size={16} /> {t('guides.reader.completeGuide')}
                </button>
              ) : (
                <button
                  type="button"
                  className="koma-gr-step-nav__btn koma-gr-step-nav__btn--next"
                  onClick={() => goToStep(activeStep + 1)}
                >
                  {t('guides.reader.next')} <ChevronRight size={16} />
                </button>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }
