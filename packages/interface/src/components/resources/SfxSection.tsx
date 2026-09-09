/* ============================================================
   KŌMA STUDIO — SFX Library Section (Resources Tab)
   Japanese onomatopoeia with copy-to-clipboard
   ============================================================ */

   import { Check, Copy } from 'lucide-react';
   import { useCallback, useMemo, useState } from 'react';
   import { useI18n } from '../../i18n';

   import { SFX_DATA } from '../../data/resources-data';
   import type { SfxEntry } from '../../data/guides-types';
   import ResourcesEmptyState from './ResourcesEmptyState';

   interface SfxSectionProps {
     search: string;
   }

   export default function SfxSection({ search }: SfxSectionProps) {
     const { t } = useI18n();
     const [activeFilter, setActiveFilter] = useState<
       SfxEntry['category'] | 'all'
     >('all');
     const [copiedId, setCopiedId] = useState<string | null>(null);

     const SFX_CATEGORY_LABELS: Record<SfxEntry['category'], string> = {
       impact: t('resources.sfx.category.impact'),
       emotion: t('resources.sfx.category.emotion'),
       ambient: t('resources.sfx.category.ambient'),
       action: t('resources.sfx.category.action'),
       voice: t('resources.sfx.category.voice'),
       misc: t('resources.sfx.category.misc'),
     };

     const ALL_SFX_CATEGORIES = Object.keys(
       SFX_CATEGORY_LABELS,
     ) as SfxEntry['category'][];

     const filtered = useMemo(() => {
       let data = SFX_DATA as SfxEntry[];
       if (activeFilter !== 'all') {
         data = data.filter((s) => s.category === activeFilter);
       }
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
         {/* Category filter pills */}
         <div className="koma-res-filters" role="radiogroup" aria-label={t('resources.sfx.filterAria')}>
           <button
             type="button"
             className={`koma-res-filter-btn ${activeFilter === 'all' ? 'koma-res-filter-btn--active' : ''}`}
             onClick={() => setActiveFilter('all')}
             role="radio"
             aria-checked={activeFilter === 'all'}
           >
             {t('resources.sfx.filterAll', { count: SFX_DATA.length })}
           </button>
           {ALL_SFX_CATEGORIES.map((cat) => (
             <button
               key={cat}
               type="button"
               className={`koma-res-filter-btn ${activeFilter === cat ? 'koma-res-filter-btn--active' : ''}`}
               onClick={() => setActiveFilter(cat)}
               role="radio"
               aria-checked={activeFilter === cat}
             >
               {SFX_CATEGORY_LABELS[cat]}
             </button>
           ))}
         </div>

         {/* Result count */}
         <div className="koma-res-section-count">
           <span className="koma-res-section-count__num">{filtered.length}</span>
           {filtered.length === 1 ? t('resources.sfx.results_one') : t('resources.sfx.results_other')}
         </div>

         {filtered.length === 0 ? (
           <ResourcesEmptyState query={search} context={t('resources.sfx.context')} />
         ) : (
           <div className="koma-res-sfx__grid">
             {filtered.map((sfx, idx) => {
               const copyKey = `${sfx.romaji}-${idx}`;
               return (
                 <div key={copyKey} className="koma-res-sfx-card">
                   {/* Header: JP + badge */}
                   <div className="koma-res-sfx-card__header">
                     <span className="koma-res-sfx-card__jp">{sfx.japanese}</span>
                     <span
                       className={`koma-res-sfx-badge koma-res-sfx-badge--${sfx.category}`}
                     >
                       {SFX_CATEGORY_LABELS[sfx.category]}
                     </span>
                   </div>

                   {/* Romaji */}
                   <span className="koma-res-sfx-card__romaji">{sfx.romaji}</span>

                   {/* English translation + copy */}
                   <div className="koma-res-sfx-card__translation">
                     <span className="koma-res-sfx-card__flag">🇺🇸</span>
                     <span className="koma-res-sfx-card__text">{sfx.english}</span>
                     <button
                       type="button"
                       className={`koma-res-copy-btn ${copiedId === copyKey ? 'koma-res-copy-btn--copied' : ''}`}
                       onClick={() => handleCopy(sfx.english, copyKey)}
                       aria-label={t('resources.sfx.copyAria', { text: sfx.english })}
                     >
                       {copiedId === copyKey ? (
                         <Check size={12} />
                       ) : (
                         <Copy size={12} />
                       )}
                     </button>
                   </div>

                   {/* Usage note */}
                   {sfx.usageNote && (
                     <p className="koma-res-sfx-card__note">{sfx.usageNote}</p>
                   )}

                   {/* Common in */}
                   {sfx.commonIn && (
                     <p className="koma-res-sfx-card__common">
                       {t('resources.sfx.commonIn', { value: sfx.commonIn })}
                     </p>
                   )}
                 </div>
               );
             })}
           </div>
         )}
       </div>
     );
   }