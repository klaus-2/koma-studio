import { useEffect, useState, type RefObject } from 'react';
import {
  BookOpen,
  Download,
  FolderOpen,
  FolderX,
  Languages,
  LogOut,
  Megaphone,
  Moon,
  Sun,
  Trophy,
  User,
  UserCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

import { useI18n } from '../../i18n';
import { useThemeStore } from "@koma/ui/stores/theme-store";
import { cn } from './KomaTopbar.shared';

type KomaTopbarUserMenuProps = {
  isOpen: boolean;
  dropdownRef: RefObject<HTMLDivElement | null>;
  userDisplayName: string;
  userDisplayEmail: string;
  onOpenSettings?: () => void;
  onOpenModelRankings?: () => void;
  onOpenScanlationFeed?: () => void;
  onReplayTour?: () => void;
  onToggle: () => void;
  onClose: () => void;
  onExportWorkspace: () => void;
  onImportWorkspace: () => void;
  onCloseWorkspace: () => void;
  onLogout: () => void;
};

export default function KomaTopbarUserMenu({
  isOpen,
  dropdownRef,
  userDisplayName,
  userDisplayEmail,
  onOpenSettings,
  onOpenModelRankings,
  onOpenScanlationFeed,
  onReplayTour,
  onToggle,
  onClose,
  onExportWorkspace,
  onImportWorkspace,
  onCloseWorkspace,
  onLogout,
}: KomaTopbarUserMenuProps) {
  const { locale, localeLabels, setLocale, supportedLocales, t } = useI18n();
  const currentTheme = useThemeStore((state) => state.theme);
  const setCurrentTheme = useThemeStore((state) => state.setTheme);
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setLangPickerOpen(false);
    }
  }, [isOpen]);

  return (
    <div className="koma-navdrop koma-navdrop--right" ref={dropdownRef}>
      <button
        type="button"
        data-tour="topbar-user-trigger"
        className={cn('koma-topbar__userbtn', isOpen && 'koma-topbar__userbtn--open')}
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <div className="koma-topbar__avatar">
          <User size={12} />
        </div>
        <span className="koma-topbar__username">{userDisplayName}</span>
        <ChevronDown size={10} />
      </button>

      {isOpen && (
      <div className="koma-usermenu" data-tour="topbar-user-panel" role="menu">
        <div className="koma-usermenu__arrow" aria-hidden="true" />
        <div className="koma-usermenu__head">
          <div className="koma-usermenu__avatar">
            <User size={14} />
          </div>
          <div className="koma-usermenu__info">
            <span className="koma-usermenu__name">{userDisplayName}</span>
            <span className="koma-usermenu__email">{userDisplayEmail}</span>
          </div>
          <button
            type="button"
            className={cn('koma-lang-pill', langPickerOpen && 'koma-lang-pill--open')}
            onClick={(e) => {
              e.stopPropagation();
              setLangPickerOpen((value) => !value);
            }}
            aria-label={t('settings.language.label')}
            title={localeLabels[locale]}
          >
            <Languages size={10} />
            <span>{locale === 'pt-br' ? 'BR' : locale.toUpperCase()}</span>
          </button>
        </div>

        {langPickerOpen && (
          <div className="koma-lang-picker">
            {supportedLocales.map((loc) => (
              <button
                key={loc}
                type="button"
                className={cn('koma-lang-option', locale === loc && 'koma-lang-option--active')}
                onClick={(e) => {
                  e.stopPropagation();
                  setLocale(loc as typeof locale);
                  setLangPickerOpen(false);
                }}
              >
                <span className="koma-lang-option__code">{loc === 'pt-br' ? 'BR' : loc.toUpperCase()}</span>
                <span className="koma-lang-option__label">{localeLabels[loc]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="koma-usermenu__themeRow">
          <button
            type="button"
            className={cn('koma-theme-pill', currentTheme === 'dark' && 'koma-theme-pill--active')}
            onClick={() => setCurrentTheme('dark')}
            aria-label={t('settings.theme.dark')}
            title={t('settings.theme.dark')}
          >
            <Moon size={10} />
          </button>
          <button
            type="button"
            className={cn('koma-theme-pill', currentTheme === 'light' && 'koma-theme-pill--active')}
            onClick={() => setCurrentTheme('light')}
            aria-label={t('settings.theme.light')}
            title={t('settings.theme.light')}
          >
            <Sun size={10} />
          </button>
        </div>

        <div className="koma-usermenu__sep" />
        <MenuItem icon={UserCircle} label={t('dashboard.topbar.profile')} onClick={() => { onClose(); onOpenSettings?.(); }} />
        <MenuItem icon={Download} label={t('dashboard.topbar.exportWorkspace')} onClick={() => { onClose(); onExportWorkspace(); }} />
        <MenuItem icon={FolderOpen} label={t('dashboard.topbar.importWorkspace')} onClick={() => { onClose(); onImportWorkspace(); }} />
        <MenuItem icon={FolderX} label={t('dashboard.topbar.closeWorkspace')} danger onClick={() => { onClose(); onCloseWorkspace(); }} />
        {onReplayTour && <MenuItem icon={BookOpen} label={t('dashboard.topbar.replayTour')} onClick={() => { onClose(); onReplayTour(); }} />}
        <MenuItem icon={Megaphone} label={t('dashboard.topbar.scanlationFeed')} onClick={() => { onClose(); onOpenScanlationFeed?.(); }} />
        <MenuItem icon={Trophy} label={t('dashboard.topbar.rankings')} onClick={() => { onClose(); onOpenModelRankings?.(); }} />
        <div className="koma-usermenu__sep" />
        <MenuItem icon={LogOut} label={t('dashboard.topbar.logout')} danger onClick={() => { onClose(); onLogout(); }} />
      </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={cn('koma-usermenu__item', danger && 'koma-usermenu__item--danger')} role="menuitem" onClick={onClick}>
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}
