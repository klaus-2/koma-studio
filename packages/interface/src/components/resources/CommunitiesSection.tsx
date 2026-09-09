/* ============================================================
   KŌMA STUDIO — Communities Section (Resources Tab)
   Scanlation communities & links with platform badges
   ============================================================ */

   import { ExternalLink } from 'lucide-react';
   import { useMemo } from 'react';
   import { useI18n } from '../../i18n';

   import { COMMUNITIES_DATA } from '../../data/resources-data';
   import type { CommunityEntry } from '../../data/guides-types';
    import ResourcesEmptyState from './ResourcesEmptyState';
    import ResourceExternalAnchor from './ResourceExternalAnchor';

   interface CommunitiesSectionProps {
     search: string;
   }

   export default function CommunitiesSection({ search }: CommunitiesSectionProps) {
     const { t } = useI18n();

     const PLATFORM_LABELS: Record<CommunityEntry['platform'], string> = {
       discord: t('resources.communities.platform.discord'),
       reddit: t('resources.communities.platform.reddit'),
       forum: t('resources.communities.platform.forum'),
       website: t('resources.communities.platform.website'),
       telegram: t('resources.communities.platform.telegram'),
     };

     const filtered = useMemo(() => {
       if (!search.trim()) return COMMUNITIES_DATA;
       const q = search.toLowerCase();
       return COMMUNITIES_DATA.filter(
         (c: CommunityEntry) =>
           c.name.toLowerCase().includes(q) ||
           c.description.toLowerCase().includes(q) ||
           c.language.toLowerCase().includes(q),
       );
     }, [search]);

     if (filtered.length === 0) {
       return <ResourcesEmptyState query={search} context={t('resources.communities.context')} />;
     }

     return (
       <div>
         <div className="koma-res-section-count">
           <span className="koma-res-section-count__num">{filtered.length}</span>
           {filtered.length === 1 ? t('resources.communities.results_one') : t('resources.communities.results_other')}
         </div>

         <div className="koma-res-links__grid">
           {filtered.map((community: CommunityEntry) => (
             <div key={community.name} className="koma-res-link-card">
               <div className="koma-res-link-card__top">
                 <h4 className="koma-res-link-card__name">{community.name}</h4>
                 <span
                   className={`koma-res-platform koma-res-platform--${community.platform}`}
                 >
                   {PLATFORM_LABELS[community.platform] ?? community.platform}
                 </span>
               </div>

               <p className="koma-res-link-card__desc">{community.description}</p>

               <div className="koma-res-link-card__meta">
                 <span>🌐 {community.language}</span>
                 {community.memberCount && (
                   <span>👤 {community.memberCount}</span>
                 )}
               </div>

               {community.url && (
                  <ResourceExternalAnchor
                    href={community.url}
                    className="koma-res-link-card__action"
                    aria-label={t('resources.communities.visitAria', { name: community.name })}
                  >
                    {t('resources.communities.visit')}
                    <ExternalLink size={11} />
                  </ResourceExternalAnchor>
               )}
             </div>
           ))}
         </div>
       </div>
     );
   }
