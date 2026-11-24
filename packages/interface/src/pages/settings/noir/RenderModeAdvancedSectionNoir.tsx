import { HexColorPopover } from "../../../components/color/HexColorPopover";
import type { useI18n } from "../../../i18n";
import { cn } from "../../../lib/utils";
import type { RenderTextStyle } from "../../../typography/renderStyle";
import {
  formatAdvancedRangeValue,
  isAdvancedFieldEnabled,
  RENDER_MODE_ADVANCED_FIELD_GROUPS,
  type AdvancedField,
  type AdvancedFieldChange,
} from "../renderModeAdvancedFields";
import { btnGhost, Field, InkToggle, RangeField } from "./primitives";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface RenderModeAdvancedSectionNoirProps {
  t: TranslationFn;
  style: RenderTextStyle;
  onChange: AdvancedFieldChange;
}

const AdvancedFieldControlNoir = ({ t, style, onChange, field }: RenderModeAdvancedSectionNoirProps & { field: AdvancedField }) => {
  const label = field.labelKeys.map((key) => t(key)).join(" · ");
  const enabled = isAdvancedFieldEnabled(field, style);

  switch (field.kind) {
    case "range":
      return (
        <RangeField label={label} min={field.min} max={field.max} step={field.step} disabled={!enabled}
          value={style[field.key]} display={formatAdvancedRangeValue(field, style[field.key])}
          onChange={(value) => onChange(field.key, value)} />
      );
    case "toggle":
      return (
        <Field label={label}>
          <InkToggle label={label} checked={style[field.key]} onChange={(value) => onChange(field.key, value)} />
        </Field>
      );
    case "choice":
      return (
        <Field label={label}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
            {field.options.map((option) => (
              <button key={option.value} type="button" aria-pressed={style[field.key] === option.value}
                className={cn(btnGhost, style[field.key] === option.value && "border-crimson text-crimson")}
                onClick={() => onChange(field.key, option.value)}>
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </Field>
      );
    case "color":
      return (
        <HexColorPopover label={label} value={style[field.key]} disabled={!enabled} onChange={(value) => onChange(field.key, value)} />
      );
  }
};

export const RenderModeAdvancedSectionNoir = ({ t, style, onChange }: RenderModeAdvancedSectionNoirProps) => (
  <details className="panel-cut-sm mt-4 border border-paper/8 bg-ink/50 px-4 py-3">
    <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.24em] text-paper/60">
      {t("guides.common.advanced")}
    </summary>
    {RENDER_MODE_ADVANCED_FIELD_GROUPS.map((group) => (
      <section key={group.id} aria-label={t(group.titleKey)} className="mt-4">
        <p className="kicker !text-[9px]">{t(group.titleKey)}</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          {group.fields.map((field) => (
            <AdvancedFieldControlNoir key={field.key} t={t} style={style} onChange={onChange} field={field} />
          ))}
        </div>
      </section>
    ))}
  </details>
);
