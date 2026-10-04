import { ReactNode } from "react";

import { AuthSimpleShell } from "../../components/auth/AuthSimpleShell";
import { Alert } from "../../components/auth/noir/koma-ui";
import { useI18n } from "../../i18n";

export interface ConfirmEmailViewProps {
  title: string;
  subtitle: string;
  isVerifying: boolean;
  errorCode: string | null;
  isSuccess: boolean;
  onNavigateDashboard: () => void;
  onNavigateLogin: () => void;
}

export const ConfirmEmailNoir = ({
  title,
  subtitle,
  isVerifying,
  errorCode,
  isSuccess,
  onNavigateDashboard,
  onNavigateLogin,
}: ConfirmEmailViewProps): ReactNode => {
  const { t } = useI18n();

  return (
    <AuthSimpleShell accent={t("auth.noir.accentConfirm")} title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {isVerifying && (
          <Alert tone="info">
            <span className="flex items-center gap-3">
              <span className="spinner-hard" aria-hidden /> {t("confirm.status.wait")}
            </span>
          </Alert>
        )}

        {!isVerifying && errorCode && (
          <Alert tone="error" title={t("confirm.errorCode")}>
            <strong>{errorCode}</strong>
          </Alert>
        )}

        {isSuccess && <Alert tone="success">▣ {t("confirm.success")}</Alert>}

        <div className="grid gap-3">
          <button type="button" onClick={onNavigateDashboard} className="btn-primary w-full">
            {t("confirm.goDashboard")} →
          </button>
          <button type="button" onClick={onNavigateLogin} className="btn-ghost w-full">
            {t("confirm.goLogin")}
          </button>
        </div>
      </div>
    </AuthSimpleShell>
  );
};
