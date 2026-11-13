import { isRecord } from "./guards";

export interface GlossaryTerm {
  source: string;
  target: string;
  never_translate: boolean;
}

export const GLOSSARY_MAX_TERMS = 200;
const GLOSSARY_SOURCE_MAX_CHARS = 120;
const GLOSSARY_TARGET_MAX_CHARS = 240;

export const clampGlossary = (terms: unknown): GlossaryTerm[] => {
  if (!Array.isArray(terms)) {
    return [];
  }
  const entries: unknown[] = terms;
  const seen = new Set<string>();
  const result: GlossaryTerm[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const source = String(entry.source ?? "")
      .trim()
      .slice(0, GLOSSARY_SOURCE_MAX_CHARS);
    const target = String(entry.target ?? "")
      .trim()
      .slice(0, GLOSSARY_TARGET_MAX_CHARS);
    if (!source || !target || seen.has(source)) continue;
    seen.add(source);
    result.push({
      source,
      target,
      never_translate: entry.never_translate === true,
    });
    if (result.length >= GLOSSARY_MAX_TERMS) break;
  }
  return result;
};

/**
 * Merge a work's glossary over the global one for a single request: work terms
 * win on NFKC-duplicate sources, then the merged list is truncated to `clamp`
 * entries. Pure — neither input is mutated.
 */
export const mergeWorkGlossary = (
  globalTerms: GlossaryTerm[],
  workTerms: GlossaryTerm[],
  clamp: number,
): GlossaryTerm[] => {
  const normalize = (term: GlossaryTerm): GlossaryTerm => ({
    source: term.source.trim().slice(0, GLOSSARY_SOURCE_MAX_CHARS),
    target: term.target.trim().slice(0, GLOSSARY_TARGET_MAX_CHARS),
    never_translate: term.never_translate === true,
  });
  const merged: GlossaryTerm[] = [];
  const seen = new Set<string>();
  for (const term of [...workTerms, ...globalTerms]) {
    const normalized = normalize(term);
    if (!normalized.source || !normalized.target) continue;
    const key = normalized.source.normalize("NFKC");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }
  return merged.slice(0, Math.max(0, clamp));
};
