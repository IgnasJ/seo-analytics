"use client"

import { Hint } from "@/components/ui/hint"
import type { Severity } from "@/lib/seo/health"

const COLOUR: Record<Severity, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
}

interface Props {
  severity: Severity
  reasons: string[]
}

export function StatusDot({ severity, reasons }: Props) {
  return (
    <Hint
      text={
        <div className="space-y-0.5">
          {reasons.map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      }
      className="inline-flex"
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${COLOUR[severity]}`}
        aria-label={`status: ${severity}`}
      />
    </Hint>
  )
}
