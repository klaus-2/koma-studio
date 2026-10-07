'use client';

import {
  Check,
  Copy,
  Volume2,
  Waves,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  SFX_DATA,
} from '@/data/resources-data';
import type {
  SfxEntry,
} from '@/data/guides-types';
import { useI18n } from '@/i18n';

import {
  ResourceCardReveal,
  ResourceFilterRail,
  ResourceResultCount,
  ResourceSectionHeader,
} from './ResourceV2Primitives';
import ResourcesEmptyStateV2 from './ResourcesEmptyStateV2';
import {
  copyResourceText,
  matchesResourceSearch,
} from './resource-v2-utils';

interface Props {
  search: string;
}

export default function SfxSectionV2({
  search,
}: Props) {
  const { t } = useI18n();

  const [
    activeFilter,
    setActiveFilter,
  ] = useState<
    SfxEntry['category'] | 'all'
  >('all');

  const [copiedId, setCopiedId] =
    useState<string | null>(null);

  const copyTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(
          copyTimeoutRef.current,
        );
      }
    },
    [],
  );

  const categoryLabels: Record<
    SfxEntry['category'],
    string
  > = {
    impact: t(
      'resources.sfx.category.impact',
    ),
    emotion: t(
      'resources.sfx.category.emotion',
    ),
    ambient: t(
      'resources.sfx.category.ambient',
    ),
    action: t(
      'resources.sfx.category.action',
    ),
    voice: t(
      'resources.sfx.category.voice',
    ),
    misc: t(
      'resources.sfx.category.misc',
    ),
  };

  const categoryStyle: Record<
    SfxEntry['category'],
    string
  > = {
    impact:
      'border-crimson/45 bg-crimson/10 text-crimson',
    emotion:
      'border-gold/45 bg-gold/10 text-gold',
    ambient:
      'border-azure/45 bg-azure/10 text-azure',
    action:
      'border-crimson/45 bg-crimson/10 text-crimson',
    voice:
      'border-mint/45 bg-mint/10 text-mint',
    misc:
      'border-paper/15 bg-paper/[0.035] text-paper/45',
  };

  const categories = Object.keys(
    categoryLabels,
  ) as SfxEntry['category'][];

  const filtered = useMemo(
    () =>
      (SFX_DATA as SfxEntry[]).filter(
        (sfx) => {
          if (
            activeFilter !== 'all' &&
            sfx.category !==
              activeFilter
          ) {
            return false;
          }

          return matchesResourceSearch(
            search,
            [
              sfx.japanese,
              sfx.romaji,
              sfx.english,
              sfx.usageNote,
              sfx.commonIn,
              sfx.category,
            ],
          );
        },
      ),
    [activeFilter, search],
  );

  const copyValue = useCallback(
    async (
      value: string,
      token: string,
    ) => {
      try {
        await copyResourceText(value);
        setCopiedId(token);

        if (copyTimeoutRef.current) {
          clearTimeout(
            copyTimeoutRef.current,
          );
        }

        copyTimeoutRef.current =
          setTimeout(() => {
            setCopiedId(null);
          }, 1700);
      } catch {
        setCopiedId(null);
      }
    },
    [],
  );

  const filterOptions = [
    {
      value: 'all' as const,
      label: t(
        'resources.sfx.filterAll',
        {
          count: SFX_DATA.length,
        },
      ),
      count: SFX_DATA.length,
    },
    ...categories.map(
      (category) => ({
        value: category,
        label:
          categoryLabels[category],
        count: SFX_DATA.filter(
          (sfx) =>
            sfx.category === category,
        ).length,
      }),
    ),
  ];

  return (
    <section>
      <ResourceSectionHeader
        index="02"
        kicker="Onomatopoeia vault"
        title={t(
          'resources.sfx.title',
        )}
        description={t(
          'resources.sfx.desc',
        )}
        icon={Volume2}
        tone="azure"
        action={
          <ResourceResultCount
            count={filtered.length}
            singular={t(
              'resources.sfx.results_one',
            )}
            plural={t(
              'resources.sfx.results_other',
            )}
          />
        }
      />

      <div className="space-y-5 p-4 sm:p-5">
        <ResourceFilterRail
          value={activeFilter}
          options={filterOptions}
          onChange={setActiveFilter}
          ariaLabel={t(
            'resources.sfx.filterAria',
          )}
        />

        {filtered.length === 0 ? (
          <ResourcesEmptyStateV2
            query={search}
            context={t(
              'resources.sfx.context',
            )}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(
              (sfx, index) => {
                const token = `${sfx.romaji}-${index}`;
                const copiedEnglish =
                  copiedId ===
                  `${token}:english`;

                const copiedJapanese =
                  copiedId ===
                  `${token}:japanese`;

                return (
                  <ResourceCardReveal
                    key={token}
                    index={index}
                    className="h-full"
                  >
                    <article className="offset-card glass-card panel-cut-sm relative flex h-full min-h-72 flex-col overflow-hidden border-paper/10 drop-shadow-[6px_6px_0_rgba(77,201,255,0.18)]">
                      <div
                        className="halftone pointer-events-none absolute -right-8 -top-8 size-36 opacity-30"
                        aria-hidden="true"
                      />

                      <span
                        className="text-outline pointer-events-none absolute right-4 top-0 font-display text-5xl font-black leading-none"
                        aria-hidden="true"
                      >
                        {String(
                          index + 1,
                        ).padStart(2, '0')}
                      </span>

                      <header className="relative z-10 flex items-start justify-between gap-3 p-4">
                        <button
                          type="button"
                          className="panel-cut-sm group text-left"
                          aria-label={t(
                            'resources.sfx.copyAria',
                            {
                              text: sfx.japanese,
                            },
                          )}
                          onClick={() =>
                            void copyValue(
                              sfx.japanese,
                              `${token}:japanese`,
                            )
                          }
                        >
                          <span className="block font-display text-4xl font-black leading-none tracking-[-0.05em] text-paper transition group-hover:text-crimson">
                            {sfx.japanese}
                          </span>

                          <span className="mt-2 flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-paper/30">
                            {copiedJapanese ? (
                              <Check
                                size={10}
                                className="text-mint"
                              />
                            ) : (
                              <Copy
                                size={10}
                              />
                            )}

                            {sfx.romaji}
                          </span>
                        </button>

                        <span
                          className={[
                            'stamp',
                            categoryStyle[
                              sfx.category
                            ],
                          ].join(' ')}
                        >
                          {
                            categoryLabels[
                              sfx.category
                            ]
                          }
                        </span>
                      </header>

                      <div className="relative z-10 mx-4 flex items-center gap-3 border-l-2 border-azure bg-azure/[0.045] p-3 panel-cut-sm">
                        <Waves
                          size={15}
                          className="shrink-0 text-azure"
                        />

                        <span className="min-w-0 flex-1 font-display text-base font-black uppercase tracking-[-0.02em] text-paper">
                          {sfx.english}
                        </span>

                        <button
                          type="button"
                          className={[
                            'panel-cut-sm grid size-8 shrink-0 place-items-center border transition',
                            copiedEnglish
                              ? 'border-mint bg-mint text-ink'
                              : 'border-paper/10 bg-ink text-paper/38 hover:border-azure hover:text-azure',
                          ].join(' ')}
                          aria-label={t(
                            'resources.sfx.copyAria',
                            {
                              text: sfx.english,
                            },
                          )}
                          onClick={() =>
                            void copyValue(
                              sfx.english,
                              `${token}:english`,
                            )
                          }
                        >
                          {copiedEnglish ? (
                            <Check
                              size={13}
                            />
                          ) : (
                            <Copy
                              size={13}
                            />
                          )}
                        </button>
                      </div>

                      <div className="relative z-10 flex-1 p-4">
                        {sfx.usageNote ? (
                          <p className="text-xs leading-5 text-paper/42">
                            {sfx.usageNote}
                          </p>
                        ) : null}

                        {sfx.commonIn ? (
                          <p className="mt-3 border-t border-paper/[0.065] pt-3 font-mono text-[0.56rem] uppercase tracking-[0.08em] text-paper/28">
                            {t(
                              'resources.sfx.commonIn',
                              {
                                value:
                                  sfx.commonIn,
                              },
                            )}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  </ResourceCardReveal>
                );
              },
            )}
          </div>
        )}
      </div>
    </section>
  );
}
