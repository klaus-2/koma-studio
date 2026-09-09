import type { Metadata } from "next";
import type { FaqItem } from "@/types";
import {
  SITE_DESCRIPTION,
  SITE_GITHUB_URL,
  SITE_LICENSE_URL,
  SITE_NAME,
  SITE_SAME_AS,
  SITE_SUPPORT_EMAIL,
  SITE_URL,
} from "@/lib/site";

type MetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

type ItemListEntry = {
  name: string;
  path: string;
};

export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
}: MetadataInput): Metadata {
  const canonical = new URL(path, SITE_URL).toString();

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function toSectionId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, SITE_URL).toString(),
    })),
  };
}

export function buildFaqJsonLd(faqs: FaqItem[]) {
  if (!faqs.length) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildWebPageJsonLd({
  title,
  description,
  path,
}: MetadataInput) {
  const url = new URL(path, SITE_URL).toString();
  const modifiedAt = new Date().toISOString();

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url,
    inLanguage: "en-US",
    dateModified: modifiedAt,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`,
      sameAs: [...SITE_SAME_AS],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE_SUPPORT_EMAIL,
      },
    },
    about: {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Windows, macOS, Linux",
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      codeRepository: SITE_GITHUB_URL,
      license: SITE_LICENSE_URL,
      isAccessibleForFree: true,
    },
  };
}

export function buildArticleJsonLd({
  title,
  description,
  path,
}: MetadataInput) {
  const url = new URL(path, SITE_URL).toString();
  const modifiedAt = new Date().toISOString();

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    dateModified: modifiedAt,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: [...SITE_SAME_AS],
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`,
      sameAs: [...SITE_SAME_AS],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE_SUPPORT_EMAIL,
      },
    },
    mainEntityOfPage: url,
    inLanguage: "en-US",
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`,
      sameAs: [...SITE_SAME_AS],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE_SUPPORT_EMAIL,
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/compare`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildItemListJsonLd(name: string, items: ItemListEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: new URL(item.path, SITE_URL).toString(),
    })),
  };
}
