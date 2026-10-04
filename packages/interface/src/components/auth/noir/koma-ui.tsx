import { forwardRef, InputHTMLAttributes, ReactNode } from "react";

export const Hanko = ({ size = 44 }: { size?: number }) => (
  <div
    aria-hidden
    className="panel-cut-sm grid shrink-0 place-items-center bg-crimson"
    style={{ width: size, height: size }}
  >
    <span className="font-display font-black leading-none text-ink" style={{ fontSize: size * 0.34 }}>
      コマ
    </span>
  </div>
);

export const PrintTicks = () => (
  <>
    <span aria-hidden className="pointer-events-none absolute -left-1 -top-1 font-mono text-[11px] text-paper/25">+</span>
    <span aria-hidden className="pointer-events-none absolute -bottom-1 -left-1 font-mono text-[11px] text-paper/25">+</span>
    <span aria-hidden className="pointer-events-none absolute -bottom-1 -right-1 font-mono text-[11px] text-paper/25">+</span>
  </>
);

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: ReactNode;
  trailing?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ id, label, icon, trailing, ...props }, ref) => (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-paper/50">
          <span className="text-crimson">//</span> {label}
        </label>
        {trailing}
      </div>
      <div className="relative">
        <span aria-hidden className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-paper/35">
          {icon}
        </span>
        <input id={id} ref={ref} className="input-koma" {...props} />
      </div>
    </div>
  ),
);

Field.displayName = "Field";

export function Submit({
  loading,
  loadingLabel,
  children,
  disabled,
}: {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={disabled || loading} className="btn-primary w-full">
      {loading ? (
        <>
          <span className="spinner-hard" aria-hidden />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

const TONES = {
  error: "border-crimson text-crimson bg-crimson/10",
  success: "border-mint text-mint bg-mint/10",
  warning: "border-gold text-gold bg-gold/10",
  info: "border-azure text-azure bg-azure/10",
} as const;

export function Alert({
  tone = "error",
  title,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`panel-cut-sm border px-4 py-3 font-mono text-[12px] leading-relaxed ${TONES[tone]}`}
    >
      {title && <p className="mb-1 font-bold uppercase tracking-[0.18em]">{title}</p>}
      {children}
    </div>
  );
}
