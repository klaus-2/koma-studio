'use client';

import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
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
  useRef,
} from 'react';

import {
  GUIDE_CATEGORIES,
  GUIDES,
} from '@/data/guides-data';
import type { GuideCategoryId } from '@/data/guides-types';
import { useI18n } from '@/i18n';

import GuideStepRendererV2 from './GuideStepRendererV2';
import {
  GUIDE_EASE,
  GuideDifficultyBadge,
  GuideEmptyState,
  GUIDE_TONE_STYLES,
  getGuideTone,
} from './GuideV2Primitives';
import { useGuideStoreCompat } from './guide-store-compat';

interface Props {
  categoryId: GuideCategoryId;
  entryId: string;
}

export default function GuideReaderV2({
  categoryId,
  entryId,
}: Props) {
  const { t } = useI18n();
  const reduceMotion =
    useReducedMotion();

  const scrollRef =
    useRef<HTMLDivElement>(null);

  const {
    navigateGuidesHome,
    navigateToGuideCategory,
    navigateToGuideEntry,

    activeSectionIdx,
    activeStepIdx,
    legacyActiveStep,

    setActiveSection,
    setActiveStep,
    setLegacyActiveStep,
    usesSectionPosition,

    saveStepProgress,
    markGuideRead,
    readGuides,

    bookmarks,
    toggleBookmark,
    recentlyViewed,
  } = useGuideStoreCompat();

  const category = useMemo(
    () =>
      GUIDE_CATEGORIES.find(
        (candidate) =>
          candidate.id === categoryId,
      ),
    [categoryId],
  );

  const guide = useMemo(
    () =>
      GUIDES.find(
        (candidate) =>
          candidate.id === entryId &&
          candidate.category ===
          categoryId,
      ),
    [categoryId, entryId],
  );

  const flatSteps = useMemo(() => {
    if (!guide) return [];

    return guide.sections.flatMap(
      (section, sectionIdx) =>
        section.steps.map(
          (step, stepIdx) => ({
            step,
            sectionIdx,
            stepIdx,
            sectionId: section.id,
            sectionTitle:
              section.title,
          }),
        ),
    );
  }, [guide]);

  const storedFlatIndex = useMemo(() => {
    if (!usesSectionPosition) {
      return legacyActiveStep;
    }

    return flatSteps.findIndex(
      (item) =>
        item.sectionIdx ===
        activeSectionIdx &&
        item.stepIdx === activeStepIdx,
    );
  }, [
    activeSectionIdx,
    activeStepIdx,
    flatSteps,
    legacyActiveStep,
    usesSectionPosition,
  ]);

  const currentFlatIndex =
    storedFlatIndex >= 0 &&
      storedFlatIndex < flatSteps.length
      ? storedFlatIndex
      : 0;

  const current =
    flatSteps[currentFlatIndex];

  const totalSteps =
    flatSteps.length;

  const progress =
    totalSteps > 0
      ? ((currentFlatIndex + 1) /
        totalSteps) *
      100
      : 0;

  const bookmarked =
    bookmarks.includes(entryId);

  const complete =
    Boolean(
      guide &&
      readGuides[guide.id],
    );

  const isLast =
    currentFlatIndex ===
    totalSteps - 1;

  const tone = getGuideTone(
    guide?.accentColor,
  );

  const toneStyles =
    GUIDE_TONE_STYLES[tone];

  const setPosition = useCallback(
    (flatIndex: number) => {
      const target =
        flatSteps[flatIndex];

      if (!target) return;

      if (usesSectionPosition) {
        setActiveSection?.(
          target.sectionIdx,
        );

        setActiveStep?.(
          target.stepIdx,
        );
      } else {
        setLegacyActiveStep?.(
          flatIndex,
        );
      }
    },
    [
      flatSteps,
      setActiveSection,
      setActiveStep,
      setLegacyActiveStep,
      usesSectionPosition,
    ],
  );

  useEffect(() => {
    if (
      flatSteps.length === 0 ||
      storedFlatIndex >= 0
    ) {
      return;
    }

    setPosition(0);
  }, [
    flatSteps.length,
    setPosition,
    storedFlatIndex,
  ]);

  useEffect(() => {
    if (!guide || !current) return;

    if (usesSectionPosition) {
      saveStepProgress?.(
        guide.id,
        current.sectionIdx,
        current.stepIdx,
      );
    } else {
      saveStepProgress?.(
        guide.id,
        currentFlatIndex,
      );
    }
  }, [
    current,
    currentFlatIndex,
    guide,
    saveStepProgress,
    usesSectionPosition,
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: 0,
      behavior: reduceMotion
        ? 'auto'
        : 'smooth',
    });
  }, [
    currentFlatIndex,
    reduceMotion,
  ]);

  const goPrevious = useCallback(() => {
    if (currentFlatIndex > 0) {
      setPosition(
        currentFlatIndex - 1,
      );
    }
  }, [
    currentFlatIndex,
    setPosition,
  ]);

  const goNext = useCallback(() => {
    if (
      currentFlatIndex <
      totalSteps - 1
    ) {
      setPosition(
        currentFlatIndex + 1,
      );

      return;
    }

    if (!guide) return;

    if (complete) {
      navigateToGuideCategory(
        categoryId,
      );
      return;
    }

    markGuideRead(guide.id);
  }, [
    categoryId,
    complete,
    currentFlatIndex,
    guide,
    markGuideRead,
    navigateToGuideCategory,
    setPosition,
    totalSteps,
  ]);

  const recentGuides = useMemo(
    () =>
      recentlyViewed
        .filter(
          (id) => id !== entryId,
        )
        .slice(0, 3)
        .map((id) =>
          GUIDES.find(
            (candidate) =>
              candidate.id === id,
          ),
        )
        .filter(
          (
            recent,
          ): recent is (typeof GUIDES)[number] =>
            Boolean(recent),
        ),
    [entryId, recentlyViewed],
  );

  if (
    !category ||
    !guide ||
    !current
  ) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="btn-ghost"
          onClick={
            navigateGuidesHome
          }
        >
          <ArrowLeft size={14} />
          {t(
            'guides.detail.back',
          )}
        </button>

        <GuideEmptyState
          icon={FileText}
          title={t(
            'guides.detail.notFound',
          )}
        />
      </div>
    );
  }

  const difficultyLabel =
    guide.difficulty === 'beginner'
      ? t('guides.common.beginner')
      : guide.difficulty ===
        'intermediate'
        ? t(
          'guides.common.intermediate',
        )
        : t(
          'guides.common.advanced',
        );

  return (
    <div
      className="relative isolate"
    >
      {/* Global progress rail */}
      <div
        className="sticky top-0 z-50 h-1.5 overflow-hidden bg-ink"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(
          progress,
        )}
        aria-label={t(
          'guides.reader.progressAria',
        )}
      >
        <motion.div
          animate={{
            scaleX: progress / 100,
          }}
          transition={{
            duration: reduceMotion
              ? 0
              : 0.48,
            ease: GUIDE_EASE,
          }}
          className={[
            'h-full',
            'w-full',
            'origin-left',
            toneStyles.solid,
          ].join(' ')}
        />
      </div>

      <div className="grid min-h-[calc(100dvh-5rem)] items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_15rem]">
        {/* Left index */}
        <aside
          className="glass panel-cut koma-scrollbar max-h-[72vh] overflow-y-auto lg:sticky lg:top-5 lg:max-h-[calc(100dvh-2.5rem)]"
          aria-label={t(
            'guides.detail.stepsAria',
          )}
        >
          <header className="sticky top-0 z-10 border-b border-paper/10 bg-ink-2/92 p-4 backdrop-blur-xl">
            <button
              type="button"
              className="panel-cut-sm inline-flex items-center gap-2 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-paper/38 transition hover:bg-paper/[0.04] hover:text-crimson"
              onClick={() =>
                navigateToGuideCategory(
                  categoryId,
                )
              }
            >
              <ChevronLeft
                size={13}
              />
              {category.label}
            </button>

            <h2 className="mt-4 font-display text-lg font-black uppercase leading-[0.95] tracking-[-0.04em] text-paper">
              {guide.title}
            </h2>

            <div className="mt-4 flex items-center gap-2">
              <span className="stamp">
                {currentFlatIndex + 1}/
                {totalSteps}
              </span>

              <span className="font-mono text-[0.56rem] uppercase tracking-[0.08em] text-paper/28">
                {Math.round(progress)}%
              </span>
            </div>
          </header>

          <nav className="space-y-5 p-3">
            {guide.sections.map(
              (
                section,
                sectionIdx,
              ) => (
                <div key={section.id}>
                  <p className="mb-2 px-2 font-mono text-[0.55rem] font-bold uppercase tracking-[0.12em] text-paper/24">
                    {String(
                      sectionIdx + 1,
                    ).padStart(2, '0')}{' '}
                    / {section.title}
                  </p>

                  <div className="space-y-1">
                    {section.steps.map(
                      (
                        step,
                        stepIdx,
                      ) => {
                        const flatIndex =
                          flatSteps.findIndex(
                            (item) =>
                              item.sectionIdx ===
                              sectionIdx &&
                              item.stepIdx ===
                              stepIdx,
                          );

                        const active =
                          flatIndex ===
                          currentFlatIndex;

                        const done =
                          flatIndex <
                          currentFlatIndex;

                        return (
                          <button
                            key={
                              step.id
                            }
                            type="button"
                            aria-current={
                              active
                                ? 'step'
                                : undefined
                            }
                            className={[
                              'panel-cut-sm flex w-full items-center gap-3 border px-3 py-2.5 text-left transition',
                              active
                                ? `${toneStyles.border} ${toneStyles.background} ${toneStyles.shadow}`
                                : done
                                  ? 'border-mint/15 bg-mint/[0.025]'
                                  : 'border-transparent hover:border-paper/10 hover:bg-paper/[0.025]',
                            ].join(' ')}
                            onClick={() =>
                              setPosition(
                                flatIndex,
                              )
                            }
                          >
                            <span
                              className={[
                                'grid size-6 shrink-0 place-items-center border font-mono text-[0.58rem] font-bold panel-cut-sm',
                                active
                                  ? `${toneStyles.border} ${toneStyles.solid} text-ink`
                                  : done
                                    ? 'border-mint bg-mint text-ink'
                                    : 'border-paper/12 bg-ink text-paper/35',
                              ].join(' ')}
                              aria-hidden="true"
                            >
                              {done ? (
                                <Check
                                  size={
                                    12
                                  }
                                />
                              ) : (
                                flatIndex +
                                1
                              )}
                            </span>

                            <span
                              className={[
                                'line-clamp-2 text-xs leading-4',
                                active
                                  ? 'font-semibold text-paper'
                                  : done
                                    ? 'text-paper/38'
                                    : 'text-paper/46',
                              ].join(' ')}
                            >
                              {step.title ??
                                t(
                                  'guides.detail.stepLabel',
                                  {
                                    index:
                                      flatIndex +
                                      1,
                                  },
                                )}
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              ),
            )}
          </nav>

          {recentGuides.length > 0 ? (
            <div className="border-t border-paper/10 p-3">
              <p className="mb-2 px-2 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-paper/24">
                {t(
                  'guides.detail.recent',
                )}
              </p>

              <div className="space-y-1">
                {recentGuides.map(
                  (recent) => (
                    <button
                      key={recent.id}
                      type="button"
                      className="panel-cut-sm flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-paper/35 transition hover:bg-paper/[0.035] hover:text-paper"
                      onClick={() =>
                        navigateToGuideEntry(
                          recent.category,
                          recent.id,
                        )
                      }
                    >
                      <FileText
                        size={12}
                        className="shrink-0 text-crimson"
                      />
                      <span className="line-clamp-1">
                        {recent.title}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </aside>

        {/* Content */}
        <main className="glass panel-cut min-w-0 overflow-hidden">
          <div
            ref={scrollRef}
            className="koma-scrollbar max-h-none overflow-y-auto lg:max-h-[calc(100dvh-2.5rem)]"
          >
            <div className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10">
              <nav
                className="flex flex-wrap items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-paper/28"
                aria-label="Breadcrumb"
              >
                <button
                  type="button"
                  className="panel-cut-sm px-2 py-1 transition hover:bg-paper/[0.04] hover:text-crimson"
                  onClick={
                    navigateGuidesHome
                  }
                >
                  {t(
                    'guides.detail.guides',
                  )}
                </button>

                <span>/</span>

                <button
                  type="button"
                  className="panel-cut-sm px-2 py-1 transition hover:bg-paper/[0.04] hover:text-crimson"
                  onClick={() =>
                    navigateToGuideCategory(
                      categoryId,
                    )
                  }
                >
                  {category.label}
                </button>

                <span>/</span>

                <span className="max-w-48 truncate text-paper/48">
                  {guide.title}
                </span>

                <button
                  type="button"
                  className={[
                    'panel-cut-sm ml-auto inline-flex min-h-9 items-center gap-2 border px-3',
                    'font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] transition',
                    bookmarked
                      ? 'border-crimson/50 bg-crimson/10 text-crimson'
                      : 'border-paper/10 bg-paper/[0.025] text-paper/35 hover:border-crimson/40 hover:text-crimson',
                  ].join(' ')}
                  aria-pressed={
                    bookmarked
                  }
                  aria-label={
                    bookmarked
                      ? t(
                        'guides.detail.removeFavorite',
                      )
                      : t(
                        'guides.detail.addFavorite',
                      )
                  }
                  onClick={() =>
                    toggleBookmark(
                      entryId,
                    )
                  }
                >
                  {bookmarked ? (
                    <BookmarkCheck
                      size={14}
                    />
                  ) : (
                    <Bookmark
                      size={14}
                    />
                  )}

                  {bookmarked
                    ? t(
                      'guides.detail.saved',
                    )
                    : t(
                      'guides.detail.save',
                    )}
                </button>
              </nav>

              <header className="relative mt-9 overflow-hidden border-b border-paper/[0.065] pb-8">
                <span
                  className="text-outline pointer-events-none absolute right-0 top-0 font-display text-8xl font-black leading-none"
                  aria-hidden="true"
                >
                  {String(
                    currentFlatIndex +
                    1,
                  ).padStart(2, '0')}
                </span>

                <div className="relative z-10">
                  <span className="kicker">
                    //{' '}
                    {t(
                      'guides.detail.stepCounter',
                      {
                        current:
                          currentFlatIndex +
                          1,
                        total:
                          totalSteps,
                      },
                    )}
                  </span>

                  <h1 className="mt-4 max-w-3xl font-display text-3xl font-black uppercase leading-[0.9] tracking-[-0.055em] text-paper sm:text-5xl">
                    {current.step.title ??
                      t(
                        'guides.detail.stepLabel',
                        {
                          index:
                            currentFlatIndex +
                            1,
                        },
                      )}
                  </h1>

                  <p className="mt-3 font-accent text-lg italic text-crimson">
                    {
                      current.sectionTitle
                    }
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <GuideDifficultyBadge
                      difficulty={
                        guide.difficulty
                      }
                      label={
                        difficultyLabel
                      }
                    />

                    <span className="inline-flex items-center gap-1.5 border border-paper/10 bg-paper/[0.025] px-2 py-1 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-paper/36 panel-cut-sm">
                      <Clock size={10} />
                      {
                        guide.estimatedTime
                      }
                    </span>

                    {complete ? (
                      <span className="stamp !border-mint/45 !bg-mint/10 !text-mint">
                        <Check size={10} />
                        {t(
                          'guides.detail.completed',
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
              </header>

              <AnimatePresence
                mode="wait"
              >
                <motion.article
                  key={`${current.sectionIdx}-${current.stepIdx}`}
                  initial={
                    reduceMotion
                      ? false
                      : {
                        opacity: 0,
                        y: 18,
                        clipPath:
                          'inset(0 0 8% 0)',
                      }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                    clipPath:
                      'inset(0 0 0% 0)',
                  }}
                  exit={{
                    opacity: 0,
                    y: -10,
                  }}
                  transition={{
                    duration:
                      reduceMotion
                        ? 0
                        : 0.46,
                    ease: GUIDE_EASE,
                  }}
                  className="py-8"
                >
                  <GuideStepRendererV2
                    step={current.step}
                  />
                </motion.article>
              </AnimatePresence>

              <footer className="grid gap-3 border-t border-paper/[0.065] pt-6 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-ghost min-h-12 justify-start"
                  disabled={
                    currentFlatIndex === 0
                  }
                  onClick={goPrevious}
                >
                  <ChevronLeft size={15} />
                  {t(
                    'guides.detail.previous',
                  )}
                </button>

                <button
                  type="button"
                  className={[
                    'min-h-12',
                    isLast
                      ? complete
                        ? 'btn-ghost'
                        : 'btn-primary'
                      : 'btn-primary',
                  ].join(' ')}
                  onClick={goNext}
                >
                  {isLast ? (
                    <>
                      <Check size={15} />
                      {complete
                        ? t(
                          'guides.detail.completed',
                        )
                        : t(
                          'guides.detail.complete',
                        )}
                    </>
                  ) : (
                    <>
                      {t(
                        'guides.detail.next',
                      )}
                      <ChevronRight
                        size={15}
                      />
                    </>
                  )}
                </button>
              </footer>
            </div>
          </div>
        </main>

        {/* Right TOC */}
        <aside
          className="glass panel-cut hidden max-h-[calc(100dvh-2.5rem)] overflow-hidden 2xl:sticky 2xl:top-5 2xl:block"
          aria-label={t(
            'guides.detail.tocAria',
          )}
        >
          <header className="border-b border-paper/10 p-4">
            <span className="kicker block">
              // Navigation
            </span>

            <h2 className="mt-1 font-display text-sm font-black uppercase text-paper">
              {t(
                'guides.detail.inThisGuide',
              )}
            </h2>
          </header>

          <nav className="koma-scrollbar max-h-[calc(100dvh-12rem)] space-y-1 overflow-y-auto p-3">
            {flatSteps.map(
              (item, index) => {
                const active =
                  index ===
                  currentFlatIndex;

                const done =
                  index <
                  currentFlatIndex;

                return (
                  <button
                    key={`${item.sectionIdx}-${item.stepIdx}`}
                    type="button"
                    aria-current={
                      active
                        ? 'step'
                        : undefined
                    }
                    className={[
                      'panel-cut-sm flex w-full items-start gap-2 border px-2.5 py-2 text-left transition',
                      active
                        ? `${toneStyles.border} ${toneStyles.background}`
                        : 'border-transparent hover:bg-paper/[0.025]',
                    ].join(' ')}
                    onClick={() =>
                      setPosition(index)
                    }
                  >
                    <span
                      className={[
                        'mt-1.5 size-1.5 shrink-0',
                        active
                          ? toneStyles.solid
                          : done
                            ? 'bg-mint'
                            : 'bg-paper/15',
                      ].join(' ')}
                      aria-hidden="true"
                    />

                    <span
                      className={[
                        'text-[0.67rem] leading-4',
                        active
                          ? 'font-semibold text-paper'
                          : done
                            ? 'text-paper/32'
                            : 'text-paper/42',
                      ].join(' ')}
                    >
                      {item.step.title ??
                        t(
                          'guides.detail.stepLabel',
                          {
                            index:
                              index +
                              1,
                          },
                        )}
                    </span>
                  </button>
                );
              },
            )}
          </nav>
        </aside>
      </div>
    </div>
  );
}
