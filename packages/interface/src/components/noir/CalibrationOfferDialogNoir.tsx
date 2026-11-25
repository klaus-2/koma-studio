import type { JSX } from 'react';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { CalibrationOfferController } from '../CalibrationOfferDialog.types';

const btnPrimary =
  'panel-cut-sm flex items-center justify-center gap-2 bg-crimson px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-gold disabled:cursor-not-allowed disabled:opacity-40';
const btnGhost =
  'panel-cut-sm border border-paper/15 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-paper/70 transition-colors hover:border-crimson/50 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40';

export default function CalibrationOfferDialogNoir({
  controller,
}: {
  controller: CalibrationOfferController;
}): JSX.Element {
  const { t } = useI18n();
  const report = controller.report;
  const recommendation = report?.recommendedWorkingResolution ?? null;
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-ink/85 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-offer-title-noir"
      onKeyDown={(event) => {
        if (event.key === 'Escape') controller.close();
      }}
    >
      <div className="glass panel-cut halftone relative flex w-full max-w-md flex-col gap-3 p-4">
        <div className="border-b border-paper/10 pb-2">
          <h2
            id="calibration-offer-title-noir"
            className="font-display text-[15px] font-black uppercase tracking-tight text-paper"
          >
            {t('dashboard.calibration.title')}
          </h2>
          <p className="font-mono text-[10px] text-paper-dim">
            {t('dashboard.calibration.desc')}
          </p>
        </div>

        {controller.phase === 'offer' && (
          <div className="flex items-center gap-2">
            <button type="button" className={btnPrimary} onClick={controller.accept}>
              {t('dashboard.calibration.run')}
            </button>
            <button type="button" className={btnGhost} onClick={controller.decline}>
              {t('dashboard.calibration.decline')}
            </button>
          </div>
        )}

        {controller.phase === 'running' && (
          <p className="flex items-center gap-2 font-mono text-[11px] text-paper-dim">
            <Loader2 size={12} className="animate-spin" />
            {t('dashboard.calibration.running')}
          </p>
        )}

        {controller.phase === 'result' && report !== null && (
          <>
            <p className="font-mono text-[11px] text-paper">
              {recommendation === null
                ? t('dashboard.calibration.failed')
                : t('dashboard.calibration.recommended', {
                    megapixels: recommendation,
                  })}
            </p>
            {controller.applyStatus === 'failed' && (
              <p className="font-mono text-[10px] text-crimson">
                {t('dashboard.calibration.applyFailed')}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={recommendation === null || controller.applyStatus === 'saving'}
                onClick={controller.apply}
              >
                {t('dashboard.calibration.apply')}
              </button>
              <button type="button" className={btnGhost} onClick={controller.close}>
                {t('dashboard.calibration.close')}
              </button>
            </div>
          </>
        )}

        {controller.phase === 'error' && (
          <>
            <p className="font-mono text-[11px] text-crimson">
              {t('dashboard.calibration.failed')}
            </p>
            <button type="button" className={btnGhost} onClick={controller.close}>
              {t('dashboard.calibration.close')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
