import { memo, useId, useState, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

interface AioSectionProps {
  icon: LucideIcon;
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export const AioSectionNoir = memo(function AioSectionNoir({
  icon: Icon,
  title,
  badge,
  defaultOpen = true,
  children,
}: AioSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();
  const bodyId = useId();

  return (
    <section className={cn("koma-aio-section", open && "koma-aio-section--open")}>
      <button
        type="button"
        className="koma-aio-section__header"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="koma-aio-section__header-icon" aria-hidden="true">
          <Icon size={12} strokeWidth={2.5} />
        </span>

        <span className="koma-aio-section__title">
          <span className="koma-aio-section__slashes" aria-hidden="true">//</span>
          {title}
        </span>

        {badge}

        <span className="koma-aio-section__chevron" aria-hidden="true">▼</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div className="koma-aio-section__body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
});
