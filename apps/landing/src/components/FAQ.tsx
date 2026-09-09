import { ChevronDown } from "lucide-react";
import { SectionHeader } from "./ui/SectionHeader";
import { landingFaqs } from "@/content/site-faqs";

export function FAQ() {
  return (
    <section id="faq" className="py-[var(--spacing-section)]">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHeader
          badge="FAQ"
          title="Straight Answers, No Sales Pitch"
          subtitle="Licensing, self-hosting, privacy, contributing, and workflow questions — answered in the open."
        />

        <div className="space-y-3">
          {landingFaqs.map((faq, index) => {
            return (
              <details
                key={faq.question}
                className="group rounded-[24px] border border-white/6 bg-white/[0.02] transition-all open:border-koma-purple/20 open:bg-koma-purple/6"
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left">
                  <span className="text-base font-medium text-koma-text">
                    {faq.question}
                  </span>
                  <span className="transition-transform duration-200 group-open:rotate-180">
                    <ChevronDown size={18} className="text-koma-muted" />
                  </span>
                </summary>

                <div className="px-6 pb-6 text-sm leading-relaxed text-koma-text-secondary">
                  {faq.answer}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
