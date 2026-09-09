import type {
  RenderTextStyle,
  RenderTextStyleRange,
} from "../typography/renderStyle";

export const INLINE_RENDER_STYLE_KEYS = [
  "fontFamily",
  "fontSize",
  "minFontSize",
  "bold",
  "italic",
  "uppercase",
  "underline",
  "opacity",
  "color",
  "fillCssValue",
  "gradientEnabled",
  "gradientStartColor",
  "gradientEndColor",
  "gradientAngle",
  "shadowEnabled",
  "shadowColor",
  "shadowFillCssValue",
  "shadowGradientEnabled",
  "shadowGradientStartColor",
  "shadowGradientEndColor",
  "shadowGradientAngle",
  "shadowOpacity",
  "shadowBlur",
  "shadowOffsetX",
  "shadowOffsetY",
  "shadowLayers",
  "outlineColor",
  "outlineOpacity",
  "outlineWidth",
  "textEffectPreset",
  "textEffectIntensity",
] as const;

type InlineRenderTextStyleKey = (typeof INLINE_RENDER_STYLE_KEYS)[number];
type InlineRenderTextStylePatch = Partial<Pick<RenderTextStyle, InlineRenderTextStyleKey>>;

const INLINE_RENDER_STYLE_KEY_SET = new Set<string>(INLINE_RENDER_STYLE_KEYS);

const cloneInlineStyleValue = <TValue,>(value: TValue): TValue => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item && typeof item === "object" ? { ...item } : item,
    ) as TValue;
  }
  return value;
};

const valuesEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(cloneInlineStyleValue(left)) === JSON.stringify(cloneInlineStyleValue(right));

const normalizeSelectionBounds = (
  textLength: number,
  start: number,
  end: number,
): { start: number; end: number } => {
  const safeStart = Math.max(0, Math.min(textLength, Math.floor(start)));
  const safeEnd = Math.max(0, Math.min(textLength, Math.floor(end)));
  return safeStart <= safeEnd
    ? { start: safeStart, end: safeEnd }
    : { start: safeEnd, end: safeStart };
};

export const pickInlineRenderTextStylePatch = (
  style?: Partial<RenderTextStyle> | null,
): InlineRenderTextStylePatch => {
  const patch: InlineRenderTextStylePatch = {};
  if (!style) return patch;
  INLINE_RENDER_STYLE_KEYS.forEach((key) => {
    const value = style[key];
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = cloneInlineStyleValue(value);
    }
  });
  return patch;
};

const cloneInlineRenderTextStylePatch = (
  patch?: InlineRenderTextStylePatch | null,
): InlineRenderTextStylePatch => pickInlineRenderTextStylePatch(patch);

export const cloneRenderTextStyleRanges = (
  ranges?: RenderTextStyleRange[] | null,
): RenderTextStyleRange[] | undefined =>
  ranges?.map((range) => ({
    start: range.start,
    end: range.end,
    style: cloneInlineRenderTextStylePatch(range.style),
  }));

export const areRenderTextStyleRangesEqual = (
  left?: RenderTextStyleRange[] | null,
  right?: RenderTextStyleRange[] | null,
): boolean =>
  JSON.stringify(cloneRenderTextStyleRanges(left) ?? []) === JSON.stringify(cloneRenderTextStyleRanges(right) ?? []);

const buildCharacterPatches = (
  textLength: number,
  ranges?: RenderTextStyleRange[] | null,
): InlineRenderTextStylePatch[] => {
  const patches = Array.from({ length: textLength }, () => ({} as InlineRenderTextStylePatch));
  ranges?.forEach((range) => {
    const { start, end } = normalizeSelectionBounds(textLength, range.start, range.end);
    if (start === end) return;
    const patch = pickInlineRenderTextStylePatch(range.style);
    for (let index = start; index < end; index += 1) {
      patches[index] = {
        ...patches[index],
        ...patch,
      };
    }
  });
  return patches;
};

const compressCharacterPatches = (
  text: string,
  baseStyle: RenderTextStyle,
  patches: InlineRenderTextStylePatch[],
): RenderTextStyleRange[] | undefined => {
  const nextRanges: RenderTextStyleRange[] = [];
  let rangeStart = -1;
  let previousPatch = "";

  const getSanitizedPatch = (patch: InlineRenderTextStylePatch): InlineRenderTextStylePatch => {
    const nextPatch = cloneInlineRenderTextStylePatch(patch);
    INLINE_RENDER_STYLE_KEYS.forEach((key) => {
      if (nextPatch[key] === undefined) return;
      if (valuesEqual(nextPatch[key], baseStyle[key])) {
        delete nextPatch[key];
      }
    });
    return nextPatch;
  };

  for (let index = 0; index <= text.length; index += 1) {
    const patch = index < text.length ? getSanitizedPatch(patches[index] ?? {}) : {};
    const patchSignature = JSON.stringify(patch);
    if (patchSignature === previousPatch) continue;
    if (rangeStart >= 0 && previousPatch !== "{}") {
      nextRanges.push({
        start: rangeStart,
        end: index,
        style: JSON.parse(previousPatch) as InlineRenderTextStylePatch,
      });
    }
    rangeStart = index;
    previousPatch = patchSignature;
  }

  return nextRanges.length > 0 ? nextRanges : undefined;
};

