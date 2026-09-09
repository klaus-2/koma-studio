"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { SectionHeader } from "./ui/SectionHeader";

const testimonials = [
  {
    quote:
      "KOMA cut our release prep from a weekend-long mess into a controlled pipeline. The biggest win was not speed alone — it was consistency.",
    author: "@PanelShift",
    group: "Release Ops",
    role: "Lead Translator",
    rating: 5,
  },
  {
    quote:
      "The cleanup and lettering flow feels like it was designed by people who actually understand how manga pages get shipped.",
    author: "@InkClean",
    group: "Solo Workflow",
    role: "Cleaner / Typesetter",
    rating: 5,
  },
  {
    quote:
      "We stopped juggling three apps and a spreadsheet. That alone made the tool feel premium before the AI features even kicked in.",
    author: "@ChapterPilot",
    group: "Weekly Team",
    role: "Project Coordinator",
    rating: 5,
  },
  {
    quote:
      "The interface looks like a real production console, not a generic SaaS dashboard pretending to be a manga tool.",
    author: "@BubbleGrid",
    group: "Lettering Crew",
    role: "Typesetter",
    rating: 5,
  },
  {
    quote:
      "Running the pipeline demo feels exactly like what convinced us: one workspace, clear stage state, and far less handoff chaos.",
    author: "@StageLock",
    group: "Mid-size Team",
    role: "QC Lead",
    rating: 5,
  },
  {
    quote:
      "The redraw and cleanup stages finally feel connected instead of stitched together by habit and luck.",
    author: "@LineRepair",
    group: "Art Team",
    role: "Redrawer",
    rating: 5,
  },
] as const;

export function Testimonials() {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [perPage, setPerPage] = useState(3);

  useEffect(() => {
    const syncPerPage = () => {
      setPerPage(window.innerWidth < 768 ? 1 : 3);
    };

    syncPerPage();
    window.addEventListener("resize", syncPerPage);
    return () => window.removeEventListener("resize", syncPerPage);
  }, []);

  const totalPages = Math.ceil(testimonials.length / perPage);
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentPage((page) => (page + 1) % totalPages);
    }, 6000);

    return () => clearInterval(timer);
  }, [totalPages]);

  const visible = useMemo(
    () => testimonials.slice(safeCurrentPage * perPage, safeCurrentPage * perPage + perPage),
    [safeCurrentPage, perPage],
  );

  const goTo = (page: number) => {
    setDirection(page > safeCurrentPage ? 1 : -1);
    setCurrentPage(page);
  };

  return (
    <section className="overflow-hidden py-[var(--spacing-section)]" aria-label="Customer testimonials">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          badge="Loved by Scanlators"
          title="Join Thousands of Translators Worldwide"
          subtitle="Trusted by scanlation groups and solo translators across 50+ countries."
        />

        <div className="relative">
          <button
            onClick={() => goTo((safeCurrentPage - 1 + totalPages) % totalPages)}
            className="absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-x-2 -translate-y-1/2 items-center justify-center rounded-full glass-card text-koma-text-secondary transition-all hover:border-koma-purple/30 hover:text-koma-text md:flex"
            aria-label="Previous testimonials"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={() => goTo((safeCurrentPage + 1) % totalPages)}
            className="absolute right-0 top-1/2 z-10 hidden h-10 w-10 translate-x-2 -translate-y-1/2 items-center justify-center rounded-full glass-card text-koma-text-secondary transition-all hover:border-koma-purple/30 hover:text-koma-text md:flex"
            aria-label="Next testimonials"
          >
            <ChevronRight size={18} />
          </button>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={safeCurrentPage}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 80 : -80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -80 : 80 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="grid grid-cols-1 gap-5 md:grid-cols-3"
            >
              {visible.map((t) => (
                <article
                  key={t.author}
                  className="group relative rounded-2xl glass-card glass-card-hover p-6 transition-all duration-300 md:p-7"
                >
                  <Quote size={28} className="absolute right-5 top-5 text-koma-purple/10" />

                  <p className="relative mb-5 text-sm leading-relaxed text-koma-text/80">
                    &ldquo;{t.quote}&rdquo;
                  </p>

                  <span className="sr-only">{`${t.rating} out of 5 stars`}</span>
                  <div className="mb-4 flex gap-0.5" aria-hidden="true">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} size={13} fill="#f59e0b" className="text-amber-500" />
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-koma-purple/10 bg-gradient-to-br from-koma-purple/30 to-koma-cyan/30 text-sm font-bold text-koma-purple/60">
                      {t.author.charAt(1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-koma-text/90">{t.author}</div>
                      <div className="text-xs text-koma-muted">
                        {t.group} · {t.role}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex justify-center gap-2" role="tablist" aria-label="Testimonial pages">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              role="tab"
              aria-selected={i === safeCurrentPage}
              aria-label={`Page ${i + 1}`}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 hover:bg-white/[0.03]"
            >
              <span
                className={`block rounded-full transition-all duration-300 ${
                  i === safeCurrentPage
                    ? "h-2.5 w-6 bg-koma-purple shadow-glow-sm"
                    : "h-2.5 w-2.5 bg-koma-text-secondary/80 hover:bg-koma-text-secondary"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
