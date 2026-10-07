import { useMemo } from 'react';
import { Globe2, Users } from 'lucide-react';
import { useI18n } from '../../../i18n';

import { COMMUNITIES_DATA } from '../../../data/resources-data';
import type { CommunityEntry } from '../../../data/guides-types';
import {
  PLATFORM_TONE,
  ResActionLink,
  ResourcesEmptyState,
  ResStamp,
  SectionCount,
} from './noir-resources';

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
      <SectionCount
        count={filtered.length}
        label={
          filtered.length === 1
            ? t('resources.communities.results_one')
            : t('resources.communities.results_other')
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((community: CommunityEntry) => (
          <article
            key={community.name}
            className="panel-cut-sm flex flex-col gap-2.5 border border-paper/10 bg-ink-2/60 p-4 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-paper/25 hover:drop-shadow-[4px_4px_0_rgba(255,200,87,0.5)]"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 truncate font-display text-[13px] font-black uppercase tracking-wide text-paper">
                {community.name}
              </h4>
              <ResStamp tone={PLATFORM_TONE[community.platform] ?? 'paper'}>
                {PLATFORM_LABELS[community.platform] ?? community.platform}
              </ResStamp>
            </div>

            <p className="flex-1 text-[11px] leading-relaxed text-paper/50">
              {community.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 border-t border-paper/8 pt-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper/40">
              <span className="flex items-center gap-1">
                <Globe2 size={10} aria-hidden /> {community.language}
              </span>
              {community.memberCount && (
                <span className="flex items-center gap-1">
                  <Users size={10} aria-hidden />
                  {t('resources.communities.members', { count: community.memberCount })}
                </span>
              )}
              {community.url && (
                <span className="ml-auto">
                  <ResActionLink
                    href={community.url}
                    ariaLabel={t('resources.communities.visitAria', { name: community.name })}
                  >
                    {t('resources.communities.visit')}
                  </ResActionLink>
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
