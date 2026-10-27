"use client";
import { useEffect, useState } from "react";
import { Menu, X, Download } from "lucide-react";
import StarButton from "./StarButton";

const LINKS = [
  ["Features", "#features"],
  ["Studio", "#studio"],
  ["Open Source", "#open-source"],
  ["Contribute", "#contribute"],
  ["FAQ", "#faq"],
] as const;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header data-navbar className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "glass" : "bg-transparent"}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6" aria-label="Main">
        <a href="#" className="group flex items-center gap-3">
          <span className="panel-cut-sm flex h-9 w-9 items-center justify-center bg-crimson font-black text-ink transition-transform group-hover:-rotate-6">コ</span>
          <span className="font-black uppercase tracking-widest">
            KOMA<span className="text-crimson">.</span>
            <span className="ml-2 hidden font-[family-name:var(--font-mono)] text-[10px] font-normal tracking-[0.3em] text-paper/40 sm:inline">STUDIO</span>
          </span>
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <a href={href} className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-paper/60 transition-colors hover:text-crimson">
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <StarButton compact />
          <a href="#download" className="btn-primary !px-5 !py-2.5 text-xs">
            <Download size={14} /> Download
          </a>
        </div>

        <button data-menu-open className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu />
        </button>
      </nav>

      <div
        data-menu-backdrop
        className={`fixed inset-0 z-50 bg-ink/80 transition-opacity duration-300 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />
      <aside
        data-menu-panel
        className={`glass fixed right-0 top-0 z-50 flex h-dvh w-[82%] max-w-sm flex-col gap-2 p-8 transition-transform duration-300 ease-out lg:hidden ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
        inert={!open}
      >
        <button data-menu-close className="mb-8 self-end" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        {LINKS.map(([label, href], i) => (
          <a
            key={href}
            href={href}
            data-menu-link
            onClick={() => setOpen(false)}
            className={`border-b border-paper/10 py-4 text-2xl font-black uppercase tracking-wide transition-all duration-300 hover:text-crimson ${open ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"}`}
            style={{ transitionDelay: open ? `${0.05 + 0.06 * i}s` : "0s" }}
          >
            {label}
          </a>
        ))}
        <a href="#download" data-menu-link onClick={() => setOpen(false)} className="btn-primary mt-8 justify-center"><Download size={16} /> Download Free</a>
        <div className="mt-3 flex justify-center" onClick={() => setOpen(false)}>
          <StarButton compact />
        </div>
      </aside>
    </header>
  );
}
