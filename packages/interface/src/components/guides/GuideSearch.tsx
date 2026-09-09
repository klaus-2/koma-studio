/* ============================================================
   KŌMA STUDIO — Guide Search (Command Palette)
   ============================================================ */

   import { Search, X } from 'lucide-react';
   import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
   
   import { GUIDE_CATEGORIES, GUIDES } from '../../data/guides-data';
   import type { GuideCategoryId } from '../../data/guides-types';
   import { useInfoNavStore } from '../../stores/info-nav-store';
   import { useI18n } from '../../i18n';
   
   interface Props {
     onClose: () => void;
   }
   
   export default function GuideSearch({ onClose }: Props) {
     const { t } = useI18n();
     const [query, setQuery] = useState('');
     const [selectedIdx, setSelectedIdx] = useState(0);
     const inputRef = useRef<HTMLInputElement>(null);
     const navigateToGuideEntry = useInfoNavStore((s) => s.navigateToGuideEntry);
     const recentGuides = useInfoNavStore((s) => s.recentGuides);
   
     useEffect(() => {
       inputRef.current?.focus();
     }, []);
   
     useEffect(() => {
       const handler = (e: KeyboardEvent) => {
         if (e.key === 'Escape') onClose();
       };
       window.addEventListener('keydown', handler);
       return () => window.removeEventListener('keydown', handler);
     }, [onClose]);
   
     const results = useMemo(() => {
       if (!query.trim()) {
         return recentGuides
           .map((id) => GUIDES.find((g) => g.id === id))
           .filter(Boolean)
           .map((g) => g!);
       }
       const q = query.toLowerCase();
       return GUIDES.filter(
         (g) =>
           g.title.toLowerCase().includes(q) ||
           g.subtitle.toLowerCase().includes(q) ||
           g.tags.some((t) => t.toLowerCase().includes(q)) ||
           g.sections.some((s) =>
             s.steps.some(
               (st) =>
                 st.content.toLowerCase().includes(q) ||
                 (st.title && st.title.toLowerCase().includes(q)),
             ),
           ),
       );
     }, [query, recentGuides]);
   
     useEffect(() => {
       setSelectedIdx(0);
     }, [query]);
   
     const handleKeyDown = useCallback(
       (e: React.KeyboardEvent) => {
         if (e.key === 'ArrowDown') {
           e.preventDefault();
           setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
         } else if (e.key === 'ArrowUp') {
           e.preventDefault();
           setSelectedIdx((prev) => Math.max(prev - 1, 0));
         } else if (e.key === 'Enter' && results[selectedIdx]) {
           const guide = results[selectedIdx];
           navigateToGuideEntry(guide.category, guide.id);
           onClose();
         }
       },
       [results, selectedIdx, navigateToGuideEntry, onClose],
     );
   
     const handleSelect = useCallback(
       (guideId: string, category: GuideCategoryId) => {
         navigateToGuideEntry(category, guideId);
         onClose();
       },
       [navigateToGuideEntry, onClose],
     );
   
     return (
      <div className="koma-gr-search-overlay" onClick={onClose} role="dialog" aria-label={t('guides.search.dialogAria')}>
         <div className="koma-gr-search-modal" onClick={(e) => e.stopPropagation()}>
           {/* Search field */}
           <div className="koma-gr-search-modal__field">
             <Search size={18} />
             <input
               ref={inputRef}
               className="koma-gr-search-modal__input"
               type="text"
               placeholder={t('guides.search.placeholder')}
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               onKeyDown={handleKeyDown}
               aria-label={t('guides.search.inputAria')}
             />
             <button
               type="button"
               onClick={onClose}
               style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--auth-text-muted)', padding: 4 }}
               aria-label={t('guides.search.close')}
             >
               <X size={16} />
             </button>
           </div>
   
           {/* Results */}
           <div className="koma-gr-search-modal__body" role="listbox">
             {results.length === 0 && query.trim() ? (
               <div className="koma-gr-search-modal__empty">
                 <Search size={28} />
                 {t('guides.search.noResults', { query })}
               </div>
             ) : (
               <>
                 <div className="koma-gr-search-modal__group-label">
                   {query.trim()
                     ? t('guides.search.results', { count: results.length })
                     : t('guides.search.recent')}
                 </div>
                 {results.map((guide, idx) => {
                   const cat = GUIDE_CATEGORIES.find((c) => c.id === guide.category);
                   return (
                     <div
                       key={guide.id}
                       className={`koma-gr-search-modal__item ${idx === selectedIdx ? 'koma-gr-search-modal__item--active' : ''}`}
                       onClick={() => handleSelect(guide.id, guide.category)}
                       role="option"
                       aria-selected={idx === selectedIdx}
                       onMouseEnter={() => setSelectedIdx(idx)}
                     >
                       <div className="koma-gr-search-modal__item-icon">
                         <guide.icon size={14} />
                       </div>
                       <div className="koma-gr-search-modal__item-text">
                         <div className="koma-gr-search-modal__item-title">{guide.title}</div>
                         <div className="koma-gr-search-modal__item-sub">
                           {cat?.label || guide.category} · {guide.subtitle}
                         </div>
                       </div>
                       <span className="koma-gr-search-modal__item-meta">
                         {guide.estimatedTime}
                       </span>
                     </div>
                   );
                 })}
               </>
             )}
           </div>
   
           {/* Footer */}
           <div className="koma-gr-search-modal__footer">
             <span><kbd>{t('guides.search.keyArrowUp')}</kbd><kbd>{t('guides.search.keyArrowDown')}</kbd> {t('guides.search.navigate')}</span>
             <span><kbd>{t('guides.search.keyEnter')}</kbd> {t('guides.search.open')}</span>
             <span><kbd>{t('guides.search.keyEscape')}</kbd> {t('guides.search.closeVerb')}</span>
           </div>
         </div>
       </div>
     );
   }
