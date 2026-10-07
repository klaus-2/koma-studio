'use client';

import {
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  GUIDE_CATEGORIES,
  GUIDES,
} from '@/data/guides-data';
import { useI18n } from '@/i18n';

import GuideSearchV2 from './GuideSearchV2';
import {
  GUIDE_EASE,
  GuideDifficultyBadge,
  GuideMetric,
  GuidesEditorialHero,
  GuideSectionHeading,
  GUIDE_TONE_STYLES,
  getGuideTone,
} from './GuideV2Primitives';
import {
  type StoredGuideProgress,
  useGuideStoreCompat,
} from './guide-store-compat';

function resolveFlatProgress(
  guide: (typeof GUIDES)[number],
  progress: StoredGuideProgress,
): number {
  const totalSteps =
    guide.sections.reduce(
      (sum, section) =>
        sum + section.steps.length,
      0,
    );

  if (typeof progress === 'number') {
    return Math.min(
      Math.max(0, progress),
      Math.max(0, totalSteps - 1),
    );
  }

  const sectionIdx =
    progress.sectionIdx ??
    progress.section ??
    0;

  const stepIdx =
    progress.stepIdx ??
    progress.step ??
    0;

  const stepsBeforeSection =
    guide.sections
      .slice(0, sectionIdx)
      .reduce(
        (sum, section) =>
          sum + section.steps.length,
        0,
      );

  return Math.min(
    Math.max(
      0,
      stepsBeforeSection + stepIdx,
    ),
    Math.max(0, totalSteps - 1),
  );
}

