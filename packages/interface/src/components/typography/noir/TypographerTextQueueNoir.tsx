import { useRef, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ClipboardPaste, ListOrdered, FileUp, Eraser, SkipForward,
  CheckSquare, Rows3, ChevronUp, ChevronDown, GripVertical,
} from "lucide-react";
import type { TextQueueItem } from "../../../typography/types";
import { AioSection } from "../../../pages/AioSection";
import { useI18n } from "../../../i18n";
import { InkToggle, btnGhost } from "../../../pages/settings/noir/primitives";
import { TypographerQueueRowNoir } from "../TypographerTextQueueRows";

interface MultiBubbleRegion { id: string; label: string }

interface TypographerTextQueueProps {
  draftText: string;
  queue: TextQueueItem[];
  selectedQueueItemId: string | null;
  multiBubbleEnabled: boolean;
  onDraftTextChange: (value: string) => void;
  onBuildQueue: () => void;
  onClearQueue: () => void;
  onApplySelected: () => void;
  onApplyNext: () => void;
  onSelectQueueItem: (id: string | null) => void;
  onToggleMultiBubble: () => void;
  onImportText: (value: string) => void;
  multiBubbleRegions?: MultiBubbleRegion[];
  onReorderMultiBubbleRegions?: (nextOrder: string[]) => void;
}

// Stable identity: an inline `= []` default broke memo equality on every
// parent render that omits the prop (react-doctor rerender-memo-with-default-value).
const EMPTY_MULTI_BUBBLE_REGIONS: MultiBubbleRegion[] = [];

