import { LEGAL_SUPPORT_URL, getLegalDocuments, type LegalDocumentId } from "../legal/legalDocuments";
import { getOrderedLegalDocuments, navigateToLegalDocument } from "../legal/navigation";
import { useI18n } from "../i18n";
import ResourceExternalAnchor from "../components/resources/ResourceExternalAnchor";

interface LegalHubPageProps {
  documentId: LegalDocumentId;
}

export const LegalHubPage = ({ documentId }: LegalHubPageProps) => {
  const { locale, t } = useI18n();
  const documentsById = getLegalDocuments(locale);
  const document = documentsById[documentId];
  const documents = getOrderedLegalDocuments(locale);

  const handleBack = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.hash = "/login";
  };

  return (
    <div className="koma-page koma-legal-page">
      <div className="koma-page__bg" aria-hidden="true" />
      <div className="koma-page__halftone" aria-hidden="true" />
      <div className="auth-orb auth-orb--purple" aria-hidden="true" />
      <div className="auth-orb auth-orb--cyan" aria-hidden="true" />

      <div className="koma-page__container koma-page__container--lg">
        <div className="koma-page-header">
          <div className="koma-page-header__info">
            <p className="koma-legal-page__eyebrow">{document.eyebrow}</p>
            <h1 className="koma-page-header__title">{document.title}</h1>
            <p className="koma-page-header__subtitle">{document.summary}</p>
            <p className="koma-page-header__subtitle" style={{ marginTop: 10 }}>
              {t("legalHub.version")} {document.version} • {t("legalHub.updatedAt")} {document.lastUpdated}
            </p>
          </div>
          <button type="button" onClick={handleBack} className="koma-back-btn">
            {t('legalHub.back')}
          </button>
        </div>

        <section className="koma-card koma-card--wide koma-legal-page__highlights">
          {document.highlights.map((highlight) => (
            <div key={highlight} className="koma-legal-page__highlight">
              <span className="koma-legal-page__dot" aria-hidden="true" />
              <p>{highlight}</p>
            </div>
          ))}
        </section>

        <div className="koma-legal-layout">
          <aside className="koma-card koma-legal-sidebar">
            <div className="koma-section__header" style={{ marginBottom: 14 }}>
              <span className="koma-section__title">{t('legalHub.sidebarTitle')}</span>
            </div>

            <div className="koma-legal-sidebar__nav">
              {documents.map((item) => {
                const active = item.id === documentId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`koma-legal-sidebar__item ${active ? "koma-legal-sidebar__item--active" : ""}`}
                    onClick={() => navigateToLegalDocument(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.eyebrow}</span>
                  </button>
                );
              })}
            </div>

            <div className="koma-legal-sidebar__support">
              <p className="koma-page-header__subtitle">
                {t('legalHub.supportDescription')}
              </p>
              <ResourceExternalAnchor href={LEGAL_SUPPORT_URL} className="koma-provider-btn koma-provider-btn--small">
                {t('legalHub.supportCta')}
              </ResourceExternalAnchor>
            </div>
          </aside>

          <article className="koma-card koma-card--wide koma-legal-doc">
            {document.sections.map((section) => (
              <section key={section.title} className="koma-legal-doc__section">
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
          </article>
        </div>
      </div>
    </div>
  );
};