export const getInlineStylePatchFromStyleDiff = (
  currentStyle: RenderTextStyle,
  nextStyle: RenderTextStyle,
): InlineRenderTextStylePatch | null => {
  const patch: InlineRenderTextStylePatch = {};
  for (const key of Object.keys(nextStyle) as Array<keyof RenderTextStyle>) {
    if (valuesEqual(currentStyle[key], nextStyle[key])) continue;
    if (!INLINE_RENDER_STYLE_KEY_SET.has(key)) {
      return null;
    }
    (patch as Record<string, unknown>)[key] = cloneInlineStyleValue(
      nextStyle[key as InlineRenderTextStyleKey],
    );
  }
  return patch;
};

export const applyInlineRenderTextStylePatch = (
  text: string,
  baseStyle: RenderTextStyle,
  ranges: RenderTextStyleRange[] | undefined,
  start: number,
  end: number,
  patch: Partial<RenderTextStyle>,
): RenderTextStyleRange[] | undefined => {
  const selection = normalizeSelectionBounds(text.length, start, end);
  if (selection.start === selection.end) {
    return cloneRenderTextStyleRanges(ranges);
  }
  const inlinePatch = pickInlineRenderTextStylePatch(patch);
  const characterPatches = buildCharacterPatches(text.length, ranges);
  for (let index = selection.start; index < selection.end; index += 1) {
    characterPatches[index] = {
      ...characterPatches[index],
      ...inlinePatch,
    };
  }
  return compressCharacterPatches(text, baseStyle, characterPatches);
};

export const resolveRenderTextSelectionStyle = (
  text: string,
  baseStyle: RenderTextStyle,
  ranges: RenderTextStyleRange[] | undefined,
  start: number,
  end: number,
): RenderTextStyle => {
  const selection = normalizeSelectionBounds(text.length, start, end);
  if (selection.start === selection.end) return { ...baseStyle };
  const characterPatches = buildCharacterPatches(text.length, ranges);
  const resolvedStyle: RenderTextStyle = { ...baseStyle };
  INLINE_RENDER_STYLE_KEYS.forEach((key) => {
    const firstValue = characterPatches[selection.start]?.[key] ?? baseStyle[key];
    let isShared = true;
    for (let index = selection.start + 1; index < selection.end; index += 1) {
      const value = characterPatches[index]?.[key] ?? baseStyle[key];
      if (!valuesEqual(firstValue, value)) {
        isShared = false;
        break;
      }
    }
    if (isShared && firstValue !== undefined) {
      ((resolvedStyle as unknown) as Record<string, unknown>)[key] = cloneInlineStyleValue(
        firstValue,
      );
    }
  });
  return resolvedStyle;
};

export const remapRenderTextStyleRangesAfterTextEdit = (
  previousText: string,
  nextText: string,
  baseStyle: RenderTextStyle,
  ranges: RenderTextStyleRange[] | undefined,
): RenderTextStyleRange[] | undefined => {
  if (!ranges?.length || previousText === nextText) {
    return cloneRenderTextStyleRanges(ranges);
  }
  const previousPatches = buildCharacterPatches(previousText.length, ranges);
  let prefix = 0;
  while (
    prefix < previousText.length
    && prefix < nextText.length
    && previousText[prefix] === nextText[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < previousText.length - prefix
    && suffix < nextText.length - prefix
    && previousText[previousText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const insertionLength = nextText.length - prefix - suffix;
  const nextPatches: InlineRenderTextStylePatch[] = previousPatches.slice(0, prefix).map(cloneInlineRenderTextStylePatch);
  const inheritedPatch =
    cloneInlineRenderTextStylePatch(previousPatches[Math.max(0, prefix - 1)])
    || cloneInlineRenderTextStylePatch(previousPatches[prefix]);
  for (let index = 0; index < insertionLength; index += 1) {
    nextPatches.push(cloneInlineRenderTextStylePatch(inheritedPatch));
  }
  nextPatches.push(
    ...previousPatches
      .slice(previousText.length - suffix)
      .map(cloneInlineRenderTextStylePatch),
  );

  return compressCharacterPatches(nextText, baseStyle, nextPatches);
};

export const collectInlineRenderTextFontFamilies = (
  ranges?: Array<{ style?: { fontFamily?: string } }> | null,
): string[] => {
  const families = new Set<string>();
  ranges?.forEach((range) => {
    const family = range.style?.fontFamily?.trim();
    if (family) {
      families.add(family);
    }
  });
  return [...families];
};

export interface RenderTextStyledSegment {
  text: string;
  style: RenderTextStyle;
}
