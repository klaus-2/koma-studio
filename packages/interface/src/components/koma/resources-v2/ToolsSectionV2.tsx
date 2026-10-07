'use client';

import {
  Download,
  ExternalLink,
  Wrench,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import {
  EXTERNAL_TOOLS_DATA,
} from '@/data/resources-data';
import type {
  ExternalToolEntry,
  ResourceLink,
} from '@/data/guides-types';
import { useI18n } from '@/i18n';

import ResourceExternalAnchorV2 from './ResourceExternalAnchorV2';
import {
  ResourceCardReveal,
  ResourceFilterRail,
  ResourceResultCount,
  ResourceSectionHeader,
} from './ResourceV2Primitives';
import ResourcesEmptyStateV2 from './ResourcesEmptyStateV2';
import {
  deduplicateResourceLinks,
  matchesResourceSearch,
} from './resource-v2-utils';

interface Props {
  search: string;
}

export default function ToolsSectionV2({
  search,
}: Props) {
  const { t } = useI18n();

  const [categoryFilter, setCategoryFilter] =
    useState<string>('all');

  const categoryLabels: Record<
    string,
    string
  > = {
    editing: t(
      'resources.tools.category.editing',
    ),
    ocr: t(
      'resources.tools.category.ocr',
    ),
    translation: t(
      'resources.tools.category.translation',
    ),
    fonts: t(
      'resources.tools.category.fonts',
    ),
    hosting: t(
      'resources.tools.category.hosting',
    ),
    utility: t(
      'resources.tools.category.utility',
    ),
  };

  const categories = Object.keys(
    categoryLabels,
  );

  const buildToolLinks = (
    tool: ExternalToolEntry,
  ): ResourceLink[] =>
    deduplicateResourceLinks([
      ...(tool.url
        ? [
            {
              label: t(
                'resources.tools.action.open',
              ),
              url: tool.url,
              kind: 'site' as const,
            },
          ]
        : []),
      ...(tool.downloadUrl
        ? [
            {
              label: t(
                'resources.tools.action.download',
              ),
              url: tool.downloadUrl,
              kind: 'download' as const,
            },
          ]
        : []),
      ...(tool.links ?? []),
    ]);

  const filtered = useMemo(
    () =>
      (
        EXTERNAL_TOOLS_DATA as ExternalToolEntry[]
      ).filter((tool) => {
        if (
          categoryFilter !== 'all' &&
          tool.category !==
            categoryFilter
        ) {
          return false;
        }

        return matchesResourceSearch(
          search,
          [
            tool.name,
            tool.description,
            tool.category,
          ],
        );
      }),
    [categoryFilter, search],
  );

  const filterOptions = [
    {
      value: 'all',
      label: t(
        'resources.tools.filterAll',
      ),
      count:
        EXTERNAL_TOOLS_DATA.length,
    },
    ...categories.map(
      (category) => ({
        value: category,
        label:
          categoryLabels[category] ?? '',
        count:
          EXTERNAL_TOOLS_DATA.filter(
            (tool) =>
              tool.category ===
              category,
          ).length,
      }),
    ),
  ];

  return (
    <section>
      <ResourceSectionHeader
        index="05"
        kicker="External arsenal"
        title={t(
          'resources.externalTools.title',
        )}
        description={t(
          'resources.externalTools.desc',
        )}
        icon={Wrench}
        tone="mint"
        action={
          <ResourceResultCount
            count={filtered.length}
            singular={t(
              'resources.tools.results_one',
            )}
            plural={t(
              'resources.tools.results_other',
            )}
          />
        }
      />

      <div className="space-y-5 p-4 sm:p-5">
        <ResourceFilterRail
          value={categoryFilter}
          options={filterOptions}
          onChange={setCategoryFilter}
          ariaLabel={t(
            'resources.sfx.filterAria',
          )}
        />

        {filtered.length === 0 ? (
          <ResourcesEmptyStateV2
            query={search}
            context={t(
              'resources.tools.context',
            )}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(
              (tool, index) => {
                const ToolIcon =
                  tool.icon;

                const links =
                  buildToolLinks(tool);

                return (
                  <ResourceCardReveal
                    key={tool.name}
                    index={index}
                  >
                    <article className="offset-card glass-card panel-cut-sm relative grid gap-4 overflow-hidden border-paper/10 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                      <span
                        className="text-outline pointer-events-none absolute right-4 top-0 font-display text-6xl font-black leading-none"
                        aria-hidden="true"
                      >
                        {String(
                          index + 1,
                        ).padStart(2, '0')}
                      </span>

                      <span
                        className="grid size-12 place-items-center border border-mint/30 bg-mint/10 text-mint panel-cut-sm"
                        aria-hidden="true"
                      >
                        <ToolIcon size={18} />
                      </span>

                      <div className="relative z-10 min-w-0 pr-12 md:pr-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-black uppercase tracking-[-0.03em] text-paper">
                            {tool.name}
                          </h3>

                          <span className="stamp !border-azure/35 !bg-azure/[0.065] !text-azure">
                            {categoryLabels[
                              tool.category
                            ] ??
                              tool.category}
                          </span>

                          <span
                            className={[
                              'stamp',
                              tool.free
                                ? '!border-mint/45 !bg-mint/10 !text-mint'
                                : '!border-gold/45 !bg-gold/10 !text-gold',
                            ].join(' ')}
                          >
                            {tool.free
                              ? t(
                                  'resources.tools.free.yes',
                                )
                              : t(
                                  'resources.tools.free.no',
                                )}
                          </span>
                        </div>

                        <p className="mt-2 max-w-3xl text-xs leading-5 text-paper/40">
                          {
                            tool.description
                          }
                        </p>
                      </div>

                      {links.length > 0 ? (
                        <div className="relative z-10 flex flex-wrap gap-2 md:max-w-60 md:justify-end">
                          {links.map(
                            (link) => {
                              const label =
                                link.label.includes(
                                  '.',
                                )
                                  ? t(
                                      link.label as any,
                                    )
                                  : link.label;

                              return (
                                <ResourceExternalAnchorV2
                                  key={`${tool.name}-${link.kind}-${link.url}`}
                                  href={link.url}
                                  className={
                                    link.kind ===
                                    'download'
                                      ? 'btn-primary'
                                      : 'btn-ghost'
                                  }
                                  aria-label={`${label} ${tool.name}`}
                                >
                                  {link.kind ===
                                  'download' ? (
                                    <Download
                                      size={
                                        14
                                      }
                                    />
                                  ) : (
                                    <ExternalLink
                                      size={
                                        14
                                      }
                                    />
                                  )}

                                  {label}
                                </ResourceExternalAnchorV2>
                              );
                            },
                          )}
                        </div>
                      ) : null}
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
