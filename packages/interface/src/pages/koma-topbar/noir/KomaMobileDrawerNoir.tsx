import { motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { NavGroup, ToolMode } from '../KomaTopbar.shared';
import { cn, isModeUnderDevelopment } from '../KomaTopbar.shared';

type KomaMobileDrawerProps = {
  open: boolean;
  navGroups: NavGroup[];
  mode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  userDisplayName: string;
  userDisplayEmail: string;
  onClose: () => void;
};

export default function KomaMobileDrawerNoir({
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

  const initial = userDisplayName?.charAt(0)?.toUpperCase() ?? 'K';

  return (
    <div className="fixed inset-0 z-[100]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        role="dialog"
        aria-label={t('dashboard.topbar.navigation')}
        className="glass absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-l-2 border-crimson/40 bg-ink-2/95"
      >
        <div className="halftone-red pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
        <span className="v-text pointer-events-none absolute right-3 top-24 font-display text-6xl font-black text-outline opacity-40" aria-hidden="true">コマ</span>

        <div className="relative flex items-center justify-between border-b-2 border-crimson/30 p-4">
          <div className="flex items-center gap-2.5">
            <div className="panel-cut-sm grid h-9 w-9 place-items-center bg-crimson font-display text-lg font-black text-ink shadow-hard-gold">K</div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-sm font-black uppercase tracking-tight text-paper">{t('brand.name')}</span>
              <span className="kicker !text-[9px]">{t('brand.studioSuffix')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('dashboard.topbar.close')}
            className="panel-cut-sm grid h-8 w-8 place-items-center bg-ink-3 text-paper transition-colors hover:bg-crimson hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto p-4">
          {navGroups.map((group) => (
            <div key={group.id} className="mb-5">
              <h3 className="kicker mb-2">// {group.label}</h3>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = mode === item.mode;
                  const isDisabled = isModeUnderDevelopment(item.mode);
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      aria-disabled={isDisabled}
                      onClick={() => onModeChange(item.mode)}
                      className={cn(
                        'panel-cut-sm group flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150',
                        isActive ? 'bg-crimson text-ink shadow-hard-gold' : 'bg-ink-3/60 text-paper hover:-translate-x-0.5 hover:bg-ink-3 hover:shadow-hard-crimson',
                        isDisabled && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      <span
                        className={cn(
                          'panel-cut-sm grid h-9 w-9 shrink-0 place-items-center',
                          isActive ? 'bg-ink/20 text-ink' : 'bg-ink-2 text-crimson',
                        )}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-display text-sm font-bold uppercase tracking-tight">{item.label}</span>
                        <span className={cn('truncate font-mono text-[10px]', isActive ? 'text-ink/70' : 'text-paper-dim')}>{item.subtitle}</span>
                      </span>
                      {item.hasSubMode && (
                        <span className={cn('shrink-0 font-mono text-[8px] font-bold uppercase tracking-widest', isActive ? 'text-ink/80' : 'text-azure')}>
                          {t('dashboard.topbar.autoManualBadge')}
                        </span>
                      )}
                      <ChevronRight size={14} className={cn('shrink-0', isActive ? 'text-ink' : 'text-paper-dim')} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative border-t-2 border-crimson/30 p-4">
          <div className="glass panel-cut-sm flex items-center gap-3 p-3">
            <span className="panel-cut-sm grid h-10 w-10 place-items-center bg-crimson font-display text-base font-black text-ink">{initial}</span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-display text-sm font-bold uppercase tracking-tight text-paper">{userDisplayName}</span>
              <span className="truncate font-mono text-[10px] text-paper-dim">{userDisplayEmail}</span>
            </div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
