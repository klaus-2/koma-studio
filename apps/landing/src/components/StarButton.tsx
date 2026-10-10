"use client";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { GitHubIcon } from "./ui/GitHubIcon";
import { SITE_CONFIG } from "@/lib/data";

function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export default function StarButton({ compact = false }: { compact?: boolean }) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`https://api.github.com/repos/${SITE_CONFIG.repo}`)
      .then((r) => {
        if (!r.ok) throw new Error("github api");
        return r.json() as Promise<{ stargazers_count: number }>;
      })
      .then((d) => {
        if (alive && typeof d.stargazers_count === "number") setStars(d.stargazers_count);
      })
      .catch(() => { });
    return () => { alive = false; };
  }, []);

  if (compact) {
    return (
      <a
        href={SITE_CONFIG.github}
        target="_blank"
        rel="noreferrer"
        className="panel-cut-sm inline-flex items-center gap-2 border border-paper/20 px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/80 transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-gold/60 hover:text-gold hover:shadow-[3px_3px_0_rgba(255,200,87,0.25)]"
        aria-label="Star KOMA Studio on GitHub"
      >
        <GitHubIcon size={14} />
        <Star size={12} className="text-gold" fill="currentColor" />
        {stars !== null && <span className="text-gold">{formatStars(stars)}</span>}
      </a>
    );
  }

  return (
    <a href={SITE_CONFIG.github} target="_blank" rel="noreferrer" className="btn-primary" aria-label="Star KOMA Studio on GitHub">
      <GitHubIcon size={18} />
      Star on GitHub
      {stars !== null && (
        <span className="ml-1 inline-flex items-center gap-1 border-l border-ink/25 pl-3 font-[family-name:var(--font-mono)] text-sm">
          <Star size={13} fill="currentColor" /> {formatStars(stars)}
        </span>
      )}
    </a>
  );
}
