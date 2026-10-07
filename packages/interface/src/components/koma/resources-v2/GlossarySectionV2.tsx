'use client';

import {
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  GLOSSARY_DATA,
} from '@/data/resources-data';
import type {
  GlossaryEntry,
} from '@/data/guides-types';
import { useI18n } from '@/i18n';

import {
  ResourceFilterRail,
  ResourceResultCount,
  ResourceSectionHeader,
} from './ResourceV2Primitives';
import ResourcesEmptyStateV2 from './ResourcesEmptyStateV2';
import {
  matchesResourceSearch,
  resourceSlug,
  RESOURCE_EASE,
} from './resource-v2-utils';

interface Props {
  search: string;
  onSearchChange?: (
    value: string,
  ) => void;
}

export default function GlossarySectionV2({
  search,
  onSearchChange,
}: Props) {
  const { t } = useI18n();
  const reduceMotion =
    useReducedMotion();

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState<
    GlossaryEntry['category'] | 'all'
  >('all');

  const [
    expandedTerms,
    setExpandedTerms,
  ] = useState<Set<string>>(
    new Set(),
  );

  const categoryLabels: Record<
    GlossaryEntry['category'],
    string
  > = {
    general: t(
      'resources.glossary.category.general',
    ),
    typesetting: t(
      'resources.glossary.category.typesetting',
    ),
    cleaning: t(
      'resources.glossary.category.cleaning',
    ),
    translation: t(
      'resources.glossary.category.translation',
    ),
    technical: t(
      'resources.glossary.category.technical',
    ),
    roles: t(
      'resources.glossary.category.roles',
    ),
  };

  const categories = Object.keys(
    categoryLabels,
  ) as GlossaryEntry['category'][];

  const filtered = useMemo(
    () =>
      (
        GLOSSARY_DATA as GlossaryEntry[]
      ).filter((entry) => {
        if (
          categoryFilter !== 'all' &&
          entry.category !==
            categoryFilter
        ) {
          return false;
        }

        return matchesResourceSearch(
          search,
          [
            entry.term,
            entry.definition,
            ...(entry.relatedTerms ??
              []),
          ],
        );
      }),
    [categoryFilter, search],
  );

  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      GlossaryEntry[]
    >();

    filtered.forEach((entry) => {
      const letter =
        entry.term
          .charAt(0)
          .toLocaleUpperCase() || '#';

      const current =
        groups.get(letter) ?? [];

      current.push(entry);
      groups.set(letter, current);
    });

    return [...groups.entries()].sort(
      ([left], [right]) =>
        left.localeCompare(right),
    );
  }, [filtered]);

  const availableLetters =
    useMemo(
      () =>
        new Set(
          grouped.map(
            ([letter]) => letter,
          ),
        ),
      [grouped],
    );

  const toggleTerm = useCallback(
    (term: string) => {
      setExpandedTerms((current) => {
        const next =
          new Set(current);

        if (next.has(term)) {
          next.delete(term);
        } else {
          next.add(term);
        }

        return next;
      });
    },
    [],
  );

  const scrollToLetter =
    useCallback(
      (letter: string) => {
        document
          .getElementById(
            `resource-glossary-${letter}`,
          )
          ?.scrollIntoView({
            behavior: reduceMotion
              ? 'auto'
              : 'smooth',
            block: 'start',
          });
      },
      [reduceMotion],
    );

  const selectRelatedTerm =
    useCallback(
      (term: string) => {
        setCategoryFilter('all');

        setExpandedTerms(
          (current) =>
            new Set([
              ...current,
              term,
            ]),
        );

        onSearchChange?.(term);

        window.setTimeout(() => {
          document
            .getElementById(
              `resource-term-${resourceSlug(
                term,
              )}`,
            )
            ?.scrollIntoView({
              behavior: reduceMotion
                ? 'auto'
                : 'smooth',
              block: 'center',
            });
        }, 50);
      },
      [
        onSearchChange,
        reduceMotion,
      ],
    );

  const shortDefinition = (
    definition: string,
  ) => {
    const match =
      definition.match(
        /^.*?[.!?](?:\s|$)/,
      );

    return match?.[0]?.trim() ??
      definition;
  };

  const filterOptions = [
    {
      value: 'all' as const,
      label: t(
        'resources.glossary.filterAll',
      ),
      count:
        GLOSSARY_DATA.length,
    },
    ...categories.map(
      (category) => ({
        value: category,
        label:
          categoryLabels[category],
        count: GLOSSARY_DATA.filter(
          (entry) =>
            entry.category ===
            category,
        ).length,
      }),
    ),
  ];

  return (
    <section>
      <ResourceSectionHeader
        index="03"
        kicker="Scanlation lexicon"
        title={t(
          'resources.glossary.title',
        )}
        description={t(
          'resources.glossary.desc',
        )}
        icon={BookOpen}
        tone="gold"
        action={
          <ResourceResultCount
            count={filtered.length}
            singular={t(
              'resources.glossary.results_one',
            )}
            plural={t(
              'resources.glossary.results_other',
            )}
          />
        }
      />

      <div className="space-y-5 p-4 sm:p-5">
        <ResourceFilterRail
          value={categoryFilter}
          options={filterOptions}
          onChange={
            setCategoryFilter
          }
          ariaLabel={t(
            'resources.glossary.category.general',
          )}
        />

        {filtered.length === 0 ? (
          <ResourcesEmptyStateV2
            query={search}
            context={t(
              'resources.glossary.context',
            )}
          />
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[3rem_minmax(0,1fr)]">
            <nav
              className="glass-card panel-cut-sm koma-scrollbar sticky top-4 z-20 flex max-h-[70vh] gap-1 overflow-x-auto border-paper/10 p-2 xl:flex-col xl:overflow-y-auto"
              aria-label={t(
                'resources.glossary.alphaAria',
              )}
            >
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                .split('')
                .map((letter) => {
                  const enabled =
                    availableLetters.has(
                      letter,
                    );

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!enabled}
                      className={[
                        'panel-cut-sm grid size-8 shrink-0 place-items-center border',
                        'font-mono text-[0.6rem] font-black transition',
                        enabled
                          ? 'border-paper/10 text-paper/42 hover:border-crimson hover:bg-crimson hover:text-ink'
                          : 'cursor-not-allowed border-transparent text-paper/10',
                      ].join(' ')}
                      aria-label={t(
                        'resources.glossary.alphaBtnAria',
                        { letter },
                      )}
                      onClick={() =>
                        scrollToLetter(
                          letter,
                        )
                      }
                    >
                      {letter}
                    </button>
                  );
                })}
            </nav>

            <div className="space-y-8">
              {grouped.map(
                ([letter, entries]) => (
                  <section
                    key={letter}
                    id={`resource-glossary-${letter}`}
                    className="scroll-mt-6"
                  >
                    <header className="mb-3 flex items-center gap-3">
                      <span className="text-outline font-display text-5xl font-black leading-none">
                        {letter}
                      </span>

                      <span className="h-px flex-1 bg-gradient-to-r from-crimson/45 to-transparent" />
                    </header>

                    <div className="space-y-2">
                      {entries.map(
                        (entry) => {
                          const expanded =
                            expandedTerms.has(
                              entry.term,
                            );

                          return (
                            <article
                              key={
                                entry.term
                              }
                              id={`resource-term-${resourceSlug(
                                entry.term,
                              )}`}
                              className={[
                                'glass-card panel-cut-sm scroll-mt-24 overflow-hidden border transition',
                                expanded
                                  ? 'border-crimson/35 drop-shadow-[5px_5px_0_rgba(255,46,99,0.2)]'
                                  : 'border-paper/10',
                              ].join(' ')}
                            >
                              <button
                                type="button"
                                className="panel-cut-sm grid w-full gap-3 p-4 text-left sm:grid-cols-[minmax(150px,0.35fr)_auto_minmax(0,1fr)_auto] sm:items-center"
                                aria-expanded={
                                  expanded
                                }
                                onClick={() =>
                                  toggleTerm(
                                    entry.term,
                                  )
                                }
                              >
                                <strong className="font-display text-base font-black uppercase tracking-[-0.03em] text-paper">
                                  {entry.term}
                                </strong>

                                <span className="stamp !border-gold/40 !bg-gold/10 !text-gold">
                                  {
                                    categoryLabels[
                                      entry
                                        .category
                                    ]
                                  }
                                </span>

                                {!expanded ? (
                                  <span className="line-clamp-1 text-xs text-paper/34">
                                    {shortDefinition(
                                      entry.definition,
                                    )}
                                  </span>
                                ) : (
                                  <span />
                                )}

                                <ChevronDown
                                  size={15}
                                  className={[
                                    'text-paper/35 transition-transform duration-300',
                                    expanded
                                      ? 'rotate-180 text-crimson'
                                      : '',
                                  ].join(' ')}
                                />
                              </button>

                              <AnimatePresence initial={false}>
                                {expanded ? (
                                  <motion.div
                                    initial={
                                      reduceMotion
                                        ? false
                                        : {
                                            height:
                                              0,
                                            opacity:
                                              0,
                                          }
                                    }
                                    animate={{
                                      height:
                                        'auto',
                                      opacity: 1,
                                    }}
                                    exit={{
                                      height: 0,
                                      opacity: 0,
                                    }}
                                    transition={{
                                      duration:
                                        reduceMotion
                                          ? 0
                                          : 0.34,
                                      ease: RESOURCE_EASE,
                                    }}
                                    className="overflow-hidden"
                                  >
                                    <div className="border-t border-paper/[0.065] px-4 py-5">
                                      <p className="max-w-4xl text-sm leading-7 text-paper/60">
                                        {
                                          entry.definition
                                        }
                                      </p>

                                      {entry.relatedTerms
                                        ?.length ? (
                                        <div className="mt-5 flex flex-wrap items-center gap-2">
                                          <span className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-paper/28">
                                            {t(
                                              'resources.glossary.related',
                                            )}
                                          </span>

                                          {entry.relatedTerms.map(
                                            (
                                              related,
                                            ) => (
                                              <button
                                                key={
                                                  related
                                                }
                                                type="button"
                                                className="panel-cut-sm border border-azure/20 bg-azure/[0.045] px-2.5 py-1.5 font-mono text-[0.58rem] text-azure transition hover:-translate-y-0.5 hover:border-azure hover:bg-azure hover:text-ink"
                                                onClick={() =>
                                                  selectRelatedTerm(
                                                    related,
                                                  )
                                                }
                                              >
                                                {
                                                  related
                                                }
                                              </button>
                                            ),
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </article>
                          );
                        },
                      )}
                    </div>
                  </section>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
