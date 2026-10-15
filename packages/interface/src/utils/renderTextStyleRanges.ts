import type {
  RenderTextStyle,
  RenderTextStyleRange,
} from "@/typography/renderStyle";
import { segmentText } from "@/utils/renderText.unicode";

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
] as const satisfies readonly (keyof RenderTextStyle)[];

export type InlineRenderTextStyleKey =
  (typeof INLINE_RENDER_STYLE_KEYS)[number];

export type InlineRenderTextStylePatch = Partial<
  Pick<RenderTextStyle, InlineRenderTextStyleKey>
>;

export interface RenderTextStyledSegment {
  text: string;
  style: RenderTextStyle;
}

interface RangeEvent {
  readonly offset: number;
  readonly index: number;
  readonly starts: boolean;
}

const inlineKeys: ReadonlySet<string> = new Set(INLINE_RENDER_STYLE_KEYS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const styleValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value: unknown, index) =>
        styleValuesEqual(value, right[index]),
      )
    );
  }

  if (!isRecord(left) || !isRecord(right)) return false;

  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        styleValuesEqual(left[key], right[key]),
    )
  );
};

const copyDefinedProperty = <T extends object, K extends keyof T>(
  target: Partial<T>,
  source: Partial<T>,
  key: K,
): void => {
  const value = source[key];
  if (value !== undefined) target[key] = structuredClone(value);
};

export const normalizeSelectionBounds = (
  textLength: number,
  start: number,
  end: number,
): Readonly<{ start: number; end: number }> => {
  if (
    !Number.isSafeInteger(textLength) ||
    textLength < 0 ||
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    throw new RangeError("Selection bounds must be finite UTF-16 offsets.");
  }

  const left = Math.max(0, Math.min(textLength, Math.floor(start)));
  const right = Math.max(0, Math.min(textLength, Math.floor(end)));

  return {
    start: Math.min(left, right),
    end: Math.max(left, right),
  };
};

export const pickInlineRenderTextStylePatch = (
  style?: Partial<RenderTextStyle> | null,
): InlineRenderTextStylePatch => {
  const patch: InlineRenderTextStylePatch = {};
  if (!style) return patch;

  for (const key of INLINE_RENDER_STYLE_KEYS) {
    copyDefinedProperty<RenderTextStyle, typeof key>(patch, style, key);
  }

  return patch;
};

export const cloneRenderTextStyleRanges = (
  ranges?: readonly RenderTextStyleRange[] | null,
): RenderTextStyleRange[] | undefined =>
  ranges?.map((range) => ({
    start: range.start,
    end: range.end,
    style: pickInlineRenderTextStylePatch(range.style),
  }));

export const areRenderTextStyleRangesEqual = (
  left?: readonly RenderTextStyleRange[] | null,
  right?: readonly RenderTextStyleRange[] | null,
): boolean =>
  styleValuesEqual(
    cloneRenderTextStyleRanges(left) ?? [],
    cloneRenderTextStyleRanges(right) ?? [],
  );

const heapPush = (heap: number[], value: number): void => {
  heap.push(value);
  let index = heap.length - 1;

  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    const parentValue = heap[parent];
    if (parentValue === undefined || parentValue >= value) break;
    heap[index] = parentValue;
    index = parent;
  }

  heap[index] = value;
};

const heapPop = (heap: number[]): void => {
  const last = heap.pop();
  if (last === undefined || heap.length === 0) return;

  let index = 0;

  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    const leftValue = heap[left];
    const rightValue = heap[right];

    if (leftValue === undefined) break;

    const child =
      rightValue !== undefined && rightValue > leftValue ? right : left;
    const childValue = heap[child];

    if (childValue === undefined || childValue <= last) break;

    heap[index] = childValue;
    index = child;
  }

  heap[index] = last;
};

