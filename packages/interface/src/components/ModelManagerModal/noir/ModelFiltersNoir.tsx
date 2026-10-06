import { motion } from "framer-motion";
import type { ModelFilterState } from "../../../models/types";
import { useI18n } from "../../../i18n";

interface ModelFiltersProps {
  filters: ModelFilterState;
  languages: string[];
  allowCloud?: boolean;
  hideSourceToggle?: boolean;
  hideLanguageFilter?: boolean;
  hideStatusFilter?: boolean;
  onSourceChange: (source: ModelFilterState['source']) => void;
  onLanguageChange: (language: string) => void;
  onStatusChange: (status: ModelFilterState['status']) => void;
}

const selectCls =
  "panel-cut-sm w-full appearance-none border border-paper/12 bg-ink px-2.5 py-1.5 font-mono text-[11px] uppercase text-paper/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson";

const FilterField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex min-w-[110px] flex-col gap-1">
    <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-paper/35">
      <span className="text-crimson" aria-hidden>//</span> {label}
    </span>
    {children}
  </label>
);

export const ModelFiltersNoir = ({
  filters, languages, allowCloud = true,
  hideSourceToggle = false, hideLanguageFilter = false, hideStatusFilter = false,
  onSourceChange, onLanguageChange, onStatusChange,
}: ModelFiltersProps) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-end gap-3 border-y border-paper/8 bg-ink/60 px-5 py-3">
      {allowCloud && !hideSourceToggle && (
        <div role="tablist" aria-label={t("modelManager.filters.catalog")}
          className="panel-cut-sm inline-flex gap-0.5 border border-paper/12 bg-ink p-1">
          {(["all", "local", "cloud"] as const).map((src) => {
            const label = src === "all" ? t("modelManager.filters.all") : src === "local" ? t("modelManager.filters.local") : t("modelManager.filters.cloud");
            const active = filters.source === src;
            return (
              <button key={src} type="button" role="tab" aria-selected={active}
                onClick={() => onSourceChange(src)}
                className={`relative panel-cut-sm px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${active ? "text-ink" : "text-paper/45 hover:text-paper"}`}>
                {active && (
                  <motion.span layoutId="koma-source-ink" aria-hidden
                    className="panel-cut-sm absolute inset-0 bg-crimson"
                    transition={{ type: "spring", stiffness: 520, damping: 38 }} />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!hideLanguageFilter && (
        <FilterField label={t("modelManager.filters.language")}>
          <select className={selectCls} value={filters.language} onChange={(e) => onLanguageChange(e.target.value)}>
            <option value="all">{t("modelManager.filters.all")}</option>
            {languages.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
          </select>
        </FilterField>
      )}

      {!hideStatusFilter && (
        <FilterField label={t("modelManager.filters.status")}>
          <select className={selectCls} value={filters.status}
            onChange={(e) => onStatusChange(e.target.value as ModelFilterState['status'])}>
            <option value="all">{t("modelManager.filters.all")}</option>
            <option value="installed">{t("modelManager.filters.installed")}</option>
            <option value="not_installed">{t("modelManager.filters.notInstalled")}</option>
            <option value="update_available">{t("modelManager.filters.updateAvailable")}</option>
            {allowCloud && <option value="available">{t("modelManager.filters.availableCloud")}</option>}
            {allowCloud && <option value="needs_setup">{t("modelManager.filters.needsSetup")}</option>}
            {allowCloud && <option value="roadmap">{t("modelManager.filters.roadmap")}</option>}
          </select>
        </FilterField>
      )}
    </div>
  );
};

export default ModelFiltersNoir;
