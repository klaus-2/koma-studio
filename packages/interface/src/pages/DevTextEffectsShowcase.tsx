import { useEffect, useRef, useState } from "react";

import { useThemeStore } from "@koma/ui/stores/theme-store";
import { TextEffectPopover } from "../components/color/TextEffectPopover";
import { DEFAULT_RENDER_STYLE } from "../constants/dashboard.constants";
import type { RenderTextStyle } from "../typography/renderStyle";
import {
  applyNativeTextEffectPreset,
  NATIVE_TEXT_EFFECT_PRESETS,
  type NativeTextEffectPresetId,
} from "../typography/textEffects";
import { computeRenderTextLayout, drawRenderedTextInRegion } from "../utils/renderText";
import { createDefaultTypographyShape } from "../typography/types";

interface SheetEntry {
  readonly id: NativeTextEffectPresetId;
  readonly text: string;
  readonly box: [number, number, number, number];
  readonly fontFamily?: string;
  readonly intensity?: number;
}

const SHEET_1_ENTRIES: readonly SheetEntry[] = [
  { id: "smiles_outline", text: "SMILES", box: [15, 16, 200, 96], fontFamily: '"Comic Sans MS", "Trebuchet MS", sans-serif' },
  { id: "ahnnn_peach", text: "ahnnn...", box: [230, 20, 470, 96], fontFamily: '"Trebuchet MS", Arial, sans-serif' },
  { id: "hwa_pastel", text: "HWA", box: [530, 24, 725, 134], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "aah_blush", text: "a a h", box: [490, 140, 580, 270], fontFamily: '"Trebuchet MS", Arial, sans-serif' },
  { id: "silence_ink", text: "SILENCE...", box: [120, 118, 430, 205], fontFamily: '"Trebuchet MS", "Arial Black", sans-serif' },
  { id: "hah_pop", text: "HAH?", box: [590, 150, 845, 260], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "kkk_crimson", text: "KKK", box: [15, 232, 165, 318], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "smooch_jelly", text: "Smooch", box: [195, 238, 465, 326], fontFamily: '"Comic Sans MS", "Trebuchet MS", sans-serif' },
  { id: "tremble_brush", text: "TREMBLE", box: [530, 282, 840, 360], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "glossy_pop", text: "SS", box: [15, 340, 105, 420], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "eheheh_whisper", text: "EHEHEH", box: [115, 346, 310, 424], fontFamily: '"Trebuchet MS", Arial, sans-serif' },
  { id: "hoho_ink", text: "HOHO", box: [325, 344, 515, 438], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "blam_impact", text: "BLAM!", box: [530, 372, 830, 512], fontFamily: '"Impact", "Arial Black", sans-serif' },
  { id: "thump_heavy", text: "THUMP", box: [15, 452, 215, 526], fontFamily: '"Impact", "Arial Black", sans-serif' },
  { id: "badump_soft", text: "BADUMP", box: [240, 454, 490, 532], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "balloon_smear", text: "SMEAR 0.6x", box: [18, 540, 290, 636], fontFamily: '"Arial Black", Impact, sans-serif', intensity: 0.6 },
  { id: "balloon_smear", text: "SMEAR 1.0x", box: [315, 540, 595, 636], fontFamily: '"Arial Black", Impact, sans-serif', intensity: 1.0 },
  { id: "balloon_smear", text: "SMEAR 1.6x", box: [620, 540, 910, 636], fontFamily: '"Arial Black", Impact, sans-serif', intensity: 1.6 },
];

const SHEET_3_ENTRIES: readonly SheetEntry[] = [
  { id: "haha_bounce", text: "Ha! Ha! Ha!", box: [25, 22, 230, 98], fontFamily: '"Comic Sans MS", "Trebuchet MS", sans-serif' },
  { id: "crack_ink", text: "CRACK", box: [235, 48, 390, 126], fontFamily: '"Impact", "Arial Black", sans-serif' },
  { id: "screach_sketch", text: "SCREACH", box: [400, 16, 595, 96], fontFamily: '"Trebuchet MS", Arial, sans-serif' },
  { id: "growl_moss", text: "GROWL", box: [615, 38, 765, 102], fontFamily: '"Impact", "Arial Black", sans-serif' },
  { id: "scratch_noise", text: "Scratch", box: [780, 22, 1015, 106], fontFamily: '"Georgia", "Times New Roman", serif' },
  { id: "beep_outline", text: "Beep Beep", box: [25, 132, 245, 224], fontFamily: '"Comic Sans MS", "Trebuchet MS", sans-serif' },
  { id: "boom_comic", text: "BOOM", box: [265, 112, 485, 198], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "bang_chunk", text: "BANG", box: [525, 120, 815, 236], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "shake_blur", text: "SHAKE", box: [835, 112, 1010, 174], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "rattle_jagged", text: "RATTLE", box: [210, 224, 445, 314], fontFamily: '"Arial Black", Impact, sans-serif' },
  { id: "flinch_outline", text: "FLINCH", box: [465, 208, 695, 302], fontFamily: '"Impact", "Arial Black", sans-serif' },
  { id: "break_glitch", text: "BREAK", box: [845, 186, 1020, 250], fontFamily: '"Impact", "Arial Black", sans-serif' },
  { id: "snap_rough", text: "Snap", box: [30, 286, 205, 368], fontFamily: '"Trebuchet MS", Arial, sans-serif' },
  { id: "yawn_soft", text: "Yawn~", box: [235, 326, 445, 408], fontFamily: '"Comic Sans MS", "Trebuchet MS", sans-serif' },
  { id: "click_ink", text: "Click", box: [505, 308, 635, 364], fontFamily: '"Comic Sans MS", "Trebuchet MS", sans-serif' },
  { id: "dash_edge", text: "DASH", box: [825, 260, 1010, 344], fontFamily: '"Impact", "Arial Black", sans-serif' },
  { id: "scream_scratch", text: "AAAAAAAAAAAA", box: [500, 366, 1020, 434], fontFamily: '"Arial Narrow", "Trebuchet MS", sans-serif' },
];