export const resolveInlineStyleRuns = (
  textLength: number,
  ranges?: readonly RenderTextStyleRange[] | null,
): RenderTextStyleRange[] => {
  normalizeSelectionBounds(textLength, 0, textLength);
  if (textLength === 0) return [];

  const events: RangeEvent[] = [];
  const patches = new Map<number, InlineRenderTextStylePatch>();

  ranges?.forEach((range, index) => {
    const bounds = normalizeSelectionBounds(
      textLength,
      range.start,
      range.end,
    );
    const patch = pickInlineRenderTextStylePatch(range.style);

    if (bounds.start === bounds.end || Object.keys(patch).length === 0) {
      return;
    }

    patches.set(index, patch);
    events.push(
      { offset: bounds.start, index, starts: true },
      { offset: bounds.end, index, starts: false },
    );
  });

  events.sort(
    (left, right) =>
      left.offset - right.offset ||
      Number(left.starts) - Number(right.starts) ||
      left.index - right.index,
  );

  const active = new Set<number>();
  const heaps = new Map<InlineRenderTextStyleKey, number[]>();
  const runs: RenderTextStyleRange[] = [];
  let eventIndex = 0;
  let position = 0;

  while (position < textLength) {
    while (events[eventIndex]?.offset === position) {
      const event = events[eventIndex];
      if (!event) break;

      if (event.starts) {
        active.add(event.index);
        const patch = patches.get(event.index);

        for (const key of INLINE_RENDER_STYLE_KEYS) {
          if (patch?.[key] === undefined) continue;
          const heap = heaps.get(key) ?? [];
          heapPush(heap, event.index);
          heaps.set(key, heap);
        }
      } else {
        active.delete(event.index);
      }

      eventIndex += 1;
    }

    const style: InlineRenderTextStylePatch = {};

    for (const key of INLINE_RENDER_STYLE_KEYS) {
      const heap = heaps.get(key);
      if (!heap) continue;

      let highest = heap[0];
      while (highest !== undefined && !active.has(highest)) {
        heapPop(heap);
        highest = heap[0];
      }

      const patch = highest === undefined ? undefined : patches.get(highest);
      if (patch) {
        copyDefinedProperty<RenderTextStyle, typeof key>(style, patch, key);
      }
    }

    const end = events[eventIndex]?.offset ?? textLength;
    const previous = runs[runs.length - 1];

    if (
      previous &&
      previous.end === position &&
      styleValuesEqual(previous.style, style)
    ) {
      previous.end = end;
    } else {
      runs.push({ start: position, end, style });
    }

    position = end;
  }

  return runs;
};

const canonicalRanges = (
  textLength: number,
  baseStyle: RenderTextStyle,
  ranges: readonly RenderTextStyleRange[],
): RenderTextStyleRange[] | undefined => {
  const result: RenderTextStyleRange[] = [];

  for (const run of resolveInlineStyleRuns(textLength, ranges)) {
    const style = pickInlineRenderTextStylePatch(run.style);

    for (const key of INLINE_RENDER_STYLE_KEYS) {
      if (styleValuesEqual(style[key], baseStyle[key])) delete style[key];
    }

    if (Object.keys(style).length === 0) continue;

    const previous = result[result.length - 1];
    if (
      previous?.end === run.start &&
      styleValuesEqual(previous.style, style)
    ) {
      previous.end = run.end;
    } else {
      result.push({ start: run.start, end: run.end, style });
    }
  }

  return result.length > 0 ? result : undefined;
};

export const getInlineStylePatchFromStyleDiff = (
  currentStyle: RenderTextStyle,
  nextStyle: RenderTextStyle,
): InlineRenderTextStylePatch | null => {
  const current: Record<string, unknown> = { ...currentStyle };
  const next: Record<string, unknown> = { ...nextStyle };
  const keys = new Set([...Object.keys(current), ...Object.keys(next)]);

  for (const key of keys) {
    if (styleValuesEqual(current[key], next[key])) continue;
    if (!inlineKeys.has(key) || next[key] === undefined) return null;
  }

  const patch: InlineRenderTextStylePatch = {};

  for (const key of INLINE_RENDER_STYLE_KEYS) {
    if (!styleValuesEqual(currentStyle[key], nextStyle[key])) {
      copyDefinedProperty<RenderTextStyle, typeof key>(patch, nextStyle, key);
    }
  }

  return patch;
};

