import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PRIVACY, TERMS, type LegalDocument } from "@/content/legal";

const siblingDocument = (doc: LegalDocument): LegalDocument =>
  doc.slug === "terms-of-service" ? PRIVACY : TERMS;

export default function LegalPageTemplate({ doc }: { doc: LegalDocument }) {
  const sibling = siblingDocument(doc);

  return (
    <>
      <a
        href="#legal-document"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-crimson focus:px-4 focus:py-2 focus:font-[family-name:var(--font-mono)] focus:text-[11px] focus:uppercase focus:tracking-widest focus:text-ink"
      >
        Skip to document
      </a>
      <Navbar />
      <main id="legal-document" className="min-h-screen bg-ink">
        <section className="border-b border-paper/10 pt-32 pb-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="kicker mb-5">Legal</div>
            <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.95] tracking-tight text-paper sm:text-5xl lg:text-6xl">
              {doc.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-paper">
              {doc.lead}
            </p>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-paper/60">
              {doc.scopeNote}
            </p>
            <p className="mt-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] text-paper/60 sm:text-xs sm:tracking-[0.25em]">
              {`${doc.version} · Effective ${doc.effectiveDate}`}
            </p>
          </div>
        </section>

        <section className="pt-16 pb-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                {doc.sections.map((section) => (
                  <article
                    key={section.id}
                    id={section.id}
                    className="glass panel-cut scroll-mt-28 p-7"
                  >
                    <h2 className="text-2xl font-black uppercase leading-tight tracking-tight text-paper">
                      {section.title}
                      <a
                        href={`#${section.id}`}
                        aria-label="Link to this section"
                        className="ml-3 align-middle font-[family-name:var(--font-mono)] text-base font-normal text-paper/60 transition-colors hover:text-crimson"
                      >
                        #
                      </a>
                    </h2>
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="mt-4 text-base leading-relaxed text-paper"
                      >
                        {paragraph}
                      </p>
                    ))}
                    {section.bullets ? (
                      <ul className="mt-5 space-y-2">
                        {section.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="flex items-start gap-2 text-sm leading-relaxed text-paper"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-crimson" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>

              <aside className="relative self-start space-y-6 lg:sticky lg:top-24">
                <nav
                  aria-label="Document contents"
                  className="glass panel-cut-sm p-6"
                >
                  <div className="kicker">Contents</div>
                  <ol className="mt-4 space-y-2">
                    {doc.sections.map((section, index) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="block border border-paper/10 bg-paper/[0.02] px-4 py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-paper/60 transition-colors hover:border-crimson/40 hover:text-paper"
                        >
                          <span className="mr-2 text-crimson">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>

                <nav
                  aria-label="Related legal documents"
                  className="glass panel-cut-sm p-6"
                >
                  <div className="kicker">Also published</div>
                  <div className="mt-4 space-y-3">
                    <Link
                      href={`/${sibling.slug}/`}
                      className="block border border-paper/10 bg-paper/[0.02] px-4 py-3 text-sm text-paper/70 transition-colors hover:border-crimson/40 hover:text-paper"
                    >
                      {sibling.title}
                    </Link>
                    <p className="font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-paper/60">
                      {`${sibling.version} · Effective ${sibling.effectiveDate}`}
                    </p>
                  </div>
                </nav>

                <div className="glass panel-cut-sm p-6">
                  <div className="kicker">Source of this text</div>
                  <p className="mt-4 text-sm leading-relaxed text-paper/70">
                    Every statement in this document describes code in the
                    repository. Read the implementation, not just the promise:{" "}
                    <a
                      href="https://github.com/klaus-2/koma-studio"
                      target="_blank"
                      rel="noreferrer"
                      className="border-b border-crimson/40 text-paper transition-colors hover:text-crimson"
                    >
                      klaus-2/koma-studio
                    </a>
                  </p>
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
