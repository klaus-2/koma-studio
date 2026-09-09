import { DEFAULT_APP_LOCALE, normalizeLocale, resolveLocaleChain, type AppLocale } from "../i18n/config";
import { legalContentEn } from "./legalContent.en";
import { legalContentAr } from "./legalContent.ar";
import { legalContentDe } from "./legalContent.de";
import { legalContentEs } from "./legalContent.es";
import { legalContentFr } from "./legalContent.fr";
import { legalContentHi } from "./legalContent.hi";
import { legalContentIt } from "./legalContent.it";
import { legalContentJa } from "./legalContent.ja";
import { legalContentKo } from "./legalContent.ko";
import { legalContentPtBR } from "./legalContent.ptBR";
import { legalContentPt } from "./legalContent.pt";
import { legalContentRu } from "./legalContent.ru";
import type { LegalContentBundle, LegalDocumentId, LegalDocumentSection } from "./legalContent.types";
import { legalContentZh } from "./legalContent.zh";
import { legalContentZhTw } from "./legalContent.zhTW";

export type { LegalDocumentId, LegalDocumentSection } from "./legalContent.types";

export interface LegalDocument {
  id: LegalDocumentId;
  eyebrow: string;
  title: string;
  summary: string;
  lastUpdated: string;
  version: string;
  highlights: string[];
  sections: LegalDocumentSection[];
}

export interface RegistrationLegalAcceptancePayload {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
  cookiesVersion: string;
  contentVersion: string;
}

const LEGAL_VERSION = "2026-03-10";

const LEGAL_CONTENT_BUNDLES = {
  ar: legalContentAr,
  de: legalContentDe,
  en: legalContentEn,
  es: legalContentEs,
  fr: legalContentFr,
  hi: legalContentHi,
  it: legalContentIt,
  ja: legalContentJa,
  ko: legalContentKo,
  pt: legalContentPt,
  "pt-br": legalContentPtBR,
  ru: legalContentRu,
  zh: legalContentZh,
  "zh-tw": legalContentZhTw,
} satisfies Record<AppLocale, LegalContentBundle>;

export const LEGAL_DOCUMENT_VERSIONS = {
  terms: LEGAL_VERSION,
  privacy: LEGAL_VERSION,
  cookies: LEGAL_VERSION,
  content: LEGAL_VERSION,
} as const;

const DEFAULT_WEBSITE_URL = "https://komastudio.com";

const normalizeBaseUrl = (value: string | undefined): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_WEBSITE_URL;
  }

  return trimmed.replace(/\/+$/, "");
};

const createSupportUrl = (value: string | undefined): string => {
  const baseUrl = normalizeBaseUrl(value);
  if (/\/support$/i.test(baseUrl)) {
    return baseUrl;
  }

  return `${baseUrl}/support`;
};

export const LEGAL_WEBSITE_URL = normalizeBaseUrl(import.meta.env.VITE_PROJECT_WEBSITE_URL as string | undefined);
export const LEGAL_SUPPORT_URL = createSupportUrl(import.meta.env.VITE_PROJECT_WEBSITE_URL as string | undefined);

export const LEGAL_DOCUMENT_IDS: LegalDocumentId[] = ["terms", "privacy", "cookies", "content"];

const resolveLegalBundle = (locale: AppLocale | string): LegalContentBundle => {
  const resolvedLocale = typeof locale === "string" ? normalizeLocale(locale) : locale;
  const chain = resolveLocaleChain(resolvedLocale ?? DEFAULT_APP_LOCALE);

  for (const nextLocale of chain) {
    const bundle = LEGAL_CONTENT_BUNDLES[nextLocale];
    if (bundle) {
      return bundle;
    }
  }

  return LEGAL_CONTENT_BUNDLES[DEFAULT_APP_LOCALE];
};

const interpolate = (value: string): string =>
  value
    .replace(/\{supportUrl\}/g, LEGAL_SUPPORT_URL)
    .replace(/\{websiteUrl\}/g, LEGAL_WEBSITE_URL);

const mapSection = (section: { title: string; paragraphs: string[]; bullets?: string[] }): LegalDocumentSection => ({
  title: interpolate(section.title),
  paragraphs: section.paragraphs.map(interpolate),
  bullets: section.bullets?.map(interpolate),
});

export const createRegistrationLegalAcceptance = (): RegistrationLegalAcceptancePayload => ({
  termsAccepted: true,
  privacyAccepted: true,
  termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
  privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
  cookiesVersion: LEGAL_DOCUMENT_VERSIONS.cookies,
  contentVersion: LEGAL_DOCUMENT_VERSIONS.content,
});

export const getLegalDocuments = (locale: AppLocale | string): Record<LegalDocumentId, LegalDocument> => {
  const bundle = resolveLegalBundle(locale);

  return {
    terms: {
      id: "terms",
      eyebrow: bundle.documents.terms.eyebrow,
      title: bundle.documents.terms.title,
      summary: bundle.documents.terms.summary,
      lastUpdated: bundle.releaseDate,
      version: LEGAL_DOCUMENT_VERSIONS.terms,
      highlights: bundle.documents.terms.highlights.map(interpolate),
      sections: bundle.documents.terms.sections.map(mapSection),
    },
    privacy: {
      id: "privacy",
      eyebrow: bundle.documents.privacy.eyebrow,
      title: bundle.documents.privacy.title,
      summary: bundle.documents.privacy.summary,
      lastUpdated: bundle.releaseDate,
      version: LEGAL_DOCUMENT_VERSIONS.privacy,
      highlights: bundle.documents.privacy.highlights.map(interpolate),
      sections: bundle.documents.privacy.sections.map(mapSection),
    },
    cookies: {
      id: "cookies",
      eyebrow: bundle.documents.cookies.eyebrow,
      title: bundle.documents.cookies.title,
      summary: bundle.documents.cookies.summary,
      lastUpdated: bundle.releaseDate,
      version: LEGAL_DOCUMENT_VERSIONS.cookies,
      highlights: bundle.documents.cookies.highlights.map(interpolate),
      sections: bundle.documents.cookies.sections.map(mapSection),
    },
    content: {
      id: "content",
      eyebrow: bundle.documents.content.eyebrow,
      title: bundle.documents.content.title,
      summary: bundle.documents.content.summary,
      lastUpdated: bundle.releaseDate,
      version: LEGAL_DOCUMENT_VERSIONS.content,
      highlights: bundle.documents.content.highlights.map(interpolate),
      sections: bundle.documents.content.sections.map(mapSection),
    },
  };
};
