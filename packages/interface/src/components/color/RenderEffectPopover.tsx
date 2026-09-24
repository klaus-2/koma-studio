import { memo, useMemo, useState, type ReactNode } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import ReactGPicker from "react-gcolor-picker";

import { Popover, PopoverContent, PopoverTrigger } from "@koma/ui/components/popover";
import { useI18n } from "../../i18n";

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

export const RenderEffectPopover = memo(function RenderEffectPopover({
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
}: RenderEffectPopoverProps) {
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
    onColorChange(normalized.startsWith("#") ? normalized : `#${normalized}`);
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
            <span className="koma-color-popover__value">{summary}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="koma-color-popover__content" side="top">
        <div className="koma-color-popover__panel">
          <div className="koma-color-popover__panelHead">
            <div className="koma-color-popover__panelTitle">{label}</div>
          </div>
          <label className="koma-effect-popover__toggle">
            <span>{t('dashboard.typography.activate')}</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onEnabledChange(event.target.checked)}
            />
          </label>
          {allowGradient ? (
            <div className="koma-color-popover__pickerWrap">
              <ReactGPicker
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
            <div className="koma-color-popover__pickerWrap koma-color-popover__pickerWrap--hex">
              <HexColorPicker color={value} onChange={handleColorChange} />
              <HexColorInput
                className="koma-color-popover__hexInput"
                color={value}
                onChange={handleColorChange}
                prefixed
              />
            </div>
          )}
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