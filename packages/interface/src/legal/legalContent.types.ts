export type LegalDocumentId = "terms" | "privacy" | "cookies" | "content";

export interface LegalDocumentSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocumentContent {
  eyebrow: string;
  title: string;
  summary: string;
  highlights: string[];
  sections: LegalDocumentSection[];
}

export interface LegalContentBundle {
  releaseDate: string;
  documents: Record<LegalDocumentId, LegalDocumentContent>;
}
