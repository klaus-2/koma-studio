import { useMemo, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";

import { Popover, PopoverContent, PopoverTrigger } from "@koma/ui/components/popover";

interface HexColorPopoverProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const HexColorPopover = ({
  label,
  value,
  onChange,
  disabled = false,
}: HexColorPopoverProps) => {
  const [open, setOpen] = useState(false);
  const handleChange = (nextValue: string) => {
    const normalized = nextValue.trim();
    onChange(normalized.startsWith("#") ? normalized : `#${normalized}`);
  };
  const previewStyle = useMemo(
    () => ({ background: value }),
    [value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="koma-color-popover__trigger"
          disabled={disabled}
          aria-label={label}
          title={label}
        >
          <span className="koma-color-popover__preview" style={previewStyle} />
          <span className="koma-color-popover__meta">
            <span className="koma-color-popover__label">{label}</span>
            <span className="koma-color-popover__value">{value.toLowerCase()}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="koma-color-popover__content" side="top">
        <div className="koma-color-popover__panel">
          <div className="koma-color-popover__panelHead">
            <div className="koma-color-popover__panelTitle">{label}</div>
          </div>
          <div className="koma-color-popover__pickerWrap koma-color-popover__pickerWrap--hex">
            <HexColorPicker color={value} onChange={handleChange} />
            <HexColorInput
              className="koma-color-popover__hexInput"
              color={value}
              onChange={handleChange}
              prefixed
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
