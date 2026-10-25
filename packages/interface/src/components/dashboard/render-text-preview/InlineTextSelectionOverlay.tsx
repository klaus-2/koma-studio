import React from 'react';
import type { InlineEditorLineBox } from '../../../utils/inlineEditorLayout';

interface InlineTextSelectionOverlayProps {
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly lines: readonly InlineEditorLineBox[];
  readonly caretColor: string;
}

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, value));

const InlineTextSelectionOverlay = ({
  selectionStart,
  selectionEnd,
  lines,
  caretColor,
}: InlineTextSelectionOverlayProps) => {
  if (lines.length === 0) return null;

  if (selectionStart !== selectionEnd) {
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    return (
      <div className="koma-render-inline-selection" aria-hidden="true">
        {lines.map((line, index) => {
          const lineStart = Math.max(start, line.start);
          const lineEnd = Math.min(end, line.end);
          if (lineEnd <= lineStart) return null;
          const length = Math.max(1, line.end - line.start);
          const left = line.left + line.width * ((lineStart - line.start) / length);
          const width = line.width * ((lineEnd - lineStart) / length);
          return (
            <span
              key={`selection-${index}`}
              className="koma-render-inline-selection__range"
              style={{
                left: `${clamp01(left) * 100}%`,
                top: `${line.top * 100}%`,
                width: `${Math.max(0.0005, width) * 100}%`,
                height: `${line.height * 100}%`,
              }}
            />
          );
        })}
      </div>
    );
  }

  const caretLine =
    lines.find(
      (line) => selectionStart >= line.start && selectionStart <= line.end,
    )
    ?? lines.find((line) => selectionStart < line.start)
    ?? lines[lines.length - 1];
  if (!caretLine) return null;

  const length = Math.max(1, caretLine.end - caretLine.start);
  const fraction = clamp01((selectionStart - caretLine.start) / length);

  return (
    <div className="koma-render-inline-selection" aria-hidden="true">
      <span
        className="koma-render-inline-selection__caret"
        style={{
          left: `${clamp01(caretLine.left + caretLine.width * fraction) * 100}%`,
          top: `${caretLine.top * 100}%`,
          height: `${caretLine.height * 100}%`,
          background: caretColor,
        }}
      />
    </div>
  );
};

export default React.memo(InlineTextSelectionOverlay);
