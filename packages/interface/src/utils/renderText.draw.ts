import type { TypographyBounds, TypographyShape } from "../typography/types";
import type { RenderTextStyle } from "../typography/renderStyle";
import { getNativeTextEffectPreset } from "../typography/textEffects";
import type {
  FillStyleSource,
  RenderTextLayout,
  RenderTextPlacementSegment,
} from "./renderText.types";
import {
  applyOpacityToColor,
  buildCanvasFont,
  normalizeOpacity,
  normalizeRotationAngle,
  normalizeShape,
  normalizeSkewAngle,
  normalizeTextPathMode,
  resolveCanvasFillStyle,
  resolveTextFillStyle,
} from "./renderText.core";

export const resolveInnerBoxOffset = (
  bbox: TypographyBounds,
  shape?: TypographyShape,
): TypographyBounds => {
  const [x1, y1, x2, y2] = bbox;
  const boxWidth = Math.max(1, x2 - x1);
  const boxHeight = Math.max(1, y2 - y1);
  const normalizedShape = normalizeShape(shape, boxWidth, boxHeight);
  if (!normalizedShape) {
    return [0, 0, boxWidth, boxHeight];
  }
  return normalizedShape.innerBox;
};

export const drawStyledSegment = (
  ctx: CanvasRenderingContext2D,
  segment: RenderTextPlacementSegment,
  x: number,
  y: number,
  localX1: number,
  localY1: number,
  boxWidth: number,
  boxHeight: number,
  align: CanvasTextAlign,
  baseline: CanvasTextBaseline,
  underlineThickness: number,
  drawUnderline: boolean,
): void => {
  const style = segment.style;
  const outlineWidth = Math.max(0, style.outlineWidth || 0);
  const textOpacity = normalizeOpacity(style.opacity);
  const outlineOpacity = normalizeOpacity(style.outlineOpacity ?? 1);
  const shadowOpacity = normalizeOpacity(style.shadowOpacity ?? 1);
  const effectPreset = getNativeTextEffectPreset(style.textEffectPreset);
  const effectIntensity = Math.min(Math.max(Number(style.textEffectIntensity ?? 1), 0), 2);
  const outlineColor = applyOpacityToColor(style.outlineColor || "#ffffff", outlineOpacity);
  const shadowFillStyleSource: FillStyleSource = {
    color: style.shadowColor || "#000000",
    fillCssValue: style.shadowFillCssValue || style.shadowColor || "#000000",
    gradientEnabled: Boolean(style.shadowGradientEnabled),
    gradientStartColor: style.shadowGradientStartColor || style.shadowColor || "#000000",
    gradientEndColor: style.shadowGradientEndColor || style.shadowColor || "#000000",
    gradientAngle: style.shadowGradientAngle || 90,
  };

  const drawGhost = (
    fill: string,
    opacity: number,
    blur: number,
    offsetX: number,
    offsetY: number,
  ) => {
    ctx.save();
    ctx.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : "none";
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.fillStyle = fill;
    ctx.fillText(segment.text, x + offsetX, y + offsetY);
    ctx.restore();
  };

  ctx.save();
  ctx.font = buildCanvasFont(style, style.fontSize);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = Math.max(0, outlineWidth * 2);
  ctx.fillStyle = resolveTextFillStyle(ctx, style, localX1, localY1, boxWidth, boxHeight);

  if (style.shadowEnabled) {
    const layers = style.shadowLayers?.length
      ? style.shadowLayers
      : [{
        fillCssValue: shadowFillStyleSource.fillCssValue || shadowFillStyleSource.color,
        opacity: shadowOpacity,
        blur: style.shadowBlur || 0,
        offsetX: style.shadowOffsetX || 0,
        offsetY: style.shadowOffsetY || 0,
      }];
    layers.forEach((layer) => {
      ctx.save();
      ctx.filter = layer.blur > 0 ? `blur(${layer.blur.toFixed(1)}px)` : "none";
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
      ctx.fillStyle = resolveCanvasFillStyle(
        ctx,
        {
          color: shadowFillStyleSource.color,
          fillCssValue: layer.fillCssValue,
          gradientEnabled: /gradient\(/i.test(layer.fillCssValue),
          gradientStartColor: shadowFillStyleSource.gradientStartColor,
          gradientEndColor: shadowFillStyleSource.gradientEndColor,
          gradientAngle: shadowFillStyleSource.gradientAngle,
        },
        localX1,
        localY1,
        boxWidth,
        boxHeight,
      );
      ctx.fillText(segment.text, x + layer.offsetX * 1.35, y + layer.offsetY * 1.35);
      ctx.restore();
    });
    ctx.filter = "none";
  }

  if (effectPreset.id !== "none" && effectIntensity > 0) {
    drawGhost(effectPreset.fill, 0.1 + effectIntensity * 0.08, 1.4 + effectIntensity * 1.8, -1.5 * effectIntensity, 1.5 * effectIntensity);
    drawGhost(effectPreset.fill, 0.06 + effectIntensity * 0.05, 3 + effectIntensity * 2.5, 0, 0.8 * effectIntensity);
  }

  if (outlineWidth > 0) {
    ctx.globalAlpha = 1;
    ctx.strokeText(segment.text, x, y);
  }
  ctx.globalAlpha = textOpacity;
  ctx.fillText(segment.text, x, y);

  if (drawUnderline && style.underline && segment.text.trim().length > 0) {
    let underlineStartX = x;
    if (align === "center") {
      underlineStartX -= segment.measuredWidth / 2;
    } else if (align === "right") {
      underlineStartX -= segment.measuredWidth;
    }
    const underlineY = y + style.fontSize - Math.max(1, Math.round(style.fontSize * 0.16));
    ctx.fillRect(underlineStartX, underlineY, segment.measuredWidth, underlineThickness);
  }
  ctx.restore();
};

export const drawRenderedTextInRegion = (
  ctx: CanvasRenderingContext2D,
  bbox: TypographyBounds,
  layout: RenderTextLayout,
  style: RenderTextStyle,
  shape?: TypographyShape,
): void => {
  const [x1, y1, x2, y2] = bbox;
  const boxWidth = Math.max(1, x2 - x1);
  const boxHeight = Math.max(1, y2 - y1);
  const outlineWidth = Math.max(0, style.outlineWidth || 0);
  const rotation = normalizeRotationAngle(style.rotation || 0);
  const hasRotation = Math.abs(rotation) > 0.001;
  const skewX = normalizeSkewAngle(style.skewX || 0);
  const skewY = normalizeSkewAngle(style.skewY || 0);
  const hasSkew = Math.abs(skewX) > 0.001 || Math.abs(skewY) > 0.001;
  const textOpacity = normalizeOpacity(style.opacity);
  const outlineOpacity = normalizeOpacity(style.outlineOpacity ?? 1);
  const shadowOpacity = normalizeOpacity(style.shadowOpacity ?? 1);
  const shadowEnabled = Boolean(style.shadowEnabled);
  const shadowBlur = Math.max(0, style.shadowBlur || 0);
  const shadowOffsetX = Number.isFinite(style.shadowOffsetX) ? style.shadowOffsetX : 0;
  const shadowOffsetY = Number.isFinite(style.shadowOffsetY) ? style.shadowOffsetY : 0;
  const shadowColor = applyOpacityToColor(style.shadowColor || "#000000", shadowOpacity);
  const shadowFillStyleSource: FillStyleSource = {
    color: style.shadowColor || "#000000",
    fillCssValue: style.shadowFillCssValue || style.shadowColor || "#000000",
    gradientEnabled: Boolean(style.shadowGradientEnabled),
    gradientStartColor: style.shadowGradientStartColor || style.shadowColor || "#000000",
    gradientEndColor: style.shadowGradientEndColor || style.shadowColor || "#000000",
    gradientAngle: style.shadowGradientAngle || 90,
  };
  const outlineColor = applyOpacityToColor(style.outlineColor || "#ffffff", outlineOpacity);
  const effectPreset = getNativeTextEffectPreset(style.textEffectPreset);
  const effectIntensity = Math.min(Math.max(Number(style.textEffectIntensity ?? 1), 0), 2);
  const innerBox = resolveInnerBoxOffset(bbox, shape);

  ctx.save();
  if (hasRotation || hasSkew) {
    ctx.translate(x1 + (boxWidth / 2), y1 + (boxHeight / 2));
    if (hasRotation) {
      ctx.rotate((rotation * Math.PI) / 180);
    }
    if (hasSkew) {
      ctx.transform(
        1,
        Math.tan((skewY * Math.PI) / 180),
        Math.tan((skewX * Math.PI) / 180),
        1,
        0,
        0,
      );
    }
  }
  ctx.font = buildCanvasFont(style, layout.fontSize);
  ctx.textBaseline = "top";
  ctx.strokeStyle = outlineColor;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(0, outlineWidth * 2);
  ctx.globalAlpha = 1;

  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const localX1 = hasRotation || hasSkew ? -(boxWidth / 2) : x1;
  const localY1 = hasRotation || hasSkew ? -(boxHeight / 2) : y1;
  const lineThickness = Math.max(1, Math.round(layout.fontSize * 0.075));
  ctx.fillStyle = resolveTextFillStyle(ctx, style, localX1, localY1, boxWidth, boxHeight);
  const hasStyledSegments = layout.placements.some(
    (placement) => (placement.segments?.length ?? 0) > 0,
  );

  if (normalizeTextPathMode(style.textPathMode) === "circular") {
    const normalizedShape = normalizeShape(shape, boxWidth, boxHeight);
    const innerBox = normalizedShape?.innerBox ?? [0, 0, boxWidth, boxHeight];
    const innerWidth = Math.max(1, innerBox[2] - innerBox[0] - (outlineWidth * 2));
    const innerHeight = Math.max(1, innerBox[3] - innerBox[1] - (outlineWidth * 2));
    const radius = (Math.min(innerWidth, innerHeight) / 2) * Math.min(Math.max(style.circularRadiusScale || 0.78, 0.2), 1.2);
    const centerX = localX1 + innerBox[0] + (innerWidth / 2) + outlineWidth;
    const centerY = localY1 + innerBox[1] + (innerHeight / 2) + outlineWidth;
    const text = layout.wrappedText || " ";
    const glyphSegments = hasStyledSegments
      ? (layout.placements[0]?.segments ?? [])
      : Array.from(text).map((glyph) => ({
        text: glyph,
        style,
        measuredWidth:
          ctx.measureText(glyph).width
          + layout.fontSize * 0.08 * Math.min(Math.max(style.circularLetterSpacing || 1, 0.5), 2.5),
      }));
    const totalArc = glyphSegments.reduce((sum, segment) => sum + segment.measuredWidth, 0);
    let angle = ((style.circularStartAngle || -90) * Math.PI) / 180 - (totalArc / Math.max(1, radius)) / 2;

    for (let index = 0; index < glyphSegments.length; index += 1) {
      const segment = glyphSegments[index]!;
      const glyphAngle = segment.measuredWidth / Math.max(1, radius);
      const charAngle = angle + glyphAngle / 2;
      const drawX = centerX + Math.cos(charAngle) * radius;
      const drawY = centerY + Math.sin(charAngle) * radius;

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(charAngle + Math.PI / 2);
      drawStyledSegment(
        ctx,
        segment,
        0,
        0,
        localX1,
        localY1,
        boxWidth,
        boxHeight,
        "center",
        "middle",
        lineThickness,
        false,
      );
      ctx.restore();
      angle += glyphAngle;
    }

    ctx.restore();
    return;
  }

  if (style.textOrientation === "vertical") {
    const drawTop = localY1 + Math.max(0, (boxHeight - layout.textHeight) / 2) + outlineWidth;
    const horizontalOffset =
      style.alignment === "center"
        ? Math.max(0, (boxWidth - layout.textWidth) / 2)
        : (style.alignment === "right" ? Math.max(0, boxWidth - layout.textWidth) : 0);
    const drawLeft = localX1 + horizontalOffset + outlineWidth;
    const columns = layout.lines.length > 0 ? layout.lines : [""];
    const contentWidth = Math.max(1, layout.textWidth - (outlineWidth * 2));
    const columnAdvance = contentWidth / Math.max(1, columns.length);
    ctx.textAlign = "center";

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const glyphs = hasStyledSegments
        ? (layout.placements[columnIndex]?.segments ?? [])
        : Array.from(columns[columnIndex] ?? "").map((glyph) => ({
          text: glyph,
          style,
          measuredWidth: ctx.measureText(glyph || " ").width,
        }));
      const drawX = hasStyledSegments
        ? drawLeft + (layout.placements[columnIndex]?.x ?? 0)
        : drawLeft + (columnIndex * columnAdvance) + (columnAdvance / 2);
      for (let rowIndex = 0; rowIndex < glyphs.length; rowIndex += 1) {
        const segment = glyphs[rowIndex]!;
        if (!segment.text) continue;
        const drawY = drawTop + (rowIndex * layout.lineHeight);
        drawStyledSegment(
          ctx,
          segment,
          drawX,
          drawY,
          localX1,
          localY1,
          boxWidth,
          boxHeight,
          "center",
          "top",
          lineThickness,
          false,
        );
      }
    }

    ctx.restore();
    return;
  }

  if (style.alignment === "center") {
    ctx.textAlign = "center";
  } else if (style.alignment === "right") {
    ctx.textAlign = "right";
  } else {
    ctx.textAlign = "left";
  }

  const availableHeight = Math.max(1, innerBox[3] - innerBox[1]);
  const verticalGap = Math.max(0, availableHeight - layout.textHeight);
  const drawTop = localY1 + innerBox[1] + Math.max(0, verticalGap / 2);

  if (hasStyledSegments) {
    for (let index = 0; index < layout.placements.length; index += 1) {
      const placement = layout.placements[index]!;
      const lineY = drawTop + placement.y;
      const segments = placement.segments ?? [];
      let cursorX = localX1 + placement.x;
      if (style.alignment === "center") {
        cursorX += placement.availableWidth / 2 - placement.measuredWidth / 2;
      } else if (style.alignment === "right") {
        cursorX += placement.availableWidth - placement.measuredWidth;
      }
      segments.forEach((segment) => {
        drawStyledSegment(
          ctx,
          segment,
          cursorX,
          lineY,
          localX1,
          localY1,
          boxWidth,
          boxHeight,
          "left",
          "top",
          lineThickness,
          true,
        );
        cursorX += segment.measuredWidth;
      });
    }
    ctx.restore();
    return;
  }

  if (effectPreset.id !== "none" && effectIntensity > 0 && !effectPreset.shadowLayers?.length && effectPreset.supportsIntensity) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = "rgba(0, 0, 0, 0)";
    ctx.lineWidth = 0;
    const drawGhostLayer = (
      fill: string,
      opacity: number,
      blur: number,
      offsetX: number,
      offsetY: number,
    ) => {
      ctx.fillStyle = fill;
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
      ctx.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : "none";
      for (let index = 0; index < layout.placements.length; index += 1) {
        const placement = layout.placements[index]!;
        const lineY = drawTop + placement.y + offsetY;
        let drawX = localX1 + placement.x + offsetX;
        if (style.alignment === "center") {
          drawX = localX1 + placement.x + (placement.availableWidth / 2) + offsetX;
        } else if (style.alignment === "right") {
          drawX = localX1 + placement.x + placement.availableWidth + offsetX;
        }
        ctx.fillText(placement.text, drawX, lineY);
      }
    };

    switch (effectPreset.id) {
      case "balloon_smear": {
        const ghostLayers = Math.max(1, Math.round(effectPreset.ghostLayers * (0.55 + (effectIntensity * 0.75))));
        const offsetYStep = effectPreset.offsetYStep * (0.6 + (effectIntensity * 0.75));
        const offsetXAmplitude = effectPreset.offsetXAmplitude * (0.45 + (effectIntensity * 0.8));
        const blurStart = effectPreset.blurStart * (0.5 + (effectIntensity * 0.85));
        const blurStep = effectPreset.blurStep * (0.55 + (effectIntensity * 0.8));
        const opacityStart = Math.min(0.42, effectPreset.opacityStart * (0.7 + (effectIntensity * 0.55)));
        const opacityFalloff = Math.max(0.68, effectPreset.opacityFalloff - (effectIntensity * 0.06));
        for (let layerIndex = 0; layerIndex < ghostLayers; layerIndex += 1) {
          const layerOpacity = opacityStart * Math.pow(opacityFalloff, layerIndex);
          const offsetY = (layerIndex + 1) * offsetYStep;
          const blur = blurStart + (layerIndex * blurStep);
          ctx.fillStyle = effectPreset.fill;
          ctx.globalAlpha = Math.max(0, Math.min(1, layerOpacity));
          ctx.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : "none";
          for (let index = 0; index < layout.placements.length; index += 1) {
            const placement = layout.placements[index]!;
            const lineY = drawTop + placement.y + offsetY;
            const jitterX = Math.sin((layerIndex + 1) * 1.15 + index * 0.75) * offsetXAmplitude;
            let drawX = localX1 + placement.x + jitterX;
            if (style.alignment === "center") {
              drawX = localX1 + placement.x + (placement.availableWidth / 2) + jitterX;
            } else if (style.alignment === "right") {
              drawX = localX1 + placement.x + placement.availableWidth + jitterX;
            }
            ctx.fillText(placement.text, drawX, lineY);
          }
        }
        break;
      }
      case "ahnnn_peach":
      case "badump_soft":
      case "eheheh_whisper":
      case "smiles_outline":
      case "neon_woah":
      case "laugh_curve": {
        drawGhostLayer(effectPreset.fill, 0.12 * effectIntensity, 4 + (effectIntensity * 4), 0, 0);
        drawGhostLayer(effectPreset.fill, 0.08 * effectIntensity, 8 + (effectIntensity * 5), 0, 1.5 * effectIntensity);
        break;
      }
      case "smooch_jelly":
      case "blam_impact":
      case "thump_heavy":
      case "hah_pop":
      case "question_pop": {
        drawGhostLayer(effectPreset.fill, 0.24 * effectIntensity, 0, -2 * effectIntensity, 2 * effectIntensity);
        drawGhostLayer(effectPreset.fill, 0.14 * effectIntensity, 1.4 * effectIntensity, -4 * effectIntensity, 4 * effectIntensity);
        break;
      }
      case "tremble_brush":
      case "hoho_ink":
      case "shake_blur":
      case "scratch_noise":
      case "crack_ink":
      case "scream_scratch": {
        const passes = Math.max(3, Math.round(4 + effectIntensity * 3));
        for (let pass = 0; pass < passes; pass += 1) {
          const jitterX = Math.sin(pass * 1.9) * (1.2 + effectIntensity * 1.6);
          const jitterY = Math.cos(pass * 1.3) * (0.8 + effectIntensity * 1.2);
          drawGhostLayer(effectPreset.fill, 0.1 + (effectIntensity * 0.03), 0.6 + (effectIntensity * 0.5), jitterX, jitterY);
        }
        break;
      }
      case "slash_speed": {
        const passes = Math.max(4, Math.round(5 + effectIntensity * 4));
        for (let pass = 0; pass < passes; pass += 1) {
          drawGhostLayer(
            effectPreset.fill,
            0.08 + (effectIntensity * 0.02),
            1.8 + pass * 0.9,
            -4 - (pass * (1.8 + effectIntensity)),
            2 + pass * 1.4,
          );
        }
        break;
      }
      case "slap_scratch":
      case "dash_edge": {
        const passes = Math.max(3, Math.round(4 + effectIntensity * 3));
        for (let pass = 0; pass < passes; pass += 1) {
          drawGhostLayer(
            effectPreset.fill,
            0.07 + (effectIntensity * 0.02),
            0.8 + pass * 0.45,
            -2 - (pass * (1.2 + effectIntensity * 0.6)),
            1 + pass * 1.1,
          );
        }
        break;
      }
      case "drip_blue": {
        const passes = Math.max(3, Math.round(3 + effectIntensity * 3));
        for (let pass = 0; pass < passes; pass += 1) {
          drawGhostLayer(
            effectPreset.fill,
            0.06 + (effectIntensity * 0.02),
            1 + pass * 0.8,
            0,
            3 + pass * (2.2 + effectIntensity),
          );
        }
        break;
      }
      case "break_glitch":
      case "growl_moss":
      case "beep_outline":
      case "boom_comic":
      case "bang_chunk":
      case "flinch_outline":
      case "yawn_soft":
      default:
        break;
    }
    ctx.restore();
    ctx.font = buildCanvasFont(style, layout.fontSize);
    ctx.textBaseline = "top";
    ctx.strokeStyle = outlineColor;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(0, outlineWidth * 2);
    ctx.fillStyle = resolveTextFillStyle(ctx, style, localX1, localY1, boxWidth, boxHeight);
    ctx.shadowColor = "rgba(0, 0, 0, 0)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;
  }

  const drawManualShadowLayers = (
    layers: Array<{ fillCssValue: string; opacity: number; blur: number; offsetX: number; offsetY: number }>,
  ) => {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0)";
    ctx.lineWidth = 0;
    ctx.shadowColor = "rgba(0, 0, 0, 0)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    for (const layer of layers) {
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
      ctx.filter = layer.blur > 0 ? `blur(${layer.blur.toFixed(1)}px)` : "none";
      ctx.fillStyle = resolveCanvasFillStyle(
        ctx,
        {
          color: shadowFillStyleSource.color,
          fillCssValue: layer.fillCssValue,
          gradientEnabled: /gradient\(/i.test(layer.fillCssValue),
          gradientStartColor: shadowFillStyleSource.gradientStartColor,
          gradientEndColor: shadowFillStyleSource.gradientEndColor,
          gradientAngle: shadowFillStyleSource.gradientAngle,
        },
        localX1,
        localY1,
        boxWidth,
        boxHeight,
      );
      for (let index = 0; index < layout.placements.length; index += 1) {
        const placement = layout.placements[index]!;
        const lineY = drawTop + placement.y + layer.offsetY;
        let drawX = localX1 + placement.x + layer.offsetX;
        if (style.alignment === "center") {
          drawX = localX1 + placement.x + (placement.availableWidth / 2) + layer.offsetX;
        } else if (style.alignment === "right") {
          drawX = localX1 + placement.x + placement.availableWidth + layer.offsetX;
        }
        ctx.fillText(placement.text, drawX, lineY);
      }
    }
    ctx.restore();
    ctx.fillStyle = resolveTextFillStyle(ctx, style, localX1, localY1, boxWidth, boxHeight);
    ctx.globalAlpha = 1;
    ctx.filter = "none";
  };

  if (shadowEnabled) {
    const styleShadowLayers = style.shadowLayers?.length
      ? style.shadowLayers
      : [
        {
          fillCssValue: shadowFillStyleSource.fillCssValue || shadowColor,
          opacity: shadowOpacity,
          blur: shadowBlur,
          offsetX: shadowOffsetX,
          offsetY: shadowOffsetY,
        },
      ];
    drawManualShadowLayers(styleShadowLayers.map((layer) => ({
      ...layer,
      offsetX: layer.offsetX * 1.35,
      offsetY: layer.offsetY * 1.35,
    })));
  }

  for (let index = 0; index < layout.placements.length; index += 1) {
    const placement = layout.placements[index]!;
    const lineY = drawTop + placement.y;
    let drawX = localX1 + placement.x;
    if (style.alignment === "center") {
      drawX = localX1 + placement.x + (placement.availableWidth / 2);
    } else if (style.alignment === "right") {
      drawX = localX1 + placement.x + placement.availableWidth;
    }
    if (outlineWidth > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeText(placement.text, drawX, lineY);
    }
    ctx.globalAlpha = textOpacity;
    ctx.fillText(placement.text, drawX, lineY);

    if (style.underline && placement.text.trim().length > 0) {
      const underlineY = lineY + layout.lineHeight - Math.max(1, Math.round(layout.fontSize * 0.16));
      let underlineStartX = drawX;
      if (style.alignment === "center") {
        underlineStartX -= placement.measuredWidth / 2;
      } else if (style.alignment === "right") {
        underlineStartX -= placement.measuredWidth;
      }
      ctx.globalAlpha = textOpacity;
      ctx.fillRect(underlineStartX, underlineY, placement.measuredWidth, lineThickness);
    }
  }

  ctx.restore();
};
