import { Star } from "lucide-react";
import { GitHubIcon } from "./ui/GitHubIcon";
import { SITE_CONFIG } from "@/lib/data";

const COLS: [string, [string, string][]][] = [
  ["Project", [
    ["GitHub", SITE_CONFIG.github],
    ["Releases", SITE_CONFIG.releases],
    ["Roadmap", SITE_CONFIG.issues],
    ["MIT License", SITE_CONFIG.licenseFile],
    ["Star us", SITE_CONFIG.stargazers],
  ]],
  ["Community", [
    ["Discord", SITE_CONFIG.discord],
    ["Discussions", SITE_CONFIG.discussions],
    ["Contributing guide", SITE_CONFIG.contributing],
    ["Code of conduct", SITE_CONFIG.codeOfConduct],
    ["Good first issues", SITE_CONFIG.goodFirstIssues],
    ["Pull requests", SITE_CONFIG.pulls],
  ]],
  ["Studio", [
    ["Features", "#features"],
    ["Desktop app", "#studio"],
    ["Workflow", "#workflow"],
    ["Open vs closed", "#compare"],
    ["FAQ", "#faq"],
  ]],
];

export default function Footer() {
  return (
    <footer className="border-t border-paper/10 bg-ink-2/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="panel-cut-sm flex h-9 w-9 items-center justify-center bg-crimson font-black text-ink">コ</span>
            <span className="font-black uppercase tracking-widest">KOMA<span className="text-crimson">.</span></span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-paper/45">
            The free, open-source AI scanlation studio. <em className="font-[family-name:var(--font-accent)] italic text-paper/70">Every panel tells a story.</em>
          </p>
          <a href={SITE_CONFIG.github} target="_blank" rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 border border-paper/15 px-4 py-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-paper/60 transition-colors hover:border-gold/60 hover:text-gold">
            <GitHubIcon size={14} /> {SITE_CONFIG.repo} <Star size={12} className="text-gold" fill="currentColor" />
          </a>
        </div>
        {COLS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="kicker mb-4 !text-[10px]">{title}</p>
            <ul className="space-y-2.5">
              {links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} target={href.startsWith("#") ? undefined : "_blank"} rel={href.startsWith("#") ? undefined : "noreferrer"}
                    className="text-sm text-paper/45 transition-colors hover:text-crimson">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-paper/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-paper/30">
          <p>© {new Date().getFullYear()} KOMA Studio — MIT Licensed</p>
          <p>Open source · <span className="text-mint">Free forever</span> · Built with the community 🤖</p>
        </div>
      </div>
    </footer>
  );
}
