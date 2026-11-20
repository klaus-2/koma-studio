import { removeFileExtension, sanitizeArchivePathToken } from './dashboard.utils';

/**
 * Export file-name pattern resolution.
 *
 * Pure module: resolves the user pattern tokens
 * `{obra} {capitulo} {pagina} {idioma} {nome} {ext}` against one page's
 * context. Every token value derived from user input goes through the
 * existing `sanitizeArchivePathToken` (reused, never duplicated). Unknown
 * tokens stay literal; an empty/whitespace pattern means "keep the legacy
 * names" — the caller falls back to the exact pre-pattern behavior.
 */

/** Structural view of the works registry needed for `{obra}` resolution. */
export interface ExportNamingWorkRecord {
  readonly name: string;
  readonly chapterLabels: readonly string[];
}

export interface ExportNamingContext {
  /** Work display name owning the page's chapter, or null when unlinked. */
  obra: string | null;
  /** Chapter label carried by the page, or null when unassigned. */
  capitulo: string | null;
  /** Target language tag (e.g. 'pt-br'), or null when unknown. */
  idioma: string | null;
  /** Original file stem without extension. */
  nome: string;
  /** Page number (1-based); rendered zero-padded to 3 digits. */
  pagina: number;
  /** File or bundle extension without the leading dot. */
  ext: string;
}

const FALLBACK_OBRA = 'koma-studio';
const FALLBACK_CAPITULO = 'chapter';
const FALLBACK_IDIOMA = 'default';

export const isExportNamingPatternEmpty = (pattern: string): boolean =>
  pattern.trim().length === 0;

/**
 * Chapter label → owning work display name. A chapter belongs to at most one
 * work (works-store contract), so the first match wins; no link → null and
 * the caller falls back to `FALLBACK_OBRA`.
 */
export const resolveWorkNameForChapter = (
  works: readonly ExportNamingWorkRecord[],
  chapterLabel: string | null,
): string | null => {
  if (chapterLabel === null) {
    return null;
  }
  const owner = works.find((work) => work.chapterLabels.includes(chapterLabel));
  return owner?.name ?? null;
};

/**
 * Sanitizes a user-derived token value through `sanitizeArchivePathToken`
 * without letting the sanitizer's own 'item' fallback mask the token's
 * contract fallback: an empty/whitespace raw value (or one that sanitizes to
 * nothing) resolves to the token's deterministic fallback instead.
 */
const sanitizeOrFallback = (
  raw: string | null | undefined,
  fallback: string,
): string => {
  if (raw === null || raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const sanitized = sanitizeArchivePathToken(raw);
  return sanitized === 'item' ? fallback : sanitized;
};

/** Resolves one token to its sanitized value. */
const resolveToken = (token: string, context: ExportNamingContext): string => {
  switch (token) {
    case 'obra':
      return sanitizeOrFallback(context.obra, FALLBACK_OBRA);
    case 'capitulo':
      return sanitizeOrFallback(context.capitulo, FALLBACK_CAPITULO);
    case 'pagina':
      return String(Math.max(1, Math.round(context.pagina))).padStart(3, '0');
    case 'idioma':
      return sanitizeOrFallback(context.idioma, FALLBACK_IDIOMA);
    case 'nome':
      return sanitizeArchivePathToken(context.nome);
    case 'ext':
      return context.ext;
    default:
      // Unknown token stays literal.
      return `{${token}}`;
  }
};

/**
 * Applies the pattern to one page context. Empty/whitespace pattern → `null`
 * so the caller keeps its legacy name untouched. The composed result is
 * sanitized per '/'-segment (token values are sanitized already, but the
 * literal text of the pattern is user input too): backslashes become
 * separators, '.'/'..' traversal segments are dropped, and every segment
 * goes through `sanitizeArchivePathToken` — so `../dump/{nome}` and
 * `{pagina}\{nome}` can neither traverse out of the bundle nor smuggle
 * separator characters into archive entries.
 */
export const buildExportName = (
  pattern: string,
  context: ExportNamingContext,
): string | null => {
  if (isExportNamingPatternEmpty(pattern)) {
    return null;
  }
  const composed = pattern.replace(
    /\{([a-zA-Z0-9_]+)\}/gu,
    (_match: string, token: string): string => resolveToken(token, context),
  );
  const segments = composed.split(/[\\/]+/);
  const sanitizedSegments: string[] = [];
  for (const segment of segments) {
    const sanitized = sanitizeArchivePathToken(segment);
    if (sanitized.length === 0 || sanitized === '.' || sanitized === '..') {
      continue;
    }
    sanitizedSegments.push(sanitized);
  }
  if (sanitizedSegments.length === 0) {
    return null;
  }
  return sanitizedSegments.join('/');
};

/** Appends `.{ext}` unless the name already ends with it (case-insensitive). */
export const ensureExportExtension = (name: string, ext: string): string => {
  const loweredExt = ext.toLowerCase();
  return name.toLowerCase().endsWith(`.${loweredExt}`)
    ? name
    : `${name}.${ext}`;
};

/**
 * Bundle file name from the pattern: the representative page is the first
 * ordered entry (caller passes its context with `pagina = 1` and the bundle
 * extension). The bundle extension is appended when the resolved name does
 * not already end with it. Empty pattern → `null` (legacy name). The bundle
 * is a single file name: folder separators from the pattern are flattened
 * and download-hostile characters (`:` `?` `|` …) are replaced before the
 * browser mangles them; literal spaces are preserved for the user.
 */
export const buildBundleExportFileName = (
  pattern: string,
  context: ExportNamingContext,
): string | null => {
  const resolved = buildExportName(pattern, context);
  if (resolved === null) {
    return null;
  }
  const flatName = resolved.replace(/[\\/:*?"<>|]/g, '-').trim();
  return ensureExportExtension(flatName, context.ext);
};

/** Builds the naming context of one ordered page entry. */
export const buildPageNamingContext = (args: {
  /** Full page file name (the stem is derived here). */
  fileName: string;
  chapterLabel: string | null;
  works: readonly ExportNamingWorkRecord[];
  targetLanguage: string | null;
  pageIndex: number;
  ext: string;
}): ExportNamingContext => ({
  obra: resolveWorkNameForChapter(args.works, args.chapterLabel),
  // Normalize the optional store fields to the context contract (null, not
  // undefined) so every consumer can narrow with `=== null`.
  capitulo: args.chapterLabel ?? null,
  idioma: args.targetLanguage ?? null,
  nome: removeFileExtension(args.fileName),
  pagina: args.pageIndex + 1,
  ext: args.ext,
});
