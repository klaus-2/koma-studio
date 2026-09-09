import { ArrowDownToLine, Layers3, Sparkles } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { OptimizationResult } from '../../../types';
import {
  savingsColor,
  savingsPercent,
} from './ChapterOptimizerWorkspace.utils';

type OptimizerTotals = {
  original: number;
  optimized: number;
  savingsPercent: number;
};

type ChapterOptimizerResultsPanelProps = {
  results: OptimizationResult[];
  totals: OptimizerTotals;
  formatBytes: (value: number) => string;
  onDownloadSingle: (result: OptimizationResult) => void;
};

export default function ChapterOptimizerResultsPanel({
  results,
  totals,
  formatBytes,
  onDownloadSingle,
}: ChapterOptimizerResultsPanelProps) {
  const { t } = useI18n();

  if (results.length === 0) {
    return (
      <div className="koma-optim__results-panel koma-optim__results-panel--empty">
        <div className="koma-optim__results-head">
          <span className="koma-optim__section-icon" aria-hidden="true">
            <Layers3 size={11} />
          </span>
          {t('optimizer.results.title')}
        </div>
        <div className="koma-optim__empty-state koma-optim__empty-state--sm">
          <Sparkles size={18} strokeWidth={1.2} />
          <span>{t('optimizer.results.empty')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="koma-optim__results-panel">
      <div className="koma-optim__results-head">
        <span className="koma-optim__section-icon" aria-hidden="true">
          <Layers3 size={11} />
        </span>
        {t('optimizer.results.title')} ({results.length})
        <span className="koma-optim__results-total">
          {formatBytes(totals.original)} &rarr; {formatBytes(totals.optimized)}
          <span
            className="koma-optim__results-badge"
            style={{ background: savingsColor(totals.savingsPercent) }}
          >
            -{totals.savingsPercent}%
          </span>
        </span>
      </div>
      <div className="koma-optim__results">
        {results.map((result) => {
          const pct = savingsPercent(result.originalBytes, result.optimizedBytes);
          return (
            <div key={result.sourceImageId} className="koma-optim__result-card">
              <div className="koma-optim__result-header">
                <strong>{result.fileName}</strong>
                <button
                  type="button"
                  className="koma-optim__result-download"
                  onClick={() => onDownloadSingle(result)}
                  title={t('optimizer.results.download')}
                >
                  <ArrowDownToLine size={11} />
                </button>
              </div>
              <div className="koma-optim__result-stats">
                <span>{formatBytes(result.originalBytes)} &rarr; {formatBytes(result.optimizedBytes)}</span>
                <span>{result.width}&times;{result.height}</span>
              </div>
              <div className="koma-optim__result-bar-track">
                <div
                  className="koma-optim__result-bar-fill"
                  style={{
                    width: `${100 - pct}%`,
                    background: savingsColor(pct),
                  }}
                />
              </div>
              <span
                className="koma-optim__result-pct"
                style={{ color: savingsColor(pct) }}
              >
                -{pct}% ({formatBytes(Math.max(0, result.originalBytes - result.optimizedBytes))})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
