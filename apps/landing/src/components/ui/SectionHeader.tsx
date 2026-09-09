interface SectionHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  badge,
  title,
  subtitle,
  align = "center",
  className = "",
}: SectionHeaderProps) {
  const textAlign = align === "center" ? "text-center" : "text-left";

  return (
    <div className={`mb-16 ${textAlign} ${className}`}>
      {badge && (
        <span className="inline-flex items-center gap-2 rounded-full border border-koma-purple/20 bg-koma-purple/5 px-4 py-1.5 text-xs font-medium tracking-wider text-koma-purple-light uppercase mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-koma-purple animate-[glow-pulse_3s_ease-in-out_infinite]" />
          {badge}
        </span>
      )}
      <h2 className="font-[var(--font-display)] text-3xl sm:text-4xl lg:text-[var(--text-display-sm)] font-bold tracking-tight text-koma-text leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base sm:text-lg text-koma-text-secondary max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
