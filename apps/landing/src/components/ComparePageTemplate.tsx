import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import type { ComparePage, CompareStepResult } from "@/types";
import { toSectionId } from "@/lib/seo";

function SidebarCard({
  eyebrow,
  title,
  children,
  accent = "cyan",
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  accent?: "cyan" | "purple" | "emerald";
}) {
  const accentStyles = {
    cyan: {
      line: "from-koma-cyan/80 via-koma-cyan/20 to-transparent",
      glow: "shadow-[0_0_32px_rgba(34,211,238,0.12)]",
      pill: "text-koma-cyan-light border-koma-cyan/20 bg-koma-cyan/10",
    },
    purple: {
      line: "from-koma-purple-light/80 via-koma-purple/20 to-transparent",
      glow: "shadow-[0_0_32px_rgba(168,85,247,0.14)]",
      pill: "text-koma-purple-light border-koma-purple/20 bg-koma-purple/10",
    },
    emerald: {
      line: "from-emerald-300/80 via-emerald-400/20 to-transparent",
      glow: "shadow-[0_0_32px_rgba(52,211,153,0.12)]",
      pill: "text-emerald-200 border-emerald-400/20 bg-emerald-500/10",
    },
  } as const;

  const style = accentStyles[accent];

  return (
    <div
      className={`group relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 backdrop-blur-2xl ${style.glow}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${style.line}`} />
      <div className="pointer-events-none absolute -right-16 top-0 h-28 w-28 rounded-full bg-white/5 blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-60" />

      {eyebrow ? (
        <div className={`mb-4 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${style.pill}`}>
          {eyebrow}
        </div>
      ) : null}

      <div className="text-sm font-semibold text-koma-text">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StepCard({
  title,
  result,
  variant,
}: {
  title: string;
  result: CompareStepResult;
  variant: "provider" | "koma";
}) {
  const qualityStyles = {
    poor: "bg-rose-500/15 text-rose-200 border-rose-500/20",
    average: "bg-amber-500/15 text-amber-100 border-amber-500/20",
    good: "bg-sky-500/15 text-sky-100 border-sky-500/20",
    excellent: "bg-emerald-500/15 text-emerald-100 border-emerald-500/20",
  } as const;

  return (
    <article
      className={`rounded-3xl border p-6 ${
        variant === "koma"
          ? "border-emerald-400/22 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))] shadow-[0_0_28px_rgba(16,185,129,0.08)]"
          : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-koma-muted">
            {title}
          </div>
          <div className="mt-2 text-base font-semibold text-koma-text">
            {variant === "koma" ? "KOMA Studio" : "Provider"}
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${qualityStyles[result.quality]}`}
        >
          {result.quality}
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-koma-text-secondary">
        {result.description}
      </p>
      <ul className="mt-5 space-y-2">
        {result.notes.map((note) => (
          <li key={note} className="flex items-start gap-2 text-sm text-koma-muted">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-koma-cyan/70" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function ComparePageTemplate({ page }: { page: ComparePage }) {
  const isHub = page.type === "hub";
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-koma-bg">
        <section className="relative overflow-hidden py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.12),transparent_36%),linear-gradient(180deg,rgba(10,12,24,0.16),transparent_42%,rgba(10,12,24,0.28))]" />
          <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="absolute left-1/2 top-10 h-56 w-[42rem] -translate-x-1/2 rounded-full bg-koma-purple/10 blur-[110px]" />
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="mb-5 inline-flex rounded-full border border-koma-cyan/20 bg-koma-cyan/8 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-koma-cyan-light shadow-[0_0_24px_rgba(34,211,238,0.12)]">
              {isHub ? "Comparison Hub" : "Direct Comparison"}
            </div>
            <h1 className="max-w-5xl font-[var(--font-display)] text-4xl font-bold tracking-tight text-koma-text sm:text-5xl lg:text-6xl">
              {page.heroTitle}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-koma-text-secondary">
              {page.heroSubtitle}
            </p>
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-koma-muted">
              {page.intro}
            </p>
            {page.competitorUrl ? (
              <p className="mt-4 text-sm text-koma-muted">
                Competitor reference: {" "}
                <a
                  href={page.competitorUrl}
                  className="text-koma-cyan-light underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {page.competitorUrl}
                </a>
              </p>
            ) : null}
          </div>
        </section>

        <section className="pb-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-8">
                <section className="glass-card relative overflow-hidden p-7">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-koma-cyan/80 via-koma-purple/40 to-transparent" />
                  <div className="pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full bg-koma-cyan/10 blur-3xl" />
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-koma-cyan-light">
                    At a Glance
                  </div>
                  <h2 className="mt-3 font-[var(--font-display)] text-2xl font-semibold text-koma-text">
                    {page.summaryQuestion}
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-relaxed text-koma-text-secondary">
                    {page.summaryAnswer}
                  </p>
                  {page.summaryTakeaways?.length ? (
                    <ul className="mt-5 grid gap-3 md:grid-cols-3">
                      {page.summaryTakeaways.map((point) => (
                        <li
                          key={point}
                          className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-koma-muted"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                {page.comparisonRows?.length ? (
                  <section className="glass-card relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-koma-cyan/80 via-koma-purple/40 to-transparent" />
                    <div className="grid gap-4 border-b border-white/6 bg-white/[0.03] px-6 py-4 md:grid-cols-[1fr_1fr_1fr]">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-koma-muted">
                        Comparison Point
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-koma-muted">
                        KOMA Studio
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-koma-muted">
                        {page.competitorName}
                      </div>
                    </div>
                    {page.comparisonRows.map((row) => (
                      <div
                        key={row.label}
                        className="grid gap-4 border-b border-white/6 px-6 py-5 last:border-b-0 md:grid-cols-[1fr_1fr_1fr]"
                      >
                        <div className="text-sm font-medium text-koma-text">{row.label}</div>
                        <div className="text-sm text-koma-text-secondary">{row.koma}</div>
                        <div className="text-sm text-koma-text-secondary">{row.competitor}</div>
                      </div>
                    ))}
                  </section>
                ) : null}

                {page.cleaner && page.typeset ? (
                  <>
                    <section className="space-y-4">
                      <div>
                        <h2 className="font-[var(--font-display)] text-2xl font-semibold text-koma-text">
                          Cleaner and Redraw Workflow
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-koma-text-secondary">
                          This section compares how each option handles text removal, page cleanup, redraw continuity, and the downstream production burden that follows.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <StepCard title={page.competitorName ?? "Provider"} result={page.cleaner.provider} variant="provider" />
                        <StepCard title="KOMA Studio" result={page.cleaner.koma} variant="koma" />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div>
                        <h2 className="font-[var(--font-display)] text-2xl font-semibold text-koma-text">
                          Typesetting and QA Readiness
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-koma-text-secondary">
                          This section focuses on lettering continuity, balloon-fit quality, and whether the workflow stays coherent once the chapter reaches review.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <StepCard title={page.competitorName ?? "Provider"} result={page.typeset.provider} variant="provider" />
                        <StepCard title="KOMA Studio" result={page.typeset.koma} variant="koma" />
                      </div>
                    </section>
                  </>
                ) : null}

                {page.sections.map((section) => {
                  const sectionId = toSectionId(section.title);

                  return (
                    <article key={section.title} id={sectionId} className="glass-card relative scroll-mt-28 overflow-hidden p-7">
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-koma-purple/70 via-koma-cyan/30 to-transparent" />
                      <h2 className="font-[var(--font-display)] text-2xl font-semibold text-koma-text">
                        {section.title}
                      </h2>
                      <p className="mt-4 text-base leading-relaxed text-koma-text-secondary">
                        {section.content}
                      </p>
                      {section.bullets ? (
                        <ul className="mt-5 space-y-2">
                          {section.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-start gap-2 text-sm text-koma-muted">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-koma-cyan/70" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}

                {page.cards?.length ? (
                  <section className="grid gap-4 md:grid-cols-2">
                    {page.cards.map((card) => (
                      <Link key={card.slug} href={`/${card.slug}`} className="glass-card-hover relative block overflow-hidden p-5">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-koma-cyan/70 to-transparent" />
                        <div className="text-lg font-semibold text-koma-text">{card.title}</div>
                        <p className="mt-2 text-sm leading-relaxed text-koma-text-secondary">
                          {card.summary}
                        </p>
                      </Link>
                    ))}
                  </section>
                ) : null}
              </div>

              <aside className="relative self-start lg:sticky lg:top-24">
                <div className="space-y-5">
                  <SidebarCard eyebrow="Navigate" title="On This Page" accent="cyan">
                    <div className="space-y-3">
                      {page.sections.map((section) => (
                        <a
                          key={section.title}
                          href={`#${toSectionId(section.title)}`}
                          className="block rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-koma-text-secondary transition-all hover:border-koma-cyan/20 hover:bg-koma-cyan/8 hover:text-koma-text"
                        >
                          {section.title}
                        </a>
                      ))}
                    </div>
                  </SidebarCard>

                  <SidebarCard eyebrow="FAQ" title="Questions" accent="purple">
                    <div className="space-y-4">
                      {page.faqs.map((faq) => (
                        <div
                          key={faq.question}
                          className="border-b border-white/6 pb-4 last:border-b-0 last:pb-0"
                        >
                          <div className="text-sm font-medium text-koma-text">{faq.question}</div>
                          <div className="mt-2 text-sm leading-relaxed text-koma-text-secondary">
                            {faq.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SidebarCard>

                  <SidebarCard eyebrow="Explore" title="Related Pages" accent="emerald">
                    <div className="space-y-3">
                      {page.relatedPages.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="block rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-koma-text-secondary transition-all hover:border-emerald-400/20 hover:bg-emerald-500/[0.08] hover:text-koma-text"
                        >
                          {link.title}
                        </Link>
                      ))}
                    </div>
                  </SidebarCard>

                  {page.sourceLinks?.length ? (
                    <SidebarCard eyebrow="Sources" title="Reference Links" accent="cyan">
                      <div className="space-y-3">
                        {page.sourceLinks.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-koma-text-secondary transition-all hover:border-koma-cyan/20 hover:bg-koma-cyan/8 hover:text-koma-text"
                          >
                            {link.title}
                          </a>
                        ))}
                      </div>
                    </SidebarCard>
                  ) : null}

                </div>
              </aside>
            </div>
          </div>
        </section>
    </main>
      <Footer />
    </>
  );
}
