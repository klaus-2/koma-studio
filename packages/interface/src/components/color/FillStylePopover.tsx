import React, { memo, useMemo, useState } from "react";
import ReactGPicker from "react-gcolor-picker";

import { useI18n } from '../../i18n';
import { Popover, PopoverContent, PopoverTrigger } from "@koma/ui/components/popover";
import { parseFillPickerValue } from "../../utils/textFillPicker";

interface FillStylePopoverProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowGradient?: boolean;
  swatches?: string[];
  onBeforeOpen?: () => void;
  onClose?: () => void;
}

const isGradientValue = (value: string): boolean =>
  /^(linear|radial)-gradient\(/i.test(value.trim());

export const FillStylePopover = memo(function FillStylePopover({
  label,
  value,
  onChange,
  disabled = false,
  allowGradient = true,
  swatches,
  onBeforeOpen,
  onClose,
}: FillStylePopoverProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const gradientActive = allowGradient && isGradientValue(value);
  const [activeTab, setActiveTab] = useState<"solid" | "gradient">(
    gradientActive ? "gradient" : "solid",
  );
  const normalizedFill = useMemo(
    () => parseFillPickerValue(value, "#111111"),
    [value],
  );
  const solidValue = normalizedFill.color;
  const gradientValue = gradientActive
    ? value
    : `linear-gradient(90deg, ${solidValue} 0%, ${solidValue} 100%)`;
  const previewStyle = useMemo(
    () => ({ background: value }),
    [value],
  );

  const [pickerKey, setPickerKey] = useState(0);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setActiveTab(gradientActive ? "gradient" : "solid");
      setPickerKey((k) => k + 1);
    } else {
      if (onClose) {
        onClose();
      }
    }
  };

  const handleTriggerMouseDownCapture = (_e: React.MouseEvent<HTMLButtonElement>) => {
    if (onBeforeOpen) {
      onBeforeOpen();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="koma-color-popover__trigger"
          disabled={disabled}
          aria-label={label}
          title={label}
          onMouseDownCapture={handleTriggerMouseDownCapture}
        >
          <span className="koma-color-popover__preview" style={previewStyle} />
          <span className="koma-color-popover__meta">
            <span className="koma-color-popover__label">{label}</span>
            <span className="koma-color-popover__value">
              {gradientActive ? t('fillStylePopover.gradient') : value.toLowerCase()}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="koma-color-popover__content koma-color-popover__content--fill" side="top">
        <div className="koma-color-popover__panel">
          <div className="koma-color-popover__panelHead">
            <div>
              <div className="koma-color-popover__panelTitle">{label}</div>
              <div className="koma-color-popover__panelHint">
                {allowGradient ? t('fillStylePopover.hint.gradient') : t('fillStylePopover.hint.solid')}
              </div>
            </div>
          </div>
          <div className="koma-color-popover__pickerWrap">
            <ReactGPicker
              key={`${pickerKey}-${activeTab}-${gradientActive ? "gradient" : "solid"}`}
              value={activeTab === "gradient" ? gradientValue : solidValue}
              onChange={(v) => {
                onChange(v);
              }}
              format="hex"
              debounce
              debounceMS={0}
              popupWidth={290}
              colorBoardHeight={132}
              gradient={allowGradient}
              solid
              showAlpha={true}
              showInputs={false}
              showGradientMode={allowGradient}
              showGradientPosition={true}
              showGradientStops={allowGradient}
              showGradientAngle={allowGradient}
              showGradientResult={allowGradient}
              allowAddGradientStops={allowGradient}
              defaultActiveTab={activeTab}
              onChangeTabs={(tab) => {
                if (tab === "solid" || tab === "gradient") {
                  setActiveTab(tab);
                  onChange(tab === "gradient" ? gradientValue : solidValue);
                }
              }}
              {...(swatches ? { defaultColors: swatches } : {})}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
