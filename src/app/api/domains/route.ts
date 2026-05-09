import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { listDomains, addDomain } from "@/lib/db/queries/domains"

export function GET() {
  const db = getDb()
  const domains = listDomains(db)
  return NextResponse.json(domains)
}

export async function POST(req: NextRequest) {
  const { hostname } = await req.json()
  if (!hostname || typeof hostname !== "string") {
    return NextResponse.json({ error: "hostname required" }, { status: 400 })
  }
  const clean = hostname.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
  try {
    const db = getDb()
    const domain = addDomain(db, clean)
    return NextResponse.json(domain, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Domain already exists" }, { status: 409 })
  }
}
