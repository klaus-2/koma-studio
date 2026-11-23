import { useI18n } from '../../../i18n';
import { SIDEBAR_SKELETON_SECTIONS } from '../sidebar-skeleton-layout';

export default function DashboardSidebarSkeletonNoir() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      {SIDEBAR_SKELETON_SECTIONS.map((section) => (
        <div key={section.id} className="glass panel-cut space-y-3 p-4" aria-hidden="true">
          <div className="flex items-center gap-2.5">
            <span className="panel-cut-sm h-6 w-6 flex-none bg-crimson/30 motion-safe:animate-pulse" />
            <span className="h-2 w-24 bg-paper/15 motion-safe:animate-pulse" />
          </div>
          {section.rows.map((width) => (
            <span
              key={width}
              className="panel-cut-sm block h-8 border border-paper/10 bg-paper/5 motion-safe:animate-pulse"
              style={{ width }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
