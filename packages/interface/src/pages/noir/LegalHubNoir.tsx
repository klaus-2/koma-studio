'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, FileSignature, LifeBuoy, ScrollText } from 'lucide-react';

import { LEGAL_SUPPORT_URL, getLegalDocuments } from '../../legal/legalDocuments';
import { getOrderedLegalDocuments, navigateToLegalDocument } from '../../legal/navigation';
import type { LegalDocumentId } from '../../legal/legalContent.types';
import { useI18n } from '../../i18n';
import ResourceExternalAnchor from '../../components/resources/ResourceExternalAnchorNoir';
import { useNoirMotion } from '../../components/noir-panels/NoirPrimitives';

interface LegalHubPageProps {
  documentId: LegalDocumentId;
}

export const LegalHubPage = ({ documentId }: LegalHubPageProps) => {
  const { locale, t } = useI18n();
  const m = useNoirMotion();
  const documentsById = getLegalDocuments(locale);
  const document = documentsById[documentId];
  const documents = getOrderedLegalDocuments(locale);

  const handleBack = () => {
    if (typeof window === 'undefined') return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.hash = '/login';
  };

  return (
    <div className="halftone min-h-screen bg-ink px-4 py-8 sm:px-8">
      <motion.div
        variants={m.container}
        initial={m.initial}
        animate={m.animate}
        className="mx-auto flex max-w-6xl flex-col gap-5"
      >
        {/* ── Hero ── */}
        <motion.header variants={m.item} className="glass panel-cut relative overflow-hidden p-6">
          <span
            aria-hidden
            className="text-outline pointer-events-none absolute -top-9 right-4 select-none font-display text-[130px] font-black leading-none"
          >
            法務
          </span>
          <div className="halftone-red pointer-events-none absolute inset-y-0 right-0 w-48 opacity-40" aria-hidden />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="kicker mb-2 flex items-center gap-2">
                <ScrollText size={11} aria-hidden />
                {'// '}
                {document.eyebrow}
              </p>
              <h1 className="font-display text-3xl font-black uppercase leading-none tracking-tight text-paper">
                {document.title}
              </h1>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-paper/50">{document.summary}</p>
              <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.22em] text-paper/35">
                {t('legalHub.version')} <span className="text-gold">{document.version}</span>
                <span aria-hidden className="mx-2 text-crimson">◆</span>
                {t('legalHub.updatedAt')} <span className="text-gold">{document.lastUpdated}</span>
              </p>
            </div>
            <button type="button" onClick={handleBack} className="btn-ghost">
              <ArrowLeft size={11} /> {t('legalHub.back')}
            </button>
          </div>
        </motion.header>

        {/* ── Highlights strip ── */}
        <motion.section
          variants={m.item}
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {document.highlights.map((highlight) => (
            <div
              key={highlight}
              className="panel-cut-sm flex items-start gap-2.5 border border-paper/10 border-l-[3px] border-l-crimson bg-ink-2/60 px-3.5 py-3"
            >
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-none rotate-45 bg-gold" />
              <p className="text-[11px] leading-relaxed text-paper/65">{highlight}</p>
            </div>
          ))}
        </motion.section>

        {/* ── Layout ── */}
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Sidebar */}
          <motion.aside variants={m.item} className="glass panel-cut lg:sticky lg:top-6 p-4">
            <p className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] text-paper/40">
              <FileSignature size={10} aria-hidden />
              {t('legalHub.sidebarTitle')}
              <span aria-hidden className="h-px flex-1 bg-paper/10" />
            </p>

            <nav className="flex flex-col gap-1.5">
              {documents.map((item, idx) => {
                const active = item.id === documentId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => navigateToLegalDocument(item.id)}
                    className={`panel-cut-sm flex flex-col gap-0.5 border px-3 py-2.5 text-left transition-all duration-150 ${active
                        ? 'border-crimson bg-crimson/10 -translate-x-0.5 -translate-y-0.5 drop-shadow-[3px_3px_0_rgba(255,200,87,0.85)]'
                        : 'border-paper/10 hover:border-paper/30'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`font-mono text-[9px] ${active ? 'text-crimson' : 'text-paper/30'}`}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <strong className="font-display text-[11.5px] font-extrabold uppercase tracking-wide text-paper">
                        {item.title}
                      </strong>
                    </span>
                    <span className="pl-6 font-mono text-[8.5px] uppercase tracking-[0.18em] text-paper/40">
                      {item.eyebrow}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-5 border-t border-paper/10 pt-4">
              <p className="mb-3 text-[10.5px] leading-relaxed text-paper/45">
                {t('legalHub.supportDescription')}
              </p>
              <ResourceExternalAnchor
                href={LEGAL_SUPPORT_URL}
                className="panel-cut-sm inline-flex items-center gap-1.5 bg-crimson px-3 py-2 font-display text-[10.5px] font-extrabold uppercase tracking-wider text-ink transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:drop-shadow-[4px_4px_0_#ffc857]"
              >
                <LifeBuoy size={11} /> {t('legalHub.supportCta')}
              </ResourceExternalAnchor>
            </div>
          </motion.aside>

          {/* Document */}
          <motion.article variants={m.item} className="glass panel-cut noir-doc relative min-w-0 p-6 sm:p-8">
            <span
              aria-hidden
              className="v-text pointer-events-none absolute right-3 top-6 select-none font-display text-3xl font-black tracking-[0.3em] text-paper/[0.05]"
            >
              契約書
            </span>
            {document.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets && section.bullets.length > 0 && (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </motion.article>
        </div>
      </motion.div>
    </div>
  );
};
