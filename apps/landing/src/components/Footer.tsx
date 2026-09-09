import { KomaLogo } from "./ui/KomaLogo";
import { GitHubIcon } from "./ui/GitHubIcon";
import {
  SITE_DISCORD_URL,
  SITE_GITHUB_URL,
  SITE_ISSUES_URL,
  SITE_LICENSE,
  SITE_LICENSE_URL,
  SITE_RELEASES_URL,
} from "@/lib/site";

const footerLinks = {
  Product: [
    { label: "Features", href: "/features" },
    { label: "Preview", href: "/app-preview" },
    { label: "Workflow", href: "/workflow" },
    { label: "Download", href: "/download" },
  ],
  "Open Source": [
    { label: "GitHub repository", href: SITE_GITHUB_URL, external: true },
    { label: "Contributing guide", href: "/contributing" },
    { label: "Issues & roadmap", href: SITE_ISSUES_URL, external: true },
    { label: `${SITE_LICENSE} license`, href: SITE_LICENSE_URL, external: true },
  ],
  Community: [
    { label: "Discord", href: SITE_DISCORD_URL, external: true },
    { label: "Open WebUI chat", href: "https://chat.koma-studio.site", external: true },
    { label: "Good first issues", href: `${SITE_GITHUB_URL}/contribute`, external: true },
    { label: "Releases", href: SITE_RELEASES_URL, external: true },
  ],
  Guides: [
    { label: "Manga Translation Software", href: "/manga-translation-software" },
    { label: "Scanlation Typesetting", href: "/scanlation-typesetting-software" },
    { label: "Cleaning & Redraw", href: "/manga-cleaning-redraw-tool" },
    { label: "AI Manga Translator", href: "/ai-manga-translator" },
  ],
  Compare: [
    { label: "Compare KOMA Studio", href: "/compare" },
    { label: "Comic Translator vs KOMA", href: "/comictranslator-vs-koma-studio" },
    { label: "Photoshop vs KOMA", href: "/photoshop-vs-koma-studio" },
    { label: "Yomu AI vs KOMA", href: "/yomu-vs-koma-studio" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/6 py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr]">
          <div>
            <KomaLogo size={36} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-koma-text-secondary">
              Open-source, {SITE_LICENSE}-licensed desktop workflow for manga, manhwa, and comic
              production. Translate, clean, typeset, redraw, and review in one focused environment —
              on your machine.
            </p>
            <a
              href={SITE_GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-koma-text transition-colors hover:border-koma-purple/30 hover:bg-white/[0.06]"
            >
              <GitHubIcon size={14} />
              View source on GitHub
            </a>
          </div>

          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h3 className="text-sm font-semibold text-koma-text">{group}</h3>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={"external" in link && link.external ? "_blank" : undefined}
                      rel={"external" in link && link.external ? "noreferrer" : undefined}
                      className="text-sm text-koma-muted transition-colors hover:text-koma-text"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/6 pt-6 text-sm text-koma-muted md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-koma-text-secondary">
            <p className="text-xs text-koma-muted/80">
              © {new Date().getFullYear()} KOMA Studio · {SITE_LICENSE} licensed · built in the open
            </p>
            <p className="italic mt-1 text-koma-text-secondary">
              &quot;Every panel tells a story&quot;
            </p>
          </div>
          <div className="flex items-center gap-4 font-[var(--font-mono)] text-xs">
            <a
              href={SITE_RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-koma-text"
            >
              changelog
            </a>
            <a
              href={SITE_ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-koma-text"
            >
              issues
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
