import { memo, useMemo } from 'react';

import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/messages';
import { aioPanelClasses } from '../../pages/dashboard/sections/AioRightPanel.skin';
import { useImageCollectionStore } from '../../pages/dashboard/stores/image-collection-store';
import type { RegionIssue, RegionIssueKind } from '../../utils/region-review';

interface RegionIssuesPanelProps {
  issues: RegionIssue[];
  onSelect: (issue: RegionIssue) => void;
  noir: boolean;
}

const KIND_LABEL_KEYS: Record<RegionIssueKind, TranslationKey> = {
  untranslated: 'dashboard.aio.review.kind.untranslated',
  empty: 'dashboard.aio.review.kind.empty',
  cjk_leftover: 'dashboard.aio.review.kind.cjkLeftover',
  overflow: 'dashboard.aio.review.kind.overflow',
};

interface RegionIssueGroup {
  imageId: string;
  imageLabel: string;
  issues: RegionIssue[];
}

// SKIN-AGNOSTIC panel (noir-prop mechanism, aioPanelClasses — inline sidebar
// content, not a modal, so no Classic/Noir twins): renders any RegionIssue[]
// grouped per image with kind badges and a region preview. Feature-agnostic —
// the leftover-text reviewer and the render-stage overflow checker both feed
// this same panel. All navigation happens through onSelect; the panel holds no
// selection state of its own.
export default memo(function RegionIssuesPanel({
  issues,
  onSelect,
  noir,
}: RegionIssuesPanelProps) {
  const { t } = useI18n();
  const classes = aioPanelClasses(noir);
  const images = useImageCollectionStore((s) => s.images);

  const badgeClass = noir
    ? 'panel-cut-sm inline-flex shrink-0 items-center border border-crimson/40 bg-crimson/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-crimson'
    : 'koma-aio-section__badge';
  const rowClass = noir
    ? 'panel-cut-sm hard-hover flex w-full items-center gap-2 border border-paper/12 bg-transparent px-2 py-1.5 text-left font-mono text-[10px] text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson'
    : 'koma-btn koma-btn--ghost koma-btn--full';

  const groups = useMemo<RegionIssueGroup[]>(() => {
    const labelsByImageId = new Map<string, string>();
    for (const image of images) {
      labelsByImageId.set(image.id, image.file.name);
    }
    const grouped = new Map<string, RegionIssueGroup>();
    for (const issue of issues) {
      const group = grouped.get(issue.imageId) ?? {
        imageId: issue.imageId,
        imageLabel: labelsByImageId.get(issue.imageId) ?? issue.imageId,
        issues: [],
      };
      group.issues.push(issue);
      grouped.set(issue.imageId, group);
    }
    return [...grouped.values()];
  }, [images, issues]);

  if (issues.length === 0) {
    return (
      <p className={classes.hint}>{t('dashboard.aio.review.empty')}</p>
    );
  }

  return (
    <div
      className="koma-aio-llm-panel"
      role="group"
      aria-label={t('dashboard.aio.review.listAria')}
    >
      {groups.map((group) => (
        <div key={group.imageId}>
          <span className={classes.label}>{group.imageLabel}</span>
          {group.issues.map((issue) => (
            <button
              key={issue.regionId}
              type="button"
              className={rowClass}
              onClick={() => onSelect(issue)}
            >
              <span className={badgeClass}>
                {t(KIND_LABEL_KEYS[issue.kind])}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {issue.detail.length > 0 ? issue.detail : issue.regionId}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
});
