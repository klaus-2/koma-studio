import { useState, type ReactNode, type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  UserCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import { useThemeStore } from "@koma/ui/stores/theme-store";
import { cn } from '../KomaTopbar.shared';

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

export default function KomaTopbarUserMenuNoir({
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

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) setLangPickerOpen(false);
  }

  const initial = userDisplayName?.charAt(0)?.toUpperCase() ?? 'K';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        data-tour="topbar-user-trigger"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          'panel-cut-sm flex h-8 items-center gap-2 pl-1 pr-2 transition-all duration-200',
          isOpen ? 'bg-crimson text-ink shadow-hard-paper' : 'bg-ink-3/70 text-paper hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-crimson',
        )}
      >
        <span
          className={cn(
            'panel-cut-sm grid h-6 w-6 place-items-center font-display text-[11px] font-black',
            isOpen ? 'bg-ink text-crimson' : 'bg-crimson text-ink',
          )}
        >
          {initial}
        </span>
        <span className="hidden max-w-[90px] truncate font-mono text-[11px] font-semibold uppercase tracking-wider sm:block">{userDisplayName}</span>
        <ChevronDown size={10} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            data-tour="topbar-user-panel"
            className="glass panel-cut absolute right-0 top-[calc(100%+10px)] z-50 w-72 border-crimson/30 p-2 shadow-hard-crimson"
          >
            <div className="halftone-red pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />

            {/* Head */}
            <div className="relative mb-2 flex items-center gap-2.5 border-b border-paper/10 p-2 pb-3">
              <span className="panel-cut-sm grid h-10 w-10 place-items-center bg-crimson font-display text-base font-black text-ink shadow-hard-gold">
                {initial}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-sm font-bold uppercase tracking-tight text-paper">{userDisplayName}</span>
                <span className="truncate font-mono text-[10px] text-paper-dim">{userDisplayEmail}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLangPickerOpen((value) => !value);
                }}
                aria-label={t('settings.language.label')}
                title={localeLabels[locale]}
                className={cn(
                  'panel-cut-sm flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-bold uppercase transition-colors',
                  langPickerOpen ? 'bg-gold text-ink' : 'bg-ink-3 text-paper-dim hover:text-paper',
                )}
              >
                <Languages size={10} />
                <span>{locale === 'pt-br' ? 'BR' : locale.toUpperCase()}</span>
              </button>
            </div>

            <AnimatePresence>
              {langPickerOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative mb-2 overflow-hidden"
                >
                  <div className="flex flex-col gap-1 border-b border-paper/10 pb-2">
                    {supportedLocales.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocale(loc as typeof locale);
                          setLangPickerOpen(false);
                        }}
                        className={cn(
                          'panel-cut-sm flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors',
                          locale === loc ? 'bg-crimson text-ink' : 'text-paper hover:bg-ink-3',
                        )}
                      >
                        <span className="font-mono text-[10px] font-bold">{loc === 'pt-br' ? 'BR' : loc.toUpperCase()}</span>
                        <span className="font-mono text-[11px]">{localeLabels[loc]}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative mb-2 flex gap-1.5 border-b border-paper/10 px-1 pb-2">
              <ThemePill active={currentTheme === 'dark'} onClick={() => setCurrentTheme('dark')} label={t('settings.theme.dark')}>
                <Moon size={11} />
              </ThemePill>
              <ThemePill active={currentTheme === 'light'} onClick={() => setCurrentTheme('light')} label={t('settings.theme.light')}>
                <Sun size={11} />
              </ThemePill>
            </div>

            <div className="relative flex flex-col gap-0.5">
              <MenuItem icon={UserCircle} label={t('dashboard.topbar.profile')} onClick={() => { onClose(); onOpenSettings?.(); }} />
              <MenuItem icon={Download} label={t('dashboard.topbar.exportWorkspace')} onClick={() => { onClose(); onExportWorkspace(); }} />
              <MenuItem icon={FolderOpen} label={t('dashboard.topbar.importWorkspace')} onClick={() => { onClose(); onImportWorkspace(); }} />
              <MenuItem icon={FolderX} label={t('dashboard.topbar.closeWorkspace')} danger onClick={() => { onClose(); onCloseWorkspace(); }} />
              {onReplayTour && <MenuItem icon={BookOpen} label={t('dashboard.topbar.replayTour')} onClick={() => { onClose(); onReplayTour(); }} />}
              <MenuItem icon={Megaphone} label={t('dashboard.topbar.scanlationFeed')} onClick={() => { onClose(); onOpenScanlationFeed?.(); }} />
              <MenuItem icon={Trophy} label={t('dashboard.topbar.rankings')} onClick={() => { onClose(); onOpenModelRankings?.(); }} />
              <div className="my-1 border-t border-paper/10" />
              <MenuItem icon={LogOut} label={t('dashboard.topbar.logout')} danger onClick={() => { onClose(); onLogout(); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemePill({ children, active, onClick, label }: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'panel-cut-sm grid h-7 flex-1 place-items-center transition-colors',
        active ? 'bg-gold text-ink' : 'bg-ink-3 text-paper-dim hover:text-paper',
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({ icon: Icon, label, danger, onClick }: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'panel-cut-sm group flex items-center gap-2.5 px-2.5 py-2 text-left transition-all duration-150',
        danger
          ? 'text-crimson hover:-translate-x-0.5 hover:bg-crimson hover:text-ink'
          : 'text-paper hover:-translate-x-0.5 hover:bg-ink-3 hover:text-crimson',
      )}
    >
      <Icon size={14} className="shrink-0" />
      <span className="font-mono text-[11px] font-medium uppercase tracking-wide">{label}</span>
    </button>
  );
}
