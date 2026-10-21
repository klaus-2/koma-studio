import BugReportModalClassic from "./BugReportModalClassic";
import BugReportModalNoir from "./noir/BugReportModalNoir";
import { createFamilyComponent } from "@koma/ui/themes/family-skins";

const BugReportModal = createFamilyComponent(BugReportModalClassic, BugReportModalNoir);

export default BugReportModal;
