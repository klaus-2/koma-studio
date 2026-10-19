import type { ComponentType } from "react";
import { useFamilySkin } from "@koma/ui/themes/family-skins";
import { PasswordStrengthClassic } from "./PasswordStrengthClassic";
import { PasswordStrengthNoir } from "./noir/PasswordStrengthNoir";

interface PasswordStrengthProps {
  password: string;
}

export const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const Meter = useFamilySkin<ComponentType<PasswordStrengthProps>>({
    classic: PasswordStrengthClassic,
    noir: PasswordStrengthNoir,
  });

  return <Meter password={password} />;
};
