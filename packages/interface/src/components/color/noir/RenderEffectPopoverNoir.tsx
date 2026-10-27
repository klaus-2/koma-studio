'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { GColorPicker } from '../GColorPicker';

import { useI18n } from '../../../i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@koma/ui/components/popover';
import { PopoverChip, PopoverPanel, ActivateToggle } from '../noir-popover';

interface RenderEffectPopoverProps {
  label: string;
  value: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onColorChange: (value: string) => void;
  summary: string;
  disabled?: boolean;
  allowGradient?: boolean;
  swatches?: string[];
  children?: ReactNode;
}

export const RenderEffectPopoverNoir = ({
  label,
  value,
  enabled,
  onEnabledChange,
  onColorChange,
  summary,
  disabled = false,
  allowGradient = false,
  swatches,
  children,
}: RenderEffectPopoverProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setPickerKey((k) => k + 1);
    }
  };

  const handleColorChange = (nextValue: string) => {
    const normalized = nextValue.trim();
    onColorChange(normalized.startsWith('#') ? normalized : `#${normalized}`);
  };

  const previewStyle = useMemo(
    () => ({
      background: value,
      opacity: enabled ? 1 : 0.45,
    }),
    [enabled, value],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <PopoverChip
          label={label}
          value={summary}
          previewStyle={previewStyle}
          disabled={disabled}
          aria-label={label}
          title={label}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[330px]" side="top">
        <PopoverPanel title={label}>
          <ActivateToggle
            label={t('dashboard.typography.activate')}
            checked={enabled}
            onChange={onEnabledChange}
          />
          {allowGradient ? (
            <div className="noir-picker-wrap">
              <GColorPicker
                key={pickerKey}
                value={value}
                onChange={onColorChange}
                format="hex"
                debounce
                debounceMS={0}
                popupWidth={290}
                colorBoardHeight={132}
                gradient
                solid
                showAlpha={true}
                showInputs={false}
                showGradientMode={true}
                showGradientPosition={true}
                showGradientStops={true}
                showGradientAngle={true}
                showGradientResult={true}
                allowAddGradientStops={true}
                {...(swatches ? { defaultColors: swatches } : {})}
              />
            </div>
          ) : (
            <div className="noir-picker-wrap flex flex-col gap-2.5">
              <HexColorPicker color={value} onChange={handleColorChange} />
              <HexColorInput
                className="noir-input !text-center !font-mono"
                color={value}
                onChange={handleColorChange}
                prefixed
              />
            </div>
          )}
          {children ? (
            <div className="mt-1 flex flex-col gap-3">{children}</div>
          ) : null}
        </PopoverPanel>
      </PopoverContent>
    </Popover>
  );
};
