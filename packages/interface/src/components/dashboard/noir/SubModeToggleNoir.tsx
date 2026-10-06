import { motion } from "framer-motion";
import { Paintbrush, Sparkles } from "lucide-react";
import { useI18n } from "../../../i18n";

export interface SubModeToggleProps {
  value: "auto" | "manual";
  onChange: (value: "auto" | "manual") => void;
}

export default function SubModeToggleNoir({ value, onChange }: SubModeToggleProps) {
  const { t } = useI18n();
  const options = [
    { key: "auto" as const, Icon: Sparkles, label: t("dashboard.aio.autoScope"), title: t("dashboard.aio.autoScopeTitle") },
    { key: "manual" as const, Icon: Paintbrush, label: t("dashboard.aio.manualScope"), title: t("dashboard.aio.manualScopeTitle") },
  ];

  return (
    <div
      role="tablist"
      aria-label="Sub-mode"
      data-tour="dashboard-submode-toggle"
      className="glass panel-cut-sm inline-flex items-center gap-0.5 p-1"
    >
      {options.map(({ key, Icon, label, title }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            title={title}
            onClick={() => onChange(key)}
            className={`relative panel-cut-sm px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson ${active ? "text-ink" : "text-paper/45 hover:text-paper"
              }`}
          >
            {active && (
              <motion.span
                layoutId="koma-submode-ink"
                aria-hidden
                className="panel-cut-sm absolute inset-0 bg-crimson"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Icon size={11} strokeWidth={2.5} />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
