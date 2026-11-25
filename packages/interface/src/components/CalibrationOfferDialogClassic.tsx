import type { JSX } from 'react';
import { Loader2 } from 'lucide-react';
import { KomaDialog } from '@koma/ui/components/dialog';
import '@koma/ui/styles/KomaModals.css';
import { useI18n } from '../i18n';
import type {
  CalibrationOfferController,
  CalibrationReportView,
} from './CalibrationOfferDialog.types';

const CalibrationReportSummary = ({
  report,
}: {
  report: CalibrationReportView;
}): JSX.Element => {
  const { t } = useI18n();
  const recommended =
    report.status === 'failed' ? null : report.recommendedWorkingResolution;
  return (
    <p className="koma-modal__subtitle">
      {recommended === null
        ? t('dashboard.calibration.failed')
        : t('dashboard.calibration.recommended', { megapixels: recommended })}
    </p>
  );
};

export default function CalibrationOfferDialogClassic({
  controller,
}: {
  controller: CalibrationOfferController;
}) {
  const { t } = useI18n();
  return (
    <KomaDialog
      open
      onClose={controller.close}
      layerClassName="koma-modal-backdrop"
      modalClassName="koma-modal"
      labelledBy="calibration-offer-title"
    >
      <div className="koma-modal__header">
        <div className="koma-modal__title-group">
          <h2 id="calibration-offer-title" className="koma-modal__title">
            {t('dashboard.calibration.title')}
          </h2>
          <p className="koma-modal__subtitle">{t('dashboard.calibration.desc')}</p>
        </div>
      </div>
      <div className="koma-modal__body">
        {controller.phase === 'offer' && (
          <div className="koma-modal__actions">
            <button
              type="button"
              className="koma-btn koma-btn--primary koma-btn--sm"
              onClick={controller.accept}
            >
              {t('dashboard.calibration.run')}
            </button>
            <button
              type="button"
              className="koma-btn koma-btn--ghost koma-btn--sm"
              onClick={controller.decline}
            >
              {t('dashboard.calibration.decline')}
            </button>
          </div>
        )}

        {controller.phase === 'running' && (
          <p className="koma-modal__subtitle">
            <Loader2 size={12} className="koma-spin" />{' '}
            {t('dashboard.calibration.running')}
          </p>
        )}

        {controller.phase === 'result' && controller.report !== null && (
          <>
            <CalibrationReportSummary report={controller.report} />
            {controller.applyStatus === 'failed' && (
              <p className="koma-modal__subtitle">
                {t('dashboard.calibration.applyFailed')}
              </p>
            )}
            <div className="koma-modal__actions">
              <button
                type="button"
                className="koma-btn koma-btn--primary koma-btn--sm"
                disabled={
                  controller.report.recommendedWorkingResolution === null ||
                  controller.applyStatus === 'saving'
                }
                onClick={controller.apply}
              >
                {t('dashboard.calibration.apply')}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--ghost koma-btn--sm"
                onClick={controller.close}
              >
                {t('dashboard.calibration.close')}
              </button>
            </div>
          </>
        )}

        {controller.phase === 'error' && (
          <>
            <p className="koma-modal__subtitle">
              {t('dashboard.calibration.failed')}
            </p>
            <div className="koma-modal__actions">
              <button
                type="button"
                className="koma-btn koma-btn--ghost koma-btn--sm"
                onClick={controller.close}
              >
                {t('dashboard.calibration.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </KomaDialog>
  );
}
