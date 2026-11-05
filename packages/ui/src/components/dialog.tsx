import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

interface KomaDialogProps {
  open: boolean;
  onClose: () => void;
  layerClassName: string;
  modalClassName?: string;
  labelledBy?: string;
  label?: string;
  dismissable?: boolean;
  children: React.ReactNode;
}

export function KomaDialog({
  open,
  onClose,
  layerClassName,
  modalClassName,
  labelledBy,
  label,
  dismissable = true,
  children,
}: KomaDialogProps): React.JSX.Element {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className={layerClassName}
          aria-labelledby={labelledBy}
          aria-label={label}
          onEscapeKeyDown={(event) => {
            if (!dismissable) event.preventDefault();
          }}
          onPointerDown={(event) => {
            if (dismissable && event.target === event.currentTarget) onClose();
          }}
        >
          {modalClassName ? (
            <div className={modalClassName}>{children}</div>
          ) : (
            children
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
