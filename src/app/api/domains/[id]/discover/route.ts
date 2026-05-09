import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getToken } from "@/lib/db/queries/tokens"
import { getValidAccessToken } from "@/lib/google/oauth"
import { discoverProperties } from "@/lib/google/search-console"
import { getDomain } from "@/lib/db/queries/domains"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const domain = getDomain(db, Number(id))
  if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 })

  const tokenRow = getToken(db)
  if (!tokenRow) return NextResponse.json({ error: "Not authenticated with Google" }, { status: 401 })

  try {
    const accessToken = await getValidAccessToken(tokenRow.refresh_token_encrypted)
    const result = await discoverProperties(accessToken)

    const matchingGsc = result.gscSites.filter(
      (s) => s.siteUrl.includes(domain.hostname) || s.siteUrl.replace("sc-domain:", "") === domain.hostname
    )

    return NextResponse.json({ ga4Properties: result.ga4Properties, gscSites: matchingGsc })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
