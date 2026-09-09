import { FileImage, Info, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n';

interface ReviewRawToolsPanelProps {
  mode: string;
  subMode: string;
  imagesCount: number;
  processing: boolean;
  setStatusMessage: (value: string) => void;
}

export default function ReviewRawToolsPanel({
  mode,
  subMode,
  imagesCount,
  processing,
  setStatusMessage,
}: ReviewRawToolsPanelProps) {
  const { t } = useI18n();

  if (mode === 'raw') {
    return (
      <div className="koma-card-surface">
        <div className="koma-card-surface__title"><FileImage size={14} /> {t('dashboard.reviewRaw.raw.title')}</div>
        <p className="koma-card-surface__desc">
          {t('dashboard.reviewRaw.raw.description')}
        </p>

        <div className="koma-note koma-note--info">
          <Info size={15} />
          <p>{t('dashboard.reviewRaw.raw.note')}</p>
        </div>

        <button
          type="button"
          className="koma-btn koma-btn--ghost koma-btn--full"
          disabled={imagesCount === 0}
          onClick={() => setStatusMessage(t('dashboard.reviewRaw.raw.statusReady', { count: imagesCount }))}
        >
          <FileImage size={14} /> {t('dashboard.reviewRaw.raw.validate')}
        </button>
      </div>
    );
  }

  if (mode === 'proofreader') {
    return (
      <div className="koma-card-surface">
        <div className="koma-card-surface__title"><ShieldCheck size={14} /> {t('dashboard.reviewRaw.qc.title')}</div>
        <p className="koma-card-surface__desc">
          {subMode === 'auto'
            ? t('dashboard.reviewRaw.qc.descriptionAuto')
            : t('dashboard.reviewRaw.qc.descriptionManual')}
        </p>

        <div className="koma-note koma-note--info">
          <Info size={15} />
          <p>{t('dashboard.reviewRaw.qc.note')}</p>
        </div>

        <div className="koma-field">
          <label className="koma-field__label">{t('dashboard.reviewRaw.qc.automaticChecks')}</label>
          <div className="koma-checklist">
            {[
              'dashboard.reviewRaw.qc.checks.untranslatedText',
              'dashboard.reviewRaw.qc.checks.emptyBubbles',
              'dashboard.reviewRaw.qc.checks.visualArtifacts',
              'dashboard.reviewRaw.qc.checks.textAlignment',
              'dashboard.reviewRaw.qc.checks.fontConsistency',
            ].map((checkKey) => (
              <label key={checkKey} className="koma-checklist__item">
                <input type="checkbox" defaultChecked />
                <span>{t(checkKey as never)}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="koma-btn koma-btn--primary koma-btn--full"
          disabled={processing || imagesCount === 0}
          onClick={() => setStatusMessage(t('dashboard.reviewRaw.qc.inProgress'))}
        >
          <ShieldCheck size={14} /> {t('dashboard.reviewRaw.qc.run')}
        </button>
      </div>
    );
  }

  return null;
}