const BASE_CUSTOM_STYLE: RenderTextStyle = {
  ...DEFAULT_RENDER_STYLE,
  fontFamily: '"Trebuchet MS", Arial, sans-serif',
  fontSize: 64,
  minFontSize: 10,
  color: "#0d6efd",
  fillCssValue: "#0d6efd",
  outlineColor: "#fde047",
  outlineWidth: 2,
  italic: true,
  bold: true,
  detectGradient: false,
};

function paintSheet(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  entries: readonly SheetEntry[],
): void {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  for (const entry of entries) {
    const baseStyle: RenderTextStyle = {
      ...DEFAULT_RENDER_STYLE,
      fontFamily: entry.fontFamily ?? '"Arial Black", Impact, sans-serif',
      fontSize: 96,
      minFontSize: 10,
      autoFontSize: true,
      detectGradient: false,
    };
    const styled = applyNativeTextEffectPreset(baseStyle, entry.id);
    if (entry.intensity !== undefined) {
      styled.textEffectIntensity = entry.intensity;
    }
    const [x1, y1, x2, y2] = entry.box;
    const shape = createDefaultTypographyShape(x2 - x1, y2 - y1, "square", "manual");
    shape.innerBox = [2, 2, Math.max(3, x2 - x1 - 2), Math.max(3, y2 - y1 - 2)];
    const layout = computeRenderTextLayout(ctx, entry.text, x2 - x1, y2 - y1, styled, shape);
    drawRenderedTextInRegion(ctx, entry.box, layout, styled, shape);
  }
}

export const DevTextEffectsShowcasePage = () => {
  const [style, setStyle] = useState<RenderTextStyle>(BASE_CUSTOM_STYLE);
  const [sampleText, setSampleText] = useState("TESTE FX");
  const themeFamily = useThemeStore((s) => s.family);
  const setFamily = useThemeStore((s) => s.setFamily);

  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheet1Ref = useRef<HTMLCanvasElement | null>(null);
  const sheet3Ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = liveCanvasRef.current;
    if (!canvas) return;
    canvas.width = 480;
    canvas.height = 170;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bbox: [number, number, number, number] = [24, 18, 456, 152];
    const shape = createDefaultTypographyShape(432, 134, "square", "manual");
    shape.innerBox = [4, 4, 428, 130];
    const layout = computeRenderTextLayout(ctx, sampleText || " ", 432, 134, style, shape);
    drawRenderedTextInRegion(ctx, bbox, layout, style, shape);
  }, [sampleText, style]);

  useEffect(() => {
    if (sheet1Ref.current) paintSheet(sheet1Ref.current, 940, 660, SHEET_1_ENTRIES);
    if (sheet3Ref.current) paintSheet(sheet3Ref.current, 1040, 450, SHEET_3_ENTRIES);
  }, []);

  return (
    <div className="min-h-screen overflow-y-auto bg-[#0b1020] p-6 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-lg font-bold">Text Effects Verification Showcase</h1>
            <p className="text-xs text-slate-400">
              Single Canvas 2D engine powering Popover previews, live region render, and PSD raster layers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="toggle-theme-classic"
              onClick={() => setFamily("classic")}
              className={`rounded border px-3 py-1 text-xs font-bold ${themeFamily === "classic" ? "border-sky-400 bg-sky-500/20" : "border-white/15"}`}
            >
              Classic Theme
            </button>
            <button
              type="button"
              data-testid="toggle-theme-noir"
              onClick={() => setFamily("noir")}
              className={`rounded border px-3 py-1 text-xs font-bold ${themeFamily === "noir" ? "border-rose-400 bg-rose-500/20" : "border-white/15"}`}
            >
              Noir Theme
            </button>
          </div>
        </header>

        <section className="grid gap-4 rounded-xl border border-white/10 bg-slate-900/70 p-4 md:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-3">
            <TextEffectPopover
              value={style.textEffectPreset}
              presets={NATIVE_TEXT_EFFECT_PRESETS}
              intensity={style.textEffectIntensity}
              onChange={(presetId) => setStyle((prev) => applyNativeTextEffectPreset(prev, presetId))}
              onIntensityChange={(val) => setStyle((prev) => ({ ...prev, textEffectIntensity: val }))}
            />
            <input
              type="text"
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              className="rounded border border-white/15 bg-slate-950 px-3 py-1.5 text-sm"
              aria-label="Live preview sample text"
            />
            <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-300">
              <div>Preset: <strong data-testid="live-preset-id">{style.textEffectPreset}</strong></div>
              <div>Color: <strong data-testid="live-color">{style.color}</strong></div>
              <div>Outline: <strong data-testid="live-outline">{style.outlineWidth}px</strong></div>
              <div>Snapshot: <strong data-testid="live-has-snapshot">{style.textEffectBaseSnapshot ? "yes" : "no"}</strong></div>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white p-2">
            <canvas
              ref={liveCanvasRef}
              data-testid="live-render-canvas"
              className="max-w-full border border-slate-200"
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-slate-200">Reference Sheet 1 + Balloon Smear</h2>
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-white p-2">
            <canvas ref={sheet1Ref} data-testid="sheet-image1" className="block" />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-slate-200">Reference Sheet 3</h2>
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-white p-2">
            <canvas ref={sheet3Ref} data-testid="sheet-image3" className="block" />
          </div>
        </section>
      </div>
    </div>
  );
};
