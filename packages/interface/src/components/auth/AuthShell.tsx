import { useThemeStore } from "@koma/ui/stores/theme-store";
import { AuthShellClassic } from "./AuthShellClassic";
import { AuthShellNoir } from "./noir/AuthShellNoir";

type AuthShellProps = React.ComponentProps<typeof AuthShellClassic>;

/** Facade: picks the auth shell for the active theme family. Props contract unchanged. */
export const AuthShell = (props: AuthShellProps) => {
  const family = useThemeStore((s) => s.family);

  return family === "noir" ? <AuthShellNoir {...props} /> : <AuthShellClassic {...props} />;
};