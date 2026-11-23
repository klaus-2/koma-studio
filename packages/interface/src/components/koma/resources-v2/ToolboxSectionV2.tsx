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
  TOOLBOX_ENTRIES,
  TOOLBOX_STAGE_ORDER,
} from '@/data/resources-data';
import type {
  ResourceLink,
  ToolboxEntry,
  ToolboxLicense,
  ToolboxStage,
} from '@/data/guides-types';
import { useI18n } from '@/i18n';

import ResourceExternalAnchorV2 from './ResourceExternalAnchorV2';
import ResourceThumbV2 from './ResourceThumbV2';
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

type StageFilter = 'all' | ToolboxStage;

interface Props {
  search: string;
}

const LICENSE_TONE: Record<
  ToolboxLicense,
  string
> = {
  'open-source':
    '!border-mint/45 !bg-mint/10 !text-mint',
  free: '!border-mint/45 !bg-mint/10 !text-mint',
  freeware:
    '!border-azure/45 !bg-azure/10 !text-azure',
  paid: '!border-gold/45 !bg-gold/10 !text-gold',
  account:
    '!border-gold/45 !bg-gold/10 !text-gold',
};

export default function ToolboxSectionV2({
  search,
}: Props) {
  const { t } = useI18n();


  const [stageFilter, setStageFilter] =
    useState<StageFilter>('all');

  const stageLabels = useMemo<
    Record<ToolboxStage, string>
  >(
    () => ({
      rippers: t(
        'resources.toolbox.stage.rippers',
      ),
      cleaning: t(
        'resources.toolbox.stage.cleaning',
      ),
      upscaling: t(
        'resources.toolbox.stage.upscaling',
      ),
      typesetting: t(
        'resources.toolbox.stage.typesetting',
      ),
      assets: t(
        'resources.toolbox.stage.assets',
      ),
      publishing: t(
        'resources.toolbox.stage.publishing',
      ),
      translation: t(
        'resources.toolbox.stage.translation',
      ),
      reference: t(
        'resources.toolbox.stage.reference',
      ),
      utilities: t(
        'resources.toolbox.stage.utilities',
      ),
    }),
    [t],
  );

  const licenseLabels = useMemo<
    Record<ToolboxLicense, string>
  >(
    () => ({
      'open-source': t(
        'resources.toolbox.license.openSource',
      ),
      free: t(
        'resources.toolbox.license.free',
      ),
      freeware: t(
        'resources.toolbox.license.freeware',
      ),
      paid: t(
        'resources.toolbox.license.paid',
      ),
      account: t(
        'resources.toolbox.license.account',
      ),
    }),
    [t],
  );

  const filtered = useMemo(
    () =>
      TOOLBOX_ENTRIES.filter(
        (entry: ToolboxEntry) => {
          if (
            stageFilter !== 'all' &&
            entry.stage !== stageFilter
          ) {
            return false;
          }

          return matchesResourceSearch(
            search,
            [
              entry.name,
              entry.description,
              entry.stage,
              entry.platform,
              ...(entry.tags ?? []),
            ],
          );
        },
      ),
    [search, stageFilter],
  );

  const filterOptions = useMemo(
    () => [
      {
        value: 'all' as StageFilter,
        label: t(
          'resources.toolbox.filterAll',
        ),
        count: TOOLBOX_ENTRIES.length,
      },
      ...TOOLBOX_STAGE_ORDER.map(
        (stage) => ({
          value: stage,
          label: stageLabels[stage],
          count: TOOLBOX_ENTRIES.filter(
            (entry) =>
              entry.stage === stage,
          ).length,
        }),
      ),
    ],
    [stageLabels, t],
  );

  const buildLinks = (
    entry: ToolboxEntry,
  ): ResourceLink[] =>
    deduplicateResourceLinks([
      {
        label: t(
          'resources.toolbox.action.open',
        ),
        url: entry.url,
        kind: 'site' as const,
      },
      ...(entry.links ?? []),
    ]);

  return (
    <section>
      <ResourceSectionHeader
        index="05"
        kicker="Pipeline arsenal"
        title={t(
          'resources.toolbox.title',
        )}
        description={t(
          'resources.toolbox.desc',
        )}
        icon={Wrench}
        tone="mint"
        action={
          <ResourceResultCount
            count={filtered.length}
            singular={t(
              'resources.toolbox.results_one',
            )}
            plural={t(
              'resources.toolbox.results_other',
            )}
          />
        }
      />

      <div className="space-y-5 p-4 sm:p-5">
        <ResourceFilterRail
          value={stageFilter}
          options={filterOptions}
          onChange={setStageFilter}
          ariaLabel={t(
            'resources.toolbox.filterAria',
          )}
        />

        {filtered.length === 0 ? (
          <ResourcesEmptyStateV2
            query={search}
            context={t(
              'resources.toolbox.context',
            )}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(
              (entry, index) => {
                const links =
                  buildLinks(entry);

                return (
                  <li key={entry.id}>
                    <ResourceCardReveal
                      index={index}
                      className="h-full"
                    >
                      <article className="offset-card panel-cut-sm relative flex h-full flex-col gap-3 overflow-hidden border border-paper/10 bg-paper/[0.02] p-4">
                        <div className="flex items-start gap-3">
                          <ResourceThumbV2
                            image={entry.image}
                            stage={entry.stage}
                            size={40}
                          />

                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-sm font-black uppercase tracking-[-0.02em] text-paper">
                              {entry.name}
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-paper/45">
                              {entry.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <span className="stamp !border-azure/35 !bg-azure/[0.065] !text-azure">
                            {
                              stageLabels[
                                entry.stage
                              ]
                            }
                          </span>

                          {entry.platform ? (
                            <span className="stamp !border-paper/15 !bg-paper/[0.04] !text-paper/45">
                              {entry.platform}
                            </span>
                          ) : null}

                          {entry.license ? (
                            <span
                              className={[
                                'stamp',
                                LICENSE_TONE[
                                  entry.license
                                ],
                              ].join(' ')}
                            >
                              {
                                licenseLabels[
                                  entry.license
                                ]
                              }
                            </span>
                          ) : null}
                        </div>

                        {links.length > 0 ? (
                          <div className="mt-auto flex flex-wrap gap-2 pt-1">
                            {links.map((link) => (
                              <ResourceExternalAnchorV2
                                key={`${entry.id}-${link.kind}-${link.url}`}
                                href={link.url}
                                className={
                                  link.kind ===
                                  'download'
                                    ? 'btn-primary'
                                    : 'btn-ghost'
                                }
                                aria-label={`${link.label} — ${entry.name}`}
                              >
                                {link.kind ===
                                'download' ? (
                                  <Download
                                    size={13}
                                  />
                                ) : (
                                  <ExternalLink
                                    size={13}
                                  />
                                )}

                                {link.label}
                              </ResourceExternalAnchorV2>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    </ResourceCardReveal>
                  </li>
                );
              },
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
