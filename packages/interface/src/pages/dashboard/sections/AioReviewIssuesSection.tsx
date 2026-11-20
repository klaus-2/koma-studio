import {
  useCallback,
  useMemo,
  useState,
  type ReactElement,
} from 'react';
import { AlertTriangle } from 'lucide-react';

import RegionIssuesPanel, {
  type RegionIssueNavRow,
} from '../../../components/dashboard/RegionIssuesPanel';
import { AioSection } from '../../AioSection';
import { aioPanelClasses } from './AioRightPanel.skin';
import { useI18n } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/messages';
import { deriveRegionIssues, type RegionIssue, type RegionIssueKind } from '../../../utils/region-review';
import { useRegionFocusScroll } from '../hooks/useRegionFocusScroll';
import { useRegionOverflowReview } from '../hooks/region-overflow-adjust';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import type { AioTextRegion } from '../../../types/dashboard.types';

export type AioReviewFilterKind =
  | 'all'
  | 'untranslated'
  | 'overflow'
  | 'locked'
  | 'sfx';

export const AIO_REVIEW_FILTER_KINDS: readonly AioReviewFilterKind[] = [
  'all',
  'untranslated',
  'overflow',
  'locked',
  'sfx',
] as const;

export const AIO_REVIEW_FILTER_STORAGE_KEY = 'koma-aio-review-filter';

const FILTER_KIND_SET: ReadonlySet<string> = new Set(AIO_REVIEW_FILTER_KINDS);

const readStoredFilterKind = (): AioReviewFilterKind => {
  try {
    const raw = window.localStorage.getItem(AIO_REVIEW_FILTER_STORAGE_KEY);
    return raw !== null && FILTER_KIND_SET.has(raw)
      ? (raw as AioReviewFilterKind)
      : 'all';
  } catch {
    return 'all';
  }
};

const writeStoredFilterKind = (kind: AioReviewFilterKind): void => {
  try {
    window.localStorage.setItem(AIO_REVIEW_FILTER_STORAGE_KEY, kind);
  } catch {
  }
};

const FILTER_CHIP_LABEL_KEYS: Record<AioReviewFilterKind, TranslationKey> = {
  all: 'dashboard.aio.review.filter.all',
  untranslated: 'dashboard.aio.review.kind.untranslated',
  overflow: 'dashboard.aio.review.kind.overflow',
  locked: 'dashboard.aio.review.filter.locked',
  sfx: 'dashboard.aio.review.filter.sfx',
};

const NAV_ROW_BADGE_KEYS = {
  locked: 'dashboard.aio.review.filter.locked',
  sfx: 'dashboard.aio.review.filter.sfx',
} as const satisfies Record<'locked' | 'sfx', TranslationKey>;

