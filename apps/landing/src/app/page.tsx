import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { SocialProof } from "@/components/SocialProof";
import { Features } from "@/components/Features";
import { AppPreview } from "@/components/AppPreview";
import { Workflow } from "@/components/Workflow";
import { ComparisonTable } from "@/components/ComparisonTable";
import { Contribute } from "@/components/Contribute";
import { OpenSource } from "@/components/OpenSource";
import { FAQ } from "@/components/FAQ";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { WebMcpProvider } from "@/components/WebMcpProvider";
import {
  SITE_CHAT_URL,
  SITE_DESCRIPTION,
  SITE_DISCORD_URL,
  SITE_GITHUB_URL,
  SITE_LICENSE_URL,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import { landingFaqs } from "@/content/site-faqs";
import {
  buildFaqJsonLd,
  buildItemListJsonLd,
  buildPageMetadata,
  buildWebSiteJsonLd,
} from "@/lib/seo";
export const metadata: Metadata = buildPageMetadata({
  title: "KOMA Studio - Open-Source Scanlation Software for Manga, Manhwa, and Comics",
  description:
    "Free and open-source (MIT) scanlation studio for manga, manhwa, and comics. Translate, clean, redraw, typeset, and review chapters in a self-hostable desktop app you can fork and extend.",
  keywords: [
    "open source scanlation software",
    "open source manga translator",
    "self-hosted manga translation",
    "MIT licensed scanlation tool",
    "free manga translation software",
  ],
  path: "/",
});

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  operatingSystem: "Windows, macOS, Linux",
  applicationCategory: "MultimediaApplication",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  codeRepository: SITE_GITHUB_URL,
  license: SITE_LICENSE_URL,
  isAccessibleForFree: true,
  featureList: [
    "AI translation with page context",
    "Cleanup and redraw workflow",
    "Typesetting and QA workflow",
    "Desktop-native chapter production",
    "Self-hosted and offline-capable",
    "Bring your own AI model or API key",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
};

const sourceCodeJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  codeRepository: SITE_GITHUB_URL,
  url: SITE_URL,
  license: SITE_LICENSE_URL,
  isAccessibleForFree: true,
  author: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  logo: `${SITE_URL}/android-chrome-512x512.png`,
  sameAs: [SITE_DISCORD_URL, SITE_CHAT_URL],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@koma-studio.site",
  },
};

const citedSourceJsonLd = buildItemListJsonLd("KOMA Studio Supporting Sources", [
  { name: "Compare KOMA Studio", path: "/compare" },
  { name: "Manga Translation Software", path: "/manga-translation-software" },
  { name: "AI Manga Translator", path: "/ai-manga-translator" },
]);

const webSiteJsonLd = buildWebSiteJsonLd();
const corePageItemListJsonLd = buildItemListJsonLd("KOMA Studio Core SEO Pages", [
  { name: "Features", path: "/features" },
  { name: "Workflow", path: "/workflow" },
  { name: "Compare", path: "/compare" },
  { name: "Download", path: "/download/windows" },
]);
const homeFaqJsonLd = buildFaqJsonLd(landingFaqs.slice(0, 4));

export default function HomePage() {
  return (
    <>
      <WebMcpProvider />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(corePageItemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sourceCodeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(citedSourceJsonLd) }}
      />
      {homeFaqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }}
        />
      ) : null}
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <AppPreview />
        <Workflow />
        <OpenSource />
        <ComparisonTable />
        <Contribute />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
