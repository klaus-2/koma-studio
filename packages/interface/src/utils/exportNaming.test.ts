import { describe, expect, it } from 'vitest';

import {
  buildBundleExportFileName,
  buildExportName,
  buildPageNamingContext,
  isExportNamingPatternEmpty,
  resolveWorkNameForChapter,
  type ExportNamingWorkRecord,
} from '@/utils/exportNaming';

const works: ExportNamingWorkRecord[] = [
  { name: 'Minha Obra', chapterLabels: ['Chapter 01.cbz'] },
  { name: 'Outra', chapterLabels: [] },
];

const basePageArgs = {
  fileName: 'Page 01.png',
  chapterLabel: 'Chapter 01.cbz' as string | null,
  works,
  targetLanguage: 'pt-br' as string | null,
  pageIndex: 0,
  ext: 'png',
};

const context = buildPageNamingContext(basePageArgs);

describe('resolveWorkNameForChapter', () => {
  it('returns the owning work name for a linked chapter label', () => {
    expect(resolveWorkNameForChapter(works, 'Chapter 01.cbz')).toBe('Minha Obra');
  });

  it('returns null for an unlinked label and for a null label', () => {
    expect(resolveWorkNameForChapter(works, 'unlinked.cbz')).toBeNull();
    expect(resolveWorkNameForChapter(works, null)).toBeNull();
  });
});

describe('isExportNamingPatternEmpty', () => {
  it('treats whitespace-only patterns as empty', () => {
    expect(isExportNamingPatternEmpty('')).toBe(true);
    expect(isExportNamingPatternEmpty('   ')).toBe(true);
    expect(isExportNamingPatternEmpty('{obra}')).toBe(false);
  });
});

describe('buildExportName', () => {
  it('returns null for an empty pattern (legacy naming)', () => {
    expect(buildExportName('', context)).toBeNull();
    expect(buildExportName('   ', context)).toBeNull();
  });

  it('resolves every token with the existing sanitize rules', () => {
    expect(buildExportName('{obra}/{capitulo}/{pagina}', context)).toBe(
      'minha-obra/chapter-01.cbz/001',
    );
    expect(buildExportName('{idioma}-{nome}-{ext}', context)).toBe(
      'pt-br-page-01-png',
    );
  });

  it('keeps unknown tokens literal and sanitizes the composed result', () => {
    // The literal text of the pattern is user input too: the composed name is
    // per-segment sanitized (spaces → '-', trimmed) beyond the token values.
    expect(buildExportName('{obra}-nope{x}-', context)).toBe('minha-obra-nope{x}');
  });

  it('drops traversal segments from the composed path', () => {
    expect(buildExportName('../dump/{nome}', context)).toBe('dump/page-01');
    expect(buildExportName('{pagina}\\{nome}', context)).toBe('001/page-01');
  });

  it('pads {pagina} beyond 999 correctly', () => {
    const later = buildPageNamingContext({
      ...basePageArgs,
      pageIndex: 1234,
    });
    expect(buildExportName('{pagina}', later)).toBe('1235');
  });

  it('falls back deterministically for unlinked pages', () => {
    const unlinked = buildPageNamingContext({
      ...basePageArgs,
      chapterLabel: null,
      works: [],
      targetLanguage: null,
      pageIndex: 0,
    });
    expect(buildExportName('{obra} {capitulo} {idioma}', unlinked)).toBe(
      'koma-studio-chapter-default',
    );
  });

  it('falls back to the sanitize item when {nome} is empty', () => {
    const nameless = buildPageNamingContext({
      ...basePageArgs,
      fileName: '.png',
    });
    expect(buildExportName('{nome}', nameless)).toBe('item');
  });
});

describe('buildBundleExportFileName', () => {
  const bundleContext = buildPageNamingContext({
    ...basePageArgs,
    pageIndex: 0,
    ext: 'zip',
  });

  it('returns null for an empty pattern (legacy bundle name)', () => {
    expect(buildBundleExportFileName('', bundleContext)).toBeNull();
  });

  it('appends the bundle extension when the pattern lacks {ext}', () => {
    expect(
      buildBundleExportFileName('{obra} {capitulo}', bundleContext),
    ).toBe('minha-obra-chapter-01.cbz.zip');
  });

  it('flattens folder separators and download-hostile characters in the bundle name', () => {
    expect(
      buildBundleExportFileName('{obra}:{capitulo}\\{pagina}', bundleContext),
    ).toBe('minha-obra-chapter-01.cbz-001.zip');
  });

  it('does not duplicate the extension when the pattern ends with it', () => {
    expect(
      buildBundleExportFileName('{obra}-{pagina}.{ext}', bundleContext),
    ).toBe('minha-obra-001.zip');
  });

  it('covers the {ext}-only pattern edge deterministically', () => {
    expect(buildBundleExportFileName('{ext}', bundleContext)).toBe('zip.zip');
  });

  it('does not append when the pattern already ends with the bundle extension', () => {
    expect(
      buildBundleExportFileName('{obra}-extra.zip', bundleContext),
    ).toBe('minha-obra-extra.zip');
  });
});
