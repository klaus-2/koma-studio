import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-koma-bg px-6">
      <div className="glass-card max-w-xl p-10 text-center">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-koma-muted">
          404
        </div>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl font-bold text-koma-text">
          Page Not Found
        </h1>
        <p className="mt-4 text-base leading-relaxed text-koma-text-secondary">
          The page you are looking for does not exist in the new KOMA landing experience.
        </p>
        <Link href="/" className="btn-glow mt-8 inline-flex">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
