import { useMemo } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { Check, X } from "lucide-react";
import { useI18n } from "../../i18n";

interface PasswordStrengthProps {
  password: string;
}

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

export const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const { t } = useI18n();

  const rules: Rule[] = useMemo(
    () => [
      { label: t("password.rule.minLength"), test: (pw) => pw.length >= 8 },
      { label: t("password.rule.uppercase"), test: (pw) => /[A-Z]/.test(pw) },
      { label: t("password.rule.lowercase"), test: (pw) => /[a-z]/.test(pw) },
      { label: t("password.rule.number"), test: (pw) => /\d/.test(pw) },
      { label: t("password.rule.special"), test: (pw) => /[^A-Za-z0-9]/.test(pw) },
    ],
    [t],
  );

  const strengthConfig = useMemo(
    () => [
      { label: t("password.level.veryWeak"), gradient: "linear-gradient(90deg,#f43f5e,rgba(244,63,94,0.35))", textCls: "koma-str--rose" },
      { label: t("password.level.weak"), gradient: "linear-gradient(90deg,#f59e0b,rgba(245,158,11,0.35))", textCls: "koma-str--amber" },
      { label: t("password.level.fair"), gradient: "linear-gradient(90deg,#a855f7,rgba(168,85,247,0.35))", textCls: "koma-str--purple" },
      { label: t("password.level.good"), gradient: "linear-gradient(90deg,#06b6d4,rgba(6,182,212,0.35))", textCls: "koma-str--cyan" },
      { label: t("password.level.strong"), gradient: "linear-gradient(90deg,#10b981,rgba(16,185,129,0.35))", textCls: "koma-str--emerald" },
    ],
    [t],
  );

  const passed = useMemo(() => rules.filter((r) => r.test(password)).length, [password, rules]);
  const level = password.length === 0 ? -1 : Math.min(passed, strengthConfig.length - 1);
  const config = level >= 0 ? strengthConfig[level] : null;
  if (password.length === 0) return null;

  return (
    // ponytail: render-rule fix — `m` + LazyMotion(domAnimation) instead of the
    // full `motion` component trims ~30kb from the auth bundle; this screen
    // only animates opacity/position/scale, which domAnimation covers.
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        <m.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="koma-strength">
          <div className="koma-strength__bars">
            {strengthConfig.map((seg, i) => (
              <div key={seg.label} className="koma-strength__seg">
                {/* scaleX (origin left) instead of width: the .koma-strength__seg wrapper has overflow:hidden, so the scaled fill clips like a width grow */}
                <m.div className="koma-strength__segFill" style={{ background: seg.gradient, width: '100%', originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: i <= level ? 1 : 0 }} transition={{ duration: 0.35, delay: i * 0.05 }} />
              </div>
            ))}
          </div>
          {config && <p className={`koma-strength__label ${config.textCls}`}>{config.label}</p>}
          <ul className="koma-strength__rules">
            {rules.map((rule) => {
              const ok = rule.test(password);
              return (
                <m.li key={rule.label} className="koma-strength__rule" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
                  {ok ? <Check size={14} className="koma-strength__check--ok" strokeWidth={2.5} /> : <X size={14} className="koma-strength__check--no" strokeWidth={2.5} />}
                  <span className={ok ? "koma-strength__ruleText--ok" : "koma-strength__ruleText--no"}>{rule.label}</span>
                </m.li>
              );
            })}
          </ul>
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
};
