import { memo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Play,
  RefreshCw,
  Square,
} from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { DownloadBundleFormat } from '../../../../types/dashboard.types';
import type { FocusFlowState, FocusPageFlow } from '../../lib/focus-flow';

const BUNDLE_FORMATS: readonly DownloadBundleFormat[] = ['zip', 'cbz', 'pdf'];

interface FocusActionBarProps {
  flow: FocusFlowState;
  activePageFlow: FocusPageFlow | null;
  processing: boolean;
  executionLabel: string | null;
  bundleFormat: DownloadBundleFormat;
  imageFormatLabel: string;
  onBundleFormatChange: (format: DownloadBundleFormat) => void;
  onRun: () => void;
  onStop: () => void;
  onExport: () => void;
  onMarkReviewedAndNext: () => void;
}

/**
 * Bottom action bar with the Focus contract: exactly one primary action
 * for the current step (run → mark reviewed & advance → export), a quiet
 * re-run behind an inline confirm (it overwrites fixes), and a
 * non-blocking QC summary next to export.
 */
export default memo(function FocusActionBar({
  flow,
  activePageFlow,
  processing,
  executionLabel,
  bundleFormat,
  imageFormatLabel,
  onBundleFormatChange,
  onRun,
  onStop,
  onExport,
  onMarkReviewedAndNext,
}: FocusActionBarProps) {
  const { t } = useI18n();
  const [confirmingRerun, setConfirmingRerun] = useState(false);

  const activeUnreviewed =
    activePageFlow?.processed === true && !activePageFlow.reviewed;
  const showMarkNext =
    !processing && flow.step === 'review' && activeUnreviewed;
  const primaryIsExport =
    !processing && flow.canExport && !showMarkNext && flow.step !== 'run';

  const runLabel = t(
    flow.totalPages === 1 ? 'focus.run.cta_one' : 'focus.run.cta_other',
    { count: flow.totalPages },
  );

  if (confirmingRerun && !processing) {
    return (
      <div className="koma-focus__actionbar">
        <div className="koma-focus__confirm" role="alertdialog" aria-label={t('focus.run.rerun')}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{t('focus.run.rerunConfirm')}</span>
          <button
            type="button"
            className="koma-focus__btn koma-focus__btn--danger"
            onClick={() => {
              setConfirmingRerun(false);
              onRun();
            }}
          >
            {t('focus.run.rerunYes')}
          </button>
          <button
            type="button"
            className="koma-focus__btn"
            onClick={() => setConfirmingRerun(false)}
          >
            {t('focus.run.rerunNo')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="koma-focus__actionbar">
      <div className="koma-focus__actionbar-main">
        {processing ? (
          <>
            <span aria-live="polite">{executionLabel ?? t('focus.step.run')}</span>
            <button
              type="button"
              className="koma-focus__btn koma-focus__btn--danger"
              onClick={onStop}
            >
              <Square size={13} />
              {t('focus.run.stop')}
            </button>
          </>
        ) : flow.step === 'run' ? (
          <button
            type="button"
            className="koma-focus__btn koma-focus__btn--primary"
            onClick={onRun}
            disabled={!flow.canRun}
          >
            <Play size={15} />
            {runLabel}
          </button>
        ) : showMarkNext ? (
          <button
            type="button"
            className="koma-focus__btn koma-focus__btn--primary"
            onClick={onMarkReviewedAndNext}
          >
            <Check size={15} />
            {t('focus.review.markAndNext')}
          </button>
        ) : flow.step === 'pages' ? (
          <span className="koma-focus__export-meta">
            {t('focus.pages.emptyHint')}
          </span>
        ) : null}

        {!processing && flow.processedPages > 0 && (
          <button
            type="button"
            className="koma-focus__btn"
            onClick={() => setConfirmingRerun(true)}
          >
            <RefreshCw size={13} />
            {t('focus.run.rerun')}
          </button>
        )}
      </div>

      {flow.canExport && !processing && (
        <div className="koma-focus__warnings">
          {flow.unreviewedPageIds.length > 0 && (
            <span className="koma-focus__warn">
              <AlertTriangle size={13} aria-hidden="true" />
              {t(
                flow.unreviewedPageIds.length === 1
                  ? 'focus.export.warnUnreviewed_one'
                  : 'focus.export.warnUnreviewed_other',
                { count: flow.unreviewedPageIds.length },
              )}
            </span>
          )}
          {flow.emptyRegionTotal > 0 && (
            <span className="koma-focus__warn">
              <AlertTriangle size={13} aria-hidden="true" />
              {t(
                flow.emptyRegionTotal === 1
                  ? 'focus.export.warnEmpty_one'
                  : 'focus.export.warnEmpty_other',
                { count: flow.emptyRegionTotal },
              )}
            </span>
          )}
          {flow.unreviewedPageIds.length === 0 &&
            flow.emptyRegionTotal === 0 && (
              <span className="koma-focus__ready">
                <Check size={13} aria-hidden="true" />
                {t('focus.export.ready')}
              </span>
            )}
        </div>
      )}

      <div className="koma-focus__actionbar-side">
        <span className="koma-focus__export-meta">
          {t('focus.export.meta', {
            bundle: bundleFormat.toUpperCase(),
            format: imageFormatLabel,
          })}
        </span>
        <div
          className="koma-focus__segmented"
          role="group"
          aria-label={t('focus.export.bundleLabel')}
        >
          {BUNDLE_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              aria-pressed={bundleFormat === format}
              disabled={processing}
              onClick={() => onBundleFormatChange(format)}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={
            primaryIsExport
              ? 'koma-focus__btn koma-focus__btn--primary'
              : 'koma-focus__btn'
          }
          onClick={onExport}
          disabled={!flow.canExport || processing}
        >
          <Download size={14} />
          {t('focus.export.cta')}
        </button>
      </div>
    </div>
  );
});
