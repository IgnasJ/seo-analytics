import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import {
  deleteDomain,
  getDomain,
  updateDomainProperties,
  updateDomainCategory,
} from "@/lib/db/queries/domains"
import { getCategory } from "@/lib/db/queries/categories"

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** A nullable string field from the request body: string, null, or invalid. */
function readNullableString(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null }
  if (typeof value === "string") return { ok: true, value }
  return { ok: false }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const domainId = parseId(id)
  if (domainId === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "JSON object required" }, { status: 400 })
  }

  const db = getDb()
  const domain = getDomain(db, domainId)
  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 })
  }

  // Accept partial updates: GA4/GSC linkage and/or category reassignment.
  // A field that isn't in the body keeps its stored value — sending only
  // `ga4PropertyId` used to wipe the Search Console link (and vice versa).
  if ("ga4PropertyId" in body || "gscSiteUrl" in body) {
    const ga4 =
      "ga4PropertyId" in body
        ? readNullableString(body.ga4PropertyId)
        : ({ ok: true, value: domain.ga4_property_id } as const)
    const gsc =
      "gscSiteUrl" in body
        ? readNullableString(body.gscSiteUrl)
        : ({ ok: true, value: domain.gsc_site_url } as const)
    if (!ga4.ok || !gsc.ok) {
      return NextResponse.json(
        { error: "ga4PropertyId and gscSiteUrl must be strings or null" },
        { status: 400 }
      )
    }
    updateDomainProperties(db, domainId, ga4.value, gsc.value)
  }

  if ("categoryId" in body) {
    const categoryId = body.categoryId
    if (typeof categoryId !== "number" || !getCategory(db, categoryId)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 })
    }
    updateDomainCategory(db, domainId, categoryId)
  }

  return NextResponse.json(getDomain(db, domainId))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const domainId = parseId(id)
  if (domainId === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }
  const db = getDb()
  deleteDomain(db, domainId)
  return new NextResponse(null, { status: 204 })
}
