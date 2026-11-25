import {
  Download,
  ExternalLink,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import {
  FONT_COLLECTIONS_DATA,
  FONTS_DATA,
} from '@/data/resources-data';
import type {
  FontEntry,
  ResourceLink,
} from '@/data/guides-types';
import { useI18n } from '@/i18n';

import ResourceExternalAnchorV2 from './ResourceExternalAnchorV2';
import ResourceThumbV2 from './ResourceThumbV2';
import {
  ResourceCardReveal,
  ResourceResultCount,
  ResourceSectionHeader,
} from './ResourceV2Primitives';
import ResourcesEmptyStateV2 from './ResourcesEmptyStateV2';
import {
  deduplicateResourceLinks,
  matchesResourceSearch,
  resolveLinkLabel,
} from './resource-v2-utils';

interface Props {
  search: string;
}

const PREVIEW_SIZES = [
  16,
  24,
  32,
] as const;

function buildFontLinks(
  font: FontEntry,
  downloadLabel: string,
): ResourceLink[] {
  return deduplicateResourceLinks([
    ...(font.downloadUrl
      ? [
          {
            label: downloadLabel,
            url: font.downloadUrl,
            kind: 'download' as const,
          },
        ]
      : []),
    ...(font.links ?? []),
  ]);
}

export default function FontsSectionV2({
  search,
}: Props) {
  const { t, translateDynamic } = useI18n();


  const [previewSize, setPreviewSize] =
    useState<number>(24);

  const [customText, setCustomText] =
    useState('');

  const licenseLabels: Record<
    string,
    string
  > = {
    free: t(
      'resources.fonts.license.free',
    ),
    'open-source': t(
      'resources.fonts.license.openSource',
    ),
    commercial: t(
      'resources.fonts.license.commercial',
    ),
    mixed: t(
      'resources.fonts.license.mixed',
    ),
  };

  const licenseStyle: Record<
    string,
    string
  > = {
    free:
      'border-mint/45 bg-mint/10 text-mint',
    'open-source':
      'border-azure/45 bg-azure/10 text-azure',
    commercial:
      'border-gold/45 bg-gold/10 text-gold',
    mixed:
      'border-crimson/45 bg-crimson/10 text-crimson',
  };

  const filtered = useMemo(
    () =>
      (FONTS_DATA as FontEntry[]).filter(
        (font) =>
          matchesResourceSearch(
            search,
            [
              font.name,
              font.style,
              font.usage,
              font.license,
              ...font.tags,
            ],
          ),
      ),
    [search],
  );

  return (
    <section>
      <ResourceSectionHeader
        index="01"
        kicker="Type foundry"
        title={t(
          'resources.fonts.title',
        )}
        description={t(
          'resources.fonts.desc',
        )}
        icon={Type}
        tone="crimson"
        action={
          <ResourceResultCount
            count={filtered.length}
            singular={t(
              'resources.fonts.results_one',
            )}
            plural={t(
              'resources.fonts.results_other',
            )}
          />
        }
      />

      <div className="space-y-5 p-4 sm:p-5">
        {/* Collections */}
        <section aria-labelledby="resources-font-collections">
          <h3
            id="resources-font-collections"
            className="font-display text-sm font-black uppercase tracking-[-0.02em] text-paper"
          >
            {t(
              'resources.fonts.collections.title',
            )}
          </h3>

          <p className="mt-1 text-xs leading-5 text-paper/40">
            {t(
              'resources.fonts.collections.desc',
            )}
          </p>

          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {FONT_COLLECTIONS_DATA.map(
              (collection) => (
                <li
                  key={collection.id}
                >
                  <article className="offset-card panel-cut-sm flex h-full flex-col gap-3 border border-paper/10 bg-paper/[0.02] p-4">
                    <div className="flex items-start gap-3">
                      <ResourceThumbV2
                        image={collection.image}
                        fallback={Type}
                        size={40}
                      />

                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-black uppercase tracking-[-0.02em] text-paper">
                          {collection.name}
                        </h4>

                        <p className="mt-1 text-xs text-paper/40">
                          {collection.origin}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs leading-5 text-paper/45">
                      {collection.description}
                    </p>

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-paper/[0.065] pt-3 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-paper/38">
                      <dt className="contents">
                        <dd>
                          {collection.fileCount}{' '}
                          {t(
                            'resources.fonts.collection.files',
                          )}
                        </dd>
                      </dt>

                      <dt className="contents">
                        <dd>
                          {collection.familyCount}{' '}
                          {t(
                            'resources.fonts.collection.families',
                          )}
                        </dd>
                      </dt>

                      <dt className="contents">
                        <dd className="col-span-2">
                          {collection.vendors.join(' · ')}
                        </dd>
                      </dt>
                    </dl>

                    <p className="text-[0.68rem] leading-4 text-paper/34">
                      <span className="font-semibold text-paper/55">
                        {t(
                          'resources.fonts.collection.license',
                        )}
                        :
                      </span>{' '}
                      {collection.licenseNote}
                    </p>

                    {collection.links?.length ? (
                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        {collection.links.map(
                          (link) => (
                            <ResourceExternalAnchorV2
                              key={`${collection.id}-${link.url}`}
                              href={link.url}
                              className={
                                link.kind ===
                                'download'
                                  ? 'btn-primary'
                                  : 'btn-ghost'
                              }
                              aria-label={`${link.label} — ${collection.name}`}
                            >
                              {link.label}
                            </ResourceExternalAnchorV2>
                          ),
                        )}
                      </div>
                    ) : null}
                  </article>
                </li>
              ),
            )}
          </ul>
        </section>

        <div className="panel-cut-sm grid gap-4 border-paper/10 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-paper/40">
              <Type
                size={13}
                className="text-crimson"
              />
              Live specimen
            </span>

            <input
              type="text"
              className="koma-control"
              value={customText}
              placeholder={t(
                'resources.fonts.placeholder',
              )}
              onChange={(event) =>
                setCustomText(
                  event.target.value,
                )
              }
            />
          </label>

          <div>
            <span className="mb-2 flex items-center gap-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-paper/40">
              <SlidersHorizontal
                size={13}
                className="text-gold"
              />
              Preview scale
            </span>

            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label="Preview size"
            >
              {PREVIEW_SIZES.map(
                (size) => (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-checked={
                      previewSize === size
                    }
                    aria-label={t(
                      'resources.fonts.sizeAria',
                      { size },
                    )}
                    className={[
                      'panel-cut-sm min-h-11 min-w-12 border font-mono text-[0.65rem] font-black transition',
                      previewSize === size
                        ? 'border-crimson bg-crimson text-ink drop-shadow-[3px_3px_0_#ffc857]'
                        : 'border-paper/10 bg-ink/55 text-paper/42 hover:border-crimson/35 hover:text-paper',
                    ].join(' ')}
                    onClick={() =>
                      setPreviewSize(size)
                    }
                  >
                    {size}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <ResourcesEmptyStateV2
            query={search}
            context={t(
              'resources.fonts.context',
            )}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filtered.map(
              (font, index) => {
                const actionLinks =
                  buildFontLinks(
                    font,
                    t(
                      'resources.action.download',
                    ),
                  );

                return (
                  <ResourceCardReveal
                    key={font.name}
                    index={index}
                    className="h-full"
                  >
                    <article className="offset-card panel-cut-sm relative flex h-full flex-col overflow-hidden border-paper/10 drop-shadow-[6px_6px_0_rgba(255,46,99,0.18)]">
                      <span
                        className="text-outline pointer-events-none absolute right-4 top-0 z-10 font-display text-6xl font-black leading-none"
                        aria-hidden="true"
                      >
                        {String(
                          index + 1,
                        ).padStart(2, '0')}
                      </span>

                      <header className="relative z-10 flex items-start justify-between gap-4 p-4">
                        <div className="flex min-w-0 items-start gap-3 pr-10">
                          <ResourceThumbV2
                            image={font.image}
                            fallback={Type}
                            size={32}
                          />

                          <div className="min-w-0">
                            <span className="kicker block text-[0.56rem]">
                              Font specimen
                            </span>

                            <h3 className="mt-1 truncate font-display text-lg font-black uppercase tracking-[-0.035em] text-paper">
                              {font.name}
                            </h3>

                            <p className="mt-1 text-xs text-paper/34">
                              {font.style}
                            </p>
                          </div>
                        </div>

                        <span
                          className={[
                            'stamp shrink-0',
                            licenseStyle[
                              font.license
                            ] ??
                              'border-paper/15 bg-paper/[0.035] text-paper/45',
                          ].join(' ')}
                        >
                          {licenseLabels[
                            font.license
                          ] ??
                            font.license}
                        </span>
                      </header>

                      <div
                        className="koma-resource-font-specimen relative mx-4 min-h-36 overflow-hidden border border-ink/10 bg-paper p-5 text-ink panel-cut-sm"
                        style={{
                          fontFamily:
                            font.family,
                          fontSize: `${previewSize}px`,
                        }}
                      >
                        <span
                          className="pointer-events-none absolute right-3 top-2 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-ink/25"
                          aria-hidden="true"
                        >
                          {previewSize}px
                        </span>

                        <span className="relative z-10 block break-words leading-[1.25]">
                          {customText ||
                            font.previewText ||
                            t(
                              'resources.fonts.previewFallback',
                            )}
                        </span>
                      </div>

                      <div className="flex-1 p-4">
                        <p className="text-xs leading-5 text-paper/42">
                          {font.usage}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {font.tags.map(
                            (tag) => (
                              <span
                                key={tag}
                                className="border border-paper/10 bg-paper/[0.025] px-2 py-1 font-mono text-[0.54rem] uppercase tracking-[0.08em] text-paper/32 panel-cut-sm"
                              >
                                #{tag}
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      {actionLinks.length >
                      0 ? (
                        <footer className="flex flex-wrap gap-2 border-t border-paper/[0.065] p-4">
                          {actionLinks.map(
                            (link) => {
                              const label =
                                resolveLinkLabel(
                                  link.label,
                                  translateDynamic,
                                );

                              return (
                                <ResourceExternalAnchorV2
                                  key={`${font.name}-${link.kind}-${link.url}`}
                                  href={link.url}
                                  className={
                                    link.kind ===
                                    'download'
                                      ? 'btn-primary'
                                      : 'btn-ghost'
                                  }
                                  aria-label={`${label} ${font.name}`}
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

                                  {link.kind ===
                                  'download'
                                    ? t(
                                        'resources.fonts.downloadLabel',
                                      )
                                    : label}
                                </ResourceExternalAnchorV2>
                              );
                            },
                          )}
                        </footer>
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
