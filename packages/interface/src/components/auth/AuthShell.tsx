import type { ComponentType } from "react";
import { useFamilySkin } from "@koma/ui/themes/family-skins";
import { AuthShellClassic } from "./AuthShellClassic";
import { AuthShellNoir } from "./noir/AuthShellNoir";

type AuthShellProps = React.ComponentProps<typeof AuthShellClassic>;

export const AuthShell = (props: AuthShellProps) => {
  const Shell = useFamilySkin<ComponentType<AuthShellProps>>({
    classic: AuthShellClassic,
    noir: AuthShellNoir,
  });

  return <Shell {...props} />;
};