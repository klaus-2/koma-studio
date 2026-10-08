import { useThemeStore } from "@koma/ui/stores/theme-store";
import { CustomProviderProfileCardClassic } from "./CustomProviderProfileCardClassic";
import { CustomProviderProfileCard as CustomProviderProfileCardNoir } from "../noir-panels/CustomProviderProfileCardNoir";

export const CustomProviderProfileCard = (props: React.ComponentProps<typeof CustomProviderProfileCardClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === "noir" ? <CustomProviderProfileCardNoir {...props} /> : <CustomProviderProfileCardClassic {...props} />;
};

export default CustomProviderProfileCard;
