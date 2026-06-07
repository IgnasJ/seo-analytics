"use client"

import Link from "next/link"
import { useState } from "react"

/**
 * A drop-in `<Link>` that defers prefetching until the user hovers (or
 * touches) the link, instead of prefetching as soon as it scrolls into the
 * viewport (Next's default).
 *
 * Why: the default behaviour fans out an RSC prefetch request for *every* link
 * in view. On persistent nav chrome (the sidebar) and long lists (dashboard
 * cards, audit history, the analytics leaderboard) that is a lot of prefetch
 * traffic — and on a constrained host, CPU — for routes the user may never
 * visit. Restricting prefetch to hover intent keeps navigation feeling instant
 * for links the user actually aims at while cutting the request volume.
 *
 * `prefetch={null}` (once hovered) restores Next's default/auto prefetch; until
 * then `prefetch={false}` disables it entirely. Pattern from the Next.js
 * prefetching guide (node_modules/next/dist/docs/01-app/02-guides/prefetching.md).
 */
export function HoverPrefetchLink({
  onMouseEnter,
  ...props
}: React.ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false)
  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(e) => {
        setActive(true)
        onMouseEnter?.(e)
      }}
    />
  )
}
