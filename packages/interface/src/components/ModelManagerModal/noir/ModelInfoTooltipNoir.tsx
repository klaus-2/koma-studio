import { Info } from "lucide-react";
import type { TranslationModel } from "../../../models/types";
import { useI18n } from "../../../i18n";
import { desktopBridge } from "@/lib/desktop-bridge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-2">
    <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-crimson">{title}</p>
    <div className="mt-0.5 text-[11px] leading-relaxed text-paper/70">{children}</div>
  </div>
);

export const ModelInfoTooltipNoir = ({ model }: { model: TranslationModel }) => {
  const { t } = useI18n();
  const k = model.tooltipKey;
  const highlights  = k ? (t(`${k}.highlights` as any) as string) : null;
  const unique      = k ? (t(`${k}.unique` as any) as string) : null;
  const bestFor     = k ? (t(`${k}.bestFor` as any) as string) : null;
  const performance = k ? (t(`${k}.performance` as any) as string) : null;
  const notes       = k ? (t(`${k}.notes` as any) as string) : null;
  const hasRich = highlights || unique || bestFor || performance || notes;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={t("modelManager.tooltip.infoAria", { name: model.name })}
            className="inline-flex items-center gap-1 p-1.5 font-mono text-[10px] uppercase tracking-wider text-paper/35 transition-colors hover:text-azure">
            <Info size={13} />
            {t("modelManager.tooltip.info")}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="glass panel-cut-sm z-[140] max-w-sm p-3.5 text-paper">
          <div className="font-display text-xs font-black uppercase tracking-tight text-paper">
            <span aria-hidden className="mr-1.5 text-crimson">▣</span>{model.name}
          </div>
          <div aria-hidden className="mt-2 h-px bg-gradient-to-r from-crimson/60 to-transparent" />

          {hasRich ? (
            <>
              {highlights && (
                <Section title={`// ${t("modelManager.tooltip.rich.highlights")}`}>
                  <ul className="space-y-0.5">
                    {highlights.split("\n").filter(Boolean).map((line, i) => (
                      <li key={i}><span aria-hidden className="mr-1 text-crimson">▸</span>{line.trim().replace(/^[•-]\s*/, "")}</li>
                    ))}
                  </ul>
                </Section>
              )}
              {unique      && <Section title={`// ${t("modelManager.tooltip.rich.unique")}`}>{unique}</Section>}
              {bestFor     && <Section title={`// ${t("modelManager.tooltip.rich.bestFor")}`}>{bestFor}</Section>}
              {performance && <Section title={`// ${t("modelManager.tooltip.rich.performance")}`}>{performance}</Section>}
              {notes       && <Section title={`// ${t("modelManager.tooltip.rich.notes")}`}>{notes}</Section>}
            </>
          ) : (
            <p className="mt-2 text-[11px] text-paper/70">{t(model.description as Parameters<typeof t>[0])}</p>
          )}

          {model.docsUrl && (
            <a
              href={model.docsUrl}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const openExternal = desktopBridge.desktop?.openExternal;
                if (typeof openExternal === "function") await openExternal(model.docsUrl!);
                else window.open(model.docsUrl, "_blank", "noopener,noreferrer");
              }}
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-wider text-azure underline decoration-azure/40 underline-offset-2 hover:decoration-azure"
            >
              {t("modelManager.tooltip.docsUrl")} →
            </a>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ModelInfoTooltipNoir;
