import { useThemeStore } from "@koma/ui/stores/theme-store";
import { useI18n } from "../../i18n";

interface ThemeFamilySwitchProps {
  variant?: "classic" | "noir";
}

export const ThemeFamilySwitch = ({ variant = "classic" }: ThemeFamilySwitchProps) => {
  const family = useThemeStore((s) => s.family);
  const setFamily = useThemeStore((s) => s.setFamily);
  const theme = useThemeStore((s) => s.theme);
  const { t } = useI18n();

  const nextIsNoir = family === "classic";
  const label = nextIsNoir ? t("auth.themeSwitch.toNoir") : t("auth.themeSwitch.toClassic");

  const className =
    variant === "noir"
      ? "fixed bottom-5 left-6 z-30 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/35 transition-colors hover:text-crimson"
      : `fixed bottom-5 left-6 z-30 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${theme === "light" ? "text-black/35 hover:text-black/70" : "text-white/35 hover:text-white/75"
      }`;

  return (
    <button type="button" className={className} onClick={() => setFamily(nextIsNoir ? "noir" : "classic")}>
      {label}
    </button>
  );
};
