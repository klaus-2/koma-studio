import { useMemo } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { useI18n } from "../../../i18n";
import {
  PASSWORD_LEVELS,
  evaluatePasswordStrength,
} from "../passwordStrengthModel";

const LEVEL_COLORS = [
  "var(--noir-crimson)",
  "var(--noir-gold)",
  "var(--noir-gold)",
  "var(--noir-azure)",
  "var(--noir-mint)",
] as const;

export function PasswordStrengthNoir({ password }: { password: string }) {
  const { t } = useI18n();
  const { level, ruleResults } = useMemo(
    () => evaluatePasswordStrength(password),
    [password],
  );
  if (!password) return null;

  const cfgColor = LEVEL_COLORS[Math.max(level, 0)]!;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        <m.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="panel-cut-sm overflow-hidden border border-paper/10 bg-ink/50 px-4 py-3.5"
        >
          <div className="flex gap-1.5" aria-hidden>
            {PASSWORD_LEVELS.map((seg, i) => (
              <div key={seg.labelKey} className="h-[5px] flex-1 bg-paper/10">
                <m.div
                  className="h-full w-full origin-left"
                  style={{ background: LEVEL_COLORS[i] }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: i <= level ? 1 : 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            ))}
          </div>

          <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: cfgColor }}>
            {t(PASSWORD_LEVELS[Math.max(level, 0)]!.labelKey)}
          </p>

          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {ruleResults.map(({ rule, ok }) => (
              <li key={rule.labelKey} className="flex items-center gap-2 font-mono text-[10.5px] tracking-wide">
                <span className={ok ? "text-mint" : "text-paper/25"}>{ok ? "▣" : "▢"}</span>
                <span className={ok ? "text-paper/70" : "text-paper/35"}>{t(rule.labelKey)}</span>
              </li>
            ))}
          </ul>
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
