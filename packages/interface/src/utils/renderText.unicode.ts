export interface TextGrapheme {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

const graphemeSegmenter = new Intl.Segmenter("und", {
  granularity: "grapheme",
});

export const segmentText = (text: string): TextGrapheme[] =>
  Array.from(graphemeSegmenter.segment(text), ({ segment, index }) => ({
    text: segment,
    start: index,
    end: index + segment.length,
  }));

export const splitGraphemes = (text: string): string[] =>
  Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);

export const isParagraphBreak = (text: string): boolean =>
  text === "\n" || text === "\r" || text === "\r\n";

export const isBreakableWhitespace = (text: string): boolean =>
  /^[\t\f\v ]+$/u.test(text);

export const normalizeLineEndings = (text: string): string =>
  text.replace(/\r\n?/gu, "\n");
