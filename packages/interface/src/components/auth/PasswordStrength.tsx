import { useThemeStore } from "@koma/ui/stores/theme-store";
import { PasswordStrengthClassic } from "./PasswordStrengthClassic";
import { PasswordStrengthNoir } from "./noir/PasswordStrengthNoir";

interface PasswordStrengthProps {
  password: string;
}

export const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const family = useThemeStore((s) => s.family);

  return family === "noir" ? <PasswordStrengthNoir password={password} /> : <PasswordStrengthClassic password={password} />;
};
