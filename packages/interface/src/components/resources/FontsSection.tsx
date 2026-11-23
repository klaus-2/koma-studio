/* ============================================================
   KŌMA STUDIO — Fonts Section (Resources Tab)
   Curated font collection with live preview
   ============================================================ */

   import { Download, ExternalLink, Type } from 'lucide-react';
   import { useMemo, useState } from 'react';
   import { useI18n } from '../../i18n';

   import { FONT_COLLECTIONS_DATA, FONTS_DATA } from '../../data/resources-data';
   import type { FontCollectionEntry, FontEntry, ResourceLink } from '../../data/guides-types';
   import { getResourceIcon } from '../../assets/resources';
    import ResourcesEmptyState from './ResourcesEmptyState';
    import ResourceExternalAnchor from './ResourceExternalAnchor';

   interface FontsSectionProps {
     search: string;
   }

   const PREVIEW_SIZES = [16, 24, 32] as const;

const buildFontLinks = (font: FontEntry, downloadLabel: string): ResourceLink[] => {
  const links: ResourceLink[] = [];
  if (font.downloadUrl) {
    links.push({ label: downloadLabel, url: font.downloadUrl, kind: 'download' });
  }
     if (Array.isArray(font.links)) {
       links.push(...font.links);
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

const buildCollectionLinks = (
  collection: FontCollectionEntry,
  openLabel: string,
): ResourceLink[] => {
  const collectionLinks = collection.links ?? [];
  const primary = collectionLinks.find((link) => link.url === collection.url);

  const links: ResourceLink[] = [
    {
      label: primary?.label ?? openLabel,
      url: collection.url,
      kind: primary?.kind ?? 'site',
    },
    ...collectionLinks.filter((link) => link.url !== collection.url),
  ];

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

   export default function FontsSection({ search }: FontsSectionProps) {
     const { t } = useI18n();
     const [previewSize, setPreviewSize] = useState<number>(24);
     const [customText, setCustomText] = useState('');

     const LICENSE_LABELS: Record<string, string> = {
       free: t('resources.fonts.license.free'),
       'open-source': t('resources.fonts.license.openSource'),
       commercial: t('resources.fonts.license.commercial'),
       mixed: t('resources.fonts.license.mixed'),
     };

     const filtered = useMemo(() => {
       if (!search.trim()) return FONTS_DATA;
       const q = search.toLowerCase();
       return FONTS_DATA.filter(
         (f) =>
           f.name.toLowerCase().includes(q) ||
           f.usage.toLowerCase().includes(q) ||
           f.tags.some((t) => t.toLowerCase().includes(q)),
       );
     }, [search]);

     return (
       <div>
         {/* Font collections */}
         <FontCollections />

         {filtered.length === 0 ? (
           <ResourcesEmptyState query={search} context={t('resources.fonts.context')} />
         ) : (
           <>
             {/* Custom preview input */}
             <div className="koma-res-fonts__preview-bar">
               <Type size={14} />
               <input
                 className="koma-res-fonts__preview-input"
                 type="text"
                 placeholder={t('resources.fonts.placeholder')}
                 value={customText}
                 onChange={(e) => setCustomText(e.target.value)}
               />
             </div>

             {/* Result count */}
             <div className="koma-res-section-count">
               <span className="koma-res-section-count__num">{filtered.length}</span>
               {filtered.length === 1 ? t('resources.fonts.results_one') : t('resources.fonts.results_other')}
             </div>

             {/* Font cards grid */}
             <div className="koma-res-fonts__grid">
               {filtered.map((font) => {
                  const actionLinks = buildFontLinks(font, t('resources.action.download'));
                 return (
                 <div key={font.name} className="koma-res-font-card">
                   {/* Top: name + license */}
                   <div className="koma-res-font-card__top">
                     <div>
                       <h4 className="koma-res-font-card__name">{font.name}</h4>
                       <p className="koma-res-font-card__style">{font.style}</p>
                     </div>
                     <span
                       className={`koma-res-badge koma-res-badge--${font.license}`}
                     >
                       {LICENSE_LABELS[font.license]}
                     </span>
                   </div>

                   {/* Preview */}
                   <div
                     className="koma-res-font-card__preview"
                     style={{ fontFamily: font.family, fontSize: previewSize }}
                   >
                     {customText || font.previewText || t('resources.fonts.previewFallback')}
                   </div>

                   {/* Size selector */}
                   <div className="koma-res-font-card__sizes">
                     {PREVIEW_SIZES.map((size) => (
                       <button
                         key={size}
                         type="button"
                         className={`koma-res-font-card__size-btn ${previewSize === size ? 'koma-res-font-card__size-btn--active' : ''}`}
                         onClick={() => setPreviewSize(size)}
                         aria-label={t('resources.fonts.sizeAria', { size })}
                       >
                         {size}
                       </button>
                     ))}
                   </div>

                   {/* Usage */}
                   <p className="koma-res-font-card__usage">{font.usage}</p>

                   {/* Tags */}
                   <div className="koma-res-font-card__tags">
                     {font.tags.map((tag) => (
                       <span key={tag} className="koma-res-tag">
                         {tag}
                       </span>
                     ))}
                   </div>

                   {/* Footer: download */}
                   {actionLinks.length > 0 && (
                     <div className="koma-res-font-card__footer">
                       <div className="koma-res-font-card__actions">
                         {actionLinks.map((link) => (
                            <ResourceExternalAnchor
                              key={`${font.name}-${link.label}-${link.url}`}
                              href={link.url}
                              className="koma-res-font-card__download"
                              aria-label={`${link.kind === 'download' ? t('resources.fonts.downloadLabel') : link.label} ${font.name}`}
                            >
                              {link.kind === 'download' ? <Download size={12} /> : <ExternalLink size={12} />}
                              {link.kind === 'download' ? t('resources.fonts.downloadLabel') : link.label}
                            </ResourceExternalAnchor>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               )})}
             </div>
           </>
         )}
       </div>
     );
   }

   function FontCollections() {
     const { t } = useI18n();

     return (
       <section className="koma-res-collections" aria-labelledby="koma-res-font-collections">
         <h3 id="koma-res-font-collections" className="koma-res-collections__title">
           {t('resources.fonts.collections.title')}
         </h3>
         <p className="koma-res-collections__desc">{t('resources.fonts.collections.desc')}</p>

         <div className="koma-res-collections__grid">
           {FONT_COLLECTIONS_DATA.map((collection) => {
             const artwork = getResourceIcon(collection.image);
             const actionLinks = buildCollectionLinks(
               collection,
               t('resources.fonts.collection.open'),
             );

             return (
               <article key={collection.id} className="koma-res-font-card koma-res-collection">
                 {/* Head: artwork + name */}
                 <div className="koma-res-collection__head">
                   <span className="koma-res-collection__icon">
                     {artwork ? (
                       <img src={artwork} alt="" width={30} height={30} loading="lazy" decoding="async" />
                     ) : (
                       <Type size={16} />
                     )}
                   </span>
                   <div className="koma-res-collection__ident">
                     <h4 className="koma-res-font-card__name">{collection.name}</h4>
                     <p className="koma-res-font-card__style">{collection.origin}</p>
                   </div>
                 </div>

                 {/* Description */}
                 <p className="koma-res-font-card__usage">{collection.description}</p>

                 {/* Counts + vendors */}
                 <dl className="koma-res-collection__stats">
                   <div className="koma-res-collection__stat">
                     <dt>{t('resources.fonts.collection.files')}</dt>
                     <dd>{collection.fileCount}</dd>
                   </div>
                   <div className="koma-res-collection__stat">
                     <dt>{t('resources.fonts.collection.families')}</dt>
                     <dd>{collection.familyCount}</dd>
                   </div>
                   <div className="koma-res-collection__stat koma-res-collection__stat--wide">
                     <dt>{t('resources.fonts.collection.vendor')}</dt>
                     <dd>{collection.vendors.join(' · ')}</dd>
                   </div>
                 </dl>

                 {/* Licence note */}
                 <p className="koma-res-collection__license">
                   <span className="koma-res-collection__license-label">
                     {t('resources.fonts.collection.license')}
                   </span>{' '}
                   {collection.licenseNote}
                 </p>

                 {/* Footer: actions */}
                 {actionLinks.length > 0 && (
                   <div className="koma-res-font-card__footer">
                     <div className="koma-res-font-card__actions">
                       {actionLinks.map((link) => (
                         <ResourceExternalAnchor
                           key={`${collection.id}-${link.label}-${link.url}`}
                           href={link.url}
                           className="koma-res-font-card__download"
                           aria-label={`${link.label} ${collection.name}`}
                         >
                           {link.kind === 'download' ? <Download size={12} /> : <ExternalLink size={12} />}
                           {link.label}
                         </ResourceExternalAnchor>
                       ))}
                     </div>
                   </div>
                 )}
               </article>
             );
           })}
         </div>
       </section>
     );
   }
