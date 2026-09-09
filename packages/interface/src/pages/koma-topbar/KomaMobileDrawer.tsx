import { ChevronRight, User, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { NavGroup, ToolMode } from './KomaTopbar.shared';
import { cn, isModeUnderDevelopment } from './KomaTopbar.shared';

type KomaMobileDrawerProps = {
  open: boolean;
  navGroups: NavGroup[];
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  userDisplayName: string;
  userDisplayEmail: string;
  onClose: () => void;
};

export default function KomaMobileDrawer({
  open,
  navGroups,
  mode,
  onModeChange,
  userDisplayName,
  userDisplayEmail,
  onClose,
}: KomaMobileDrawerProps) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="koma-drawer-root">
      <div className="koma-drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="koma-drawer" role="dialog" aria-label={t('dashboard.topbar.navigation')}>
        <div className="koma-drawer__orb" aria-hidden="true" />
        <div className="koma-drawer__header">
          <div className="koma-drawer__brand">
            <span className="koma-drawer__brand-mark">{t('brand.name')}</span>
            <span className="koma-drawer__brand-tag">{t('brand.studioSuffix')}</span>
          </div>
          <button type="button" className="koma-drawer__close" onClick={onClose} aria-label={t('dashboard.topbar.close')}>
            <X size={16} />
          </button>
        </div>

        <nav className="koma-drawer__nav">
          {navGroups.map((group) => (
            <div key={group.id} className="koma-drawer__group">
              <h3 className="koma-drawer__group-title">{group.label}</h3>
              <div className="koma-drawer__group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = mode === item.mode;
                  const isDisabled = isModeUnderDevelopment(item.mode);
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      className={cn('koma-drawer__item', isActive && 'koma-drawer__item--active', isDisabled && 'koma-drawer__item--disabled')}
                      aria-disabled={isDisabled}
                      onClick={() => onModeChange(item.mode)}
                    >
                      <span className="koma-drawer__item-icon">
                        <Icon size={15} />
                      </span>
                      <span className="koma-drawer__item-body">
                        <span className="koma-drawer__item-name">{item.label}</span>
                        <span className="koma-drawer__item-sub">{item.subtitle}</span>
                      </span>
                      {item.hasSubMode && <span className="koma-drawer__item-tag">{t('dashboard.topbar.autoManualBadge')}</span>}
                      <ChevronRight size={13} className="koma-drawer__item-arrow" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="koma-drawer__footer">
          <div className="koma-drawer__user">
            <div className="koma-drawer__user-avatar">
              <User size={13} />
            </div>
            <div className="koma-drawer__user-info">
              <span className="koma-drawer__user-name">{userDisplayName}</span>
              <span className="koma-drawer__user-email">{userDisplayEmail}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
