import { Image as ImageIcon, Sparkles } from 'lucide-react';
import './DashboardEmptyStage.css';
import { useI18n } from '../../i18n';

interface DashboardEmptyStageProps {
  emptyPreviewTipIndex: number;
  currentEmptyPreviewTip: string;
}

const DashboardEmptyStage = ({
  emptyPreviewTipIndex,
  currentEmptyPreviewTip,
}: DashboardEmptyStageProps) => {
  const { t } = useI18n();
  return (
    <div className="koma-empty-stage" data-tour="dashboard-stage-empty">
      <div className="koma-empty-stage__content">
        <div className="koma-empty-stage__icon" aria-hidden="true">
          <ImageIcon size={28} />
        </div>
        <p className="koma-empty-stage__title">{t('dashboard.emptyStage.title')}</p>
        <p className="koma-empty-stage__desc">
          {t('dashboard.emptyStage.desc')}
        </p>
      </div>

      <div className="koma-empty-stage__tip" key={`tip-${emptyPreviewTipIndex}`}>
        <div className="koma-empty-stage__tip-head">
          <Sparkles size={12} />
          {t('dashboard.emptyStage.tipTitle')}
        </div>
        <p className="koma-empty-stage__tip-text">{currentEmptyPreviewTip}</p>
        <span className="koma-empty-stage__tip-meta">
          {t('dashboard.emptyStage.tipMeta')}
        </span>
      </div>
    </div>
  );
};

export default DashboardEmptyStage;
