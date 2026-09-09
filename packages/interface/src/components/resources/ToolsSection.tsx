/* ============================================================
   KŌMA STUDIO — External Tools Section (Resources Tab)
   Recommended tools with category badges
   ============================================================ */

   import { Download, ExternalLink } from 'lucide-react';
   import { useMemo, useState } from 'react';
   import { useI18n } from '../../i18n';

   import { EXTERNAL_TOOLS_DATA } from '../../data/resources-data';
   import type { ExternalToolEntry, ResourceLink } from '../../data/guides-types';
   import ResourcesEmptyState from './ResourcesEmptyState';
   import ResourceExternalAnchor from './ResourceExternalAnchor';

   interface ToolsSectionProps {
     search: string;
   }

   export default function ToolsSection({ search }: ToolsSectionProps) {
     const { t } = useI18n();
     const [catFilter, setCatFilter] = useState<string>('all');

     const TOOL_CATEGORY_LABELS: Record<string, string> = {
       editing: t('resources.tools.category.editing'),
       ocr: t('resources.tools.category.ocr'),
       translation: t('resources.tools.category.translation'),
       fonts: t('resources.tools.category.fonts'),
       hosting: t('resources.tools.category.hosting'),
       utility: t('resources.tools.category.utility'),
     };

     const ALL_TOOL_CATEGORIES = Object.keys(TOOL_CATEGORY_LABELS);

     const buildToolLinks = (tool: ExternalToolEntry): ResourceLink[] => {
       const links: ResourceLink[] = [];
       if (tool.url) {
         links.push({ label: t('resources.tools.action.open'), url: tool.url, kind: 'site' });
       }
       if (tool.downloadUrl) {
         links.push({ label: t('resources.tools.action.download'), url: tool.downloadUrl, kind: 'download' });
       }
       if (Array.isArray(tool.links)) {
         links.push(...tool.links);
       }

       const seen = new Set<string>();
       return links.filter((link) => {
         const key = `${link.label}:${link.url}`;
         if (!link.url || seen.has(key)) {
           return false;
         }
         seen.add(key);
         return true;
       });
     };

     const filtered = useMemo(() => {
       let data = EXTERNAL_TOOLS_DATA as ExternalToolEntry[];
       if (catFilter !== 'all') {
         data = data.filter((t) => t.category === catFilter);
       }
       if (search.trim()) {
         const q = search.toLowerCase();
         data = data.filter(
           (t) =>
             t.name.toLowerCase().includes(q) ||
             t.description.toLowerCase().includes(q),
         );
       }
       return data;
     }, [search, catFilter]);

     return (
       <div>
         {/* Category filters */}
         <div className="koma-res-filters" role="radiogroup" aria-label={t('resources.sfx.filterAria')}>
           <button
             type="button"
             className={`koma-res-filter-btn ${catFilter === 'all' ? 'koma-res-filter-btn--active' : ''}`}
             onClick={() => setCatFilter('all')}
             role="radio"
             aria-checked={catFilter === 'all'}
           >
             {t('resources.tools.filterAll')}
           </button>
           {ALL_TOOL_CATEGORIES.map((cat) => (
             <button
               key={cat}
               type="button"
               className={`koma-res-filter-btn ${catFilter === cat ? 'koma-res-filter-btn--active' : ''}`}
               onClick={() => setCatFilter(cat)}
               role="radio"
               aria-checked={catFilter === cat}
             >
               {TOOL_CATEGORY_LABELS[cat]}
             </button>
           ))}
         </div>

         <div className="koma-res-section-count">
           <span className="koma-res-section-count__num">{filtered.length}</span>
           {filtered.length === 1 ? t('resources.tools.results_one') : t('resources.tools.results_other')}
         </div>

         {filtered.length === 0 ? (
           <ResourcesEmptyState query={search} context={t('resources.tools.context')} />
         ) : (
           <div className="koma-res-tools__list">
             {filtered.map((tool: ExternalToolEntry) => {
               const actionLinks = buildToolLinks(tool);
               return (
               <div key={tool.name} className="koma-res-tool-row">
                 <div className="koma-res-tool-row__icon">
                   <tool.icon size={16} />
                 </div>

                 <div className="koma-res-tool-row__body">
                   <div className="koma-res-tool-row__name">{tool.name}</div>
                   <div className="koma-res-tool-row__desc">
                     {tool.description}
                   </div>
                   <div className="koma-res-tool-row__badges">
                     <span className="koma-res-tool-row__cat-badge">
                       {TOOL_CATEGORY_LABELS[tool.category] ?? tool.category}
                     </span>
                   </div>
                 </div>

                 <span
                   className={`koma-res-tool-row__free koma-res-tool-row__free--${tool.free ? 'yes' : 'no'}`}
                 >
                   {tool.free ? t('resources.tools.free.yes') : t('resources.tools.free.no')}
                 </span>

                 <div className="koma-res-tool-row__actions">
                   {actionLinks.map((link) => (
                      <ResourceExternalAnchor
                        key={`${tool.name}-${link.label}-${link.url}`}
                        href={link.url}
                        className="koma-res-tool-row__link"
                        aria-label={`${t(link.label as any)} ${tool.name}`}
                      >
                        {link.kind === 'download' ? <Download size={13} /> : <ExternalLink size={13} />}
                        <span>{t(link.label as any)}</span>
                      </ResourceExternalAnchor>
                   ))}
                 </div>
               </div>
             )})}
           </div>
         )}
       </div>
     );
   }
