import { useState, type ReactNode } from "react";
import { ChevronDown, BookOpen } from "lucide-react";
import { cn } from "@/utils/dashboard.utils";


interface IntegGuideProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export const IntegGuide = ({ title, children, defaultOpen = false }: IntegGuideProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("koma-ig-guide", open && "koma-ig-guide--open")}>
      <button
        type="button"
        className="koma-ig-guide__trigger"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <span className="koma-ig-guide__trigger-icon" aria-hidden="true"><BookOpen size={10} /></span>
        {title}
        <ChevronDown size={12} className="koma-ig-guide__chevron" />
      </button>
      {open && <div className="koma-ig-guide__body">{children}</div>}
    </div>
  );
};