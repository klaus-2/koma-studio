import { CustomProviderProfileCardClassic } from "./CustomProviderProfileCardClassic";
import { CustomProviderProfileCard as CustomProviderProfileCardNoir } from "../noir-panels/CustomProviderProfileCardNoir";
import { createFamilyComponent } from "@koma/ui/themes/family-skins";

export const CustomProviderProfileCard = createFamilyComponent(CustomProviderProfileCardClassic, CustomProviderProfileCardNoir);

export default CustomProviderProfileCard;
