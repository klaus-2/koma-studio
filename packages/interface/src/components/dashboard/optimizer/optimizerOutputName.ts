import type { RawOutputFormat } from '../../../types';

const getExtension = (
  format: RawOutputFormat,
): string => (format === 'jpeg' ? 'jpg' : format);

const sanitizeStem = (fileName: string): string =>
  fileName
    .replace(/\.[^.]+$/u, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]+/g, '-');

export const buildOutputName = (
  fileName: string,
  format: RawOutputFormat,
  pattern: string,
  index: number,
): string => {
  const stem = sanitizeStem(fileName);
  const extension = getExtension(format);
  const paddedIndex = String(index + 1).padStart(3, '0');

  const resolved = pattern
    .replace(/\{name\}/g, stem)
    .replace(/\{index\}/g, paddedIndex)
    .replace(/\{ext\}/g, extension);

  return `${resolved.trim() || stem}.${extension}`;
};
