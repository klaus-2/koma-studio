import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { seoPageMap, seoPages } from "@/content/seo-pages";
import { comparePageMap, comparePages } from "@/content/compare-pages";
import { SeoPageTemplate } from "@/components/SeoPageTemplate";
import { ComparePageTemplate } from "@/components/ComparePageTemplate";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildItemListJsonLd,
  buildPageMetadata,
  buildWebPageJsonLd,
} from "@/lib/seo";

type Params = { slug: string };

export function generateStaticParams() {
  return [...seoPages, ...comparePages].map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return params.then(({ slug }) => {
    const seoPage = seoPageMap.get(slug);
    if (seoPage) {
      return buildPageMetadata({
        title: seoPage.metaTitle,
        description: seoPage.metaDescription,
        path: `/${slug}`,
        keywords: seoPage.keywords,
      });
    }

    const comparePage = comparePageMap.get(slug);
    if (comparePage) {
      return buildPageMetadata({
        title: comparePage.metaTitle,
        description: comparePage.metaDescription,
        path: `/${slug}`,
        keywords: comparePage.keywords,
      });
    }

    return {};
  });
}

export default async function SlugPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const seoPage = seoPageMap.get(slug);
  if (seoPage) {
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: seoPage.title, path: `/${seoPage.slug}` },
    ]);
    const faqJsonLd = buildFaqJsonLd(seoPage.faqs);
    const articleJsonLd = buildArticleJsonLd({
      title: seoPage.metaTitle,
      description: seoPage.metaDescription,
      path: `/${seoPage.slug}`,
      keywords: seoPage.keywords,
    });
    const webPageJsonLd = buildWebPageJsonLd({
      title: seoPage.metaTitle,
      description: seoPage.metaDescription,
      path: `/${seoPage.slug}`,
      keywords: seoPage.keywords,
    });

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        {faqJsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
        ) : null}
        <SeoPageTemplate page={seoPage} />
      </>
    );
  }

  const comparePage = comparePageMap.get(slug);
  if (comparePage) {
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Compare", path: "/compare" },
      { name: comparePage.title, path: `/${comparePage.slug}` },
    ]);
    const faqJsonLd = buildFaqJsonLd(comparePage.faqs);
    const articleJsonLd = buildArticleJsonLd({
      title: comparePage.metaTitle,
      description: comparePage.metaDescription,
      path: `/${comparePage.slug}`,
      keywords: comparePage.keywords,
    });
    const webPageJsonLd = buildWebPageJsonLd({
      title: comparePage.metaTitle,
      description: comparePage.metaDescription,
      path: `/${comparePage.slug}`,
      keywords: comparePage.keywords,
    });
    const compareHubItemListJsonLd = comparePage.cards?.length
      ? buildItemListJsonLd(
          "KOMA Studio Comparison Pages",
          comparePage.cards.map((card) => ({
            name: card.title,
            path: `/${card.slug}`,
          })),
        )
      : null;

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        {faqJsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
        ) : null}
        {compareHubItemListJsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(compareHubItemListJsonLd) }}
          />
        ) : null}
        <ComparePageTemplate page={comparePage} />
      </>
    );
  }

  notFound();
}
