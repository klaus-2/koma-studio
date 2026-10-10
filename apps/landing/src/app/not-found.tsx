import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="glass panel-cut max-w-xl p-10 text-center">
        <p className="kicker">404</p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-tight text-paper">
          Page Not Found
        </h1>
        <p className="mt-4 text-base leading-relaxed text-paper/55">
          The page you are looking for does not exist in the new KOMA landing experience.
        </p>
        <Link href="/" className="btn-primary mt-8 inline-flex">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
