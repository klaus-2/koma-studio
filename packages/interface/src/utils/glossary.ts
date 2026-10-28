import { isRecord } from "./guards";

export interface GlossaryTerm {
  source: string;
  target: string;
}

const GLOSSARY_MAX_TERMS = 200;
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
    result.push({ source, target });
    if (result.length >= GLOSSARY_MAX_TERMS) break;
  }
  return result;
};
