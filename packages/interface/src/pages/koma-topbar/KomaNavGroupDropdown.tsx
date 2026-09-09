import type { RefObject } from 'react';
import { ChevronDown } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";
import { useI18n } from '../../i18n';
import type { DropdownId, NavGroup, NavItem, ToolMode } from './KomaTopbar.shared';
import { cn, isModeUnderDevelopment } from './KomaTopbar.shared';

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

export default function KomaNavGroupDropdown({
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

  return (
    <div className={cn('koma-navdrop', isOpen && 'koma-navdrop--open')} ref={dropdownRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-tour={
              id === 'production'
                ? 'topbar-production-trigger'
                : id === 'utils'
                  ? 'topbar-utils-trigger'
                  : 'topbar-info-trigger'
            }
            className={cn('koma-navdrop__trigger', (hasActive || isOpen) && 'koma-navdrop__trigger--active')}
            onClick={() => onToggle(id)}
            aria-haspopup="menu"
            aria-expanded={isOpen}
          >
            {hasActive && <span className="koma-navdrop__indicator" aria-hidden="true" />}
            <TriggerIcon size={14} />
            <span className="koma-navdrop__trigger-label">{triggerLabel}</span>
            <ChevronDown size={11} className={cn('koma-navdrop__caret', isOpen && 'koma-navdrop__caret--open')} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{group.label}</TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="koma-navdrop__panel" data-tour={tourTarget} role="menu" aria-label={group.label}>
          <div className="koma-navdrop__panel-arrow" aria-hidden="true" />
          <div className="koma-navdrop__panel-header">{group.label}</div>
          <div className="koma-navdrop__panel-list">
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
                      className={cn('koma-navdrop__item', isActive && 'koma-navdrop__item--active', isDisabled && 'koma-navdrop__item--disabled')}
                      onClick={() => onModeSelect(item.mode)}
                    >
                      <span className="koma-navdrop__item-icon"><Icon size={16} /></span>
                      <span className="koma-navdrop__item-body">
                        <span className="koma-navdrop__item-name">{item.label}</span>
                        <span className="koma-navdrop__item-desc">{item.subtitle}</span>
                      </span>
                      {item.hasSubMode && <span className="koma-navdrop__item-tag">{t('dashboard.topbar.autoManualBadge')}</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="koma-tooltip--rich">
                    <strong>{item.label}</strong>
                    <span>{tooltipText}</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
