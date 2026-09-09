import { SITE_LICENSE } from "@/lib/site";

/**
 * Honest project facts — no invented usage numbers.
 * Every item here is verifiable in the repository or in the app itself.
 */
const ITEMS = [
  { value: SITE_LICENSE, label: "licensed — fork it, ship it" },
  { value: "Self-hosted", label: "runs on your machine" },
  { value: "Bring your own", label: "API keys & models" },
  { value: "No account", label: "required to use the app" },
  { value: "No telemetry", label: "your chapters stay yours" },
  { value: "Public", label: "issues, roadmap and PRs" },
  { value: "3 platforms", label: "Windows, macOS, Linux" },
  { value: "Open formats", label: "no vendor lock-in" },
];

export function SocialProof() {
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <section
      className="relative border-y border-koma-border py-4 overflow-hidden"
      aria-label="Project facts"
    >
      <div className="marquee-mask">
        <div className="flex animate-[marquee_40s_linear_infinite] whitespace-nowrap">
          {doubled.map((item, i) => (
            <span
              key={i}
              className="mx-6 inline-flex items-center gap-2 text-sm font-medium text-koma-muted"
              aria-hidden={i >= ITEMS.length ? "true" : undefined}
            >
              <span className="text-koma-text font-bold text-sm md:text-base">
                {item.value}
              </span>
              <span className="text-koma-text-secondary text-sm">{item.label}</span>
              <span className="h-1 w-1 rounded-full bg-koma-purple/60" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
