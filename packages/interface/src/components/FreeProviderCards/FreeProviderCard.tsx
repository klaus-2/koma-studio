import { useThemeStore } from "@koma/ui/stores/theme-store";
import { FreeProviderCardClassic } from "./FreeProviderCardClassic";
import { FreeProviderCard as FreeProviderCardNoir } from "../noir-panels/FreeProviderCardNoir";

export const FreeProviderCard = (props: React.ComponentProps<typeof FreeProviderCardClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === "noir" ? <FreeProviderCardNoir {...props} /> : <FreeProviderCardClassic {...props} />;
};

export default FreeProviderCard;
