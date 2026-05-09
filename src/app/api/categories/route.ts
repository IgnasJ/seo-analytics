import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { listCategories, createCategory } from "@/lib/db/queries/categories"

export function GET() {
  const db = getDb()
  return NextResponse.json(listCategories(db))
}

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }
  try {
    const db = getDb()
    const category = createCategory(db, name)
    return NextResponse.json(category, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/UNIQUE constraint/i.test(message)) {
      return NextResponse.json(
        { error: "A category with that name already exists" },
        { status: 409 }
      )
    }
    console.error("POST /api/categories failed:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
