import type {
  RenderTextAlign,
  RenderTextOrientation,
  RenderTextPathMode,
  RenderTextStyle,
} from "../../typography/renderStyle";

type KeysOfType<T> = {
  [K in keyof RenderTextStyle]-?: RenderTextStyle[K] extends T ? K : never;
}[keyof RenderTextStyle];

type EnabledWhen = (style: RenderTextStyle) => boolean;

export interface AdvancedRangeField {
  readonly kind: "range";
  readonly key: KeysOfType<number>;
  readonly labelKeys: readonly string[];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly digits: number;
  readonly suffix?: string;
  readonly enabledWhen?: EnabledWhen;
}

export interface AdvancedToggleField {
  readonly kind: "toggle";
  readonly key: KeysOfType<boolean>;
  readonly labelKeys: readonly string[];
}

interface ChoiceOption<V extends string> {
  readonly value: V;
  readonly labelKey: string;
}

export type AdvancedChoiceField =
  | { readonly kind: "choice"; readonly key: "alignment"; readonly labelKeys: readonly string[]; readonly options: readonly ChoiceOption<RenderTextAlign>[] }
  | { readonly kind: "choice"; readonly key: "textOrientation"; readonly labelKeys: readonly string[]; readonly options: readonly ChoiceOption<RenderTextOrientation>[] }
  | { readonly kind: "choice"; readonly key: "textPathMode"; readonly labelKeys: readonly string[]; readonly options: readonly ChoiceOption<RenderTextPathMode>[] };

export interface AdvancedColorField {
  readonly kind: "color";
  readonly key: "shadowColor" | "outlineColor";
  readonly labelKeys: readonly string[];
  readonly enabledWhen?: EnabledWhen;
}

export type AdvancedField = AdvancedRangeField | AdvancedToggleField | AdvancedChoiceField | AdvancedColorField;

export interface AdvancedFieldGroup {
  readonly id: string;
  readonly titleKey: string;
  readonly fields: readonly AdvancedField[];
}

const isCircular: EnabledWhen = (style) => style.textPathMode === "circular";
const hasShadow: EnabledWhen = (style) => style.shadowEnabled;
const hasAutoSize: EnabledWhen = (style) => style.autoFontSize;

export const RENDER_MODE_ADVANCED_FIELD_GROUPS: readonly AdvancedFieldGroup[] = [
  {
    id: "layout",
    titleKey: "renderPreview.typographyStyle",
    fields: [
      {
        kind: "choice",
        key: "alignment",
        labelKeys: ["renderPreview.alignment"],
        options: [
          { value: "left", labelKey: "renderPreview.alignLeft" },
          { value: "center", labelKey: "renderPreview.alignCenter" },
          { value: "right", labelKey: "renderPreview.alignRight" },
        ],
      },
      {
        kind: "choice",
        key: "textOrientation",
        labelKeys: ["renderPreview.textOrientation"],
        options: [
          { value: "horizontal", labelKey: "renderPreview.horizontal" },
          { value: "vertical", labelKey: "renderPreview.vertical" },
        ],
      },
      { kind: "range", key: "lineSpacing", labelKeys: ["renderPreview.lineSpacing"], min: 0.65, max: 2.2, step: 0.05, digits: 2 },
      { kind: "toggle", key: "autoFontSize", labelKeys: ["renderPreview.autoFontSize"] },
      { kind: "range", key: "minFontSize", labelKeys: ["renderPreview.minSize"], min: 6, max: 160, step: 1, digits: 0, suffix: "px", enabledWhen: hasAutoSize },
      { kind: "toggle", key: "underline", labelKeys: ["renderPreview.underline"] },
      { kind: "toggle", key: "hyphenationEnabled", labelKeys: ["renderPreview.hyphenation"] },
    ],
  },
  {
    id: "transform",
    titleKey: "renderPreview.adjustments",
    fields: [
      { kind: "range", key: "rotation", labelKeys: ["renderPreview.rotation"], min: -180, max: 180, step: 1, digits: 0, suffix: "°" },
      { kind: "range", key: "skewX", labelKeys: ["renderPreview.skewX"], min: -45, max: 45, step: 1, digits: 0, suffix: "°" },
      { kind: "range", key: "skewY", labelKeys: ["renderPreview.skewY"], min: -45, max: 45, step: 1, digits: 0, suffix: "°" },
      { kind: "range", key: "opacity", labelKeys: ["renderPreview.opacity"], min: 0.05, max: 1, step: 0.05, digits: 2 },
      { kind: "range", key: "outlineOpacity", labelKeys: ["renderPreview.outline", "renderPreview.opacity"], min: 0, max: 1, step: 0.05, digits: 2 },
    ],
  },
  {
    id: "circular",
    titleKey: "renderPreview.circularText",
    fields: [
      {
        kind: "choice",
        key: "textPathMode",
        labelKeys: ["renderPreview.circularText"],
        options: [
          { value: "normal", labelKey: "renderPreview.disabled" },
          { value: "circular", labelKey: "renderPreview.enabled" },
        ],
      },
      { kind: "range", key: "circularRadiusScale", labelKeys: ["renderPreview.radius"], min: 0.2, max: 1.2, step: 0.01, digits: 2, enabledWhen: isCircular },
      { kind: "range", key: "circularStartAngle", labelKeys: ["renderPreview.startAngle"], min: -180, max: 180, step: 1, digits: 0, suffix: "°", enabledWhen: isCircular },
      { kind: "range", key: "circularLetterSpacing", labelKeys: ["renderPreview.spacing"], min: 0.5, max: 2.5, step: 0.05, digits: 2, enabledWhen: isCircular },
    ],
  },
  {
    id: "shadow",
    titleKey: "renderPreview.shadow",
    fields: [
      { kind: "toggle", key: "shadowEnabled", labelKeys: ["renderPreview.shadow"] },
      { kind: "color", key: "shadowColor", labelKeys: ["renderPreview.shadow"], enabledWhen: hasShadow },
      { kind: "range", key: "shadowOpacity", labelKeys: ["renderPreview.opacity"], min: 0, max: 1, step: 0.05, digits: 2, enabledWhen: hasShadow },
      { kind: "range", key: "shadowBlur", labelKeys: ["renderPreview.blur"], min: 0, max: 30, step: 0.5, digits: 1, enabledWhen: hasShadow },
      { kind: "range", key: "shadowOffsetX", labelKeys: ["renderPreview.offsetX"], min: -24, max: 24, step: 0.5, digits: 1, enabledWhen: hasShadow },
      { kind: "range", key: "shadowOffsetY", labelKeys: ["renderPreview.offsetY"], min: -24, max: 24, step: 0.5, digits: 1, enabledWhen: hasShadow },
    ],
  },
];

export const isAdvancedFieldEnabled = (field: AdvancedField, style: RenderTextStyle): boolean =>
  !("enabledWhen" in field) || field.enabledWhen === undefined || field.enabledWhen(style);

export const formatAdvancedRangeValue = (field: AdvancedRangeField, value: number): string =>
  `${value.toFixed(field.digits)}${field.suffix ?? ""}`;

export type AdvancedFieldChange = <K extends keyof RenderTextStyle>(key: K, value: RenderTextStyle[K]) => void;
