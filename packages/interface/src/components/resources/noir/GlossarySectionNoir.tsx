import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '../../../i18n';

import { GLOSSARY_DATA } from '../../../data/resources-data';
import type { GlossaryEntry } from '../../../data/guides-types';
import { EASE } from '../../noir-panels/NoirPrimitives';
import { FilterPills, ResourcesEmptyState, ResStamp, SectionCount } from './noir-resources';

interface GlossarySectionProps {
  search: string;
}

export default function GlossarySection({ search }: GlossarySectionProps) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [categoryFilter, setCategoryFilter] = useState<GlossaryEntry['category'] | 'all'>('all');
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());

  const GLOSSARY_CATEGORY_LABELS: Record<GlossaryEntry['category'], string> = {
    general: t('resources.glossary.category.general'),
    typesetting: t('resources.glossary.category.typesetting'),
    cleaning: t('resources.glossary.category.cleaning'),
    translation: t('resources.glossary.category.translation'),
    technical: t('resources.glossary.category.technical'),
    roles: t('resources.glossary.category.roles'),
  };

  const ALL_GLOSSARY_CATEGORIES = Object.keys(
    GLOSSARY_CATEGORY_LABELS,
  ) as GlossaryEntry['category'][];

  const toggleExpand = useCallback((term: string) => {
    setExpandedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    let data = GLOSSARY_DATA as GlossaryEntry[];
    if (categoryFilter !== 'all') data = data.filter((g) => g.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (g) =>
          g.term.toLowerCase().includes(q) ||
          g.definition.toLowerCase().includes(q) ||
          (g.relatedTerms && g.relatedTerms.some((rt) => rt.toLowerCase().includes(q))),
      );
    }
    return data;
  }, [search, categoryFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, GlossaryEntry[]> = {};
    filtered.forEach((entry) => {
      const letter = (entry.term[0] ?? '').toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(entry);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const availableLetters = useMemo(
    () => new Set(grouped.map(([letter]) => letter)),
    [grouped],
  );

  const scrollToLetter = useCallback((letter: string) => {
    document
      .getElementById(`koma-gl-${letter}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const shortDef = (def: string) => {
    const first = def.split(/[.!]/, 1)[0];
    return (first ?? '').length < def.length ? `${first}.` : first;
  };

  return (
    <div>
      <FilterPills
        ariaLabel={t('resources.glossary.category.general')}
        value={categoryFilter}
        onChange={setCategoryFilter}
        options={[
          { value: 'all' as const, label: t('resources.glossary.filterAll') },
          ...ALL_GLOSSARY_CATEGORIES.map((cat) => ({
            value: cat,
            label: GLOSSARY_CATEGORY_LABELS[cat],
          })),
        ]}
      />

      <SectionCount
        count={filtered.length}
        label={
          filtered.length === 1
            ? t('resources.glossary.results_one')
            : t('resources.glossary.results_other')
        }
      />

      {filtered.length === 0 ? (
        <ResourcesEmptyState query={search} context={t('resources.glossary.context')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_36px]">
          {/* Terms grouped by letter */}
          <div className="flex flex-col gap-4">
            {grouped.map(([letter, entries]) => (
              <div key={letter}>
                {/* Letter marker — dictionary spine */}
                <div
                  id={`koma-gl-${letter}`}
                  className="mb-2 flex scroll-mt-4 items-center gap-3"
                >
                  <span className="text-outline select-none font-display text-3xl font-black leading-none">
                    {letter}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-paper/10" />
                </div>

                <div className="flex flex-col gap-1.5">
                  {entries.map((entry) => {
                    const isExpanded = expandedTerms.has(entry.term);
                    return (
                      <div
                        key={entry.term}
                        className={`panel-cut-sm border transition-colors ${isExpanded
                            ? 'border-crimson/35 bg-crimson/5'
                            : 'border-paper/10 bg-ink-2/50 hover:border-paper/25'
                          }`}
                      >
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpand(entry.term)}
                          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                        >
                          <span className="flex-none font-display text-[12.5px] font-extrabold uppercase tracking-wide text-paper">
                            {entry.term}
                          </span>
                          <ResStamp tone="azure">
                            {GLOSSARY_CATEGORY_LABELS[entry.category]}
                          </ResStamp>
                          {!isExpanded && (
                            <span className="hidden min-w-0 flex-1 truncate text-[10.5px] text-paper/40 sm:block">
                              {shortDef(entry.definition)}
                            </span>
                          )}
                          <ChevronDown
                            size={13}
                            aria-hidden
                            className={`ml-auto flex-none text-paper/40 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-crimson' : ''
                              }`}
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={reduce ? false : { height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={reduce ? undefined : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.28, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-paper/8 px-3.5 py-3">
                                <p className="text-[12px] leading-relaxed text-paper/70">
                                  {entry.definition}
                                </p>
                                {entry.relatedTerms && entry.relatedTerms.length > 0 && (
                                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-paper/35">
                                      {t('resources.glossary.related')}
                                    </span>
                                    {entry.relatedTerms.map((rt) => (
                                      <span
                                        key={rt}
                                        className="border border-gold/30 bg-gold/6 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-gold"
                                      >
                                        {rt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Alphabet spine (desktop) */}
          <nav
            role="navigation"
            aria-label={t('resources.glossary.alphaAria')}
            className="sticky top-4 hidden h-fit flex-col items-center gap-0.5 lg:flex"
          >
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
              const enabled = availableLetters.has(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!enabled}
                  aria-label={t('resources.glossary.alphaBtnAria', { letter })}
                  onClick={() => scrollToLetter(letter)}
                  className={`grid h-5 w-6 place-items-center font-mono text-[9px] transition-colors ${enabled
                      ? 'text-paper/55 hover:bg-crimson hover:font-bold hover:text-ink'
                      : 'cursor-default text-paper/15'
                    }`}
                >
                  {letter}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
