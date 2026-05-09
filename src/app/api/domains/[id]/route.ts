import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { deleteDomain, getDomain, updateDomainProperties } from "@/lib/db/queries/domains"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const domainId = Number(id)
  const { ga4PropertyId, gscSiteUrl } = await req.json()
  const db = getDb()
  updateDomainProperties(db, domainId, ga4PropertyId ?? null, gscSiteUrl ?? null)
  return NextResponse.json(getDomain(db, domainId))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  deleteDomain(db, Number(id))
  return new NextResponse(null, { status: 204 })
}
