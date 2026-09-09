import type { TypographyShapeKind } from "../typography/types";
import type { RenderTextStyle } from "../typography/renderStyle";

export type FillStyleSource = Pick<
  RenderTextStyle,
  "color" | "fillCssValue" | "gradientEnabled" | "gradientStartColor" | "gradientEndColor" | "gradientAngle"
>;

export interface RenderTextPlacementSegment {
  text: string;
  style: RenderTextStyle;
  measuredWidth: number;
}

export interface RenderTextLinePlacement {
  text: string;
  x: number;
  y: number;
  measuredWidth: number;
  availableWidth: number;
  lineHeight?: number;
  segments?: RenderTextPlacementSegment[];
}

export interface RenderTextLayout {
  wrappedText: string;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  textWidth: number;
  textHeight: number;
  placements: RenderTextLinePlacement[];
  shapeKind: TypographyShapeKind;
}

export type RenderTextVisualPadding = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type StyledGlyph = {
  text: string;
  style: RenderTextStyle;
  measuredWidth: number;
  lineHeight: number;
};