export const applyInlineRenderTextStylePatch = (
  text: string,
  baseStyle: RenderTextStyle,
  ranges: readonly RenderTextStyleRange[] | undefined,
  start: number,
  end: number,
  patch: Partial<RenderTextStyle>,
): RenderTextStyleRange[] | undefined => {
  const selection = normalizeSelectionBounds(text.length, start, end);

  if (selection.start === selection.end) {
    return cloneRenderTextStyleRanges(ranges);
  }

  return canonicalRanges(text.length, baseStyle, [
    ...(ranges ?? []),
    {
      ...selection,
      style: pickInlineRenderTextStylePatch(patch),
    },
  ]);
};

export const resolveRenderTextSelectionStyle = (
  text: string,
  baseStyle: RenderTextStyle,
  ranges: readonly RenderTextStyleRange[] | undefined,
  start: number,
  end: number,
): RenderTextStyle => {
  const selection = normalizeSelectionBounds(text.length, start, end);
  const resolved = structuredClone(baseStyle);

  if (selection.start === selection.end) return resolved;

  const runs = resolveInlineStyleRuns(text.length, ranges).filter(
    (run) => run.start < selection.end && run.end > selection.start,
  );
  const first = runs[0];
  if (!first) return resolved;

  for (const key of INLINE_RENDER_STYLE_KEYS) {
    const firstValue = first.style[key] ?? baseStyle[key];
    const shared = runs.every((run) =>
      styleValuesEqual(run.style[key] ?? baseStyle[key], firstValue),
    );

    if (shared) {
      copyDefinedProperty<RenderTextStyle, typeof key>(
        resolved,
        first.style[key] === undefined ? baseStyle : first.style,
        key,
      );
    }
  }

  return resolved;
};

export const remapRenderTextStyleRangesAfterTextEdit = (
  previousText: string,
  nextText: string,
  baseStyle: RenderTextStyle,
  ranges: readonly RenderTextStyleRange[] | undefined,
): RenderTextStyleRange[] | undefined => {
  if (!ranges?.length || previousText === nextText) {
    return cloneRenderTextStyleRanges(ranges);
  }

  const before = segmentText(previousText);
  const after = segmentText(nextText);
  let prefixCount = 0;

  while (
    prefixCount < before.length &&
    prefixCount < after.length &&
    before[prefixCount]?.text === after[prefixCount]?.text
  ) {
    prefixCount += 1;
  }

  let suffixCount = 0;
  while (
    suffixCount < before.length - prefixCount &&
    suffixCount < after.length - prefixCount &&
    before[before.length - 1 - suffixCount]?.text ===
      after[after.length - 1 - suffixCount]?.text
  ) {
    suffixCount += 1;
  }

  const prefix = before[prefixCount - 1]?.end ?? 0;
  const oldSuffix =
    before[before.length - suffixCount]?.start ?? previousText.length;
  const newSuffix =
    after[after.length - suffixCount]?.start ?? nextText.length;
  const delta = newSuffix - oldSuffix;
  const runs = resolveInlineStyleRuns(previousText.length, ranges);
  const inheritedIndex = prefix > 0 ? prefix - 1 : prefix;
  const inherited = runs.find(
    (run) => run.start <= inheritedIndex && run.end > inheritedIndex,
  );
  const result: RenderTextStyleRange[] = [];

  for (const run of runs) {
    if (run.start < prefix) {
      result.push({
        start: run.start,
        end: Math.min(run.end, prefix),
        style: pickInlineRenderTextStylePatch(run.style),
      });
    }

    if (run.end > oldSuffix) {
      result.push({
        start: Math.max(run.start, oldSuffix) + delta,
        end: run.end + delta,
        style: pickInlineRenderTextStylePatch(run.style),
      });
    }
  }

  if (newSuffix > prefix) {
    result.push({
      start: prefix,
      end: newSuffix,
      style: pickInlineRenderTextStylePatch(inherited?.style),
    });
  }

  return canonicalRanges(nextText.length, baseStyle, result);
};

export const collectInlineRenderTextFontFamilies = (
  ranges?:
    | readonly { readonly style?: { readonly fontFamily?: string } }[]
    | null,
): string[] => {
  const families = new Set<string>();

  for (const range of ranges ?? []) {
    const family = range.style?.fontFamily?.trim();
    if (family) families.add(family);
  }

  return Array.from(families);
};
