import { useThemeStore } from "@koma/ui/stores/theme-store";
import BugReportModalClassic from "./BugReportModalClassic";
import BugReportModalNoir from "./noir/BugReportModalNoir";

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  context?: {
    mode?: string;
    statusMessage?: string;
    route?: string;
    userEmail?: string;
  };
}

const BugReportModal = (props: BugReportModalProps) => {
  const family = useThemeStore((s) => s.family);
  return family === "noir" ? <BugReportModalNoir {...props} /> : <BugReportModalClassic {...props} />;
};

export default BugReportModal;
