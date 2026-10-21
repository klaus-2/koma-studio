import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "../utils/cn"
import { useThemeStore } from "../stores/theme-store"

const TOOLTIP_BASE_STYLE: React.CSSProperties = { zIndex: 220 }

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const family = useThemeStore((s) => s.family);
  const noir = family === "noir";
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={noir ? 4 : sideOffset}
        style={style ? { ...TOOLTIP_BASE_STYLE, ...style } : TOOLTIP_BASE_STYLE}
        className={cn(
          noir
            ? "w-fit max-w-xs border border-paper/18 bg-ink-2 px-3 py-2 text-[11px] leading-relaxed text-paper/80 " +
            "shadow-[4px_4px_0_rgba(255,46,99,0.5)] " +
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 " +
            "origin-(--radix-tooltip-content-transform-origin)"
            : "bg-popover text-popover-foreground border border-border/60 shadow-xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className={
            noir
              ? "z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 border border-paper/18 bg-ink-2 fill-ink-2"
              : "bg-popover fill-popover z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]"
          }
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