const buildRegionDetail = (region: {
  recognizedText?: string;
  translatedText?: string;
  renderText?: string;
}): string =>
  (region.renderText ?? region.translatedText ?? region.recognizedText ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/* ── Per-image derivation caches (I11): keyed by the region array identity.
   CoW gives a fresh array identity only when THAT image's regions change, so
   an edit on image B never recomputes the derivations of image A. ── */
const EMPTY_AIO_REGIONS: AioTextRegion[] = [];

const regionIssuesByRegions = new WeakMap<
  AioTextRegion[],
  { readonly targetLang: string; readonly issues: RegionIssue[] }
>();
const navRowsByRegions = new WeakMap<
  AioTextRegion[],
  { readonly imageId: string; readonly rows: RegionIssueNavRow[] }
>();

export const deriveRegionIssuesForImage = (
  imageId: string,
  regions: AioTextRegion[],
  targetLang: string,
): RegionIssue[] => {
  const cached = regionIssuesByRegions.get(regions);
  if (cached && cached.targetLang === targetLang) return cached.issues;
  const issues = deriveRegionIssues(imageId, regions, targetLang);
  regionIssuesByRegions.set(regions, { targetLang, issues });
  return issues;
};

const pushNavRow = (
  rows: RegionIssueNavRow[],
  imageId: string,
  region: AioTextRegion,
  badgeLabelKey: RegionIssueNavRow['badgeLabelKey'],
): void => {
  rows.push({ imageId, regionId: region.id, badgeLabelKey, detail: buildRegionDetail(region) });
};

export const deriveNavRowsForImage = (
  imageId: string,
  regions: AioTextRegion[],
): readonly RegionIssueNavRow[] => {
  const cached = navRowsByRegions.get(regions);
  if (cached && cached.imageId === imageId) return cached.rows;
  const rows: RegionIssueNavRow[] = [];
  for (const region of regions) {
    const isLocked =
      region.locked === true ||
      Object.values(region.lockedFields ?? {}).some(Boolean);
    if (isLocked) pushNavRow(rows, imageId, region, NAV_ROW_BADGE_KEYS.locked);
    if (region.sfxCandidate === true) pushNavRow(rows, imageId, region, NAV_ROW_BADGE_KEYS.sfx);
  }
  navRowsByRegions.set(regions, { imageId, rows });
  return rows;
};

export default function AioReviewIssuesSection(props: {
  readonly noir: boolean;
}): ReactElement {
  const { noir } = props;
  const { t } = useI18n();
  const skin = aioPanelClasses(noir);

  const images = useImageCollectionStore((s) => s.images);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const setAioSelectedRegionByImage = useRegionEditorStore(
    (s) => s.setAioSelectedRegionByImage,
  );
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => s.aioDetectionsByImage,
  );
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const setActiveStageTab = useUiShellStore((s) => s.setActiveStageTab);
  const { focusRegion } = useRegionFocusScroll();
  const regionIssues = useMemo(
    () =>
      images.flatMap((image) =>
        deriveRegionIssuesForImage(
          image.id,
          aioDetectionsByImage[image.id] ?? EMPTY_AIO_REGIONS,
          aioTgtLang,
        ),
      ),
    [images, aioDetectionsByImage, aioTgtLang],
  );
  const {
    overflowIssues,
    overflowCountByImageId,
    adjustRegion,
    adjustPage,
  } = useRegionOverflowReview();
  const reviewIssues = useMemo(
    () => [...regionIssues, ...overflowIssues],
    [regionIssues, overflowIssues],
  );

  const navRows = useMemo<RegionIssueNavRow[]>(() => {
    const rows: RegionIssueNavRow[] = [];
    for (const image of images) {
      rows.push(
        ...deriveNavRowsForImage(
          image.id,
          aioDetectionsByImage[image.id] ?? EMPTY_AIO_REGIONS,
        ),
      );
    }
    return rows;
  }, [images, aioDetectionsByImage]);

  const issueCountByKind = useMemo(() => {
    const counts = new Map<RegionIssueKind, number>();
    for (const issue of reviewIssues) {
      counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1);
    }
    return counts;
  }, [reviewIssues]);

  const filterCounts = useMemo(
    () => ({
      all: reviewIssues.length + navRows.length,
      untranslated: issueCountByKind.get('untranslated') ?? 0,
      overflow: issueCountByKind.get('overflow') ?? 0,
      locked: navRows.filter((row) => row.badgeLabelKey === NAV_ROW_BADGE_KEYS.locked)
        .length,
      sfx: navRows.filter((row) => row.badgeLabelKey === NAV_ROW_BADGE_KEYS.sfx)
        .length,
    }),
    [reviewIssues.length, issueCountByKind, navRows],
  );

  const [filterKind, setFilterKind] = useState<AioReviewFilterKind>(
    readStoredFilterKind,
  );

  const handleFilterKindChange = useCallback((kind: AioReviewFilterKind) => {
    setFilterKind(kind);
    writeStoredFilterKind(kind);
  }, []);

  const filteredIssues = useMemo(() => {
    if (filterKind === 'all') return reviewIssues;
    if (filterKind === 'locked' || filterKind === 'sfx') return [];
    return reviewIssues.filter((issue) => issue.kind === filterKind);
  }, [filterKind, reviewIssues]);

  const filteredNavRows = useMemo(() => {
    if (filterKind === 'all') return navRows;
    if (filterKind === 'locked' || filterKind === 'sfx') {
      return navRows.filter(
        (row) => row.badgeLabelKey === NAV_ROW_BADGE_KEYS[filterKind],
      );
    }
    return [];
  }, [filterKind, navRows]);

  const pageOverflowActions = useMemo(
    () =>
      images
        .map((image) => ({
          imageId: image.id,
          imageLabel: image.file.name,
          count: overflowCountByImageId.get(image.id) ?? 0,
        }))
        .filter((action) => action.count > 0),
    [images, overflowCountByImageId],
  );

  const handleIssueSelect = useCallback(
    (issue: RegionIssue) => {
      setActiveId(issue.imageId);
      setAioSelectedRegionByImage((prev) => ({
        ...prev,
        [issue.imageId]: issue.regionId,
      }));
      setActiveStageTab(issue.kind === 'overflow' ? 'render' : 'getTranslations');
      void focusRegion({ imageId: issue.imageId, regionId: issue.regionId });
    },
    [
      setActiveId,
      setAioSelectedRegionByImage,
      setActiveStageTab,
      focusRegion,
    ],
  );

  const handleNavRowSelect = useCallback(
    (row: RegionIssueNavRow) => {
      setActiveId(row.imageId);
      setAioSelectedRegionByImage((prev) => ({
        ...prev,
        [row.imageId]: row.regionId,
      }));
      setActiveStageTab('getTranslations');
      void focusRegion({ imageId: row.imageId, regionId: row.regionId });
    },
    [
      setActiveId,
      setAioSelectedRegionByImage,
      setActiveStageTab,
      focusRegion,
    ],
  );

  return (
    <AioSection
      icon={AlertTriangle}
      title={t('dashboard.aio.review.title')}
      badge={
        reviewIssues.length + navRows.length > 0 ? (
          <span className="koma-aio-section__badge">
            {reviewIssues.length + navRows.length}
          </span>
        ) : undefined
      }
      defaultOpen={false}
    >
      <div className="koma-aio-pipeline-controls">
        {AIO_REVIEW_FILTER_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={skin.ghostButton}
            aria-pressed={filterKind === kind}
            onClick={() => handleFilterKindChange(kind)}
          >
            {t(FILTER_CHIP_LABEL_KEYS[kind])}
            {' · '}
            {filterCounts[kind]}
          </button>
        ))}
      </div>
      {pageOverflowActions.length > 0 && (
        <div className="koma-aio-pipeline-controls">
          {pageOverflowActions.map((action) => (
            <button
              key={action.imageId}
              type="button"
              className={skin.ghostButton}
              title={action.imageLabel}
              onClick={() => adjustPage(action.imageId)}
            >
              {action.imageLabel}
              {' · '}
              {t('dashboard.aio.review.overflow.adjustPage', {
                count: action.count,
              })}
            </button>
          ))}
        </div>
      )}
      <RegionIssuesPanel
        noir={noir}
        issues={filteredIssues}
        additionalRows={filteredNavRows}
        onSelect={handleIssueSelect}
        onSelectNavRow={handleNavRowSelect}
        onAdjustOverflow={adjustRegion}
      />
    </AioSection>
  );
}
