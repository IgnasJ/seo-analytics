"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

interface Props {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

/**
 * Callback-driven paginator wrapping shadcn's Pagination primitives. Use for
 * card-internal lists (sync history, audit history, etc.) where paging is
 * client state rather than URL-driven. Renders first / prev / page numbers
 * with ellipsis collapse / next / last buttons.
 *
 * Returns null when there's only one page so the component can be unconditionally
 * mounted at the bottom of any list.
 */
export function PageNav({ page, totalPages, onPageChange, disabled }: Props) {
  if (totalPages <= 1) return null
  const items = computePageItems(page, totalPages)

  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </Button>
        </PaginationItem>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
        </PaginationItem>
        {items.map((it, i) => (
          <PaginationItem key={`${it}-${i}`}>
            {it === "..." ? (
              <PaginationEllipsis />
            ) : (
              <Button
                variant={it === page ? "outline" : "ghost"}
                size="sm"
                onClick={() => onPageChange(it)}
                disabled={disabled}
                aria-label={`Page ${it}`}
                aria-current={it === page ? "page" : undefined}
                className="min-w-8"
              >
                {it}
              </Button>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </PaginationItem>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

/**
 * Build the list of page items to render. For small page counts (≤7) we
 * show every page number. Beyond that we show 1, the current page and its
 * one-page window, the last page, with "..." gaps where needed.
 */
export function computePageItems(
  page: number,
  totalPages: number
): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const items: (number | "...")[] = []
  const window = 1

  items.push(1)
  if (page > 2 + window) items.push("...")

  for (
    let p = Math.max(2, page - window);
    p <= Math.min(totalPages - 1, page + window);
    p++
  ) {
    items.push(p)
  }

  if (page < totalPages - 1 - window) items.push("...")
  items.push(totalPages)

  return items
}
