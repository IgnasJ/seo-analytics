"use client"

import { useState } from "react"
import { X } from "lucide-react"
import type { Audit, AuditResult } from "@/types/audit"
import { formatDateTime } from "@/lib/format"

interface Point {
  audit: Audit
  result: AuditResult
}

interface Props {
  points: Point[]
}

/**
 * Horizontally-scrolling strip of PSI final-screenshot thumbnails — one per
 * audit. Newest on the right (chronological), labelled by timestamp. Clicking
 * a thumbnail opens it in a lightbox overlay so the user can read the actual
 * pixels without leaving the page.
 */
export function ScreenshotStrip({ points }: Props) {
  // Chronological left-to-right; the page's audit list is newest-first.
  const withShots = [...points].reverse().filter((p) => p.result.screenshot)
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(
    null
  )

  if (withShots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No screenshots captured (older audits predate this feature; re-audit to
        record one).
      </p>
    )
  }

  return (
    <>
      <div className="-mx-3 sm:mx-0 overflow-x-auto scrollbar-thin">
        <div className="flex gap-3 px-3 sm:px-0 pb-2">
          {withShots.map((p) => {
            const src = p.result.screenshot!
            const label = formatDateTime(p.audit.requested_at)
            return (
              <button
                key={p.audit.id}
                type="button"
                onClick={() => setLightbox({ src, label })}
                className="shrink-0 text-left group"
                aria-label={`Open screenshot from ${label}`}
              >
                <div className="border rounded-md overflow-hidden bg-muted w-32 h-44 sm:w-36 sm:h-48 flex items-center justify-center group-hover:ring-2 group-hover:ring-primary transition">
                  {/* Next/Image won't accept a data URL via the optimised
                      pipeline, so we use a plain <img>. PSI screenshots are
                      already compressed JPEGs around 30 KB. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Screenshot from ${label}`}
                    className="object-contain w-full h-full"
                    loading="lazy"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 tabular-nums text-center">
                  {label}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-background border rounded-lg shadow-xl max-w-2xl max-h-[90vh] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-background/80 border flex items-center justify-center hover:bg-background"
              aria-label="Close screenshot"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.src}
              alt={`Screenshot from ${lightbox.label}`}
              className="max-w-full max-h-[80vh] object-contain"
            />
            <p className="text-xs text-muted-foreground text-center py-2 border-t">
              {lightbox.label}
            </p>
          </div>
        </div>
      )}
    </>
  )
}

