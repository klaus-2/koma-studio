/* ============================================================
   KŌMA STUDIO — Category View
   Lists all guides within a category
   ============================================================ */

   import { ArrowLeft, ChevronRight, Clock, Search } from 'lucide-react';
   import { useMemo, useState } from 'react';
   
   import { GUIDE_CATEGORIES, GUIDES } from '../../data/guides-data';
   import type { GuideCategoryId } from '../../data/guides-types';
   import { useInfoNavStore } from '../../stores/info-nav-store';
   import { useI18n } from '../../i18n';
   
   interface Props {
     categoryId: GuideCategoryId;
   }
   
   export default function GuidesCategoryView({ categoryId }: Props) {
     const { t } = useI18n();
     const navigateGuidesHome = useInfoNavStore((s) => s.navigateGuidesHome);
     const navigateToGuideEntry = useInfoNavStore((s) => s.navigateToGuideEntry);
     const readGuides = useInfoNavStore((s) => s.readGuides);
     const [search, setSearch] = useState('');
   
     const category = GUIDE_CATEGORIES.find((c) => c.id === categoryId);
     const allGuides = useMemo(() => GUIDES.filter((g) => g.category === categoryId), [categoryId]);
   
     const filtered = useMemo(() => {
       if (!search.trim()) return allGuides;
       const q = search.toLowerCase();
       return allGuides.filter(
         (g) =>
           g.title.toLowerCase().includes(q) ||
           g.subtitle.toLowerCase().includes(q) ||
           g.tags.some((t) => t.toLowerCase().includes(q)),
       );
     }, [allGuides, search]);
   
     if (!category) return null;
   
     return (
       <div className="koma-gr-page koma-gr-fadein">
         {/* Breadcrumb */}
         <div className="koma-gr-breadcrumb">
          <button type="button" className="koma-gr-breadcrumb__link" onClick={navigateGuidesHome}>
             {t('guides.detail.guides')}
          </button>
           <span className="koma-gr-breadcrumb__sep">›</span>
           <span className="koma-gr-breadcrumb__current">{category.label}</span>
         </div>
   
         <button type="button" className="koma-gr-back" onClick={navigateGuidesHome}>
           <ArrowLeft size={13} /> {t('guides.detail.back')}
         </button>
   
         <div className="koma-gr-header">
           <div className="koma-gr-header__row">
             <div className={`koma-gr-header__icon koma-gr-card__icon--${category.accentColor}`} style={{ background: undefined }}>
               <category.icon size={18} />
             </div>
             <h1 className="koma-gr-header__title">{category.label}</h1>
           </div>
           <p className="koma-gr-header__desc">{category.description}</p>
         </div>
   
         {/* Search within category */}
         {allGuides.length > 3 && (
           <div className="koma-gr-search" style={{ maxWidth: 400, marginBottom: 18 }}>
             <input
               className="koma-gr-search__input"
               type="text"
               placeholder={t('guides.category.searchPlaceholder', { category: category.label })}
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               aria-label={t('guides.category.searchAria', { category: category.label })}
             />
             <Search size={14} className="koma-gr-search__icon" />
           </div>
         )}
   
         {/* Guide list */}
         {filtered.length === 0 ? (
           <div className="koma-gr-empty">
             <div className="koma-gr-empty__icon">
               <Search size={22} />
             </div>
             <p className="koma-gr-empty__title">
               {search
                 ? t('guides.category.noSearchResults', { query: search })
                 : t('guides.category.noGuides')}
             </p>
             <p className="koma-gr-empty__desc">
               {search ? t('guides.category.tryOtherTerms') : t('guides.category.comingSoon')}
             </p>
           </div>
         ) : (
           <div className="koma-gr-guide-list koma-gr-stagger">
             {filtered.map((guide) => (
               <div
                 key={guide.id}
                 className="koma-gr-guide-item koma-gr-fadein"
                 onClick={() => navigateToGuideEntry(categoryId, guide.id)}
                 role="button"
                 tabIndex={0}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     navigateToGuideEntry(categoryId, guide.id);
                   }
                 }}
               >
                 <div className={`koma-gr-guide-item__icon koma-gr-card__icon--${guide.accentColor}`}>
                   <guide.icon size={16} />
                 </div>
                 <div className="koma-gr-guide-item__body">
                   <h4 className="koma-gr-guide-item__title">
                     {guide.title}
                     {readGuides[guide.id] && (
                       <span style={{ color: 'var(--auth-emerald)', marginLeft: 8, fontSize: 11 }}>✓ {t('guides.category.completed')}</span>
                     )}
                   </h4>
                   <p className="koma-gr-guide-item__desc">{guide.subtitle}</p>
                 </div>
                 <div className="koma-gr-guide-item__meta">
                   <span className={`koma-gr-badge koma-gr-badge--${guide.difficulty}`}>
                     {guide.difficulty === 'beginner'
                       ? t('guides.common.beginner')
                       : guide.difficulty === 'intermediate'
                         ? t('guides.common.intermediate')
                         : t('guides.common.advanced')}
                   </span>
                   <span className="koma-gr-badge koma-gr-badge--time">
                     <Clock size={10} /> {guide.estimatedTime}
                   </span>
                 </div>
                 <ChevronRight size={14} className="koma-gr-guide-item__arrow" />
               </div>
             ))}
           </div>
         )}
       </div>
     );
   }