export const TypographerTextQueueNoir = ({
  draftText, queue, selectedQueueItemId, multiBubbleEnabled,
  onDraftTextChange, onBuildQueue, onClearQueue, onApplySelected, onApplyNext,
  onSelectQueueItem, onToggleMultiBubble, onImportText,
  multiBubbleRegions = EMPTY_MULTI_BUBBLE_REGIONS, onReorderMultiBubbleRegions,
}: TypographerTextQueueProps) => {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  /* ── DnD — lógica V1 intacta ── */
  const moveBubble = useCallback((fromIndex: number, delta: number) => {
    const toIndex = fromIndex + delta;
    if (toIndex < 0 || toIndex >= multiBubbleRegions.length) return;
    const nextOrder = multiBubbleRegions.map((r) => r.id);
    const [moved] = nextOrder.splice(fromIndex, 1);
    if (moved !== undefined) nextOrder.splice(toIndex, 0, moved);
    onReorderMultiBubbleRegions?.(nextOrder);
  }, [multiBubbleRegions, onReorderMultiBubbleRegions]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
    const nextOrder = multiBubbleRegions.map((r) => r.id);
    const [moved] = nextOrder.splice(fromIndex, 1);
    if (moved !== undefined) nextOrder.splice(dropIndex, 0, moved);
    onReorderMultiBubbleRegions?.(nextOrder);
    dragIndexRef.current = null;
  }, [multiBubbleRegions, onReorderMultiBubbleRegions]);

  const showBubbleOrder = multiBubbleEnabled && multiBubbleRegions.length > 0;
  const pendingItems = queue.filter((q) => q.status === "pending");

  return (
    <AioSection icon={Rows3} title={t("typo.queue.title")}
      badge={queue.length > 0
        ? <span className="border border-crimson/40 bg-crimson/10 px-1.5 font-mono text-[9px] font-bold text-crimson">{queue.length}</span>
        : undefined}>
      <div className="space-y-2.5">
        {/* Script editor */}
        <textarea
          className="panel-cut-sm w-full resize-y border border-paper/12 bg-ink px-3 py-2.5 font-mono text-[11px] leading-relaxed text-paper placeholder:text-paper/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson"
          value={draftText}
          onChange={(e) => onDraftTextChange(e.target.value)}
          placeholder={t("typo.queue.editorPlaceholder")}
          rows={6}
          aria-label={t("typo.queue.editorAria")}
        />

        {/* Actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className={btnGhost} onClick={onBuildQueue}>
            <ListOrdered size={11} /> {t("typo.queue.build")}
          </button>
          <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
            <FileUp size={11} /> {t("typo.queue.import")}
          </button>
          <button type="button" className={btnGhost} onClick={onApplySelected} disabled={!queue.length}>
            <CheckSquare size={11} /> {t("typo.queue.applySelected")}
          </button>
          <button type="button" className={btnGhost} onClick={onApplyNext} disabled={!queue.length}>
            <SkipForward size={11} /> {t("typo.queue.next")}
          </button>
        </div>

        {/* Multi-bubble toggle + clear */}
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-paper/60">
            <InkToggle checked={multiBubbleEnabled} onChange={onToggleMultiBubble}
              label={t("typo.queue.multiBubble")} />
            {t("typo.queue.multiBubble")}
          </label>
          <button type="button" className={btnGhost}
            onClick={onClearQueue}
            disabled={!queue.length && !draftText.trim().length}>
            <Eraser size={10} /> {t("typo.queue.clear")}
          </button>
        </div>

        {/* ── Bubble Order — storyboard ── */}
        {showBubbleOrder && (
          <div className="panel-cut-sm border border-azure/20 bg-azure/[0.03] p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="kicker !text-azure !text-[9px]">// BUBBLE ORDER</span>
              <span className="border border-azure/40 px-1.5 font-mono text-[8px] text-azure">
                {multiBubbleRegions.length}
              </span>
            </div>
            <div className="space-y-1">
              {multiBubbleRegions.map((region, idx) => {
                const pendingItem = pendingItems[idx];
                return (
                  <div key={region.id} draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    className="panel-cut-sm group flex cursor-grab items-center gap-2 border border-paper/10 bg-ink/60 px-2 py-1.5 transition-colors hover:border-azure/40 active:cursor-grabbing">
                    <span aria-hidden className="text-paper/25 group-hover:text-azure" title="Drag to reorder">
                      <GripVertical size={10} />
                    </span>
                    <span aria-hidden className="flex h-4 w-4 items-center justify-center bg-azure/15 font-display text-[9px] font-black text-azure">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-paper/70" title={region.label}>
                      {region.label}
                    </span>
                    {pendingItem && (
                      <span className="hidden max-w-[100px] truncate font-mono text-[9px] italic text-gold/70 sm:block"
                        title={pendingItem.text}>
                        ◂ {pendingItem.text.slice(0, 18)}
                      </span>
                    )}
                    <span className="flex flex-col">
                      <button type="button" disabled={idx === 0} aria-label="Move up"
                        onClick={() => moveBubble(idx, -1)}
                        className="text-paper/30 hover:text-azure disabled:opacity-20">
                        <ChevronUp size={11} />
                      </button>
                      <button type="button" disabled={idx === multiBubbleRegions.length - 1} aria-label="Move down"
                        onClick={() => moveBubble(idx, 1)}
                        className="text-paper/30 hover:text-azure disabled:opacity-20">
                        <ChevronDown size={11} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Queue list — script lines ── */}
        <div role="list" aria-label={t("typo.queue.listAria")}
          className="max-h-56 space-y-1 overflow-y-auto">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 border border-dashed border-paper/15 px-4 py-6 text-center">
              <ClipboardPaste size={16} className="text-paper/20" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-paper/40">
                {t("typo.queue.emptyTitle")}
              </p>
              <span className="font-mono text-[9px] text-paper/25">{t("typo.queue.emptyDesc")}</span>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {queue.map((item, idx) => (
                <TypographerQueueRowNoir
                  key={item.id}
                  item={item}
                  index={idx}
                  selected={selectedQueueItemId === item.id}
                  onSelect={onSelectQueueItem}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onImportText(await f.text());
            e.currentTarget.value = "";
          }} />
      </div>
    </AioSection>
  );
};
