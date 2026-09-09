import { AlertTriangle, ShieldBan } from "lucide-react";

import { AuthSimpleShell } from "../components/auth/AuthSimpleShell";
import type { ActiveBanInfo } from "../contexts/AuthContext";
import { useI18n } from "../i18n";

interface BannedPageProps {
  ban: ActiveBanInfo;
  onBackLogin: () => void;
}

export const BannedPage = ({ ban, onBackLogin }: BannedPageProps) => {
  const { t } = useI18n();
  const expiresAtLabel = ban.expiresAt ?? t("banned.undefinedDate");

  return (
  <AuthSimpleShell
    title={ban.title || t("banned.title")}
    subtitle={t("banned.subtitle")}
  >
    <div className="auth-alert auth-alert--warning" role="alert">
      <ShieldBan size={16} />
      <span>{ban.detail}</span>
    </div>

    <div className="koma-ban-card">
      <div className="koma-ban-card__row">
        <span className="koma-ban-card__label">{t("banned.reason")}</span>
        <strong>{ban.reason}</strong>
      </div>
      <div className="koma-ban-card__row">
        <span className="koma-ban-card__label">{t("banned.scope")}</span>
        <strong>{ban.scope}</strong>
      </div>
      <div className="koma-ban-card__row">
        <span className="koma-ban-card__label">{t("banned.duration")}</span>
        <strong>{ban.temporary ? t("banned.until", { value: expiresAtLabel }) : t("banned.permanent")}</strong>
      </div>
    </div>

    <div className="auth-alert auth-alert--info" role="note">
      <AlertTriangle size={16} />
      <span>
        {t("banned.policy")}
      </span>
    </div>

    <button type="button" className="auth-submit" onClick={onBackLogin}>
      {t("banned.backToLogin")}
    </button>
  </AuthSimpleShell>
  );
};
