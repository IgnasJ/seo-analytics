import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import {
  deleteDomain,
  getDomain,
  updateDomainProperties,
  updateDomainCategory,
} from "@/lib/db/queries/domains"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const domainId = Number(id)
  const body = await req.json()
  const db = getDb()

  // Accept partial updates: GA4/GSC linkage and/or category reassignment.
  if ("ga4PropertyId" in body || "gscSiteUrl" in body) {
    updateDomainProperties(
      db,
      domainId,
      body.ga4PropertyId ?? null,
      body.gscSiteUrl ?? null
    )
  }
  if (typeof body.categoryId === "number") {
    updateDomainCategory(db, domainId, body.categoryId)
  }

  return NextResponse.json(getDomain(db, domainId))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  deleteDomain(db, Number(id))
  return new NextResponse(null, { status: 204 })
}
