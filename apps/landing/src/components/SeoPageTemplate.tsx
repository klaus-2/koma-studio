import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import type { SeoPage } from "@/types";
import { toSectionId } from "@/lib/seo";

export function SeoPageTemplate({ page }: { page: SeoPage }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-koma-bg">
        <section className="relative overflow-hidden py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.08),transparent_35%)]" />
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="max-w-4xl">
              <div className="mb-5 inline-flex rounded-full border border-koma-purple/20 bg-koma-purple/8 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-koma-purple-light">
                {page.title}
              </div>
              <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight text-koma-text sm:text-5xl lg:text-6xl">
                {page.heroTitle}
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-koma-text-secondary">
                {page.heroSubtitle}
              </p>
              {page.intro ? (
                <p className="mt-6 max-w-3xl text-base leading-relaxed text-koma-muted">
                  {page.intro}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="pb-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <section className="glass-card p-7">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-koma-purple-light">
                    In Short
                  </div>
                  <h2 className="mt-3 font-[var(--font-display)] text-2xl font-semibold text-koma-text">
                    {page.summaryQuestion}
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-relaxed text-koma-text-secondary">
                    {page.summaryAnswer}
                  </p>
                  {page.summaryTakeaways?.length ? (
                    <ul className="mt-5 grid gap-3 md:grid-cols-3">
                      {page.summaryTakeaways.map((takeaway) => (
                        <li
                          key={takeaway}
                          className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-koma-muted"
                        >
                          {takeaway}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                {page.sections.map((section) => {
                  const sectionId = toSectionId(section.title);

                  return (
                    <article
                      key={section.title}
                      id={sectionId}
                      className="glass-card scroll-mt-28 p-7"
                    >
                      <h2 className="font-[var(--font-display)] text-2xl font-semibold text-koma-text">
                        {section.title}
                      </h2>
                      <p className="mt-4 text-base leading-relaxed text-koma-text-secondary">
                        {section.content}
                      </p>
                      {section.features ? (
                        <ul className="mt-5 space-y-2">
                          {section.features.map((feature) => (
                            <li
                              key={feature}
                              className="flex items-start gap-2 text-sm text-koma-muted"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-koma-purple/70" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}

                {page.downloadLinks?.length ? (
                  <section className="glass-card p-7">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-koma-purple-light">
                      Downloads
                    </div>
                    <h2 className="mt-3 font-[var(--font-display)] text-2xl font-semibold text-koma-text">
                      Stable Download Links
                    </h2>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {page.downloadLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-4 text-sm font-medium text-koma-text transition-colors hover:border-koma-purple/30 hover:bg-koma-purple/8"
                        >
                          {link.title}
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="relative self-start space-y-6 lg:sticky lg:top-24">
                <div className="glass-card p-6">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-koma-muted">
                    On This Page
                  </div>
                  <div className="mt-4 space-y-3">
                    {page.sections.map((section) => (
                      <a
                        key={section.title}
                        href={`#${toSectionId(section.title)}`}
                        className="block rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-koma-text-secondary transition-colors hover:text-koma-text"
                      >
                        {section.title}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <div className="text-sm font-semibold text-koma-text">Common Questions</div>
                  <div className="mt-4 space-y-4">
                    {page.faqs.map((faq) => (
                      <div
                        key={faq.question}
                        className="border-b border-white/6 pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="text-sm font-medium text-koma-text">
                          {faq.question}
                        </div>
                        <div className="mt-2 text-sm leading-relaxed text-koma-text-secondary">
                          {faq.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <div className="text-sm font-semibold text-koma-text">Related Pages</div>
                  <div className="mt-4 space-y-3">
                    {page.relatedPages.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-koma-text-secondary transition-colors hover:text-koma-text"
                      >
                        {link.title}
                      </Link>
                    ))}
                  </div>
                </div>

                {page.sourceLinks?.length ? (
                  <div className="glass-card p-6">
                    <div className="text-sm font-semibold text-koma-text">Sources</div>
                    <div className="mt-4 space-y-3">
                      {page.sourceLinks.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-koma-text-secondary transition-colors hover:text-koma-text"
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
