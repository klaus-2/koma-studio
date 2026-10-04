import { useThemeStore } from "@koma/ui/stores/theme-store";
import { AuthSimpleShellClassic } from "./AuthSimpleShellClassic";
import { AuthSimpleShellNoir } from "./noir/AuthSimpleShellNoir";

interface AuthSimpleShellProps {
  title: string;
  subtitle: string;
  /** kicker word for the Noir shell; the classic shell ignores it */
  accent?: string;
  children: React.ReactNode;
}

/** Facade: picks the simple auth shell for the active theme family. */
export const AuthSimpleShell = ({ title, subtitle, accent, children }: AuthSimpleShellProps) => {
  const family = useThemeStore((s) => s.family);

  if (family === "noir") {
    return (
      <AuthSimpleShellNoir title={title} subtitle={subtitle} accent={accent}>
        {children}
      </AuthSimpleShellNoir>
    );
  }

  return (
    <AuthSimpleShellClassic title={title} subtitle={subtitle}>
      {children}
    </AuthSimpleShellClassic>
  );
};
