import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import {
  fetchLastCalibrationReport,
  runCalibrationBenchmark,
  useCalibrationTunableApply,
  type CalibrationLastResult,
  type CalibrationTunableApply,
} from '../../components/CalibrationOfferDialog';
import type { useI18n } from '../../i18n';

type TranslationFn = ReturnType<typeof useI18n>['t'];

export interface SettingsCalibrationSectionProps {
  t: TranslationFn;
}

interface CalibrationSectionState {
  /** 'idle' = loading the last report; 'running' = benchmark POST in flight. */
  phase: 'idle' | 'running' | 'ready';
  /** Last persisted report (null while loading or when the load failed). */
  last: CalibrationLastResult | null;
  applyStatus: CalibrationTunableApply['saveStatus'];
  onRun: () => void;
  onApply: () => void;
}

const lastRecommendation = (last: CalibrationLastResult | null): number | null =>
  last && last.status !== 'never-run'
    ? last.recommendedWorkingResolution
    : null;

const CalibrationSectionClassic = ({
  t,
  section,
}: SettingsCalibrationSectionProps & { section: CalibrationSectionState }): JSX.Element => (
  <section className="koma-stg-section">
    <div className="koma-stg-section__head">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
        <path d="M10 2.75a7.25 7.25 0 100 14.5 7.25 7.25 0 000-14.5zm0 1.5a5.75 5.75 0 110 11.5 5.75 5.75 0 010-11.5zM9.25 5.75h1.5v4.44l2.66 2.66-1.06 1.06-3.1-3.1V5.75z" />
      </svg>
      <h3 className="koma-stg-section__title">{t('dashboard.calibration.title')}</h3>
    </div>
    <p className="koma-stg-section__desc">
      {t('dashboard.calibration.desc')}
    </p>

    <div className="koma-stg-actions koma-stg-actions--row" style={{ marginTop: 16 }}>
      <button
        type="button"
        className="koma-btn koma-btn--primary koma-btn--sm"
        disabled={section.phase === 'running'}
        onClick={section.onRun}
      >
        {t('dashboard.calibration.run')}
      </button>
    </div>

    <p className="koma-stg-section__desc" style={{ marginTop: 12 }}>
      {section.phase === 'running'
        ? t('dashboard.calibration.running')
        : section.last === null || section.last.status === 'never-run'
          ? t('dashboard.calibration.neverRun')
          : lastRecommendation(section.last) === null
            ? t('dashboard.calibration.failed')
            : t('dashboard.calibration.recommended', {
                megapixels: lastRecommendation(section.last),
              })}
    </p>
    {section.applyStatus === 'saved' && (
      <p className="koma-stg-section__desc">
        {t('settings.app.performance.tunables.saved')}
      </p>
    )}
    {section.applyStatus === 'failed' && (
      <p className="koma-stg-section__desc">
        {t('dashboard.calibration.applyFailed')}
      </p>
    )}

    {lastRecommendation(section.last) !== null && (
      <div className="koma-stg-actions koma-stg-actions--row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="koma-btn koma-btn--ghost koma-btn--sm"
          disabled={section.applyStatus === 'saving'}
          onClick={section.onApply}
        >
          {t('dashboard.calibration.apply')}
        </button>
      </div>
    )}
  </section>
);

const CalibrationSectionNoir = ({
  t,
  section,
}: SettingsCalibrationSectionProps & { section: CalibrationSectionState }): JSX.Element => (
  <section className="glass panel-cut p-3">
    <h3 className="kicker">{t('dashboard.calibration.title')}</h3>
    <p className="mt-1 font-mono text-[10px] text-paper-dim">
      {t('dashboard.calibration.desc')}
    </p>

    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        className="panel-cut-sm bg-crimson px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-gold disabled:cursor-not-allowed disabled:opacity-40"
        disabled={section.phase === 'running'}
        onClick={section.onRun}
      >
        {t('dashboard.calibration.run')}
      </button>
      <span className="font-mono text-[10px] text-paper-dim">
        {section.phase === 'running'
          ? t('dashboard.calibration.running')
          : section.last === null || section.last.status === 'never-run'
            ? t('dashboard.calibration.neverRun')
            : lastRecommendation(section.last) === null
              ? t('dashboard.calibration.failed')
              : t('dashboard.calibration.recommended', {
                  megapixels: lastRecommendation(section.last),
                })}
      </span>
    </div>

    {section.applyStatus === 'failed' && (
      <p className="mt-2 font-mono text-[10px] text-crimson">
        {t('dashboard.calibration.applyFailed')}
      </p>
    )}
    {section.applyStatus === 'saved' && (
      <p className="mt-2 font-mono text-[10px] text-paper-dim">
        {t('settings.app.performance.tunables.saved')}
      </p>
    )}

    {lastRecommendation(section.last) !== null && (
      <div className="mt-2">
        <button
          type="button"
          className="panel-cut-sm border border-paper/15 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-paper/70 transition-colors hover:border-crimson/50 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          disabled={section.applyStatus === 'saving'}
          onClick={section.onApply}
        >
          {t('dashboard.calibration.apply')}
        </button>
      </div>
    )}
  </section>
);

const FamilyCalibrationSection = createFamilyComponent(
  CalibrationSectionClassic,
  CalibrationSectionNoir,
);

/** "Reexecutar calibração" + last report. */
export const SettingsCalibrationSection = ({
  t,
}: SettingsCalibrationSectionProps): JSX.Element => {
  const { applyRecommendation, saveStatus } = useCalibrationTunableApply();
  const [phase, setPhase] = useState<'idle' | 'running' | 'ready'>('idle');
  const [last, setLast] = useState<CalibrationLastResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchLastCalibrationReport();
        if (cancelled) return;
        setLast(result);
        setPhase('ready');
      } catch {
        if (cancelled) return;
        setLast(null);
        setPhase('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRun = useCallback(() => {
    setPhase('running');
    void (async () => {
      try {
        const result = await runCalibrationBenchmark();
        setLast(result);
        setPhase('ready');
      } catch {
        // Transport failure: nothing is applied and the last known report
        // stays on display (the backend persists failed reports itself).
        setPhase('ready');
      }
    })();
  }, []);

  const onApply = useCallback(() => {
    const recommendation = lastRecommendation(last);
    if (recommendation === null) return;
    applyRecommendation(recommendation);
  }, [applyRecommendation, last]);

  return (
    <FamilyCalibrationSection
      t={t}
      section={{ phase, last, applyStatus: saveStatus, onRun, onApply }}
    />
  );
};

export default SettingsCalibrationSection;
