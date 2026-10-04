import { useMemo } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { useI18n } from "../../../i18n";

const RULES = [
  { labelKey: "password.rule.minLength", test: (pw: string) => pw.length >= 8 },
  { labelKey: "password.rule.uppercase", test: (pw: string) => /[A-Z]/.test(pw) },
  { labelKey: "password.rule.lowercase", test: (pw: string) => /[a-z]/.test(pw) },
  { labelKey: "password.rule.number", test: (pw: string) => /\d/.test(pw) },
  { labelKey: "password.rule.special", test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
] as const;

type LevelKey =
  | "password.level.veryWeak"
  | "password.level.weak"
  | "password.level.fair"
  | "password.level.good"
  | "password.level.strong";

const LEVELS: { labelKey: LevelKey; color: string }[] = [
  { labelKey: "password.level.veryWeak", color: "var(--noir-crimson)" },
  { labelKey: "password.level.weak", color: "var(--noir-gold)" },
  { labelKey: "password.level.fair", color: "var(--noir-gold)" },
  { labelKey: "password.level.good", color: "var(--noir-azure)" },
  { labelKey: "password.level.strong", color: "var(--noir-mint)" },
];

export function PasswordStrengthNoir({ password }: { password: string }) {
  const { t } = useI18n();
  const passed = useMemo(() => RULES.filter((r) => r.test(password)).length, [password]);
  if (!password) return null;

  const level = Math.min(passed, LEVELS.length) - 1;
  // Index is mathematically in range (level >= 0, LEVELS.length >= 1).
  const cfg = LEVELS[Math.max(level, 0)]!;

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
            {LEVELS.map((seg, i) => (
              <div key={seg.labelKey} className="h-[5px] flex-1 bg-paper/10">
                <m.div
                  className="h-full"
                  style={{ background: seg.color }}
                  initial={{ width: 0 }}
                  animate={{ width: i <= level ? "100%" : "0%" }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            ))}
          </div>

          <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: cfg.color }}>
            {t(cfg.labelKey)}
          </p>

          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.labelKey} className="flex items-center gap-2 font-mono text-[10.5px] tracking-wide">
                  <span className={ok ? "text-mint" : "text-paper/25"}>{ok ? "▣" : "▢"}</span>
                  <span className={ok ? "text-paper/70" : "text-paper/35"}>{t(rule.labelKey)}</span>
                </li>
              );
            })}
          </ul>
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
