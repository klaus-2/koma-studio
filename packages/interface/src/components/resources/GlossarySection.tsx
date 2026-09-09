/* ============================================================
   KŌMA STUDIO — Glossary Section (Resources Tab)
   Expandable terms with alphabet navigation
   ============================================================ */

import { ChevronDown } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '../../i18n';

import { GLOSSARY_DATA } from '../../data/resources-data';
import type { GlossaryEntry } from '../../data/guides-types';
import ResourcesEmptyState from './ResourcesEmptyState';

interface GlossarySectionProps {
  search: string;
}

export default function GlossarySection({ search }: GlossarySectionProps) {
  const { t } = useI18n();
  const [categoryFilter, setCategoryFilter] = useState<
    GlossaryEntry['category'] | 'all'
  >('all');
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
    if (categoryFilter !== 'all') {
      data = data.filter((g) => g.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (g) =>
          g.term.toLowerCase().includes(q) ||
          g.definition.toLowerCase().includes(q) ||
          (g.relatedTerms &&
            g.relatedTerms.some((entry) => entry.toLowerCase().includes(q))),
      );
    }
    return data;
  }, [search, categoryFilter]);

     /* Group by first letter */
  const grouped = useMemo(() => {
    const groups: Record<string, GlossaryEntry[]> = {};
    filtered.forEach((entry) => {
      const letter = (entry.term[0] ?? '#').toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(entry);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

     /* All available letters for nav */
  const availableLetters = useMemo(
    () => new Set(grouped.map(([letter]) => letter)),
    [grouped],
  );

  const scrollToLetter = useCallback((letter: string) => {
    const el = document.getElementById(`koma-gl-${letter}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

     /* Short definition: first sentence */
  const shortDef = (def: string) => {
    const first = def.split(/[.!]/, 1)[0] ?? '';
    return first.length < def.length ? `${first}.` : first;
  };

     return (
       <div>
         {/* Category filter pills */}
         <div className="koma-res-filters" role="radiogroup" aria-label={t('resources.glossary.category.general')}>
           <button
             type="button"
             className={`koma-res-filter-btn ${categoryFilter === 'all' ? 'koma-res-filter-btn--active' : ''}`}
             onClick={() => setCategoryFilter('all')}
             role="radio"
             aria-checked={categoryFilter === 'all'}
           >
             {t('resources.glossary.filterAll')}
           </button>
           {ALL_GLOSSARY_CATEGORIES.map((cat) => (
             <button
               key={cat}
               type="button"
               className={`koma-res-filter-btn ${categoryFilter === cat ? 'koma-res-filter-btn--active' : ''}`}
               onClick={() => setCategoryFilter(cat)}
               role="radio"
               aria-checked={categoryFilter === cat}
             >
               {GLOSSARY_CATEGORY_LABELS[cat]}
             </button>
           ))}
         </div>

         {/* Result count */}
         <div className="koma-res-section-count">
           <span className="koma-res-section-count__num">{filtered.length}</span>
           {filtered.length === 1 ? t('resources.glossary.results_one') : t('resources.glossary.results_other')}
         </div>

         {filtered.length === 0 ? (
           <ResourcesEmptyState query={search} context={t('resources.glossary.context')} />
         ) : (
           <div className="koma-res-glossary__layout">
             {/* Alphabet nav */}
             <nav
               className="koma-res-glossary__alpha-nav"
               role="navigation"
               aria-label={t('resources.glossary.alphaAria')}
             >
               {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
                 <button
                   key={letter}
                   type="button"
                   className={`koma-res-glossary__alpha-btn ${
                     availableLetters.has(letter)
                       ? ''
                       : 'koma-res-glossary__alpha-btn--disabled'
                   }`}
                   onClick={() => scrollToLetter(letter)}
                   aria-label={t('resources.glossary.alphaBtnAria', { letter })}
                 >
                   {letter}
                 </button>
               ))}
             </nav>

             {/* Items grouped by letter */}
             <div className="koma-res-glossary__list">
               {grouped.map(([letter, entries]) => (
                 <div key={letter}>
                   <div
                     className="koma-res-glossary__letter-row"
                     id={`koma-gl-${letter}`}
                   >
                     <span className="koma-res-glossary__letter">{letter}</span>
                     <div className="koma-res-glossary__letter-line" />
                   </div>
                   {entries.map((entry) => {
                     const isExpanded = expandedTerms.has(entry.term);
                     return (
                       <div
                         key={entry.term}
                         className={`koma-res-glossary-item ${isExpanded ? 'koma-res-glossary-item--expanded' : ''}`}
                       >
                         <button
                           type="button"
                           className="koma-res-glossary-item__header"
                           onClick={() => toggleExpand(entry.term)}
                           aria-expanded={isExpanded}
                         >
                           <span className="koma-res-glossary-item__term">
                             {entry.term}
                           </span>
                           <span className="koma-res-glossary-item__cat">
                             {GLOSSARY_CATEGORY_LABELS[entry.category]}
                           </span>
                           {!isExpanded && (
                             <span className="koma-res-glossary-item__short">
                               {shortDef(entry.definition)}
                             </span>
                           )}
                           <ChevronDown
                             size={14}
                             className="koma-res-glossary-item__chevron"
                           />
                         </button>
                         <div className="koma-res-glossary-item__body">
                           <p className="koma-res-glossary-item__definition">
                             {entry.definition}
                           </p>
                           {entry.relatedTerms &&
                             entry.relatedTerms.length > 0 && (
                               <div className="koma-res-glossary-item__related">
                                 <span className="koma-res-glossary-item__related-label">
                                   {t('resources.glossary.related')}
                                 </span>
                                 {entry.relatedTerms.map((rt) => (
                                   <span
                                     key={rt}
                                     className="koma-res-glossary-item__related-pill"
                                     role="button"
                                     tabIndex={0}
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       /* Could scroll to the related term */
                                     }}
                                     onKeyDown={(e) => {
                                       if (
                                         e.key === 'Enter' ||
                                         e.key === ' '
                                       ) {
                                         e.preventDefault();
                                       }
                                     }}
                                   >
                                     {rt}
                                   </span>
                                 ))}
                               </div>
                             )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               ))}
             </div>
           </div>
         )}
       </div>
     );
   }
