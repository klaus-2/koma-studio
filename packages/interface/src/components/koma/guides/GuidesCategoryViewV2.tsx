'use client';

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Search,
} from 'lucide-react';
import {
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  useMemo,
  useState,
} from 'react';

import {
  GUIDE_CATEGORIES,
  GUIDES,
} from '@/data/guides-data';
import type { GuideCategoryId } from '@/data/guides-types';
import { useI18n } from '@/i18n';

import {
  GUIDE_EASE,
  GuideDifficultyBadge,
  GuideEmptyState,
  GuideMetric,
  GuidesEditorialHero,
  GUIDE_TONE_STYLES,
  getGuideTone,
} from './GuideV2Primitives';
import { useGuideStoreCompat } from './guide-store-compat';

interface Props {
  categoryId: GuideCategoryId;
}

export default function GuidesCategoryViewV2({
  categoryId,
}: Props) {
  const { t } = useI18n();
  const reduceMotion =
    useReducedMotion();

  const {
    navigateGuidesHome,
    navigateToGuideEntry,
    readGuides,
  } = useGuideStoreCompat();

  const [search, setSearch] =
    useState('');

  const category = useMemo(
    () =>
      GUIDE_CATEGORIES.find(
        (candidate) =>
          candidate.id === categoryId,
      ),
    [categoryId],
  );

  const allGuides = useMemo(
    () =>
      GUIDES.filter(
        (guide) =>
          guide.category === categoryId,
      ),
    [categoryId],
  );

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) return allGuides;

    return allGuides.filter(
      (guide) =>
        guide.title
          .toLowerCase()
          .includes(query) ||
        guide.subtitle
          .toLowerCase()
          .includes(query) ||
        guide.tags.some((tag) =>
          tag
            .toLowerCase()
            .includes(query),
        ),
    );
  }, [allGuides, search]);

  if (!category) {
    return (
      <GuideEmptyState
        title={t(
          'guides.detail.notFound',
        )}
      />
    );
  }

  const CategoryIcon = category.icon;

  const tone = getGuideTone(
    category.accentColor,
  );

  const completedCount =
    allGuides.filter(
      (guide) =>
        readGuides[guide.id],
    ).length;

  return (
    <div className="space-y-6">
      <nav
        className="flex flex-wrap items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-paper/30"
        aria-label="Breadcrumb"
      >
        <button
          type="button"
          className="panel-cut-sm px-2 py-1 text-paper/38 transition hover:bg-paper/[0.04] hover:text-crimson"
          onClick={
            navigateGuidesHome
          }
        >
          {t(
            'guides.detail.guides',
          )}
        </button>

        <span aria-hidden="true">
          /
        </span>

        <span className="text-paper/62">
          {category.label}
        </span>
      </nav>

      <GuidesEditorialHero
        index="06"
        kicker="Category dossier"
        title={category.label}
        accentWord="files"
        description={
          category.description
        }
        icon={CategoryIcon}
        tone={tone}
        action={
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
        }
        metrics={
          <>
            <GuideMetric
              icon={FileText}
              value={allGuides.length}
              label="Guides"
              tone={tone}
            />

            <GuideMetric
              icon={Check}
              value={completedCount}
              label="Completed"
              tone="mint"
            />

            <GuideMetric
              icon={Clock}
              value={`${Math.round(
                (completedCount /
                  Math.max(
                    allGuides.length,
                    1,
                  )) *
                100,
              )}%`}
              label="Mastery"
              tone="gold"
            />
          </>
        }
      />

      {allGuides.length > 3 ? (
        <label className="glass panel-cut-sm flex max-w-xl items-center gap-3 border-paper/10 px-4 focus-within:border-crimson/45">
          <Search
            size={16}
            className="text-crimson"
            aria-hidden="true"
          />

          <input
            type="search"
            value={search}
            className="min-h-12 w-full bg-transparent text-sm text-paper outline-none placeholder:text-paper/28"
            placeholder={t(
              'guides.category.searchPlaceholder',
              {
                category:
                  category.label,
              },
            )}
            aria-label={t(
              'guides.category.searchAria',
              {
                category:
                  category.label,
              },
            )}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
          />

          <span className="stamp !border-paper/12 !bg-paper/[0.025] !text-paper/32">
            {filtered.length}
          </span>
        </label>
      ) : null}

      {filtered.length === 0 ? (
        <GuideEmptyState
          icon={Search}
          title={
            search
              ? t(
                'guides.category.noSearchResults',
                { query: search },
              )
              : t(
                'guides.category.noGuides',
              )
          }
          description={
            search
              ? t(
                'guides.category.tryOtherTerms',
              )
              : t(
                'guides.category.comingSoon',
              )
          }
        />
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren:
                  reduceMotion
                    ? 0
                    : 0.065,
              },
            },
          }}
          className="grid gap-4"
        >
          {filtered.map(
            (guide, index) => {
              const Icon =
                guide.icon;

              const guideTone =
                getGuideTone(
                  guide.accentColor,
                );

              const styles =
                GUIDE_TONE_STYLES[
                guideTone
                ];

              const completed =
                Boolean(
                  readGuides[guide.id],
                );

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
                <motion.button
                  key={guide.id}
                  type="button"
                  variants={{
                    hidden: {
                      opacity: 0,
                      y: 16,
                    },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration:
                          reduceMotion
                            ? 0
                            : 0.45,
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
                    'glass panel-cut-sm relative grid w-full gap-4 overflow-hidden p-4 text-left',
                    'sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center',
                    styles.shadow,
                  ].join(' ')}
                  onClick={() =>
                    navigateToGuideEntry(
                      categoryId,
                      guide.id,
                    )
                  }
                >
                  <span
                    className="text-outline pointer-events-none absolute right-4 top-0 font-display text-6xl font-black leading-none"
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
                    <Icon size={17} />
                  </span>

                  <span className="relative z-10 min-w-0 pr-12 sm:pr-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="font-display text-base font-black uppercase tracking-[-0.03em] text-paper">
                        {guide.title}
                      </strong>

                      {completed ? (
                        <span className="stamp !border-mint/45 !bg-mint/10 !text-mint">
                          <Check size={10} />
                          {t(
                            'guides.category.completed',
                          )}
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-paper/38">
                      {guide.subtitle}
                    </span>

                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {guide.tags
                        .slice(0, 3)
                        .map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-[0.54rem] uppercase tracking-[0.08em] text-paper/24"
                          >
                            #{tag}
                          </span>
                        ))}
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

                  <span className="relative z-10 flex items-center gap-3">
                    <span className="flex items-center gap-1.5 font-mono text-[0.6rem] text-paper/34">
                      <Clock size={11} />
                      {
                        guide.estimatedTime
                      }
                    </span>

                    <ChevronRight
                      size={15}
                      className={
                        styles.text
                      }
                    />
                  </span>
                </motion.button>
              );
            },
          )}
        </motion.div>
      )}
    </div>
  );
}
