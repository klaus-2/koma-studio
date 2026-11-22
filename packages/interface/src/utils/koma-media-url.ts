import { desktopBridge } from '../lib/desktop-bridge';

export const KOMA_IMAGE_SCHEME = 'koma-image';

const isAlphanumericByte = (byte: number): boolean =>
  (byte >= 0x30 && byte <= 0x39) ||
  (byte >= 0x41 && byte <= 0x5a) ||
  (byte >= 0x61 && byte <= 0x7a);

export const percentEncodeNonAlphanumeric = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let encoded = '';
  for (const byte of bytes) {
    encoded += isAlphanumericByte(byte)
      ? String.fromCharCode(byte)
      : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return encoded;
};

export const buildKomaMediaUrl = (
  scheme: string,
  path: string,
  windows: boolean,
): string =>
  windows
    ? `http://${scheme}.localhost/${percentEncodeNonAlphanumeric(path)}`
    : `${scheme}://localhost/${percentEncodeNonAlphanumeric(path)}`;

export const isWindowsPlatform = (): boolean =>
  typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows');

export const buildKomaImagePageUrl = (path: string): string =>
  buildKomaMediaUrl(KOMA_IMAGE_SCHEME, path, isWindowsPlatform());

export const hasKomaImageProtocolBridge = (): boolean =>
  desktopBridge.desktop?.images.allowPaths !== undefined;
