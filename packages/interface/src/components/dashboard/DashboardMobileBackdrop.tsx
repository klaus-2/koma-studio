
interface DashboardMobileBackdropProps {
  visible: boolean;
  onClose: () => void;
}

export default function DashboardMobileBackdrop({
  visible,
  onClose,
}: DashboardMobileBackdropProps) {
  if (!visible) return null;

  return (
    <div
      className="koma-mobile-backdrop"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}
