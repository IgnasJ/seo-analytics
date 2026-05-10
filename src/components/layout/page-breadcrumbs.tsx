import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Link from "next/link"
import { Fragment } from "react"

export interface Crumb {
  label: string
  /** When omitted the crumb renders as the current page (no link). */
  href?: string
}

/**
 * Thin wrapper around shadcn's Breadcrumb primitives. Pass an ordered list
 * of crumbs from root → current page; the last one is rendered as the
 * active <BreadcrumbPage>, the rest as Next.js <Link> hops.
 *
 * Usage:
 *   <PageBreadcrumbs items={[
 *     { label: "Dashboard", href: "/" },
 *     { label: "Domains" },
 *   ]} />
 */
export function PageBreadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null
  return (
    <Breadcrumb className="mb-3">
      <BreadcrumbList>
        {items.map((c, i) => {
          const isLast = i === items.length - 1
          return (
            <Fragment key={i}>
              <BreadcrumbItem>
                {isLast || !c.href ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={c.href} />}>
                    {c.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
