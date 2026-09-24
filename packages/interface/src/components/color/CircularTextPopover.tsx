import { memo, useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@koma/ui/components/popover";
import { useI18n } from "../../i18n";

interface CircularTextPopoverProps {
  enabled: boolean;
  summary: string;
  onEnabledChange: (enabled: boolean) => void;
  children?: ReactNode;
}

export const CircularTextPopover = memo(function CircularTextPopover({
  enabled,
  summary,
  onEnabledChange,
  children,
}: CircularTextPopoverProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="koma-color-popover__trigger"
          aria-label={t('dashboard.typography.circularText')}
          title={t('dashboard.typography.circularText')}
        >
          <span className="koma-color-popover__preview koma-color-popover__preview--fx">
            ◯T
          </span>
          <span className="koma-color-popover__meta">
            <span className="koma-color-popover__label">{t('dashboard.typography.circularText')}</span>
            <span className="koma-color-popover__value">{summary}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="koma-color-popover__content" side="top">
        <div className="koma-color-popover__panel">
          <div className="koma-color-popover__panelHead">
            <div className="koma-color-popover__panelTitle">{t('dashboard.typography.circularText')}</div>
          </div>
          <label className="koma-effect-popover__toggle">
            <span>{t('dashboard.typography.activate')}</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onEnabledChange(event.target.checked)}
            />
          </label>
          {children ? (
            <div className="koma-effect-popover__controls">
              {children}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
});