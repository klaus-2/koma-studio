'use client';

import { useMemo, useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@koma/ui/components/popover';
import { PopoverChip, PopoverPanel } from '../noir-popover';

interface HexColorPopoverProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const HexColorPopoverNoir = ({ label, value, onChange, disabled = false }: HexColorPopoverProps) => {
  const [open, setOpen] = useState(false);
  const handleChange = (nextValue: string) => {
    const normalized = nextValue.trim();
    onChange(normalized.startsWith('#') ? normalized : `#${normalized}`);
  };
  const previewStyle = useMemo(() => ({ background: value }), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PopoverChip
          label={label}
          value={value.toLowerCase()}
          previewStyle={previewStyle}
          disabled={disabled}
          aria-label={label}
          title={label}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[240px]" side="top">
        <PopoverPanel title={label}>
          <div className="noir-picker-wrap flex flex-col gap-2.5">
            <HexColorPicker color={value} onChange={handleChange} />
            <HexColorInput
              className="noir-input !text-center !font-mono"
              color={value}
              onChange={handleChange}
              prefixed
            />
          </div>
        </PopoverPanel>
      </PopoverContent>
    </Popover>
  );
};
