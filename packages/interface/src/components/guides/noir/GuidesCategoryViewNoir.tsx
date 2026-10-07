import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search } from 'lucide-react';

import { GUIDE_CATEGORIES, GUIDES } from '../../../data/guides-data';
import type { GuideCategoryId } from '../../../data/guides-types';
import { useInfoNavStore } from '../../../stores/info-nav-store';
import { useI18n } from '../../../i18n';

import {
  DifficultyStamp,
  GuideRow,
  NoirBreadcrumb,
  resolveTone,
  TimeBadge,
  TONE_CLASSES,
} from './noir-guides';

interface Props {
  categoryId: GuideCategoryId;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const useNoirMotion = () => ({
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } },
  item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } },
  initial: 'hidden' as const,
  animate: 'show' as const,
});

export default function GuidesCategoryView({ categoryId }: Props) {
  const { t } = useI18n();
  const m = useNoirMotion();
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
        g.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [allGuides, search]);

  if (!category) return null;

  const tone = resolveTone(category.accentColor);
  const tc = TONE_CLASSES[tone];
  const CatIcon = category.icon;

  return (
    <motion.div
      variants={m.container}
      initial={m.initial}
      animate={m.animate}
      className="flex flex-col gap-5"
    >
      {/* Breadcrumb + back */}
      <motion.div variants={m.item} className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={navigateGuidesHome}>
          <ArrowLeft size={11} /> {t('guides.detail.back')}
        </button>
        <NoirBreadcrumb
          items={[
            { label: t('guides.detail.guides'), onClick: navigateGuidesHome },
            { label: category.label },
          ]}
        />
      </motion.div>

      {/* Header */}
      <motion.header variants={m.item} className="glass panel-cut relative overflow-hidden p-6">
        <span
          aria-hidden
          className="text-outline pointer-events-none absolute -top-7 right-4 select-none font-display text-[100px] font-black leading-none"
        >
          章
        </span>
        <div className="relative flex items-start gap-4">
          <span
            className={`panel-cut-sm grid h-12 w-12 flex-none place-items-center border ${tc.border} ${tc.bg} ${tc.text}`}
          >
            <CatIcon size={20} />
          </span>
          <div>
            <p className="kicker mb-1">{'// '}{t('guides.detail.guides')}</p>
            <h1 className="font-display text-2xl font-black uppercase leading-none tracking-tight text-paper">
              {category.label}
            </h1>
            <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-paper/50">
              {category.description}
            </p>
          </div>
        </div>
      </motion.header>

      {allGuides.length > 3 && (
        <motion.div variants={m.item} className="relative max-w-sm">
          <input
            type="text"
            className="noir-input !py-2.5 !pl-9"
            placeholder={t('guides.category.searchPlaceholder', { category: category.label })}
            aria-label={t('guides.category.searchAria', { category: category.label })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-crimson"
            aria-hidden
          />
        </motion.div>
      )}

      {filtered.length === 0 ? (
        <motion.div
          variants={m.item}
          className="flex flex-col items-center gap-3 border border-dashed border-paper/15 py-14 text-paper/35"
        >
          <Search size={26} strokeWidth={1.2} />
          <p className="font-display text-[13px] font-bold uppercase tracking-wide">
            {search
              ? t('guides.category.noSearchResults', { query: search })
              : t('guides.category.noGuides')}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {search ? t('guides.category.tryOtherTerms') : t('guides.category.comingSoon')}
          </p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((guide) => (
            <motion.div key={guide.id} variants={m.item}>
              <GuideRow
                icon={guide.icon}
                tone={resolveTone(guide.accentColor)}
                title={guide.title}
                subtitle={guide.subtitle}
                completed={Boolean(readGuides[guide.id])}
                completedLabel={t('guides.category.completed')}
                meta={
                  <>
                    <DifficultyStamp
                      level={guide.difficulty}
                      label={t(`guides.common.${guide.difficulty}`)}
                    />
                    <TimeBadge>{guide.estimatedTime}</TimeBadge>
                  </>
                }
                onSelect={() => navigateToGuideEntry(categoryId, guide.id)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
