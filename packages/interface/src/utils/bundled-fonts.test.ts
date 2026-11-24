import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { BUNDLED_FONT_FACES, BUNDLED_FONT_FAMILIES, type BundledFontFace } from '@/constants/bundled-fonts';
import { buildFontCatalog } from './font-catalog';
import { registerBundledFontFaces } from './bundled-fonts';

const fontsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

const fontFiles = readdirSync(fontsDir, { recursive: true, encoding: 'utf8' })
  .filter((entry) => /\.(ttf|otf)$/i.test(entry))
  .map((entry) => entry.split(path.sep).join('/'));

const readNameRecord = (bytes: Buffer, nameId: number): string | null => {
  const numTables = bytes.readUInt16BE(4);
  for (let index = 0; index < numTables; index += 1) {
    const record = 12 + index * 16;
    if (bytes.toString('latin1', record, record + 4) !== 'name') continue;
    const tableOffset = bytes.readUInt32BE(record + 8);
    const count = bytes.readUInt16BE(tableOffset + 2);
    const stringsOffset = tableOffset + bytes.readUInt16BE(tableOffset + 4);
    for (let entry = 0; entry < count; entry += 1) {
      const at = tableOffset + 6 + entry * 12;
      const platformId = bytes.readUInt16BE(at);
      if (bytes.readUInt16BE(at + 6) !== nameId || platformId !== 3) continue;
      const length = bytes.readUInt16BE(at + 8);
      const start = stringsOffset + bytes.readUInt16BE(at + 10);
      return bytes.subarray(start, start + length).swap16().toString('utf16le');
    }
  }
  return null;
};

const embeddedFamily = (file: string): string | null => {
  const bytes = readFileSync(path.join(fontsDir, file));
  return readNameRecord(Buffer.from(bytes), 16) ?? readNameRecord(Buffer.from(bytes), 1);
};

const assetPathOf = (entry: BundledFontFace): string | undefined =>
  fontFiles.find((file) => entry.url.endsWith(path.posix.basename(file)) || entry.url.includes(file));

describe('bundled fonts', () => {
  it('lists every font file shipped under assets/fonts exactly once', () => {
    expect(BUNDLED_FONT_FACES).toHaveLength(fontFiles.length);
    expect(new Set(BUNDLED_FONT_FACES.map((entry) => entry.url)).size).toBe(fontFiles.length);
  });

  it('ships a license next to every bundled font', () => {
    for (const file of fontFiles) {
      const dir = path.join(fontsDir, path.dirname(file));
      const hasLicense = ['OFL.txt', 'LICENSE.txt'].some((name) => existsSync(path.join(dir, name)));
      expect(hasLicense, file).toBe(true);
    }
  });

  it('registers each face under the family name embedded in its file', () => {
    for (const entry of BUNDLED_FONT_FACES) {
      const file = assetPathOf(entry);
      expect(file, entry.url).toBeDefined();
      if (file) expect(embeddedFamily(file), file).toBe(entry.family);
    }
  });

  it('adds one face per entry with its weight and style', () => {
    const added: BundledFontFace[] = [];
    const count = registerBundledFontFaces({ add: (face: BundledFontFace) => added.push(face) }, (entry) => entry);
    expect(count).toBe(BUNDLED_FONT_FACES.length);
    expect(added).toEqual(BUNDLED_FONT_FACES);
    expect(added.filter((entry) => entry.family === 'Comic Neue').map((entry) => `${entry.weight}/${entry.style}`))
      .toEqual(['400/normal', '700/normal', '400/italic', '700/italic']);
  });

  it('offers every bundled family in the font picker without duplicates', () => {
    const catalog = buildFontCatalog({ osFamilies: ['Comic Neue'], customFamilies: [], fallbackFamilies: [] });
    for (const family of BUNDLED_FONT_FAMILIES) {
      expect(catalog.filter((entry) => entry.toLowerCase() === family.toLowerCase())).toHaveLength(1);
    }
  });
});
