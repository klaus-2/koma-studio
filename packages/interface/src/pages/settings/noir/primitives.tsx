import { m } from "framer-motion";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Class tokens ─────────────────────────────────────────── */
export const inputCls =
  "panel-cut-sm w-full border border-paper/12 bg-ink px-3 py-2 font-mono text-[11px] text-paper placeholder:text-paper/25 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson disabled:cursor-not-allowed disabled:opacity-40";
export const selectCls = `${inputCls} appearance-none`;
export const btnPrimary =
  "panel-cut-sm hard-hover inline-flex items-center gap-1.5 bg-crimson px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";
export const btnGhost =
  "panel-cut-sm hard-hover inline-flex items-center gap-1.5 border border-paper/20 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/70 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";
export const btnDanger =
  "panel-cut-sm hard-hover inline-flex items-center gap-1.5 border border-crimson/40 bg-crimson/10 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-crimson disabled:opacity-40";
export const iconBtn =
  "panel-cut-sm inline-flex h-7 w-7 items-center justify-center border border-paper/15 text-paper/45 transition-colors hover:border-paper/40 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";
export const iconBtnDanger =
  "panel-cut-sm inline-flex h-7 w-7 items-center justify-center border border-paper/15 text-paper/45 transition-colors hover:border-crimson/50 hover:text-crimson focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";

/* ── Section ────────────────────────────────── */
export const Sec = ({ icon, title, accent, desc, actions, children, className = "" }: {
  icon: ReactNode; title: string; accent?: string; desc?: string;
  actions?: ReactNode; children: ReactNode; className?: string;
}) => (
  <m.section
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-30px" }}
    transition={{ duration: 0.45, ease: EASE }}
    className={`glass panel-cut-sm relative border border-paper/8 p-5 ${className}`}
  >
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="panel-cut-sm flex h-8 w-8 shrink-0 items-center justify-center border border-crimson/40 bg-crimson/10 text-crimson">
            {icon}
          </span>
          <h3 className="font-display text-sm font-black uppercase tracking-tight text-paper">
            {title}
            {accent && <em className="font-accent font-normal normal-case italic text-crimson"> {accent}</em>}
          </h3>
        </div>
        {desc && <p className="mt-2 max-w-prose font-mono text-[10px] uppercase tracking-wider text-paper/40">{desc}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
    {children}
  </m.section>
);

/* ── Fields ───────────────────────────────────────────────── */
export const Field = ({ label, optional, children, className = "" }: {
  label: string; optional?: boolean; children: ReactNode; className?: string;
}) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">
      <span aria-hidden className="text-crimson">//</span> {label}
      {optional && <span className="ml-1 text-paper/25">(opt)</span>}
    </span>
    {children}
  </label>
);

/* ── Ink Toggle (hanko slide) ─────────────────────────────── */
export const InkToggle = ({ checked, onChange, disabled, label }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string;
}) => (
  <span className={`panel-cut-sm relative inline-flex h-5 w-10 shrink-0 border transition-colors ${checked ? "border-crimson bg-crimson/15" : "border-paper/20 bg-ink"
    } ${disabled ? "opacity-40" : "cursor-pointer"}`}>
    <input type="checkbox" role="switch" aria-checked={checked} aria-label={label}
      className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <m.span aria-hidden layout
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className={`absolute top-[3px] h-3 w-3 ${checked ? "right-1 bg-crimson" : "left-1 bg-paper/35"}`} />
  </span>
);

export const ToggleRow = ({ title, desc, checked, onChange, disabled }: {
  title: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) => (
  <div className="panel-cut-sm flex items-center justify-between gap-4 border border-paper/8 bg-ink/50 px-4 py-3">
    <div>
      <p className="font-display text-xs font-bold uppercase tracking-tight text-paper">{title}</p>
      {desc && <p className="mt-0.5 font-mono text-[10px] text-paper/40">{desc}</p>}
    </div>
    <InkToggle checked={checked} onChange={onChange} disabled={disabled} label={title} />
  </div>
);

/* ── Range slider crimson ─────────────────────────────────── */
export const RangeField = ({ label, value, display, min, max, step, disabled, onChange }: {
  label: string; value: number; display: string; min: number; max: number;
  step: number; disabled?: boolean; onChange: (v: number) => void;
}) => (
  <Field label={label}>
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none bg-paper/15 disabled:opacity-40
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-crimson"
        style={{ accentColor: "var(--color-crimson)" }} />
      <span className="w-14 shrink-0 text-right font-mono text-[10px] font-bold text-gold">{display}</span>
    </div>
  </Field>
);

/* ── Alerts ───────────────────────────────────────────────── */
export const Alert = ({ tone, children }: { tone: "success" | "error" | "info" | "warn"; children: ReactNode }) => {
  const cfg = {
    success: { c: "border-mint bg-mint/8 text-mint", I: CheckCircle2, role: "status" as const },
    error: { c: "border-crimson bg-crimson/8 text-crimson", I: AlertTriangle, role: "alert" as const },
    warn: { c: "border-gold bg-gold/8 text-gold", I: AlertTriangle, role: "alert" as const },
    info: { c: "border-azure bg-azure/8 text-azure", I: Info, role: "status" as const },
  }[tone];
  return (
    <m.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: EASE }} role={cfg.role}
      className={`flex items-start gap-2 border-l-2 px-3 py-2 font-mono text-[11px] ${cfg.c}`}>
      <cfg.I size={12} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-paper/80">{children}</div>
    </m.div>
  );
};

/* ── Spec sheet (dossier mono) ────────────────────────────── */
export const SpecGrid = ({ children }: { children: ReactNode }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">{children}</dl>
);
export const SpecRow = ({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-paper/10 py-2.5">
    <dt className="shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-paper/35">{label}</dt>
    <dd className={`min-w-0 truncate text-right text-[12px] text-paper ${mono ? "font-mono" : ""}`}>{children}</dd>
  </div>
);

export const chip = (tone: "crimson" | "mint" | "gold" | "azure" | "neutral") => ({
  crimson: "border-crimson/50 bg-crimson/10 text-crimson",
  mint: "border-mint/50 bg-mint/10 text-mint",
  gold: "border-gold/50 bg-gold/10 text-gold",
  azure: "border-azure/50 bg-azure/10 text-azure",
  neutral: "border-paper/20 bg-paper/5 text-paper/50",
}[tone] + " inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]");
