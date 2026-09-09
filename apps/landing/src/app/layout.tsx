import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Inter } from "next/font/google";
import { SITE_CHAT_URL, SITE_DISCORD_URL, SITE_GITHUB_URL } from "@/lib/site";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const siteUrl = "https://koma-studio.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KOMA Studio - Open-Source Scanlation Software for Manga Translation",
    template: "%s | KOMA Studio",
  },
  description:
    "Free and open-source (MIT) scanlation studio for manga, manhwa & comics. Translate, clean, typeset, and redraw with one AI pipeline — self-hosted, no credits, no lock-in.",
  keywords: [
    "open source manga translation software",
    "open source scanlation tool",
    "self-hosted AI manga translator",
    "MIT licensed scanlation software",
    "free manga translation software",
    "manhwa translation",
    "comic typesetting",
    "manga cleaning tool",
    "redraw AI",
    "scanlation desktop app",
    "KOMA Studio",
  ],
  authors: [{ name: "KOMA Studio" }],
  creator: "KOMA Studio",
  publisher: "KOMA Studio",
  applicationName: "KOMA Studio",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "KOMA Studio",
    title: "KOMA Studio - Open-Source Scanlation Software for Manga Translation",
    description:
      "Free and open-source (MIT) scanlation studio for manga, manhwa & comics. Translate, clean, typeset, and redraw with one AI pipeline — self-hosted, no credits, no lock-in.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "KOMA Studio - Open-Source Scanlation Software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KOMA Studio - Open-Source Scanlation Software",
    description:
      "Open-source (MIT) scanlation studio for manga, manhwa & comics. Self-hosted, free forever.",
    images: ["/opengraph-image"],
    creator: "@KomaStudio",
  },
  category: "technology",
  alternates: {
    canonical: siteUrl,
  },
  manifest: "/manifest.webmanifest",
  other: {
    "ai:site": siteUrl,
    "ai:chat": SITE_CHAT_URL,
    "ai:community": SITE_DISCORD_URL,
    "ai:repository": SITE_GITHUB_URL,
    "ai:license": "MIT",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable}`}
    >
      <head>
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png" />
        <link rel="icon" type="image/png" sizes="256x256" href="/favicon-256x256.png" />
        <link rel="icon" type="image/png" sizes="128x128" href="/favicon-128x128.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-koma-bg text-koma-text antialiased">
        {children}
      </body>
    </html>
  );
}
