import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";
import { Hanko, PrintTicks } from "./koma-ui";
import { useI18n } from "../../../i18n";

const EASE = [0.22, 1, 0.36, 1] as const;

interface AuthSimpleShellProps {
  title: string;
  accent?: string;
  subtitle: string;
  children: ReactNode;
}

export const AuthSimpleShellNoir = ({ title, accent, subtitle, children }: AuthSimpleShellProps) => {
  const { t } = useI18n();
  const reduced = useReducedMotion();

  return (
    <LazyMotion features={domAnimation}>
      <div className="koma-noir relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-14">
        <div aria-hidden className="halftone absolute inset-0 opacity-40" />
        <div aria-hidden className="absolute -top-24 right-1/4 h-96 w-96 rounded-full bg-crimson/10 blur-[130px]" />
        <span aria-hidden className="text-outline absolute -bottom-8 left-6 select-none font-display text-[9rem] font-black leading-none tracking-tighter">
          コマ
        </span>
        <span aria-hidden className="v-text absolute right-6 top-20 font-display text-xs font-bold tracking-[0.5em] text-paper/20">
          コマ・スタジオ — 認証
        </span>

        <m.section
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: EASE }}
          className="relative w-full max-w-md"
        >
          <PrintTicks />
          <div className="glass panel-cut relative p-7 sm:p-9">
            <header className="mb-6 flex items-center gap-3">
              <Hanko size={36} />
              <span className="font-display text-lg font-black uppercase tracking-tight text-paper">
                {t("brand.name")}{" "}
                <span className="font-accent font-normal normal-case italic text-crimson">{t("brand.studioSuffix")}</span>
                <span className="text-gold">.</span>
              </span>
            </header>

            <span className="kicker">// {accent ?? t("auth.noir.accentDefault")}</span>
            <h2 className="mt-2 font-display text-[26px] font-black uppercase leading-tight tracking-tight text-paper">
              {title}
            </h2>
            <p className="mb-7 mt-2 text-[13px] leading-relaxed text-paper/55">{subtitle}</p>

            {children}
          </div>
        </m.section>
      </div>
    </LazyMotion>
  );
};
