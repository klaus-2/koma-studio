import { useI18n } from '../../i18n';
import { SIDEBAR_SKELETON_SECTIONS } from './sidebar-skeleton-layout';
import './DashboardSidebarSkeleton.css';

export default function DashboardSidebarSkeletonClassic() {
  const { t } = useI18n();
  return (
    <div className="koma-sidebar-skeleton" role="status" aria-busy="true" aria-live="polite">
      <span className="koma-sidebar-skeleton__label">{t('common.loading')}</span>
      {SIDEBAR_SKELETON_SECTIONS.map((section) => (
        <div key={section.id} className="koma-sidebar-skeleton__section" aria-hidden="true">
          <div className="koma-sidebar-skeleton__head">
            <span className="koma-sidebar-skeleton__icon" />
            <span className="koma-sidebar-skeleton__bar koma-sidebar-skeleton__bar--title" />
          </div>
          {section.rows.map((width) => (
            <span key={width} className="koma-sidebar-skeleton__bar" style={{ width }} />
          ))}
        </div>
      ))}
    </div>
  );
}
