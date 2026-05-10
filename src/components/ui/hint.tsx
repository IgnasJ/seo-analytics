"use client"

import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

/**
 * Inline tooltip helper. Renders the children inside a span trigger; the
 * tooltip pops on hover/focus with the (zero-delay) provider in the root
 * layout. For when you'd otherwise reach for a `title="..."` attribute but
 * want instant feedback instead of the browser's ~1.5 s delay.
 */
export function Hint({
  children,
  text,
  className,
  side = "top",
}: {
  children: ReactNode
  text: ReactNode
  className?: string
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={className}>{children}</span>} />
      <TooltipContent side={side} className="max-w-xs leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
