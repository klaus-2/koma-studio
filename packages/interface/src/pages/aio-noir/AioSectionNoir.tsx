import { useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface AioSectionProps {
  icon: LucideIcon;
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export const AioSectionNoir = ({
  icon: Icon,
  title,
  badge,
  defaultOpen = true,
  children,
}: AioSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();

  return (
    <section
      className={cn(
        "glass panel-cut-sm mb-3 overflow-hidden border-l-2 border-l-crimson/70",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-crimson/12 text-crimson panel-cut-sm">
          <Icon size={14} strokeWidth={2.4} />
        </span>
        <h3 className="flex-1 font-display text-[13px] font-extrabold uppercase tracking-tight text-paper">
          {title}
        </h3>
        {badge}
        <ChevronDown
          size={15}
          className={cn(
            "text-paper-dim transition-transform duration-300",
            open && "rotate-180 text-crimson",
            reduced && "transition-none",
          )}
        />
      </button>

      <div
        className={cn(
          "grid",
          reduced
            ? open
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
            : [
                "transition-[grid-template-rows,opacity] duration-300",
                "[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
                open
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0 pointer-events-none",
              ],
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="halftone space-y-3 border-t border-paper/8 px-3.5 py-3.5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};