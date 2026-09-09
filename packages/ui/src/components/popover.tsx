import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "../utils/cn";

let activePointerButtons = 0;

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => {
    activePointerButtons = e.buttons;
  }, true);
  window.addEventListener("pointerup", () => {
    activePointerButtons = 0;
  }, true);
  window.addEventListener("pointercancel", () => {
    activePointerButtons = 0;
  }, true);
}

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  style,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        updatePositionStrategy="always"
        style={{ zIndex: 230, ...style }}
        className={cn(
          "origin-(--radix-popover-content-transform-origin) animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        onInteractOutside={(event) => {
          if (activePointerButtons > 0) {
            event.preventDefault();
          }
        }}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
