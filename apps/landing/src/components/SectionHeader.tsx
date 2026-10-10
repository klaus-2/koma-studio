import Reveal from "./Reveal";

export default function SectionHeader({ index, kicker, title, accent, sub }: { index: string; kicker: string; title: string; accent: string; sub?: string }) {
  return (
    <Reveal className="relative mb-16">
      <span aria-hidden className="text-outline absolute -top-12 right-0 hidden select-none font-black leading-none md:block" style={{ fontSize: "8rem" }}>
        {index}
      </span>
      <p className="kicker">{`// ${kicker}`}</p>
      <h2 className="mt-4 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight md:text-6xl">
        {title}{" "}
        <em className="font-[family-name:var(--font-accent)] font-normal normal-case italic text-crimson">{accent}</em>
      </h2>
      {sub && <p className="mt-5 max-w-2xl text-lg text-paper/55">{sub}</p>}
    </Reveal>
  );
}
