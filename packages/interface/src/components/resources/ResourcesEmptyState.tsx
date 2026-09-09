/* ============================================================
   KŌMA STUDIO — Resources Empty State
   Shown when search/filter returns no results
   ============================================================ */

   import { SearchX } from 'lucide-react';
   import { useI18n } from '../../i18n';

   interface ResourcesEmptyStateProps {
     query: string;
     context: string;
   }
   
   export default function ResourcesEmptyState({
     query,
     context,
   }: ResourcesEmptyStateProps) {
     const { t } = useI18n();
     return (
       <div className="koma-res-empty" role="status">
         <div className="koma-res-empty__icon" aria-hidden="true">
           <SearchX size={24} />
         </div>
         <h4 className="koma-res-empty__title">
           {query
             ? t('resources.empty.title.withQuery', { query })
             : t('resources.empty.title.noQuery')}
         </h4>
         <p className="koma-res-empty__desc">
           {query
             ? t('resources.empty.desc.withQuery', { context })
             : t('resources.empty.desc.noQuery', { context })}
         </p>
       </div>
     );
   }