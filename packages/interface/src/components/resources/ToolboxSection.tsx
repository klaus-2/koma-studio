

   import {
     BookOpen,
     Brush,
     Download,
     ExternalLink,
     Languages,
     Layers,
     ScanLine,
     Sparkles,
     Upload,
     Wrench,
   } from 'lucide-react';
   import { useMemo, useState } from 'react';
   import { useI18n } from '../../i18n';

   import { TOOLBOX_ENTRIES, TOOLBOX_STAGE_ORDER } from '../../data/resources-data';
   import type { ResourceLink, ToolboxEntry, ToolboxLicense, ToolboxStage } from '../../data/guides-types';
   import { getResourceIcon } from '../../assets/resources';
import { matchesResourceSearch } from '../../utils/resource-search';
    import ResourcesEmptyState from './ResourcesEmptyState';
    import ResourceExternalAnchor from './ResourceExternalAnchor';

   interface ToolboxSectionProps {
     search: string;
   }

   type StageFilter = 'all' | ToolboxStage;

   const STAGE_ICON: Record<ToolboxStage, typeof ExternalLink> = {
     rippers: Download,
     cleaning: Brush,
     upscaling: Sparkles,
     typesetting: Layers,
     assets: ScanLine,
     publishing: Upload,
     translation: Languages,
     reference: BookOpen,
     utilities: Wrench,
   };

   export default function ToolboxSection({ search }: ToolboxSectionProps) {
     const { t } = useI18n();

     const [stageFilter, setStageFilter] = useState<StageFilter>('all');

     const STAGE_LABELS: Record<ToolboxStage, string> = {
       rippers: t('resources.toolbox.stage.rippers'),
       cleaning: t('resources.toolbox.stage.cleaning'),
       upscaling: t('resources.toolbox.stage.upscaling'),
       typesetting: t('resources.toolbox.stage.typesetting'),
       assets: t('resources.toolbox.stage.assets'),
       publishing: t('resources.toolbox.stage.publishing'),
       translation: t('resources.toolbox.stage.translation'),
       reference: t('resources.toolbox.stage.reference'),
       utilities: t('resources.toolbox.stage.utilities'),
     };

     const LICENSE_LABELS: Record<ToolboxLicense, string> = {
       'open-source': t('resources.toolbox.license.openSource'),
       free: t('resources.toolbox.license.free'),
       freeware: t('resources.toolbox.license.freeware'),
       paid: t('resources.toolbox.license.paid'),
       account: t('resources.toolbox.license.account'),
     };

     const buildLinks = (entry: ToolboxEntry): ResourceLink[] => {
       const links: ResourceLink[] = [
         { label: t('resources.toolbox.action.open'), url: entry.url, kind: 'site' },
       ];
       if (Array.isArray(entry.links)) {
         links.push(...entry.links);
       }

       const seen = new Set<string>();
       return links.filter((link) => {
         const key = `${link.kind ?? 'site'}:${link.label}:${link.url}`;
         if (!link.url || seen.has(key)) {
           return false;
         }
         seen.add(key);
         return true;
       });
     };

     const filtered = useMemo(() => {
       let data = TOOLBOX_ENTRIES;
       if (stageFilter !== 'all') {
         data = data.filter((entry) => entry.stage === stageFilter);
       }
       return data.filter((entry) =>
         matchesResourceSearch(search, [
           entry.name,
           entry.description,
           entry.stage,
           entry.platform,
           ...(entry.tags ?? []),
         ]),
       );
     }, [search, stageFilter]);

     if (filtered.length === 0) {
       return <ResourcesEmptyState query={search} context={t('resources.toolbox.context')} />;
     }

     return (
       <div>
         {/* Stage filters */}
         <div className="koma-res-filters" role="radiogroup" aria-label={t('resources.toolbox.filterAria')}>
           <button
             type="button"
             className={`koma-res-filter-btn ${stageFilter === 'all' ? 'koma-res-filter-btn--active' : ''}`}
             onClick={() => setStageFilter('all')}
             role="radio"
             aria-checked={stageFilter === 'all'}
           >
             {t('resources.toolbox.filterAll')}
           </button>
           {TOOLBOX_STAGE_ORDER.map((stage) => (
             <button
               key={stage}
               type="button"
               className={`koma-res-filter-btn ${stageFilter === stage ? 'koma-res-filter-btn--active' : ''}`}
               onClick={() => setStageFilter(stage)}
               role="radio"
               aria-checked={stageFilter === stage}
             >
               {STAGE_LABELS[stage]}
             </button>
           ))}
         </div>

         <div className="koma-res-section-count">
           <span className="koma-res-section-count__num">{filtered.length}</span>
           {filtered.length === 1 ? t('resources.toolbox.results_one') : t('resources.toolbox.results_other')}
         </div>

         <div className="koma-res-tools__list">
           {filtered.map((entry) => {
             const actionLinks = buildLinks(entry);
             const icon = getResourceIcon(entry.image);
             return (
             <div key={entry.id} className="koma-res-tool-row">
               <div className="koma-res-tool-row__icon">
                 {icon ? (
                   <img src={icon} alt="" width={20} height={20} loading="lazy" decoding="async" />
                 ) : (
                   (() => {
                     const StageIcon = STAGE_ICON[entry.stage] ?? ExternalLink;
                     return <StageIcon size={16} />;
                   })()
                 )}
               </div>

               <div className="koma-res-tool-row__body">
                 <div className="koma-res-tool-row__name">{entry.name}</div>
                 <div className="koma-res-tool-row__desc">
                   {entry.description}
                 </div>
                 <div className="koma-res-tool-row__badges">
                   <span className="koma-res-tool-row__cat-badge">
                     {STAGE_LABELS[entry.stage]}
                   </span>
                   {entry.license ? (
                     <span className="koma-res-badge koma-res-badge--free">
                       {LICENSE_LABELS[entry.license]}
                     </span>
                   ) : null}
                   {entry.platform ? (
                     <span className="koma-res-tag">{entry.platform}</span>
                   ) : null}
                 </div>
               </div>

               <div className="koma-res-tool-row__actions">
                 {actionLinks.map((link) => (
                    <ResourceExternalAnchor
                      key={`${entry.id}-${link.kind}-${link.url}`}
                      href={link.url}
                      className="koma-res-tool-row__link"
                      aria-label={`${link.label} ${entry.name}`}
                    >
                      {link.kind === 'download' ? <Download size={13} /> : <ExternalLink size={13} />}
                      <span>{link.label}</span>
                    </ResourceExternalAnchor>
                 ))}
               </div>
             </div>
           )})}
         </div>
       </div>
     );
   }
