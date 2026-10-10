import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { SeoPage } from "@/types";
import { toSectionId } from "@/lib/seo";

export function SeoPageTemplate({ page }: { page: SeoPage }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-ink">
        <section className="relative overflow-hidden py-28">
          <div
            aria-hidden
            className="halftone absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="max-w-4xl">
              <div className="stamp mb-6">{page.title}</div>
              <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight text-paper sm:text-5xl lg:text-6xl">
                {page.heroTitle}
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-paper/60">
                {page.heroSubtitle}
              </p>
              {page.intro ? (
                <p className="mt-6 max-w-3xl text-base leading-relaxed text-paper/45">
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
                <section className="glass panel-cut p-7">
                  <div className="kicker">In Short</div>
                  <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-paper">
                    {page.summaryQuestion}
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-relaxed text-paper/60">
                    {page.summaryAnswer}
                  </p>
                  {page.summaryTakeaways?.length ? (
                    <ul className="mt-5 grid gap-3 md:grid-cols-3">
                      {page.summaryTakeaways.map((takeaway) => (
                        <li
                          key={takeaway}
                          className="panel-cut-sm border border-paper/10 bg-paper/[0.02] px-4 py-3 text-sm text-paper/50"
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
                      className="glass panel-cut scroll-mt-28 p-7"
                    >
                      <h2 className="text-2xl font-black uppercase tracking-tight text-paper">
                        {section.title}
                      </h2>
                      <p className="mt-4 text-base leading-relaxed text-paper/60">
                        {section.content}
                      </p>
                      {section.features ? (
                        <ul className="mt-5 space-y-2">
                          {section.features.map((feature) => (
                            <li
                              key={feature}
                              className="flex items-start gap-2 text-sm text-paper/50"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-crimson" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}

                {page.downloadLinks?.length ? (
                  <section className="glass panel-cut p-7">
                    <div className="kicker">Downloads</div>
                    <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-paper">
                      Stable Download Links
                    </h2>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {page.downloadLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="panel-cut-sm border border-paper/15 bg-paper/[0.02] px-4 py-4 text-sm font-medium text-paper/80 transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-crimson/50 hover:shadow-[4px_4px_0_rgba(255,46,99,0.4)]"
                        >
                          {link.title}
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="relative self-start space-y-6 lg:sticky lg:top-24">
                <div className="glass panel-cut-sm p-6">
                  <div className="kicker">On This Page</div>
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
                    Common Questions
                  </div>
                  <div className="mt-4 space-y-4">
                    {page.faqs.map((faq) => (
                      <div
                        key={faq.question}
                        className="border-b border-paper/10 pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="text-sm font-medium text-paper">
                          {faq.question}
                        </div>
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
