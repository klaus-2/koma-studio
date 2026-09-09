interface KomaLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function KomaLogo({ size = 32, showText = true, className = "" }: KomaLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-lg bg-gradient-to-br from-koma-purple to-koma-purple-dark"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          style={{ width: size * 0.6, height: size * 0.6 }}
        >
          <path
            d="M6 4L6 20L10 20L10 14L14 20L18 20L13 12.5L18 6L14 6L10 12L10 4Z"
            fill="white"
            fillOpacity={0.95}
          />
        </svg>
        <div className="absolute inset-0 rounded-lg bg-koma-purple/20 blur-sm" />
      </div>
      {showText && (
        <span
          className="font-[var(--font-display)] font-bold tracking-tight text-koma-text"
          style={{ fontSize: size * 0.55 }}
        >
          KOMA<span className="text-koma-muted font-normal ml-1">Studio</span>
        </span>
      )}
    </div>
  );
}
