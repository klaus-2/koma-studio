'use client';

import { useState, type ReactNode } from 'react';

import { useI18n } from '../../../i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@koma/ui/components/popover';
import { PopoverChip, PopoverPanel, ActivateToggle } from '../noir-popover';

interface CircularTextPopoverProps {
  enabled: boolean;
  summary: string;
  onEnabledChange: (enabled: boolean) => void;
  children?: ReactNode;
}

export const CircularTextPopoverNoir = ({
  enabled,
  summary,
  onEnabledChange,
  children,
}: CircularTextPopoverProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PopoverChip
          label={t('dashboard.typography.circularText')}
          value={summary}
          previewText="◯T"
          aria-label={t('dashboard.typography.circularText')}
          title={t('dashboard.typography.circularText')}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[300px]" side="top">
        <PopoverPanel title={t('dashboard.typography.circularText')}>
          <ActivateToggle
            label={t('dashboard.typography.activate')}
            checked={enabled}
            onChange={onEnabledChange}
          />
          {children ? (
            <div className="mt-1 flex flex-col gap-3">{children}</div>
          ) : null}
        </PopoverPanel>
      </PopoverContent>
    </Popover>
  );
};
