import { LEGAL_DOCUMENT_IDS, getLegalDocuments, type LegalDocumentId } from "./legalDocuments";

export type LegalRoutePath = "legal-terms" | "legal-privacy" | "legal-cookies" | "legal-content";

export const LEGAL_ROUTE_BY_DOCUMENT: Record<LegalDocumentId, LegalRoutePath> = {
  terms: "legal-terms",
  privacy: "legal-privacy",
  cookies: "legal-cookies",
  content: "legal-content",
};

export const LEGAL_DOCUMENT_BY_ROUTE: Record<LegalRoutePath, LegalDocumentId> = {
  "legal-terms": "terms",
  "legal-privacy": "privacy",
  "legal-cookies": "cookies",
  "legal-content": "content",
};

export const LEGAL_ROUTE_PATHS = Object.keys(LEGAL_DOCUMENT_BY_ROUTE) as LegalRoutePath[];

export const isLegalRoutePath = (value: string): value is LegalRoutePath =>
  LEGAL_ROUTE_PATHS.includes(value as LegalRoutePath);

export const getLegalDocumentIdForRoute = (route: string): LegalDocumentId | null =>
  isLegalRoutePath(route) ? LEGAL_DOCUMENT_BY_ROUTE[route] : null;

export const getLegalRouteForDocument = (documentId: LegalDocumentId): LegalRoutePath =>
  LEGAL_ROUTE_BY_DOCUMENT[documentId];

export const navigateToLegalDocument = (documentId: LegalDocumentId): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.location.hash = `/${getLegalRouteForDocument(documentId)}`;
};

export const getOrderedLegalDocuments = (locale: string) =>
  LEGAL_DOCUMENT_IDS.map((documentId) => getLegalDocuments(locale)[documentId]);
