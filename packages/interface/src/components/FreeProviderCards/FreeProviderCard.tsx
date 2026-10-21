import { FreeProviderCardClassic } from "./FreeProviderCardClassic";
import { FreeProviderCard as FreeProviderCardNoir } from "../noir-panels/FreeProviderCardNoir";
import { createFamilyComponent } from "@koma/ui/themes/family-skins";

export const FreeProviderCard = createFamilyComponent(FreeProviderCardClassic, FreeProviderCardNoir);

export default FreeProviderCard;
