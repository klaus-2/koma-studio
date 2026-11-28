import type React from "react";
import { useEffect, useState } from "react";
import { Palette, RotateCcw, Sparkles } from "lucide-react";
import type { useI18n } from "../../../i18n";
import {
  DEFAULT_NOIR_ACCENT_DARK,
  DEFAULT_NOIR_ACCENT_LIGHT,
  NOIR_ACCENT_PRESETS,
  clampChannel,
  hexToRgb,
  normalizeHexColor,
  rgbToHex,
} from "@koma/ui/themes/noir-accent";
import { useThemeStore } from "@koma/ui/stores/theme-store";
import { Alert, Sec, btnGhost } from "./primitives";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface ChannelConfig {
  key: "r" | "g" | "b";
  labelKey:
    | "settings.theme.noirAccent.red"
    | "settings.theme.noirAccent.green"
    | "settings.theme.noirAccent.blue";
  value: number;
  barGradient: string;
}

export const NoirAccentSectionNoir = ({
  t,
}: {
  t: TranslationFn;
}): React.ReactElement => {
  const theme = useThemeStore((s) => s.theme);
  const family = useThemeStore((s) => s.family);
  const noirAccent = useThemeStore((s) => s.noirAccent);
  const setNoirAccent = useThemeStore((s) => s.setNoirAccent);
  const resetNoirAccent = useThemeStore((s) => s.resetNoirAccent);

  const defaultHex =
    theme === "light" ? DEFAULT_NOIR_ACCENT_LIGHT : DEFAULT_NOIR_ACCENT_DARK;
  const activeHex = noirAccent ?? defaultHex;
  const rgb = hexToRgb(activeHex) ?? { r: 255, g: 46, b: 99 };

  const [hexDraft, setHexDraft] = useState(activeHex);

  useEffect(() => {
    setHexDraft(activeHex);
  }, [activeHex]);

  const handleChannelChange = (channel: "r" | "g" | "b", rawValue: number) => {
    const nextRgb = {
      ...rgb,
      [channel]: clampChannel(rawValue),
    };
    setNoirAccent(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  const handleHexInputChange = (value: string) => {
    setHexDraft(value);
    const normalized = normalizeHexColor(value);
    if (normalized) {
      setNoirAccent(normalized);
    }
  };

  const handleHexBlur = () => {
    const normalized = normalizeHexColor(hexDraft);
    if (normalized) {
      setNoirAccent(normalized);
      setHexDraft(normalized);
    } else {
      setHexDraft(activeHex);
    }
  };

  const channels: readonly ChannelConfig[] = [
    {
      key: "r",
      labelKey: "settings.theme.noirAccent.red",
      value: rgb.r,
      barGradient: `linear-gradient(90deg, rgb(0, ${rgb.g}, ${rgb.b}), rgb(255, ${rgb.g}, ${rgb.b}))`,
    },
    {
      key: "g",
      labelKey: "settings.theme.noirAccent.green",
      value: rgb.g,
      barGradient: `linear-gradient(90deg, rgb(${rgb.r}, 0, ${rgb.b}), rgb(${rgb.r}, 255, ${rgb.b}))`,
    },
    {
      key: "b",
      labelKey: "settings.theme.noirAccent.blue",
      value: rgb.b,
      barGradient: `linear-gradient(90deg, rgb(${rgb.r}, ${rgb.g}, 0), rgb(${rgb.r}, ${rgb.g}, 255))`,
    },
  ];

  return (
    <Sec
      icon={<Palette size={14} />}
      title={t("settings.theme.noirAccent.title")}
      desc={t("settings.theme.noirAccent.description")}
      actions={
        <button
          type="button"
          className={btnGhost}
          onClick={resetNoirAccent}
          disabled={noirAccent === null}
        >
          <RotateCcw size={11} />
          {t("settings.theme.noirAccent.reset")}
        </button>
      }
    >
      <div className="space-y-4">
        {family !== "noir" && (
          <Alert tone="info">
            {t("settings.theme.noirAccent.noirOnlyHint")}
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="panel-cut-sm relative flex h-11 w-14 cursor-pointer items-center justify-center overflow-hidden border border-paper/20 bg-ink-2">
                <input
                  type="color"
                  aria-label={t("settings.theme.noirAccent.title")}
                  value={activeHex}
                  onChange={(e) => setNoirAccent(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  aria-hidden="true"
                  className="h-full w-full"
                  style={{ backgroundColor: activeHex }}
                />
              </label>

              <div className="min-w-[130px]">
                <label
                  htmlFor="noir-accent-hex-input"
                  className="mb-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-paper/45"
                >
                  {t("settings.theme.noirAccent.hexLabel")}
                </label>
                <input
                  id="noir-accent-hex-input"
                  type="text"
                  value={hexDraft}
                  onChange={(e) => handleHexInputChange(e.target.value)}
                  onBlur={handleHexBlur}
                  spellCheck={false}
                  maxLength={7}
                  className="panel-cut-sm w-32 border border-paper/18 bg-ink px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider text-paper outline-none focus:border-crimson"
                />
              </div>

              <div className="panel-cut-sm border border-paper/10 bg-ink/50 px-3 py-1.5 font-mono text-[10px] tracking-wider text-paper/65">
                rgb({rgb.r}, {rgb.g}, {rgb.b})
              </div>
            </div>

            <div className="space-y-2.5">
              {channels.map((ch) => {
                const inputId = `noir-accent-channel-${ch.key}`;
                return (
                  <div
                    key={ch.key}
                    className="grid grid-cols-[88px_minmax(0,1fr)_64px] items-center gap-3"
                  >
                    <label
                      htmlFor={inputId}
                      className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/70"
                    >
                      {t(ch.labelKey)}
                    </label>

                    <div className="relative flex items-center">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none h-2 w-full border border-paper/15"
                        style={{ background: ch.barGradient }}
                      />
                      <input
                        id={inputId}
                        type="range"
                        min={0}
                        max={255}
                        step={1}
                        value={ch.value}
                        onChange={(e) =>
                          handleChannelChange(ch.key, Number(e.target.value))
                        }
                        aria-label={t(ch.labelKey)}
                        className="absolute inset-0 h-4 w-full cursor-pointer appearance-none bg-transparent accent-paper"
                      />
                    </div>

                    <input
                      type="number"
                      min={0}
                      max={255}
                      step={1}
                      value={ch.value}
                      aria-label={`${t(ch.labelKey)} value`}
                      onChange={(e) =>
                        handleChannelChange(ch.key, Number(e.target.value))
                      }
                      className="panel-cut-sm w-full border border-paper/15 bg-ink px-2 py-1 text-right font-mono text-[11px] text-paper outline-none focus:border-crimson"
                    />
                  </div>
                );
              })}
            </div>

            <div>
              <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.22em] text-paper/45">
                {t("settings.theme.noirAccent.presets")}
              </span>
              <div className="flex flex-wrap gap-2">
                {NOIR_ACCENT_PRESETS.map((preset) => {
                  const selected =
                    normalizeHexColor(activeHex) === preset.hex;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setNoirAccent(preset.hex)}
                      aria-label={preset.id}
                      aria-pressed={selected}
                      title={`${preset.id.toUpperCase()} (${preset.hex})`}
                      className={`panel-cut-sm flex h-8 w-8 items-center justify-center border transition-transform hover:-translate-y-0.5 ${
                        selected
                          ? "border-paper ring-1 ring-paper/60"
                          : "border-paper/20"
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    >
                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 border border-ink bg-paper"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className="panel-cut halftone-red flex flex-col justify-between gap-3 border border-paper/12 bg-ink-2/90 p-3.5"
            style={
              {
                "--noir-crimson": activeHex,
                "--color-crimson": activeHex,
              } as React.CSSProperties
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="kicker !text-[9px]">
                // {t("settings.theme.noirAccent.preview")}
              </span>
              <span className="stamp !px-2 !py-0.5 !text-[8px]">NOIR</span>
            </div>

            <div className="space-y-2">
              <div className="border-l-2 border-crimson bg-crimson/10 px-2.5 py-1.5 font-mono text-[10px] text-paper">
                --noir-crimson: <span className="text-crimson">{activeHex}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-crimson px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.14em] text-ink panel-cut-sm">
                <Sparkles size={11} />
                {t("settings.theme.noirAccent.previewAction")}
              </div>
            </div>

            <div className="h-[3px] w-full bg-[linear-gradient(90deg,var(--noir-crimson)_0_68%,var(--noir-gold)_68%_84%,transparent_84%)]" />
          </div>
        </div>
      </div>
    </Sec>
  );
};
