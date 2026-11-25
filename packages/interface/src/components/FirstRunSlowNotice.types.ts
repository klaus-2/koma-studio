export interface FirstRunNoticeController {
  dismiss: () => void;
  dontShowAgain: boolean;
  setDontShowAgain: (checked: boolean) => void;
}
