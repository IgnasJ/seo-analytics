import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import {
  renameCategory,
  reorderCategories,
  deleteCategory,
} from "@/lib/db/queries/categories"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const categoryId = Number(id)
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = await req.json()
  try {
    const db = getDb()
    if (typeof body.name === "string") {
      renameCategory(db, categoryId, body.name)
    }
    if (Array.isArray(body.reorder)) {
      // body.reorder = [{ id, sort_order }, ...] — useful for the drag-to-reorder UI
      reorderCategories(db, body.reorder)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/UNIQUE constraint/i.test(message)) {
      return NextResponse.json({ error: "Name already taken" }, { status: 409 })
    }
    console.error(`PATCH /api/categories/${id} failed:`, err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const categoryId = Number(id)
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }
  try {
    const db = getDb()
    deleteCategory(db, categoryId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`DELETE /api/categories/${id} failed:`, err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
