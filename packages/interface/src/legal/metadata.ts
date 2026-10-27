import type { LegalDocumentId } from "./legalContent.types";

const LEGAL_VERSION = "2026-03-10";

export const LEGAL_DOCUMENT_IDS: LegalDocumentId[] = [
  "terms",
  "privacy",
  "cookies",
  "content",
];

export const LEGAL_DOCUMENT_VERSIONS = {
  terms: LEGAL_VERSION,
  privacy: LEGAL_VERSION,
  cookies: LEGAL_VERSION,
  content: LEGAL_VERSION,
} as const;
