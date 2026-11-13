import { memo } from 'react';

import { useI18n } from '../../../i18n';
import { aioPanelClasses } from './AioRightPanel.skin';
import type { SheetReimportReport } from '../../../utils/spreadsheet-bridge';

interface SheetConflictReportProps {
  report: SheetReimportReport;
  noir: boolean;
  onApplyConflict: (rowId: string) => void;
}

const PREVIEW_MAX_CHARS = 80;

const truncatePreview = (text: string): string =>
  text.length > PREVIEW_MAX_CHARS ? `${text.slice(0, PREVIEW_MAX_CHARS)}…` : text;

// SKIN-AGNOSTIC section (noir-prop mechanism, aioPanelClasses — no Classic/Noir
// twins): the applied/conflict/skipped report of a corrections reimport.
// Reuses the pending-issues panel visual language (badge + preview rows in the
// koma-aio-llm-panel container) with a different data shape, plus the per-row
// opt-in control that applies a manual-edit conflict.
export default memo(function SheetConflictReport({
  report,
  noir,
  onApplyConflict,
}: SheetConflictReportProps) {
  const { t } = useI18n();
  const classes = aioPanelClasses(noir);

  const badgeClass = noir
    ? 'panel-cut-sm inline-flex shrink-0 items-center border border-crimson/40 bg-crimson/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-crimson'
    : 'koma-aio-section__badge';
  const rowClass = noir
    ? 'panel-cut-sm flex w-full items-center gap-2 border border-paper/12 bg-transparent px-2 py-1.5 font-mono text-[10px] text-paper'
    : 'flex w-full items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-2 py-1.5 text-[12px]';
  const applyButtonClass = noir
    ? 'panel-cut-sm hard-hover inline-flex shrink-0 items-center justify-center gap-1.5 border border-crimson/40 bg-crimson/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-crimson'
    : 'koma-btn koma-btn--ghost';

  const unresolvedConflicts = report.conflicts.filter(
    (entry) => !entry.resolved,
  ).length;

  if (
    report.appliedRows.length === 0
    && report.conflicts.length === 0
    && report.skippedRows.length === 0
  ) {
    return (
      <p className={classes.hint}>{t('dashboard.translator.sheet.reportEmpty')}</p>
    );
  }

  return (
    <div
      className="koma-aio-llm-panel"
      role="group"
      aria-label={t('dashboard.translator.sheet.reportAria')}
    >
      <p className={classes.hint}>
        {t('dashboard.translator.sheet.reportCounts', {
          applied: report.appliedRows.length,
          skipped: report.skippedRows.length + unresolvedConflicts,
          conflicts: report.conflicts.length,
        })}
      </p>

      {report.appliedRows.length > 0 && (
        <div>
          <span className={classes.label}>
            {t('dashboard.translator.sheet.listApplied')}
          </span>
          {report.appliedRows.map((row) => (
            <div key={row.rowId} className={rowClass}>
              <span className={badgeClass}>
                {t('dashboard.translator.sheet.badge.applied')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate opacity-70">
                  {row.imageId} · {row.matchedRegionId}
                </span>
                <span className="block truncate">
                  {truncatePreview(row.translation)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {report.conflicts.length > 0 && (
        <div>
          <span className={classes.label}>
            {t('dashboard.translator.sheet.listConflicts')}
          </span>
          {report.conflicts.map((entry) => (
            <div key={entry.rowId} className={rowClass}>
              <span className={badgeClass}>
                {t('dashboard.translator.sheet.badge.conflict')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate opacity-70">
                  {entry.imageId} · {entry.regionId}
                </span>
                <span className="block truncate">
                  {truncatePreview(entry.currentTranslation)}
                  {' → '}
                  {truncatePreview(entry.sheetTranslation)}
                </span>
              </span>
              {entry.resolved ? (
                <span className={badgeClass}>
                  {t('dashboard.translator.sheet.badge.applied')}
                </span>
              ) : (
                <button
                  type="button"
                  className={applyButtonClass}
                  onClick={() => onApplyConflict(entry.rowId)}
                >
                  {t('dashboard.translator.sheet.applyConflict')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {report.skippedRows.length > 0 && (
        <div>
          <span className={classes.label}>
            {t('dashboard.translator.sheet.listSkipped')}
          </span>
          {report.skippedRows.map((row) => (
            <div key={`${row.rowId}:${row.reason}`} className={rowClass}>
              <span className={badgeClass}>
                {t(
                  row.reason === 'unchanged'
                    ? 'dashboard.translator.sheet.badge.unchanged'
                    : 'dashboard.translator.sheet.badge.unmatched',
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {row.imageId} · {row.regionId}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
