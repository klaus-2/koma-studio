import type { Metadata } from "next";
import LegalPageTemplate from "@/components/LegalPageTemplate";
import { PRIVACY } from "@/content/legal";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/project";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy | KOMA Studio" },
  description: PRIVACY.metaDescription,
  alternates: {
    canonical: `${SITE_URL}/privacy-policy/`,
  },
  openGraph: {
    title: "Privacy Policy | KOMA Studio",
    description: PRIVACY.metaDescription,
    url: `${SITE_URL}/privacy-policy/`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | KOMA Studio",
    description: PRIVACY.metaDescription,
  },
};

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "Privacy Policy", path: "/privacy-policy" },
]);

export default function PrivacyPolicyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LegalPageTemplate doc={PRIVACY} />
    </>
  );
}
