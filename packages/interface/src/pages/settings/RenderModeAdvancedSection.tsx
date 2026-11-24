import { HexColorPopover } from "../../components/color/HexColorPopover";
import type { useI18n } from "../../i18n";
import type { RenderTextStyle } from "../../typography/renderStyle";
import {
  formatAdvancedRangeValue,
  isAdvancedFieldEnabled,
  RENDER_MODE_ADVANCED_FIELD_GROUPS,
  type AdvancedField,
  type AdvancedFieldChange,
} from "./renderModeAdvancedFields";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface RenderModeAdvancedSectionProps {
  t: TranslationFn;
  style: RenderTextStyle;
  onChange: AdvancedFieldChange;
}

const AdvancedFieldControl = ({ t, style, onChange, field }: RenderModeAdvancedSectionProps & { field: AdvancedField }) => {
  const label = field.labelKeys.map((key) => t(key)).join(" · ");
  const enabled = isAdvancedFieldEnabled(field, style);

  switch (field.kind) {
    case "range":
      return (
        <div className="koma-fine-field">
          <span className="koma-fine-field__label">{label}</span>
          <div className="koma-fine-field__control">
            <input type="range" className="koma-fine-field__range" min={field.min} max={field.max} step={field.step}
              value={style[field.key]} disabled={!enabled} onChange={(e) => onChange(field.key, Number(e.target.value))} />
            <span className="koma-fine-field__value">{formatAdvancedRangeValue(field, style[field.key])}</span>
          </div>
        </div>
      );
    case "toggle":
      return (
        <div className="koma-fine-field">
          <span className="koma-fine-field__label">{label}</span>
          <label className="koma-fine-toggle">
            <input type="checkbox" checked={style[field.key]} onChange={(e) => onChange(field.key, e.target.checked)} />
            <span>{style[field.key] ? t("renderPreview.enabled") : t("renderPreview.disabled")}</span>
          </label>
        </div>
      );
    case "choice":
      return (
        <div className="koma-fine-field">
          <span className="koma-fine-field__label">{label}</span>
          <div className="koma-style-row__group" role="group" aria-label={label}>
            {field.options.map((option) => (
              <button key={option.value} type="button"
                className={`koma-style-row__btn${style[field.key] === option.value ? " koma-style-row__btn--active" : ""}`}
                aria-pressed={style[field.key] === option.value}
                onClick={() => onChange(field.key, option.value)}>
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      );
    case "color":
      return (
        <div className="koma-fine-field">
          <HexColorPopover label={label} value={style[field.key]} disabled={!enabled} onChange={(value) => onChange(field.key, value)} />
        </div>
      );
  }
};

export const RenderModeAdvancedSection = ({ t, style, onChange }: RenderModeAdvancedSectionProps) => (
  <details className="koma-preset-form__advanced">
    <summary className="koma-pf__label">{t("guides.common.advanced")}</summary>
    {RENDER_MODE_ADVANCED_FIELD_GROUPS.map((group) => (
      <section key={group.id} aria-label={t(group.titleKey)}>
        <span className="koma-pf__label">{t(group.titleKey)}</span>
        <div className="koma-fine-grid">
          {group.fields.map((field) => (
            <AdvancedFieldControl key={field.key} t={t} style={style} onChange={onChange} field={field} />
          ))}
        </div>
      </section>
    ))}
  </details>
);
