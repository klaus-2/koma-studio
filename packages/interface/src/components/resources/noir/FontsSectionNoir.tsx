import { useMemo, useState } from 'react';
import { Type } from 'lucide-react';
import { useI18n } from '../../../i18n';

import { FONTS_DATA } from '../../../data/resources-data';
import type { FontEntry, ResourceLink } from '../../../data/guides-types';
import {
  LICENSE_TONE,
  ResActionLink,
  ResourcesEmptyState,
  ResStamp,
  ResTag,
  SectionCount,
} from './noir-resources';

interface FontsSectionProps {
  search: string;
}

const PREVIEW_SIZES = [16, 24, 32] as const;

const buildFontLinks = (font: FontEntry, downloadLabel: string): ResourceLink[] => {
  const links: ResourceLink[] = [];
  if (font.downloadUrl) {
    links.push({ label: downloadLabel, url: font.downloadUrl, kind: 'download' });
  }
  if (Array.isArray(font.links)) links.push(...font.links);

  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}:${link.url}`;
    if (!link.url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function FontsSection({ search }: FontsSectionProps) {
  const { t } = useI18n();
  const [previewSize, setPreviewSize] = useState<number>(24);
  const [customText, setCustomText] = useState('');

  const LICENSE_LABELS: Record<string, string> = {
    free: t('resources.fonts.license.free'),
    'open-source': t('resources.fonts.license.openSource'),
    commercial: t('resources.fonts.license.commercial'),
    mixed: t('resources.fonts.license.mixed'),
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return FONTS_DATA;
    const q = search.toLowerCase();
    return FONTS_DATA.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.usage.toLowerCase().includes(q) ||
        f.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [search]);

  if (filtered.length === 0) {
    return <ResourcesEmptyState query={search} context={t('resources.fonts.context')} />;
  }

  return (
    <div>
      {/* Preview control bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Type
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-crimson"
            aria-hidden
          />
          <input
            type="text"
            className="noir-input !pl-9"
            placeholder={t('resources.fonts.placeholder')}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Preview size">
          {PREVIEW_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              aria-label={t('resources.fonts.sizeAria', { size })}
              aria-pressed={previewSize === size}
              onClick={() => setPreviewSize(size)}
              className={`panel-cut-sm px-2.5 py-1.5 font-mono text-[10px] transition-all duration-150 ${previewSize === size
                  ? 'bg-crimson font-bold text-ink drop-shadow-[2px_2px_0_#ffc857]'
                  : 'border border-paper/15 text-paper/50 hover:border-paper/40 hover:text-paper'
                }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <SectionCount
        count={filtered.length}
        label={
          filtered.length === 1
            ? t('resources.fonts.results_one')
            : t('resources.fonts.results_other')
        }
      />

      {/* Specimen cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((font) => {
          const actionLinks = buildFontLinks(font, t('resources.action.download'));
          return (
            <article
              key={font.name}
              className="panel-cut-sm group flex flex-col border border-paper/10 bg-ink-2/60 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-paper/25 hover:drop-shadow-[4px_4px_0_rgba(255,200,87,0.5)]"
            >
              {/* Specimen preview — poster area */}
              <div
                className="halftone flex min-h-[86px] items-center overflow-hidden border-b border-paper/10 bg-ink/70 px-4 py-3 text-paper"
                style={{ fontFamily: font.family, fontSize: previewSize }}
              >
                {customText || font.previewText || t('resources.fonts.previewFallback')}
              </div>

              <div className="flex flex-1 flex-col gap-2.5 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="truncate font-display text-[13px] font-black uppercase tracking-wide text-paper">
                      {font.name}
                    </h4>
                    <p className="mt-0.5 font-accent text-[12px] italic text-paper/45">
                      {font.style}
                    </p>
                  </div>
                  <ResStamp tone={LICENSE_TONE[font.license] ?? 'paper'}>
                    {LICENSE_LABELS[font.license]}
                  </ResStamp>
                </div>

                <p className="text-[11px] leading-relaxed text-paper/50">{font.usage}</p>

                <div className="flex flex-wrap gap-1">
                  {font.tags.map((tag) => (
                    <ResTag key={tag}>{tag}</ResTag>
                  ))}
                </div>

                {actionLinks.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1.5 border-t border-paper/8 pt-2.5">
                    {actionLinks.map((link) => (
                      <ResActionLink
                        key={`${font.name}-${link.label}-${link.url}`}
                        href={link.url}
                        kind={link.kind}
                        ariaLabel={`${link.kind === 'download'
                            ? t('resources.fonts.downloadLabel')
                            : link.label
                          } ${font.name}`}
                      >
                        {link.kind === 'download'
                          ? t('resources.fonts.downloadLabel')
                          : link.label}
                      </ResActionLink>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
