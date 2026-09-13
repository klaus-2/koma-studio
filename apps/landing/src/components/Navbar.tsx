"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight, Layers, Star, MessageCircle } from "lucide-react";
import { useAppStore } from "@/store";
import { useGitHubStars } from "@/components/GitHubStars";
import { GitHubIcon } from "@/components/ui/GitHubIcon";
import { SITE_DISCORD_URL, SITE_GITHUB_URL, SITE_LICENSE } from "@/lib/site";

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Preview", href: "/app-preview" },
  { label: "Workflow", href: "/workflow" },
  { label: "Compare", href: "/compare" },
  { label: "Contribute", href: "/contributing" },
  { label: "FAQ", href: "/faq" },
] as const;

function AnimatedLogo() {
  return (
    <div className="relative flex items-center gap-3">
      <motion.div
        className="relative h-10 w-10 overflow-hidden rounded-xl"
        whileHover={{ scale: 1.05, rotate: 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <Image
          src="/koma-logo.png"
          alt="KOMA Studio logo"
          fill
          sizes="40px"
          className="object-cover"
          priority
        />
      </motion.div>

      <div className="flex flex-col">
        <span className="text-xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
          KOMA
        </span>
        <span className="text-[10px] font-medium tracking-[0.3em] text-white/40 uppercase">
          Studio
        </span>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
    >
      <span className="relative z-10">{label}</span>

      <motion.span
        className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/10 to-cyan-500/10 opacity-0"
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />

      <motion.span
        className="absolute bottom-1 left-1/2 h-[2px] w-[60%] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"
        animate={{ scaleX: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      />

      {isHovered && (
        <motion.span
          className="absolute inset-0 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            boxShadow: "0 0 20px rgba(168, 85, 247, 0.15)",
          }}
        />
      )}
    </a>
  );
}

function GradientButton({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.a
      href={href}
      className={`group relative flex items-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 font-medium text-white ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_100%] opacity-100 transition-opacity group-hover:opacity-90" />

      <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-[length:200%_100%] opacity-0 transition-opacity group-hover:opacity-100 animate-gradient" />

      <motion.div
        className="absolute -inset-[100%] rounded-full bg-gradient-to-r from-purple-600/0 via-white/20 to-purple-600/0"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        style={{ display: "none" }}
      />

      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </motion.a>
  );
}

function MobileNavLink({ href, label, onClick, index }: { href: string; label: string; onClick: () => void; index: number }) {
  return (
    <motion.a
      href={href}
      onClick={onClick}
      className="group relative flex items-center gap-3 rounded-2xl px-5 py-4 text-base font-medium text-white/70 transition-all hover:bg-white/[0.05] hover:text-white"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] transition-colors group-hover:bg-white/[0.1]">
        <Layers size={18} className="text-white/40 group-hover:text-white/80 transition-colors" />
      </div>

      <span className="flex-1">{label}</span>

      <motion.span
        className="text-white/30"
        animate={{ x: [0, 4, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <ChevronRight size={18} />
      </motion.span>
    </motion.a>
  );
}

function NavStarCount() {
  const stars = useGitHubStars();

  if (stars === null) {
    return null;
  }

  return (
    <span className="font-[var(--font-mono)] text-xs text-white/60">
      {stars >= 1000 ? `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k` : stars}
    </span>
  );
}

export function Navbar() {
  const { isScrolled, setIsScrolled, isMobileMenuOpen, setIsMobileMenuOpen } =
    useAppStore();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;

    setIsScrolled(currentScrollY > 20);

    if (currentScrollY > lastScrollY && currentScrollY > 100) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }

    setLastScrollY(currentScrollY);
  }, [lastScrollY, setIsScrolled]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? "py-2" : "py-4"
        }`}
        initial={{ y: -100, opacity: 0 }}
        animate={{
          y: isVisible ? 0 : -100,
          opacity: isVisible ? 1 : 0
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <motion.div
          className={`absolute inset-0 transition-all duration-500 ${
            isScrolled
              ? "bg-black/60 backdrop-blur-2xl border-b border-white/[0.06]"
              : "bg-transparent"
          }`}
          initial={false}
        />

        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link href="/" className="relative z-10">
            <AnimatedLogo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <motion.a
              href={SITE_DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <MessageCircle size={16} />
              Discord
            </motion.a>

            <motion.a
              href={SITE_GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="group relative inline-flex items-center gap-2.5 rounded-full bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition-colors hover:bg-white/[0.08] hover:ring-white/20"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <GitHubIcon size={16} />
              <span className="flex items-center gap-1.5">
                <Star size={13} className="text-amber-400" />
                Star
                <NavStarCount />
              </span>
            </motion.a>
          </div>

          <motion.button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="relative z-10 rounded-xl p-2.5 text-white/70 transition-all hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Toggle menu"
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isMobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X size={22} />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu size={22} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <motion.div
              className="absolute right-0 top-0 h-full w-[85%] max-w-[360px] overflow-hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="flex h-full flex-col bg-[#0a0612]/95 backdrop-blur-2xl border-l border-white/[0.08]">
                <div className="flex items-center justify-between px-6 py-6 border-b border-white/[0.06]">
                  <AnimatedLogo />

                  <motion.button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="rounded-xl p-2.5 text-white/70 hover:bg-white/10 hover:text-white"
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <div className="space-y-2">
                    {NAV_LINKS.map((link, index) => (
                      <MobileNavLink
                        key={link.href}
                        href={link.href}
                        label={link.label}
                        onClick={() => setIsMobileMenuOpen(false)}
                        index={index}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-6 border-t border-white/[0.06]">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <GradientButton href={SITE_GITHUB_URL} className="w-full justify-center">
                      <GitHubIcon size={16} />
                      Star on GitHub
                    </GradientButton>
                    <a
                      href={SITE_DISCORD_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
                    >
                      <MessageCircle size={16} />
                      Join the Discord
                    </a>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 text-center text-xs text-white/30"
                  >
                    {SITE_LICENSE} licensed · Windows, macOS &amp; Linux
                  </motion.p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
