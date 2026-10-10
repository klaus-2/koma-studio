"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "glass" : "bg-transparent"}`}>
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

        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-ink/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="glass fixed right-0 top-0 z-50 flex h-dvh w-[82%] max-w-sm flex-col gap-2 p-8"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
            >
              <button className="mb-8 self-end" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
              {LINKS.map(([label, href], i) => (
                <motion.a key={href} href={href} onClick={() => setOpen(false)}
                  className="border-b border-paper/10 py-4 text-2xl font-black uppercase tracking-wide hover:text-crimson"
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}
                >
                  {label}
                </motion.a>
              ))}
              <a href="#download" onClick={() => setOpen(false)} className="btn-primary mt-8 justify-center"><Download size={16} /> Download Free</a>
              <div className="mt-3 flex justify-center" onClick={() => setOpen(false)}>
                <StarButton compact />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
