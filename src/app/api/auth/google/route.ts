import { NextResponse } from "next/server"
import { buildAuthUrl } from "@/lib/google/oauth"

export function GET() {
  return NextResponse.redirect(buildAuthUrl())
}
