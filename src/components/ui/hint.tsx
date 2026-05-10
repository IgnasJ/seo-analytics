"use client"

import type { CSSProperties, ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

/**
 * Inline tooltip helper. Renders the children inside a span trigger; the
 * tooltip pops on hover/focus with the (zero-delay) provider in the root
 * layout. For when you'd otherwise reach for a `title="..."` attribute but
 * want instant feedback instead of the browser's ~1.5 s delay.
 *
 * `style` is forwarded onto the trigger span — useful for chart segments
 * where the visual size (width / height / background) lives on the
 * tooltip-bearing element itself.
 */
export function Hint({
  children,
  text,
  className,
  style,
  side = "top",
}: {
  children: ReactNode
  text: ReactNode
  className?: string
  style?: CSSProperties
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={className} style={style}>{children}</span>}
      />
      <TooltipContent side={side} className="max-w-xs leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
