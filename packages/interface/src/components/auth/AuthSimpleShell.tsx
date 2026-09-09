import { ReactNode } from "react";
import { BrandMark } from "./AuthShell";
import { useI18n } from "../../i18n";

interface AuthSimpleShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export const AuthSimpleShell = ({ title, subtitle, children }: AuthSimpleShellProps) => {
  const { t } = useI18n();

  return (
  <div className="auth-simple">
    <div className="auth-simple__overlay" aria-hidden="true" />
    <div className="auth-simple__halftone" aria-hidden="true" />
    <div className="auth-orb auth-orb--purple" aria-hidden="true" />
    <div className="auth-orb auth-orb--cyan" aria-hidden="true" />

    <div className="auth-simple__container">
      <div className="auth-card auth-card--centered">
        <header className="auth-brand auth-brand--compact">
          <span className="auth-brand__icon">
            <BrandMark />
          </span>
          <h1 className="auth-brand__title">
            {t("brand.name")}<span className="auth-brand__accent">{t("brand.studioSuffix")}</span>
            <span className="auth-brand__dot">.</span>
          </h1>
        </header>

        <h2 className="auth-simple__title">{title}</h2>
        <p className="auth-simple__subtitle">{subtitle}</p>

        {children}
      </div>
    </div>
  </div>
  );
};
