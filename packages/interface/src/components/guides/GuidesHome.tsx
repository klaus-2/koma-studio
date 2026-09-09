/* ============================================================
   KŌMA STUDIO — Guides Home Dashboard
   Category cards, search bar, continue reading, bookmarks
   ============================================================ */

   import {
    BookOpen,
    ChevronRight,
    Clock,
    Search,
    Bookmark,
  } from 'lucide-react';
  import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
  
  import { GUIDE_CATEGORIES, GUIDES } from '../../data/guides-data';
  import { useInfoNavStore } from '../../stores/info-nav-store';
  import { useI18n } from '../../i18n';
  import GuideSearch from './GuideSearch';
  
  export default function GuidesHome() {
    const { t } = useI18n();
    const navigateToGuideCategory = useInfoNavStore((s) => s.navigateToGuideCategory);
    const navigateToGuideEntry = useInfoNavStore((s) => s.navigateToGuideEntry);
    const stepProgress = useInfoNavStore((s) => s.stepProgress);
    const readGuides = useInfoNavStore((s) => s.readGuides);
    const bookmarks = useInfoNavStore((s) => s.bookmarks);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
  
    // Keyboard shortcut: Ctrl+K
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
  
    // Find a guide in progress (not yet completed)
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
  
    return (
      <div className="koma-gr-page koma-gr-fadein">
        {/* Header */}
        <div className="koma-gr-header">
          <div className="koma-gr-header__row">
            <div className="koma-gr-header__icon">
              <BookOpen size={18} />
            </div>
            <h1 className="koma-gr-header__title">{t('guides.home.title')}</h1>
          </div>
          <p className="koma-gr-header__desc">
            {t('guides.home.description')}
          </p>
        </div>
  
        {/* Search Bar */}
        <div className="koma-gr-search" onClick={() => setSearchOpen(true)}>
          <input
            ref={searchInputRef}
            className="koma-gr-search__input"
            type="text"
            placeholder={t('guides.home.searchPlaceholder')}
            readOnly
            aria-label={t('guides.home.searchAria')}
          />
          <Search size={14} className="koma-gr-search__icon" />
          <span className="koma-gr-search__kbd" aria-hidden="true">
            {t('guides.home.searchShortcut')}
          </span>
        </div>
  
        {/* Continue Reading */}
        {inProgressGuide && (
          <div
            className="koma-gr-continue koma-gr-fadein"
            onClick={handleContinue}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleContinue();
            }}
          >
            <div className="koma-gr-continue__info">
              <div className="koma-gr-continue__label">{t('guides.home.continueReading')}</div>
              <div className="koma-gr-continue__title">{inProgressGuide.guide.title}</div>
              <div className="koma-gr-continue__meta">
                {t('guides.home.stepProgress', {
                  current: inProgressGuide.step + 1,
                  total: inProgressGuide.totalSteps,
                  time: inProgressGuide.guide.estimatedTime,
                })}
              </div>
              <div className="koma-gr-continue__progress-track">
                <div
                  className="koma-gr-continue__progress-fill"
                  style={{
                    width: `${((inProgressGuide.step + 1) / inProgressGuide.totalSteps) * 100}%`,
                  }}
                />
              </div>
            </div>
            <button type="button" className="koma-gr-continue__btn">
              {t('guides.home.continueCta')}
            </button>
          </div>
        )}
  
        {/* Categories */}
        <div className="koma-gr-section-heading">
          <span className="koma-gr-section-heading__text">{t('guides.home.categories')}</span>
          <div className="koma-gr-section-heading__line" />
        </div>
  
        <div className="koma-gr-grid koma-gr-stagger">
          {GUIDE_CATEGORIES.map((cat) => {
            const guidesInCat = GUIDES.filter((g) => g.category === cat.id);
            const completedCount = guidesInCat.filter((g) => readGuides[g.id]).length;
            const countLabel = `${guidesInCat.length} ${t('guides.home.guidesCountLabel', {
              suffix: guidesInCat.length !== 1 ? t('guides.home.guidesPluralSuffix') : '',
            })}${completedCount > 0 ? ` · ${completedCount} ${t('guides.home.completedCountLabel', {
              suffix: completedCount !== 1 ? t('guides.home.guidesPluralSuffix') : '',
            })}` : ''}`;
            return (
              <div
                key={cat.id}
                className={`koma-gr-card koma-gr-card--${cat.accentColor} koma-gr-fadein`}
                onClick={() => navigateToGuideCategory(cat.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigateToGuideCategory(cat.id);
                  }
                }}
              >
                <div className={`koma-gr-card__icon koma-gr-card__icon--${cat.accentColor}`}>
                  <cat.icon size={18} />
                </div>
                <h3 className="koma-gr-card__title">{cat.label}</h3>
                <p className="koma-gr-card__desc">{cat.description}</p>
                <div className="koma-gr-card__footer">
                  <span className="koma-gr-card__count">{countLabel}</span>
                  <ChevronRight size={14} className="koma-gr-card__arrow" />
                </div>
              </div>
            );
          })}
        </div>
  
        {/* Bookmarks */}
        {bookmarkedGuides.length > 0 && (
          <>
            <div className="koma-gr-section-heading" style={{ marginTop: 32 }}>
              <span className="koma-gr-section-heading__text">
                <Bookmark size={13} style={{ marginRight: 6, verticalAlign: -1 }} />
                {t('guides.home.saved', { count: bookmarkedGuides.length })}
              </span>
              <div className="koma-gr-section-heading__line" />
            </div>
            <div className="koma-gr-guide-list">
              {bookmarkedGuides.map((guide) => (
                <div
                  key={guide.id}
                  className="koma-gr-guide-item"
                  onClick={() => navigateToGuideEntry(guide.category, guide.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigateToGuideEntry(guide.category, guide.id);
                  }}
                >
                  <div className={`koma-gr-guide-item__icon koma-gr-card__icon--${guide.accentColor}`}>
                    <guide.icon size={16} />
                  </div>
                  <div className="koma-gr-guide-item__body">
                    <h4 className="koma-gr-guide-item__title">{guide.title}</h4>
                    <p className="koma-gr-guide-item__desc">{guide.subtitle}</p>
                  </div>
                  <div className="koma-gr-guide-item__meta">
                      <span className={`koma-gr-badge koma-gr-badge--${guide.difficulty}`}>
                      {guide.difficulty === 'beginner'
                        ? t('guides.common.beginner')
                        : guide.difficulty === 'intermediate'
                          ? t('guides.common.intermediate')
                          : t('guides.common.advanced')}
                    </span>
                    <span className="koma-gr-badge koma-gr-badge--time">
                      <Clock size={10} /> {guide.estimatedTime}
                    </span>
                  </div>
                  <ChevronRight size={14} className="koma-gr-guide-item__arrow" />
                </div>
              ))}
            </div>
          </>
        )}
  
        {/* Search Modal */}
        {searchOpen && <GuideSearch onClose={() => setSearchOpen(false)} />}
      </div>
    );
  }