export default function GuidesHomeV2() {
  const { t } = useI18n();
  const reduceMotion =
    useReducedMotion();

  const {
    navigateToGuideCategory,
    navigateToGuideEntry,
    stepProgress,
    readGuides,
    bookmarks,
  } = useGuideStoreCompat();

  const [searchOpen, setSearchOpen] =
    useState(false);

  useEffect(() => {
    const handler = (
      event: KeyboardEvent,
    ) => {
      if (
        (event.metaKey ||
          event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener(
      'keydown',
      handler,
    );

    return () =>
      window.removeEventListener(
        'keydown',
        handler,
      );
  }, []);

  const completedCount = useMemo(
    () =>
      GUIDES.filter(
        (guide) =>
          readGuides[guide.id],
      ).length,
    [readGuides],
  );

  const inProgressGuide =
    useMemo(() => {
      for (const [
        guideId,
        progress,
      ] of Object.entries(
        stepProgress,
      )) {
        if (readGuides[guideId]) {
          continue;
        }

        const guide = GUIDES.find(
          (candidate) =>
            candidate.id === guideId,
        );

        if (!guide) continue;

        const flatStep =
          resolveFlatProgress(
            guide,
            progress,
          );

        if (flatStep <= 0) continue;

        const totalSteps =
          guide.sections.reduce(
            (sum, section) =>
              sum +
              section.steps.length,
            0,
          );

        return {
          guide,
          flatStep,
          totalSteps,
        };
      }

      return null;
    }, [
      readGuides,
      stepProgress,
    ]);

  const bookmarkedGuides =
    useMemo(
      () =>
        GUIDES.filter((guide) =>
          bookmarks.includes(guide.id),
        ),
      [bookmarks],
    );

  const continueReading =
    useCallback(() => {
      if (!inProgressGuide) return;

      navigateToGuideEntry(
        inProgressGuide.guide
          .category,
        inProgressGuide.guide.id,
      );
    }, [
      inProgressGuide,
      navigateToGuideEntry,
    ]);

  return (
    <div
      className="relative isolate space-y-7"
    >
      <GuidesEditorialHero
        index="05"
        kicker="Scanlation academy"
        title={t('guides.home.title')}
        accentWord="archive"
        description={t(
          'guides.home.description',
        )}
        icon={BookOpen}
        metrics={
          <>
            <GuideMetric
              icon={FileText}
              value={GUIDES.length}
              label="Guides"
              tone="crimson"
            />

            <GuideMetric
              icon={Check}
              value={completedCount}
              label="Completed"
              tone="mint"
            />

            <GuideMetric
              icon={Bookmark}
              value={bookmarks.length}
              label="Saved"
              tone="gold"
            />
          </>
        }
      />

      {/* Search console */}
      <button
        type="button"
        className="glass panel-cut-sm group flex w-full items-center gap-4 border-paper/10 p-3 text-left transition hover:-translate-x-1 hover:-translate-y-1 hover:border-crimson/40 hover:drop-shadow-[6px_6px_0_rgba(255,46,99,0.28)] sm:p-4"
        aria-label={t(
          'guides.home.searchAria',
        )}
        onClick={() =>
          setSearchOpen(true)
        }
      >
        <span
          className="grid size-11 shrink-0 place-items-center border border-crimson/30 bg-crimson/10 text-crimson panel-cut-sm transition group-hover:bg-crimson group-hover:text-ink"
          aria-hidden="true"
        >
          <Search size={18} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="kicker block">
            // Global index
          </span>

          <span className="mt-1 block truncate text-sm text-paper/42">
            {t(
              'guides.home.searchPlaceholder',
            )}
          </span>
        </span>

        <kbd className="hidden border border-paper/10 bg-paper/[0.035] px-3 py-2 font-mono text-[0.62rem] text-paper/40 panel-cut-sm sm:block">
          {t(
            'guides.home.searchShortcut',
          )}
        </kbd>
      </button>

      {/* Marquee */}
      <div
        className="koma-guide-marquee overflow-hidden border-y border-paper/[0.065] py-2"
        aria-hidden="true"
      >
        <div className="koma-guide-marquee__track font-display text-sm font-black uppercase tracking-[0.12em] text-paper/16">
          {[
            'TRANSLATION',
            'CLEANING',
            'REDRAW',
            'TYPESETTING',
            'QUALITY CONTROL',
            'EXPORT',
            'TRANSLATION',
            'CLEANING',
            'REDRAW',
            'TYPESETTING',
            'QUALITY CONTROL',
            'EXPORT',
          ].map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="flex items-center gap-5"
            >
              {label}
              <span className="size-1.5 rotate-45 bg-crimson" />
            </span>
          ))}
        </div>
      </div>

      {/* Continue */}
      {inProgressGuide ? (
        <motion.button
          type="button"
          initial={
            reduceMotion
              ? false
              : {
                opacity: 0,
                y: 16,
              }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          whileHover={
            reduceMotion
              ? undefined
              : {
                x: -3,
                y: -3,
              }
          }
          transition={{
            duration: reduceMotion
              ? 0
              : 0.45,
            ease: GUIDE_EASE,
          }}
          className="glass panel-cut relative w-full overflow-hidden border-crimson/20 p-5 text-left drop-shadow-[7px_7px_0_rgba(255,46,99,0.22)] sm:p-6"
          onClick={continueReading}
        >
          <div
            className="halftone-red pointer-events-none absolute -right-10 -top-10 size-52 opacity-35"
            aria-hidden="true"
          />

          <span
            className="text-outline pointer-events-none absolute right-5 top-0 font-display text-7xl font-black leading-none"
            aria-hidden="true"
          >
            NEXT
          </span>

          <div className="relative z-10 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <span className="stamp">
                <span
                  className="koma-blink size-1.5 bg-crimson"
                  aria-hidden="true"
                />
                {t(
                  'guides.home.continueReading',
                )}
              </span>

              <h2 className="mt-4 max-w-2xl font-display text-2xl font-black uppercase leading-none tracking-[-0.045em] text-paper">
                {
                  inProgressGuide.guide
                    .title
                }
              </h2>

              <p className="mt-2 font-mono text-[0.64rem] uppercase tracking-[0.08em] text-paper/36">
                {t(
                  'guides.home.stepProgress',
                  {
                    current:
                      inProgressGuide.flatStep +
                      1,
                    total:
                      inProgressGuide.totalSteps,
                    time: inProgressGuide
                      .guide
                      .estimatedTime,
                  },
                )}
              </p>

              <div
                className="mt-5 h-2 max-w-xl overflow-hidden bg-paper/[0.055] panel-cut-sm"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={
                  inProgressGuide.totalSteps
                }
                aria-valuenow={
                  inProgressGuide.flatStep +
                  1
                }
              >
                <motion.div
                  initial={
                    reduceMotion
                      ? false
                      : { width: 0 }
                  }
                  animate={{
                    width: `${((inProgressGuide.flatStep +
                        1) /
                        inProgressGuide.totalSteps) *
                      100
                      }%`,
                  }}
                  transition={{
                    duration:
                      reduceMotion
                        ? 0
                        : 0.8,
                    ease: GUIDE_EASE,
                  }}
                  className="h-full bg-crimson"
                />
              </div>
            </div>

            <span className="btn-primary">
              {t(
                'guides.home.continueCta',
              )}
              <ChevronRight size={15} />
            </span>
          </div>
        </motion.button>
      ) : null}

      {/* Categories */}
      <section>
        <GuideSectionHeading
          index="01"
          icon={Sparkles}
          title={t(
            'guides.home.categories',
          )}
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{
            once: true,
            amount: 0.08,
          }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren:
                  reduceMotion
                    ? 0
                    : 0.07,
              },
            },
          }}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {GUIDE_CATEGORIES.map(
            (category, index) => {
              const guidesInCategory =
                GUIDES.filter(
                  (guide) =>
                    guide.category ===
                    category.id,
                );

              const categoryCompleted =
                guidesInCategory.filter(
                  (guide) =>
                    readGuides[guide.id],
                ).length;

              const tone = getGuideTone(
                category.accentColor,
              );

              const styles =
                GUIDE_TONE_STYLES[
                tone
                ];

              const Icon =
                category.icon;

              return (
                <motion.button
                  key={category.id}
                  type="button"
                  variants={{
                    hidden: {
                      opacity: 0,
                      y: 18,
                    },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration:
                          reduceMotion
                            ? 0
                            : 0.46,
                        ease: GUIDE_EASE,
                      },
                    },
                  }}
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                        x: -3,
                        y: -3,
                      }
                  }
                  className={[
                    'glass panel-cut-sm relative min-h-60 overflow-hidden p-5 text-left',
                    styles.border,
                    styles.shadow,
                  ].join(' ')}
                  onClick={() =>
                    navigateToGuideCategory(
                      category.id,
                    )
                  }
                >
                  <span
                    className="text-outline pointer-events-none absolute right-4 top-1 font-display text-6xl font-black leading-none"
                    aria-hidden="true"
                  >
                    {String(
                      index + 1,
                    ).padStart(2, '0')}
                  </span>

                  <span
                    className={[
                      'grid size-11 place-items-center border panel-cut-sm',
                      styles.border,
                      styles.background,
                      styles.text,
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <Icon size={18} />
                  </span>

                  <h3 className="mt-6 pr-10 font-display text-xl font-black uppercase leading-none tracking-[-0.04em] text-paper">
                    {category.label}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-xs leading-5 text-paper/40">
                    {
                      category.description
                    }
                  </p>

                  <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-4 border-t border-paper/[0.065] pt-4">
                    <span className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-paper/32">
                      {
                        guidesInCategory.length
                      }{' '}
                      guides
                      {categoryCompleted > 0
                        ? ` / ${categoryCompleted} ✓`
                        : ''}
                    </span>

                    <ChevronRight
                      size={15}
                      className={
                        styles.text
                      }
                    />
                  </div>
                </motion.button>
              );
            },
          )}
        </motion.div>
      </section>

      {/* Bookmarks */}
      {bookmarkedGuides.length > 0 ? (
        <section>
          <GuideSectionHeading
            index="02"
            icon={Bookmark}
            title={t(
              'guides.home.saved',
              {
                count:
                  bookmarkedGuides.length,
              },
            )}
          />

          <div className="grid gap-3">
            {bookmarkedGuides.map(
              (guide, index) => {
                const Icon =
                  guide.icon;

                const tone =
                  getGuideTone(
                    guide.accentColor,
                  );

                const styles =
                  GUIDE_TONE_STYLES[
                  tone
                  ];

                const difficultyLabel =
                  guide.difficulty ===
                    'beginner'
                    ? t(
                      'guides.common.beginner',
                    )
                    : guide.difficulty ===
                      'intermediate'
                      ? t(
                        'guides.common.intermediate',
                      )
                      : t(
                        'guides.common.advanced',
                      );

                return (
                  <button
                    key={guide.id}
                    type="button"
                    className="offset-card glass panel-cut-sm grid w-full gap-4 p-4 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center"
                    onClick={() =>
                      navigateToGuideEntry(
                        guide.category,
                        guide.id,
                      )
                    }
                  >
                    <span
                      className={[
                        'grid size-10 place-items-center border panel-cut-sm',
                        styles.border,
                        styles.background,
                        styles.text,
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      <Icon size={16} />
                    </span>

                    <span className="min-w-0">
                      <span className="kicker block text-[0.54rem]">
                        Saved file /{' '}
                        {String(
                          index + 1,
                        ).padStart(2, '0')}
                      </span>

                      <strong className="mt-1 block truncate font-display text-sm font-black uppercase tracking-[-0.025em] text-paper">
                        {guide.title}
                      </strong>

                      <span className="mt-1 block truncate text-xs text-paper/34">
                        {guide.subtitle}
                      </span>
                    </span>

                    <GuideDifficultyBadge
                      difficulty={
                        guide.difficulty
                      }
                      label={
                        difficultyLabel
                      }
                    />

                    <span className="flex items-center gap-1.5 font-mono text-[0.6rem] text-paper/34">
                      <Clock size={11} />
                      {
                        guide.estimatedTime
                      }
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </section>
      ) : null}

      <AnimatePresence>
        {searchOpen ? (
          <GuideSearchV2
            onClose={() =>
              setSearchOpen(false)
            }
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
