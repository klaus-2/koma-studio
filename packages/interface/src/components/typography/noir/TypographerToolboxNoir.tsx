import { motion } from "framer-motion";
import {
  Circle, Square, ScanSearch, Copy, Trash2, Save, Library, Paintbrush, RotateCcw,
} from "lucide-react";
import { useI18n } from "../../../i18n";
import type {
  TypographyRegion, TypographyShapeKind, TypographyStyleFolder,
  TypographyStylePreset, TypographySession,
} from "../../../typography/types";
import { TypographerTextQueueNoir } from "./TypographerTextQueueNoir";
import { TypographerPresetBrowserNoir } from "./TypographerPresetBrowserNoir";
import { AioSection } from "@/pages/AioSection";
import { btnGhost, btnPrimary, inputCls, selectCls } from "../../../pages/settings/noir/primitives";

type TypographerSelectionTool = "select" | "draw-square" | "draw-rounded";

interface TypographerToolboxProps {
  activeImageName: string | null;
  activeRegion: TypographyRegion | null;
  regionsCount: number;
  session: TypographySession | null;
  queueSelectedId: string | null;
  availablePresets: TypographyStylePreset[];
  selectedPresetId: string | null;
  selectedTool: TypographerSelectionTool;
  snapshotName: string;
  selectedSnapshotId: string | null;
  onSelectedToolChange: (tool: TypographerSelectionTool) => void;
  onPresetChange: (presetId: string | null) => void;
  onRefineShape: () => void;
  onConvertShape: (kind: TypographyShapeKind) => void;
  onDuplicateRegion: () => void;
  onDeleteRegion: () => void;
  onApplyPresetToSelection: () => void;
  onApplyPresetToImage: () => void;
  onSnapshotNameChange: (value: string) => void;
  onSaveSnapshot: () => void;
  onSelectSnapshot: (snapshotId: string | null) => void;
  onRestoreSnapshot: () => void;
  onDraftTextChange: (value: string) => void;
  onBuildQueue: () => void;
  onClearQueue: () => void;
  onApplySelectedQueueItem: () => void;
  onApplyNextQueueItem: () => void;
  onSelectQueueItem: (queueItemId: string | null) => void;
  onToggleMultiBubble: () => void;
  onImportQueueText: (value: string) => void;
  multiBubbleRegions?: Array<{ id: string; label: string }>;
  onReorderMultiBubbleRegions?: (nextOrder: string[]) => void;
  availableFolders?: TypographyStyleFolder[];
  availableFonts?: string[];
  onUpdatePreset?: (presetId: string, patch: Partial<TypographyStylePreset>) => void;
}

const TOOLS = [
  { key: "select" as const, Icon: ScanSearch, labelKey: "typo.tools.select" },
  { key: "draw-square" as const, Icon: Square, labelKey: "typo.tools.rect" },
  { key: "draw-rounded" as const, Icon: Circle, labelKey: "typo.tools.ellipse" },
];

