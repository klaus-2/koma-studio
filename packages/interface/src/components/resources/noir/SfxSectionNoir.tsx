import { useCallback, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useI18n } from '../../../i18n';

import { SFX_DATA } from '../../../data/resources-data';
import type { SfxEntry } from '../../../data/guides-types';
import {
  FilterPills,
  RES_TONE,
  ResourcesEmptyState,
  ResStamp,
  SectionCount,
  SFX_TONE,
} from './noir-resources';

interface SfxSectionProps {
  search: string;
}

export default function SfxSection({ search }: SfxSectionProps) {
  const { t } = useI18n();
  const [activeFilter, setActiveFilter] = useState<SfxEntry['category'] | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const SFX_CATEGORY_LABELS: Record<SfxEntry['category'], string> = {
    impact: t('resources.sfx.category.impact'),
    emotion: t('resources.sfx.category.emotion'),
    ambient: t('resources.sfx.category.ambient'),
    action: t('resources.sfx.category.action'),
    voice: t('resources.sfx.category.voice'),
    misc: t('resources.sfx.category.misc'),
  };

  const ALL_SFX_CATEGORIES = Object.keys(SFX_CATEGORY_LABELS) as SfxEntry['category'][];

  const filtered = useMemo(() => {
    let data = SFX_DATA as SfxEntry[];
    if (activeFilter !== 'all') data = data.filter((s) => s.category === activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.japanese.includes(q) ||
          s.romaji.toLowerCase().includes(q) ||
          s.english.toLowerCase().includes(q) ||
          (s.usageNote && s.usageNote.toLowerCase().includes(q)),
      );
    }
    return data;
  }, [search, activeFilter]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  return (
    <div>
      <FilterPills
        ariaLabel={t('resources.sfx.filterAria')}
        value={activeFilter}
        onChange={setActiveFilter}
        options={[
          { value: 'all' as const, label: t('resources.sfx.filterAll', { count: SFX_DATA.length }) },
          ...ALL_SFX_CATEGORIES.map((cat) => ({ value: cat, label: SFX_CATEGORY_LABELS[cat] })),
        ]}
      />

      <SectionCount
        count={filtered.length}
        label={
          filtered.length === 1
            ? t('resources.sfx.results_one')
            : t('resources.sfx.results_other')
        }
      />

      {filtered.length === 0 ? (
        <ResourcesEmptyState query={search} context={t('resources.sfx.context')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((sfx, idx) => {
            const copyKey = `${sfx.romaji}-${idx}`;
            const tone = SFX_TONE[sfx.category] ?? 'paper';
            const tc = RES_TONE[tone];
            return (
              <article
                key={copyKey}
                className="panel-cut-sm group relative overflow-hidden border border-paper/10 bg-ink-2/60 p-4 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-paper/25 hover:drop-shadow-[4px_4px_0_rgba(255,200,87,0.5)]"
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -right-2 -top-4 select-none font-display text-6xl font-black opacity-[0.09] ${tc.text}`}
                >
                  {sfx.japanese}
                </span>

                <div className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-3xl font-black leading-none text-paper">
                      {sfx.japanese}
                    </span>
                    <ResStamp tone={tone}>{SFX_CATEGORY_LABELS[sfx.category]}</ResStamp>
                  </div>

                  <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-crimson">
                    {sfx.romaji}
                  </p>

                  {/* Translation + copy */}
                  <div className="mt-3 flex items-center gap-2 border-t border-paper/8 pt-2.5">
                    <span className="flex-1 font-accent text-[14px] italic text-paper/75">
                      “{sfx.english}”
                    </span>
                    <button
                      type="button"
                      aria-label={t('resources.sfx.copyAria', { text: sfx.english })}
                      onClick={() => void handleCopy(sfx.english, copyKey)}
                      className={`panel-cut-sm grid h-7 w-7 flex-none place-items-center border transition-all duration-150 ${copiedId === copyKey
                        ? 'border-mint/60 bg-mint/12 text-mint'
                        : 'border-paper/15 text-paper/45 hover:-translate-x-px hover:-translate-y-px hover:border-crimson/50 hover:text-crimson hover:drop-shadow-[2px_2px_0_rgba(255,200,87,0.6)]'
                        }`}
                    >
                      {copiedId === copyKey ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>

                  {sfx.usageNote && (
                    <p className="mt-2 text-[10.5px] leading-relaxed text-paper/45">
                      {sfx.usageNote}
                    </p>
                  )}
                  {sfx.commonIn && (
                    <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper/30">
                      {t('resources.sfx.commonIn', { value: sfx.commonIn })}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
