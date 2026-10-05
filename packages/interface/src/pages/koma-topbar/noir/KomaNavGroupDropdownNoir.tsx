import type { RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";
import { useI18n } from '../../../i18n';
import type { DropdownId, NavGroup, NavItem, ToolMode } from '../KomaTopbar.shared';
import { cn, isModeUnderDevelopment } from '../KomaTopbar.shared';

type KomaNavGroupDropdownProps = {
  id: Exclude<DropdownId, 'download' | 'user' | null>;
  group: NavGroup;
  activeItem: NavItem | undefined;
  mode: ToolMode;
  isOpen: boolean;
  dropdownRef: RefObject<HTMLDivElement | null>;
  underDevelopmentTooltip: string;
  onToggle: (id: DropdownId) => void;
  onModeSelect: (mode: ToolMode) => void;
};

export default function KomaNavGroupDropdownNoir({
  id,
  group,
  activeItem,
  mode,
  isOpen,
  dropdownRef,
  underDevelopmentTooltip,
  onToggle,
  onModeSelect,
}: KomaNavGroupDropdownProps) {
  const { t } = useI18n();
  const hasActive = !!activeItem;
  const TriggerIcon = activeItem?.icon ?? group.groupIcon;
  const triggerLabel = activeItem?.label ?? group.label;
  const tourTarget =
    id === 'production'
      ? 'topbar-production-panel'
      : id === 'utils'
        ? 'topbar-utils-panel'
        : 'topbar-info-panel';
  const tourTrigger =
    id === 'production'
      ? 'topbar-production-trigger'
      : id === 'utils'
        ? 'topbar-utils-trigger'
        : 'topbar-info-trigger';

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-tour={tourTrigger}
            onClick={() => onToggle(id)}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            className={cn(
              'panel-cut-sm group flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all duration-200',
              hasActive || isOpen
                ? 'bg-gold text-ink shadow-hard-paper'
                : 'bg-ink-3/60 text-paper-dim hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-paper hover:shadow-hard-gold',
            )}
          >
            {hasActive && <span className="h-1.5 w-1.5 bg-ink blink-noir" aria-hidden="true" />}
            <TriggerIcon size={13} />
            <span>{triggerLabel}</span>
            <ChevronDown size={11} className={cn('transition-transform duration-200', isOpen && 'rotate-180')} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="glass panel-cut-sm">{group.label}</TooltipContent>
      </Tooltip>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            aria-label={group.label}
            data-tour={tourTarget}
            className="glass panel-cut absolute left-0 top-[calc(100%+10px)] z-50 w-72 border-gold/30 p-2 shadow-hard-crimson"
          >
            <div className="halftone pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
            <div className="relative mb-2 flex items-center gap-2 border-b border-paper/10 px-2 pb-2">
              <span className="kicker !text-gold">// {group.label}</span>
            </div>
            <div className="relative flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = mode === item.mode;
                const isDisabled = isModeUnderDevelopment(item.mode);
                const tooltipText = isDisabled ? underDevelopmentTooltip : item.tooltip;
                return (
                  <Tooltip key={item.mode}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        aria-disabled={isDisabled}
                        onClick={() => onModeSelect(item.mode)}
                        className={cn(
                          'panel-cut-sm group/item flex items-center gap-3 px-2.5 py-2 text-left transition-all duration-150',
                          isActive
                            ? 'bg-crimson text-ink'
                            : 'text-paper hover:-translate-x-0.5 hover:bg-ink-3 hover:shadow-hard-crimson',
                          isDisabled && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        <span
                          className={cn(
                            'panel-cut-sm grid h-8 w-8 shrink-0 place-items-center transition-colors',
                            isActive ? 'bg-ink/20 text-ink' : 'bg-ink-3 text-crimson group-hover/item:bg-crimson group-hover/item:text-ink',
                          )}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="font-display text-xs font-bold uppercase tracking-tight">{item.label}</span>
                          <span className={cn('truncate font-mono text-[10px]', isActive ? 'text-ink/70' : 'text-paper-dim')}>{item.subtitle}</span>
                        </span>
                        {item.hasSubMode && (
                          <span
                            className={cn(
                              'ml-auto shrink-0 font-mono text-[8px] font-bold uppercase tracking-widest',
                              isActive ? 'text-ink/80' : 'text-azure',
                            )}
                          >
                            {t('dashboard.topbar.autoManualBadge')}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="glass panel-cut-sm border-crimson/30">
                      <strong className="font-display uppercase text-crimson">{item.label}</strong>
                      <span className="block text-paper-dim">{tooltipText}</span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