export const TypographerToolboxNoir = (props: TypographerToolboxProps) => {
  const { t } = useI18n();
  const {
    activeImageName, activeRegion, regionsCount, session, selectedTool,
    snapshotName, selectedSnapshotId,
  } = props;

  const badge = (n: number) => (
    <span className="border border-crimson/40 bg-crimson/10 px-1.5 font-mono text-[9px] font-bold text-crimson">{n}</span>
  );

  return (
    <div className="relative space-y-3">
      {/* Mode stamp */}
      <span className="stamp inline-flex items-center gap-1.5" aria-hidden>
        <span className="blink h-1.5 w-1.5 bg-crimson" /> {t("typo.tag")}
      </span>
      <span aria-hidden className="v-text pointer-events-none absolute -right-1 top-8 select-none font-display text-xs font-black tracking-widest text-paper/[0.06]">
        文字職人
      </span>

      {/* ═══ Session ═══ */}
      <AioSection icon={Paintbrush} title={t("typo.session.title")} badge={badge(regionsCount)}>
        {/* Context ticker */}
        <p className="mb-3 font-mono text-[9px] uppercase tracking-wider text-paper/40">
          {t("typo.session.image")}{" "}
          <strong className="text-paper">{activeImageName ?? "—"}</strong>
          <span aria-hidden className="mx-1.5 text-crimson/60">/</span>
          {t("typo.session.selection")}{" "}
          <strong className={activeRegion ? "text-gold" : "text-paper/30"}>
            {activeRegion?.id ?? t("typo.session.none")}
          </strong>
        </p>

        {/* Tool strip — ink slide */}
        <div role="group" aria-label={t("typo.tools.aria")}
          className="panel-cut-sm mb-3 flex gap-0.5 border border-paper/12 bg-ink p-1">
          {TOOLS.map(({ key, Icon, labelKey }) => {
            const active = selectedTool === key;
            return (
              <button key={key} type="button" aria-pressed={active}
                aria-label={t(labelKey as any)}
                onClick={() => props.onSelectedToolChange(key)}
                className={`relative flex-1 panel-cut-sm px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors ${active ? "text-ink" : "text-paper/45 hover:text-paper"
                  }`}>
                {active && (
                  <motion.span layoutId="koma-typo-tool-ink" aria-hidden
                    className="panel-cut-sm absolute inset-0 bg-crimson"
                    transition={{ type: "spring", stiffness: 520, damping: 38 }} />
                )}
                <span className="relative z-10 inline-flex items-center justify-center gap-1">
                  <Icon size={12} /> {t(labelKey as any)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Shape actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className={btnGhost} onClick={props.onRefineShape} disabled={!activeRegion}>
            <ScanSearch size={11} /> {t("typo.actions.refine")}
          </button>
          <button type="button" className={btnGhost} onClick={props.onDuplicateRegion} disabled={!activeRegion}>
            <Copy size={11} /> {t("typo.actions.duplicate")}
          </button>
          <button type="button" className={btnGhost} onClick={() => props.onConvertShape("square")} disabled={!activeRegion}>
            <Square size={11} /> {t("typo.actions.toRect")}
          </button>
          <button type="button" className={btnGhost} onClick={() => props.onConvertShape("rounded")} disabled={!activeRegion}>
            <Circle size={11} /> {t("typo.actions.toEllipse")}
          </button>
        </div>

        <button type="button" onClick={props.onDeleteRegion} disabled={!activeRegion}
          className="panel-cut-sm mt-1.5 inline-flex w-full items-center justify-center gap-1.5 border border-crimson/40 bg-crimson/8 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-crimson transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[filter:drop-shadow(3px_3px_0_rgba(255,46,99,0.5))] disabled:opacity-30 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:[filter:none]">
          <Trash2 size={11} /> {t("typo.actions.delete")}
        </button>
      </AioSection>

      {/* ═══ Presets ═══ */}
      <AioSection icon={Library} title={t("typo.presets.title")} defaultOpen={false}>
        <TypographerPresetBrowserNoir
          presets={props.availablePresets}
          folders={props.availableFolders ?? []}
          selectedPresetId={props.selectedPresetId}
          availableFonts={props.availableFonts ?? []}
          onSelectPreset={props.onPresetChange}
          onApplyToSelection={props.onApplyPresetToSelection}
          onApplyToImage={props.onApplyPresetToImage}
          onUpdatePreset={props.onUpdatePreset}
          hasActiveRegion={!!activeRegion}
          regionsCount={regionsCount}
        />
      </AioSection>

      {/* ═══ Snapshots ═══ */}
      <AioSection icon={Save} title={t("typo.snapshots.title")} defaultOpen={false}
        badge={session?.snapshots.length ? badge(session.snapshots.length) : undefined}>
        <p className="mb-3 font-mono text-[9px] text-paper/40">{t("typo.snapshots.hint")}</p>

        <div className="flex gap-1.5">
          <input type="text" className={inputCls} value={snapshotName}
            onChange={(e) => props.onSnapshotNameChange(e.target.value)}
            placeholder={t("typo.snapshots.placeholder")} />
          <button type="button" className={btnPrimary} aria-label={t("typo.snapshots.save")}
            onClick={props.onSaveSnapshot} disabled={!snapshotName.trim()}>
            <Save size={12} />
          </button>
        </div>

        {(session?.snapshots.length ?? 0) > 0 && (
          <div className="mt-2 flex gap-1.5">
            <select className={selectCls} value={selectedSnapshotId ?? ""}
              onChange={(e) => props.onSelectSnapshot(e.target.value || null)}>
              <option value="">{t("typo.snapshots.select")}</option>
              {(session?.snapshots ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="button" className={btnGhost} disabled={!selectedSnapshotId}
              onClick={props.onRestoreSnapshot}>
              <RotateCcw size={11} /> {t("typo.snapshots.restore")}
            </button>
          </div>
        )}
      </AioSection>

      {/* ═══ Text Queue ═══ */}
      <TypographerTextQueueNoir
        draftText={session?.draftText ?? ""}
        queue={session?.queue ?? []}
        selectedQueueItemId={props.queueSelectedId}
        multiBubbleEnabled={session?.multiBubbleEnabled ?? false}
        onDraftTextChange={props.onDraftTextChange}
        onBuildQueue={props.onBuildQueue}
        onClearQueue={props.onClearQueue}
        onApplySelected={props.onApplySelectedQueueItem}
        onApplyNext={props.onApplyNextQueueItem}
        onSelectQueueItem={props.onSelectQueueItem}
        onToggleMultiBubble={props.onToggleMultiBubble}
        onImportText={props.onImportQueueText}
        multiBubbleRegions={props.multiBubbleRegions}
        onReorderMultiBubbleRegions={props.onReorderMultiBubbleRegions}
      />
    </div>
  );
};
