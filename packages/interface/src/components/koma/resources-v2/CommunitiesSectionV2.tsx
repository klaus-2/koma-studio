'use client';

import {
  ExternalLink,
  Globe2,
  MessageCircle,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';

import {
  COMMUNITIES_DATA,
} from '@/data/resources-data';
import type {
  CommunityEntry,
} from '@/data/guides-types';
import { useI18n } from '@/i18n';

import ResourceExternalAnchorV2 from './ResourceExternalAnchorV2';
import {
  ResourceCardReveal,
  ResourceResultCount,
  ResourceSectionHeader,
  RESOURCE_TONE,
  type ResourceTone,
} from './ResourceV2Primitives';
import ResourcesEmptyStateV2 from './ResourcesEmptyStateV2';
import {
  matchesResourceSearch,
} from './resource-v2-utils';

interface Props {
  search: string;
}

const PLATFORM_TONE: Record<
  CommunityEntry['platform'],
  ResourceTone
> = {
  discord: 'azure',
  reddit: 'crimson',
  forum: 'gold',
  website: 'mint',
  telegram: 'azure',
};

export default function CommunitiesSectionV2({
  search,
}: Props) {
  const { t } = useI18n();

  const platformLabels: Record<
    CommunityEntry['platform'],
    string
  > = {
    discord: t(
      'resources.communities.platform.discord',
    ),
    reddit: t(
      'resources.communities.platform.reddit',
    ),
    forum: t(
      'resources.communities.platform.forum',
    ),
    website: t(
      'resources.communities.platform.website',
    ),
    telegram: t(
      'resources.communities.platform.telegram',
    ),
  };

  const filtered = useMemo(
    () =>
      (
        COMMUNITIES_DATA as CommunityEntry[]
      ).filter((community) =>
        matchesResourceSearch(search, [
          community.name,
          community.description,
          community.language,
          community.platform,
        ]),
      ),
    [search],
  );

  return (
    <section>
      <ResourceSectionHeader
        index="04"
        kicker="Collective network"
        title={t(
          'resources.communities.title',
        )}
        description={t(
          'resources.communities.desc',
        )}
        icon={Users}
        tone="azure"
        action={
          <ResourceResultCount
            count={filtered.length}
            singular={t(
              'resources.communities.results_one',
            )}
            plural={t(
              'resources.communities.results_other',
            )}
          />
        }
      />

      <div className="p-4 sm:p-5">
        {filtered.length === 0 ? (
          <ResourcesEmptyStateV2
            query={search}
            context={t(
              'resources.communities.context',
            )}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(
              (community, index) => {
                const tone =
                  PLATFORM_TONE[
                    community.platform
                  ];

                const styles =
                  RESOURCE_TONE[tone];

                return (
                  <ResourceCardReveal
                    key={`${community.platform}-${community.name}`}
                    index={index}
                    className="h-full"
                  >
                    <article
                      className={[
                        'offset-card glass-card panel-cut-sm relative flex h-full min-h-64 flex-col overflow-hidden border p-5',
                        styles.border,
                        styles.shadow,
                      ].join(' ')}
                    >
                      <span
                        className="text-outline pointer-events-none absolute right-4 top-0 font-display text-6xl font-black leading-none"
                        aria-hidden="true"
                      >
                        {String(
                          index + 1,
                        ).padStart(2, '0')}
                      </span>

                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <span
                          className={[
                            'grid size-10 place-items-center border panel-cut-sm',
                            styles.border,
                            styles.background,
                            styles.text,
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          <MessageCircle
                            size={16}
                          />
                        </span>

                        <span
                          className={[
                            'stamp',
                            `!${styles.border}`,
                            `!${styles.background}`,
                            `!${styles.text}`,
                          ].join(' ')}
                        >
                          {
                            platformLabels[
                              community
                                .platform
                            ]
                          }
                        </span>
                      </div>

                      <h3 className="relative z-10 mt-5 pr-12 font-display text-xl font-black uppercase leading-none tracking-[-0.04em] text-paper">
                        {community.name}
                      </h3>

                      <p className="relative z-10 mt-3 flex-1 text-xs leading-5 text-paper/42">
                        {
                          community.description
                        }
                      </p>

                      <div className="relative z-10 mt-5 flex flex-wrap gap-2 border-t border-paper/[0.065] pt-4">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-paper/34">
                          <Globe2 size={11} />
                          {
                            community.language
                          }
                        </span>

                        {community.memberCount ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-paper/34">
                            <Users size={11} />
                            {t(
                              'resources.communities.members',
                              {
                                count:
                                  community.memberCount,
                              },
                            )}
                          </span>
                        ) : null}
                      </div>

                      {community.url ? (
                        <ResourceExternalAnchorV2
                          href={community.url}
                          className="btn-ghost relative z-10 mt-4 w-full"
                          aria-label={t(
                            'resources.communities.visitAria',
                            {
                              name: community.name,
                            },
                          )}
                        >
                          {t(
                            'resources.communities.visit',
                          )}
                          <ExternalLink
                            size={14}
                          />
                        </ResourceExternalAnchorV2>
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
