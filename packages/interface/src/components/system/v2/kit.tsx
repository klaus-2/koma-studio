import { motion } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const btnPrimary =
  "panel-cut-sm hard-hover inline-flex items-center justify-center gap-1.5 bg-crimson px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";
export const btnMint =
  "panel-cut-sm hard-hover inline-flex items-center justify-center gap-1.5 bg-mint px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";
export const btnGhost =
  "panel-cut-sm hard-hover inline-flex items-center justify-center gap-1.5 border border-paper/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/70 hover:text-paper disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";

export const StripeBar = ({ percent, done = false, className = "" }: {
  percent: number; done?: boolean; className?: string;
}) => (
  <div
    className={`panel-cut-sm h-2 overflow-hidden border border-paper/10 bg-ink ${className}`}
    role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}
  >
    <motion.div
      className={`stripes-anim h-full ${done ? "bg-mint" : "bg-crimson"} bg-[repeating-linear-gradient(-45deg,rgba(7,7,12,0.3)_0_6px,transparent_6px_12px)] bg-[length:17px_17px]`}
      initial={false}
      animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      transition={{ type: "spring", stiffness: 90, damping: 22 }}
    />
  </div>
);
