import type { Metadata } from "next";
import LegalPageTemplate from "@/components/LegalPageTemplate";
import { TERMS } from "@/content/legal";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/project";

export const metadata: Metadata = {
  title: { absolute: "Terms of Service | KOMA Studio" },
  description: TERMS.metaDescription,
  alternates: {
    canonical: `${SITE_URL}/terms-of-service/`,
  },
  openGraph: {
    title: "Terms of Service | KOMA Studio",
    description: TERMS.metaDescription,
    url: `${SITE_URL}/terms-of-service/`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | KOMA Studio",
    description: TERMS.metaDescription,
  },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "Terms of Service", path: "/terms-of-service" },
]);

export default function TermsOfServicePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LegalPageTemplate doc={TERMS} />
    </>
  );
}
