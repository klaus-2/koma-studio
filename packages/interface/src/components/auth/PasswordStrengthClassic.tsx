import { useMemo } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { Check, X } from "lucide-react";
import { useI18n } from "../../i18n";
import {
  PASSWORD_LEVELS,
  evaluatePasswordStrength,
} from "./passwordStrengthModel";

interface PasswordStrengthProps {
  password: string;
}

const LEVEL_STYLES = [
  {
    gradient: "linear-gradient(90deg,#f43f5e,rgba(244,63,94,0.35))",
    textCls: "koma-str--rose",
  },
  {
    gradient: "linear-gradient(90deg,#f59e0b,rgba(245,158,11,0.35))",
    textCls: "koma-str--amber",
  },
  {
    gradient: "linear-gradient(90deg,#a855f7,rgba(168,85,247,0.35))",
    textCls: "koma-str--purple",
  },
  {
    gradient: "linear-gradient(90deg,#06b6d4,rgba(6,182,212,0.35))",
    textCls: "koma-str--cyan",
  },
  {
    gradient: "linear-gradient(90deg,#10b981,rgba(16,185,129,0.35))",
    textCls: "koma-str--emerald",
  },
] as const;

export const PasswordStrengthClassic = ({ password }: PasswordStrengthProps) => {
  const { t } = useI18n();
  const { level, ruleResults } = useMemo(
    () => evaluatePasswordStrength(password),
    [password],
  );
  if (password.length === 0) return null;

  const config = level >= 0 ? LEVEL_STYLES[level] : null;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        <m.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="koma-strength">
          <div className="koma-strength__bars">
            {PASSWORD_LEVELS.map((seg, i) => (
              <div key={seg.labelKey} className="koma-strength__seg">
                <m.div className="koma-strength__segFill" style={{ background: LEVEL_STYLES[i]!.gradient, width: '100%', originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: i <= level ? 1 : 0 }} transition={{ duration: 0.35, delay: i * 0.05 }} />
              </div>
            ))}
          </div>
          {config && <p className={`koma-strength__label ${config.textCls}`}>{t(PASSWORD_LEVELS[level]!.labelKey)}</p>}
          <ul className="koma-strength__rules">
            {ruleResults.map(({ rule, ok }) => (
              <m.li key={rule.labelKey} className="koma-strength__rule" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
                {ok ? <Check size={14} className="koma-strength__check--ok" strokeWidth={2.5} /> : <X size={14} className="koma-strength__check--no" strokeWidth={2.5} />}
                <span className={ok ? "koma-strength__ruleText--ok" : "koma-strength__ruleText--no"}>{t(rule.labelKey)}</span>
              </m.li>
            ))}
          </ul>
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
};
