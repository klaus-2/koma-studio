import { useMemo, useState } from 'react';
import { useI18n } from '../../../i18n';

import { EXTERNAL_TOOLS_DATA } from '../../../data/resources-data';
import type { ExternalToolEntry, ResourceLink } from '../../../data/guides-types';
import {
  FilterPills,
  ResActionLink,
  ResourcesEmptyState,
  ResStamp,
  ResTag,
  SectionCount,
} from './noir-resources';

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
      links.push({
        label: t('resources.tools.action.download'),
        url: tool.downloadUrl,
        kind: 'download',
      });
    }
    if (Array.isArray(tool.links)) links.push(...tool.links);

    const seen = new Set<string>();
    return links.filter((link) => {
      const key = `${link.label}:${link.url}`;
      if (!link.url || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const filtered = useMemo(() => {
    let data = EXTERNAL_TOOLS_DATA as ExternalToolEntry[];
    if (catFilter !== 'all') data = data.filter((tool) => tool.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (tool) =>
          tool.name.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q),
      );
    }
    return data;
  }, [search, catFilter]);

  return (
    <div>
      <FilterPills
        ariaLabel={t('resources.sfx.filterAria')}
        value={catFilter}
        onChange={setCatFilter}
        options={[
          { value: 'all', label: t('resources.tools.filterAll') },
          ...ALL_TOOL_CATEGORIES.map((cat) => ({ value: cat, label: TOOL_CATEGORY_LABELS[cat] })),
        ]}
      />

      <SectionCount
        count={filtered.length}
        label={
          filtered.length === 1
            ? t('resources.tools.results_one')
            : t('resources.tools.results_other')
        }
      />

      {filtered.length === 0 ? (
        <ResourcesEmptyState query={search} context={t('resources.tools.context')} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((tool: ExternalToolEntry) => {
            const actionLinks = buildToolLinks(tool);
            const ToolIcon = tool.icon;
            return (
              <article
                key={tool.name}
                className="panel-cut-sm flex flex-wrap items-center gap-3.5 border border-paper/10 bg-ink-2/60 p-3.5 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-paper/25 hover:drop-shadow-[4px_4px_0_rgba(255,200,87,0.5)]"
              >
                <span className="panel-cut-sm grid h-9 w-9 flex-none place-items-center border border-azure/40 bg-azure/10 text-azure">
                  <ToolIcon size={15} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-display text-[13px] font-black uppercase tracking-wide text-paper">
                      {tool.name}
                    </h4>
                    <ResTag>{TOOL_CATEGORY_LABELS[tool.category] ?? tool.category}</ResTag>
                    <ResStamp tone={tool.free ? 'mint' : 'gold'}>
                      {tool.free ? t('resources.tools.free.yes') : t('resources.tools.free.no')}
                    </ResStamp>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-paper/50">
                    {tool.description}
                  </p>
                </div>

                <div className="flex flex-none flex-wrap gap-1.5">
                  {actionLinks.map((link) => (
                    <ResActionLink
                      key={`${tool.name}-${link.label}-${link.url}`}
                      href={link.url}
                      kind={link.kind}
                      ariaLabel={`${t(link.label as never)} ${tool.name}`}
                    >
                      {t(link.label as never)}
                    </ResActionLink>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
