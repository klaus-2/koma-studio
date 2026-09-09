import { useI18n } from "../../i18n";
import type { LegalDocumentId } from "../../legal/legalDocuments";
import { navigateToLegalDocument } from "../../legal/navigation";

interface LegalInlineLinksProps {
  className?: string;
  includeContentPolicy?: boolean;
}

const baseDocuments: LegalDocumentId[] = ["terms", "privacy", "cookies"];

export const LegalInlineLinks = ({
  className = "",
  includeContentPolicy = false,
}: LegalInlineLinksProps) => {
  const { t } = useI18n();
  const documents = includeContentPolicy ? [...baseDocuments, "content" as const] : baseDocuments;

  const labelByDocument: Record<LegalDocumentId, string> = {
    terms: t("legal.links.terms"),
    privacy: t("legal.links.privacy"),
    cookies: t("legal.links.cookies"),
    content: t("legal.links.content"),
  };

  return (
    <span className={className}>
      {documents.map((documentId, index) => (
        <span key={documentId}>
          {index > 0 && <span className="koma-legal-inline__sep">•</span>}
          <button
            type="button"
            className="auth-link koma-legal-inline__link"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              navigateToLegalDocument(documentId);
            }}
          >
            {labelByDocument[documentId]}
          </button>
        </span>
      ))}
    </span>
  );
};

