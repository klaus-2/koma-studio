import type { StageTabDef, StageTabKey } from "../AioStageTabBar";
import { m } from "framer-motion";
import { cn } from "../../lib/utils";
import { useI18n } from "../../i18n";

interface AioStageTabBarProps {
  tabs: StageTabDef[];
  activeTab: StageTabKey;
  enabledSteps: Record<string, boolean>;
  onSelect: (tab: StageTabKey) => void;
}

export const AioStageTabBarNoir = ({
  tabs,
  activeTab,
  enabledSteps,
  onSelect,
}: AioStageTabBarProps) => {
  const { t } = useI18n();

  return (
    <div
      className="koma-aio-stage-tabs__bar"
      role="tablist"
      aria-label={t("aio.stage.tabsBarAria")}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const isEnabled = enabledSteps[tab.key] ?? false;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            title={tab.label}
            className={cn(
              "koma-aio-stage-tab",
              isActive && "koma-aio-stage-tab--active",
              isEnabled && "koma-aio-stage-tab--enabled",
            )}
            onClick={() => onSelect(tab.key)}
          >
            {isActive && (
              <m.span
                layoutId="koma-aio-stage-ink"
                className="koma-aio-stage-tab__ink"
                aria-hidden="true"
                transition={{ type: "spring", bounce: 0.16, duration: 0.45 }}
              />
            )}
            <span className="koma-aio-stage-tab__glyph">
              <tab.icon size={14} strokeWidth={2.25} />
            </span>
            <span className="koma-aio-stage-tab__dot" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};