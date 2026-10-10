const ROW_A = ["MIT LICENSED", "100% OPEN SOURCE", "FREE FOREVER", "ZERO TELEMETRY", "COMMUNITY DRIVEN", "FORKABLE FOREVER"];
const ROW_B = ["ホンヤク", "クリーニング", "写植 TYPESET", "リドロー", "公開 PUBLISH", "コマ STUDIO"];

function Row({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <div className={`flex shrink-0 items-center gap-10 pr-10 ${reverse ? "animate-marquee-rev" : "animate-marquee"}`}>
        {doubled.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap font-black uppercase tracking-wide">
            <span className={reverse ? "text-paper/25 text-2xl" : "text-paper/80 text-xl"}>{t}</span>
            <span aria-hidden className="text-crimson">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Marquee() {
  return (
    <section aria-label="Open source highlights" className="border-y border-paper/10 bg-ink-2/60 py-6">
      <Row items={ROW_A} />
      <div className="mt-4"><Row items={ROW_B} reverse /></div>
    </section>
  );
}
