import { ChevronDown } from "lucide-react";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";
import { landingFaqs } from "@/content/site-faqs";

export default function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-6 py-32">
      <SectionHeader index="07" kicker="FAQ" title="Questions," accent="answered." />
      <div className="space-y-3">
        {landingFaqs.map((f, i) => (
          <Reveal key={f.question} delay={i * 0.04}>
            <details className="glass panel-cut-sm group open:border-crimson/40" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-black uppercase tracking-wide [&::-webkit-details-marker]:hidden">
                {f.question}
                <ChevronDown size={18} className="shrink-0 text-crimson transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-6 pb-6 text-sm leading-relaxed text-paper/55">{f.answer}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
