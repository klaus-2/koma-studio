import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { ComparePage, CompareStepResult } from "@/types";
import { toSectionId } from "@/lib/seo";

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
    poor: "border-crimson/40 bg-crimson/10 text-crimson",
    average: "border-gold/40 bg-gold/10 text-gold",
    good: "border-azure/40 bg-azure/10 text-azure",
    excellent: "border-mint/40 bg-mint/10 text-mint",
  } as const;

  return (
    <article
      className={`panel-cut border p-6 ${variant === "koma"
          ? "border-mint/25 bg-mint/[0.04] shadow-[4px_4px_0_rgba(62,242,176,0.15)]"
          : "border-paper/10 bg-paper/[0.02]"
        }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="kicker !text-[10px]">{title}</div>
          <div className="mt-2 text-base font-black uppercase tracking-wide text-paper">
            {variant === "koma" ? "KOMA Studio" : "Provider"}
          </div>
        </div>
        <span
          className={`border px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] ${qualityStyles[result.quality]}`}
        >
          {result.quality}
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-paper/60">
        {result.description}
      </p>
      <ul className="mt-5 space-y-2">
        {result.notes.map((note) => (
          <li key={note} className="flex items-start gap-2 text-sm text-paper/50">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-crimson" />
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
      <main className="min-h-screen bg-ink">
        <section className="relative overflow-hidden py-28">
          <div
            aria-hidden
            className="halftone-red absolute inset-0 opacity-[0.06]"
          />
          <div
            aria-hidden
            className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-crimson/10 blur-[120px]"
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="stamp mb-6">{isHub ? "Comparison Hub" : "Direct Comparison"}</div>
            <h1 className="max-w-5xl text-4xl font-black uppercase leading-[0.95] tracking-tight text-paper sm:text-5xl lg:text-6xl">
              {page.heroTitle}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-paper/60">
              {page.heroSubtitle}
            </p>
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-paper/45">
              {page.intro}
            </p>
            {page.competitorUrl ? (
              <p className="mt-4 font-[family-name:var(--font-mono)] text-sm text-paper/45">
                Competitor reference:{" "}
                <a
                  href={page.competitorUrl}
                  className="text-azure underline-offset-4 hover:underline"
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
                <section className="glass panel-cut p-7">
                  <div className="kicker">At a Glance</div>
                  <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-paper">
                    {page.summaryQuestion}
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-relaxed text-paper/60">
                    {page.summaryAnswer}
                  </p>
                  {page.summaryTakeaways?.length ? (
                    <ul className="mt-5 grid gap-3 md:grid-cols-3">
                      {page.summaryTakeaways.map((point) => (
                        <li
                          key={point}
                          className="panel-cut-sm border border-paper/10 bg-paper/[0.02] px-4 py-3 text-sm text-paper/50"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                {page.comparisonRows?.length ? (
                  <section className="glass panel-cut overflow-hidden">
                    <div className="grid gap-4 border-b border-paper/10 bg-ink px-6 py-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em]">
                      <div className="text-paper/40">Comparison Point</div>
                      <div className="text-mint">KOMA Studio</div>
                      <div className="text-paper/40">{page.competitorName}</div>
                    </div>
                    {page.comparisonRows.map((row, i) => (
                      <div
                        key={row.label}
                        className={`grid gap-4 px-6 py-5 md:grid-cols-[1fr_1fr_1fr] ${i % 2 ? "bg-paper/[0.02]" : ""
                          } ${i < page.comparisonRows!.length - 1 ? "border-b border-paper/8" : ""}`}
                      >
                        <div className="text-sm font-medium text-paper">{row.label}</div>
                        <div className="text-sm text-paper/65">{row.koma}</div>
                        <div className="text-sm text-paper/40">{row.competitor}</div>
                      </div>
                    ))}
                  </section>
                ) : null}

                {page.cleaner && page.typeset ? (
                  <>
                    <section className="space-y-4">
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-paper">
                          Cleaner and Redraw Workflow
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-paper/55">
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
                        <h2 className="text-2xl font-black uppercase tracking-tight text-paper">
                          Typesetting and QA Readiness
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-paper/55">
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
                    <article key={section.title} id={sectionId} className="glass panel-cut scroll-mt-28 p-7">
                      <h2 className="text-2xl font-black uppercase tracking-tight text-paper">
                        {section.title}
                      </h2>
                      <p className="mt-4 text-base leading-relaxed text-paper/60">
                        {section.content}
                      </p>
                      {section.bullets ? (
                        <ul className="mt-5 space-y-2">
                          {section.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-start gap-2 text-sm text-paper/50">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-crimson" />
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
                      <Link
                        key={card.slug}
                        href={`/${card.slug}`}
                        className="glass panel-cut-sm block p-5 transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-crimson/40 hover:shadow-[5px_5px_0_rgba(255,46,99,0.35)]"
                      >
                        <div className="text-lg font-black uppercase tracking-wide text-paper">
                          {card.title}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-paper/55">
                          {card.summary}
                        </p>
                      </Link>
                    ))}
                  </section>
                ) : null}
              </div>

              <aside className="relative self-start space-y-5 lg:sticky lg:top-24">
                <div className="glass panel-cut-sm p-6">
                  <div className="kicker">Navigate</div>
                  <div className="mt-4 space-y-3">
                    {page.sections.map((section) => (
                      <a
                        key={section.title}
                        href={`#${toSectionId(section.title)}`}
                        className="block border border-paper/10 bg-paper/[0.02] px-4 py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/60 transition-colors hover:border-crimson/40 hover:text-paper"
                      >
                        {section.title}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="glass panel-cut-sm p-6">
                  <div className="text-sm font-black uppercase tracking-wide text-paper">
                    Questions
                  </div>
                  <div className="mt-4 space-y-4">
                    {page.faqs.map((faq) => (
                      <div
                        key={faq.question}
                        className="border-b border-paper/10 pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="text-sm font-medium text-paper">{faq.question}</div>
                        <div className="mt-2 text-sm leading-relaxed text-paper/55">
                          {faq.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass panel-cut-sm p-6">
                  <div className="text-sm font-black uppercase tracking-wide text-paper">
                    Related Pages
                  </div>
                  <div className="mt-4 space-y-3">
                    {page.relatedPages.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block border border-paper/10 bg-paper/[0.02] px-4 py-3 text-sm text-paper/60 transition-colors hover:text-paper"
                      >
                        {link.title}
                      </Link>
                    ))}
                  </div>
                </div>

                {page.sourceLinks?.length ? (
                  <div className="glass panel-cut-sm p-6">
                    <div className="text-sm font-black uppercase tracking-wide text-paper">
                      Sources
                    </div>
                    <div className="mt-4 space-y-3">
                      {page.sourceLinks.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="block border border-paper/10 bg-paper/[0.02] px-4 py-3 text-sm text-paper/60 transition-colors hover:text-paper"
                        >
                          {link.title}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
